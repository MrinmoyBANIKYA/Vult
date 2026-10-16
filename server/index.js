// The Vult engine: a small local server that runs every model call for the app and recalculates workbooks.
//
//   npm run engine        http://127.0.0.1:8787 (the dev server proxies /engine to it)
//   npm run start         builds the app and serves it from the engine on one port
//
// It binds to 127.0.0.1 by default, keeps API keys on this machine, and with a local model (Ollama,
// LM Studio) no filing text leaves the machine at all.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  ANSWERED_BY,
  PROVIDERS,
  LlmError,
  completeJson,
  isLocal,
  listModels
} from '../supabase/functions/_shared/llm.js';
import {
  STATEMENT_KEYS,
  cleanFeedback,
  cleanMapping,
  mappingPrompt,
  mappingSchema,
  narrativePrompt,
  stripFigures
} from '../supabase/functions/_shared/statements.js';
import { activeConfig, providerConfig, publicSettings, saveSettings } from './settings.js';
import { findSoffice, recalcWorkbook } from './recalc.js';
import { deleteRun, getRun, listRuns, readPdf, savePdf, saveRun } from './runs.js';
import { authenticate } from './auth.js';
import { logRequest, queues } from './queue.js';
import { beta, fundamentals, fx, peer, quote, riskFree, searchCompanies } from './market.js';
import { annualFilingPdf } from './filings.js';

const ROOT = path.resolve(import.meta.dirname, '..');
for (const file of ['.env.local', '.env']) {
  try {
    if (fs.existsSync(path.join(ROOT, file))) process.loadEnvFile(path.join(ROOT, file));
  } catch {
    /* an unreadable env file is not fatal */
  }
}

const HOST = process.env.VULT_ENGINE_HOST || '127.0.0.1';
const PORT = Number(process.env.VULT_ENGINE_PORT || 8787);
const DIST = path.join(ROOT, 'dist');
const MAX_BODY = 25 * 1024 * 1024;
// Marks a handler result that is a file to send as is, not JSON.
const BINARY = Symbol('binary');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

/** Blocks other websites (and DNS rebinding) from driving the engine through the user's browser. */
function guard(req) {
  const allowRemote = process.env.VULT_ENGINE_ALLOW_REMOTE === '1';
  const hostname = (req.headers.host || '').replace(/:\d+$/, '');
  if (!allowRemote && !LOCAL_HOSTS.has(hostname)) throw new HttpError(403, 'The engine only answers on localhost');
  const origin = req.headers.origin;
  if (origin && !allowRemote) {
    let originHost = '';
    try {
      originHost = new URL(origin).hostname;
    } catch {
      /* treated as foreign */
    }
    if (!LOCAL_HOSTS.has(originHost) && !LOCAL_HOSTS.has(`[${originHost}]`))
      throw new HttpError(403, 'Requests from other sites are refused');
  }
}

async function readJson(req, maxBody = MAX_BODY) {
  if (!/application\/json/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Send JSON');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBody) throw new HttpError(413, 'Request is too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

/** The model a reply came from: a fallback when the chosen model's daily allowance ran out. */
const answeredBy = (config, reply) => (reply?.[ANSWERED_BY] ? { ...config, model: reply[ANSWERED_BY] } : config);

function describe(config) {
  return {
    provider: config.provider,
    label: PROVIDERS[config.provider]?.label ?? config.provider,
    model: config.model,
    local: isLocal(config)
  };
}

/* ------------------------------------------------------------------ routes */
const routes = {
  'GET /engine/health': async () => {
    const config = activeConfig();
    return {
      ok: true,
      llm: { ...describe(config), configured: Boolean(config.model) },
      libreoffice: Boolean(findSoffice()),
      queues: { model: queues.model.status(), recalc: queues.recalc.status() }
    };
  },

  'GET /engine/settings': async () => publicSettings(),

  'PUT /engine/settings': async req => saveSettings(await readJson(req)),

  'GET /engine/models': async (req, url) => {
    const provider = url.searchParams.get('provider') || activeConfig().provider;
    const config = providerConfig(provider);
    if (!config) throw new HttpError(400, 'Unknown provider');
    try {
      return { provider, models: await listModels(config) };
    } catch (error) {
      return { provider, models: [], error: error.message };
    }
  },

  'POST /engine/test': async () => {
    const config = activeConfig();
    const started = Date.now();
    const reply = await queues.model.run(() =>
      completeJson(config, {
        system: 'You are a health check. Reply with JSON only.',
        user: 'Return {"ok": true, "word": "ready"}.',
        schema: { type: 'object', properties: { ok: { type: 'boolean' }, word: { type: 'string' } }, required: ['ok'] },
        maxTokens: 50
      })
    );
    return { ...describe(answeredBy(config, reply)), ok: reply?.ok === true, ms: Date.now() - started };
  },

  'POST /engine/map-rows': async req => {
    const { statement, rows, feedback } = await readJson(req);
    if (!STATEMENT_KEYS[statement]) throw new HttpError(400, 'Unknown statement');
    if (!Array.isArray(rows) || !rows.length || rows.length > 250)
      throw new HttpError(400, 'Send between 1 and 250 rows');
    const clean = rows.map(row => ({
      id: Number(row.id),
      section: String(row.section ?? '').slice(0, 80),
      label: String(row.label ?? '').slice(0, 200),
      values: (Array.isArray(row.values) ? row.values : []).slice(0, 8).map(value => String(value).slice(0, 20))
    }));
    const config = activeConfig();
    const started = Date.now();
    const { system, user } = mappingPrompt(statement, clean, cleanFeedback(feedback));
    const reply = await queues.model.run(() =>
      completeJson(config, {
        system,
        user,
        schema: mappingSchema(statement),
        maxTokens: 1500
      })
    );
    const mapping = cleanMapping(
      statement,
      reply?.mapping ?? reply,
      clean.map(row => row.id)
    );
    return { mapping, ...describe(answeredBy(config, reply)), ms: Date.now() - started };
  },

  'POST /engine/narrative': async req => {
    const { company, business, risks } = await readJson(req);
    const config = activeConfig();
    const started = Date.now();
    const prompt = narrativePrompt({
      company: String(company ?? '').slice(0, 120),
      business: String(business ?? '').slice(0, 8000),
      risks: String(risks ?? '').slice(0, 10000)
    });
    const reply = await queues.model.run(() => completeJson(config, { ...prompt, maxTokens: 1500, temperature: 0.2 }));
    return {
      business: stripFigures(reply?.business),
      risks: (Array.isArray(reply?.risks) ? reply.risks : []).map(stripFigures).filter(Boolean).slice(0, 6),
      ...describe(answeredBy(config, reply)),
      ms: Date.now() - started
    };
  },

  'POST /engine/recalc': async req => {
    const { xlsx, cells } = await readJson(req);
    if (typeof xlsx !== 'string' || !Array.isArray(cells)) throw new HttpError(400, 'Send { xlsx: base64, cells: [] }');
    return queues.recalc.run(() => recalcWorkbook(Buffer.from(xlsx, 'base64'), cells.slice(0, 500).map(String)));
  }
};

/* ------------------------------------------------------------------ free market data */
routes['GET /engine/market/quote'] = async (req, url) => quote(url.searchParams.get('symbol'));
routes['GET /engine/market/beta'] = async (req, url) =>
  beta(url.searchParams.get('symbol'), url.searchParams.get('index') || undefined);
routes['GET /engine/market/riskfree'] = async (req, url) => riskFree(url.searchParams.get('country'));
routes['GET /engine/market/fundamentals'] = async (req, url) =>
  fundamentals(url.searchParams.get('ticker'), url.searchParams.get('name') || undefined);
routes['GET /engine/market/fx'] = async (req, url) => fx(url.searchParams.get('from'), url.searchParams.get('to'));
routes['GET /engine/market/peer'] = async (req, url) => peer(url.searchParams.get('ticker'));

/* ------------------------------------------------------------------ real filings from SEC EDGAR */
routes['GET /engine/companies'] = async (req, url) => searchCompanies(url.searchParams.get('q'));
routes['GET /engine/filings/annual'] = async (req, url) => {
  const { filing, bytes } = await annualFilingPdf(url.searchParams.get('ticker'));
  return {
    [BINARY]: bytes,
    type: 'application/pdf',
    headers: { 'x-vult-filing': encodeURIComponent(JSON.stringify(filing)) }
  };
};

/* ------------------------------------------------------------------ saved Filing desk runs */
routes['GET /engine/runs'] = async () => ({ runs: listRuns() });

// Routes with a run id in the path: [method, pattern, handler(req, url, id)].
const RUN = '([a-z0-9-]{8,64})';
const paramRoutes = [
  ['GET', new RegExp(`^/engine/runs/${RUN}$`), async (req, url, id) => getRun(id)],
  ['PUT', new RegExp(`^/engine/runs/${RUN}$`), async (req, url, id) => saveRun(id, await readJson(req))],
  ['DELETE', new RegExp(`^/engine/runs/${RUN}$`), async (req, url, id) => deleteRun(id)],
  // A PDF of up to 80 MB arrives as base64 JSON.
  [
    'PUT',
    new RegExp(`^/engine/runs/${RUN}/pdf$`),
    async (req, url, id) => savePdf(id, (await readJson(req, 120 * 1024 * 1024)).pdf)
  ],
  [
    'GET',
    new RegExp(`^/engine/runs/${RUN}/pdf$`),
    async (req, url, id) => ({ [BINARY]: readPdf(id), type: 'application/pdf' })
  ]
];

function findRoute(method, pathname) {
  const exact = routes[`${method} ${pathname}`];
  if (exact) return (req, url) => exact(req, url);
  for (const [m, pattern, handler] of paramRoutes) {
    const match = m === method && pattern.exec(pathname);
    if (match) return (req, url) => handler(req, url, match[1]);
  }
  return null;
}

/* ------------------------------------------------------------------ static app (npm run start) */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip'
};

function serveStatic(res, url) {
  if (!fs.existsSync(DIST)) return send(res, 404, { error: 'Run `npm run build` first, or use `npm run dev`.' });
  const requested = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)));
  const file =
    requested.startsWith(DIST) && fs.existsSync(requested) && fs.statSync(requested).isFile()
      ? requested
      : path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

/* ------------------------------------------------------------------ server */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const started = Date.now();
  let who = null;
  res.on('finish', () =>
    logRequest({
      method: req.method,
      path: url.pathname,
      status: res.statusCode,
      ms: Date.now() - started,
      user: who?.user
    })
  );
  try {
    guard(req);
    if (!url.pathname.startsWith('/engine/')) {
      if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
      return serveStatic(res, url);
    }
    // Deployed engines check who is calling; on a laptop this returns null.
    who = await authenticate(req);
    const handler = findRoute(req.method, url.pathname);
    if (!handler) throw new HttpError(404, 'Not found');
    const body = await handler(req, url);
    if (body?.[BINARY]) {
      res.writeHead(200, { 'content-type': body.type, 'cache-control': 'no-store', ...body.headers });
      return res.end(body[BINARY]);
    }
    send(res, 200, body);
  } catch (error) {
    const status = error instanceof HttpError || error instanceof LlmError ? error.status : error.status || 500;
    if (status >= 500) console.error(`[engine] ${req.method} ${url.pathname}:`, error.message);
    send(res, status, { error: error.message || 'Engine error' });
  }
});

server.listen(PORT, HOST, () => {
  const config = activeConfig();
  const where = isLocal(config) ? 'local' : 'hosted';
  console.log(`Vult engine on http://${HOST}:${PORT}`);
  console.log(`  model: ${PROVIDERS[config.provider]?.label} ${config.model} (${where})`);
  console.log(`  LibreOffice: ${findSoffice() ? 'found' : 'not found (workbook recalculation check disabled)'}`);
});
