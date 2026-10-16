// POST /functions/v1/extract-10k
// Body: { statement: 'income' | 'balance' | 'cashflow', rows: [{ id, section, label, values }] }
// Returns { mapping: { key: [rowId] } }: which printed row is which standard line item.
//
// Same contract as the local engine's /engine/map-rows. The model only classifies rows; the browser reads
// every number from the PDF text itself, so nothing a model returns becomes a figure without a check.
// The provider comes from VULT_LLM_PROVIDER (anthropic, groq, openai, gemini, openrouter, ollama, custom).
import { json, preflight, readJson } from '../_shared/http.ts';
import { userClient } from '../_shared/supabase.ts';
import { LlmError, completeJson, configFromEnv } from '../_shared/llm.js';
import { STATEMENT_KEYS, cleanMapping, mappingPrompt, mappingSchema } from '../_shared/statements.js';

interface Row {
  id: number;
  section: string;
  label: string;
  values: string[];
}

Deno.serve(async req => {
  const early = preflight(req);
  if (early) return early;

  const supabase = userClient(req);
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'Sign in to extract an annual report' }, 401);

  const body = await readJson<{ statement?: unknown; rows?: unknown }>(req);
  const statement = typeof body?.statement === 'string' ? body.statement : '';
  if (!(statement in STATEMENT_KEYS)) return json({ error: 'Unknown statement' }, 400);
  if (!Array.isArray(body?.rows) || !body.rows.length || body.rows.length > 250) return json({ error: 'Send between 1 and 250 rows' }, 400);
  const rows: Row[] = (body.rows as Record<string, unknown>[]).map(row => ({
    id: Number(row.id),
    section: String(row.section ?? '').slice(0, 80),
    label: String(row.label ?? '').slice(0, 200),
    values: (Array.isArray(row.values) ? row.values : []).slice(0, 8).map(value => String(value).slice(0, 20))
  }));

  const config = configFromEnv((name: string) => Deno.env.get(name));
  try {
    const { system, user: prompt } = mappingPrompt(statement, rows);
    const reply = await completeJson(config, { system, user: prompt, schema: mappingSchema(statement), maxTokens: 1500 });
    const mapping = cleanMapping(statement, reply?.mapping ?? reply, rows.map(row => row.id));
    return json({ mapping, provider: config.provider, label: config.provider, model: config.model, local: false });
  } catch (error) {
    console.error('extract-10k:', error instanceof Error ? error.message : error);
    const status = error instanceof LlmError && error.status < 500 ? error.status : 502;
    return json({ error: 'The model request failed' }, status);
  }
});
