// Provider-agnostic LLM calls for Vult. Plain JavaScript with fetch only, so the same file runs in the
// Node engine (server/) and in Deno edge functions.
//
// Three wire formats cover every supported provider:
//   ollama     Ollama's native /api/chat (local models, and Ollama cloud models)
//   openai     any OpenAI-compatible /chat/completions (Groq, OpenRouter, Gemini, OpenAI, LM Studio, vLLM)
//   anthropic  the Anthropic Messages API

/** Provider presets. `local` means prompts never leave the machine the engine runs on. */
export const PROVIDERS = {
  ollama: {
    label: 'Ollama',
    wire: 'ollama',
    local: true,
    baseUrl: 'http://127.0.0.1:11434',
    keyEnv: null,
    defaultModel: 'qwen3:8b',
    note: 'Runs on this machine. Install from ollama.com, then `ollama pull qwen3:8b`.'
  },
  lmstudio: {
    label: 'LM Studio',
    wire: 'openai',
    local: true,
    baseUrl: 'http://127.0.0.1:1234/v1',
    keyEnv: null,
    defaultModel: '',
    jsonMode: 'schema',
    note: 'Runs on this machine. Start the LM Studio server and load a model.'
  },
  groq: {
    label: 'Groq',
    wire: 'openai',
    local: false,
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    defaultModel: 'openai/gpt-oss-120b',
    jsonMode: 'object',
    note: 'Hosted, free tier with rate limits. Key from console.groq.com.'
  },
  openrouter: {
    label: 'OpenRouter',
    wire: 'openai',
    local: false,
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    defaultModel: '',
    jsonMode: 'object',
    note: 'Hosted, many models including free ones. Key from openrouter.ai.'
  },
  gemini: {
    label: 'Google Gemini',
    wire: 'openai',
    local: false,
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.5-flash',
    jsonMode: 'object',
    note: 'Hosted, free tier with rate limits. Key from aistudio.google.com.'
  },
  openai: {
    label: 'OpenAI',
    wire: 'openai',
    local: false,
    baseUrl: 'https://api.openai.com/v1',
    keyEnv: 'OPENAI_API_KEY',
    defaultModel: '',
    jsonMode: 'schema',
    note: 'Hosted, paid. Key from platform.openai.com.'
  },
  anthropic: {
    label: 'Anthropic',
    wire: 'anthropic',
    local: false,
    baseUrl: 'https://api.anthropic.com',
    keyEnv: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-5-5',
    note: 'Hosted, paid. Key from console.anthropic.com.'
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    wire: 'openai',
    local: false,
    baseUrl: '',
    keyEnv: 'VULT_LLM_API_KEY',
    defaultModel: '',
    jsonMode: 'object',
    note: 'Any OpenAI-compatible endpoint, such as vLLM or a private deployment.'
  }
};

export class LlmError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const trimSlash = url => String(url || '').replace(/\/+$/, '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Ollama cloud models (name ending in "cloud") run on ollama.com, so they are not local. */
export function isLocal(config) {
  const preset = PROVIDERS[config.provider];
  if (!preset) return false;
  if (config.provider === 'ollama') return !/[-:]cloud$/i.test(config.model || '');
  if (config.provider === 'custom') return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/i.test(config.baseUrl || '');
  return preset.local;
}

/** Fills in preset defaults. `config` is { provider, model, baseUrl, apiKey }. */
export function resolveConfig(config) {
  const preset = PROVIDERS[config?.provider];
  if (!preset) throw new LlmError(`Unknown model provider "${config?.provider}"`, 400);
  const resolved = {
    provider: config.provider,
    wire: preset.wire,
    model: config.model || preset.defaultModel,
    baseUrl: trimSlash(config.baseUrl || preset.baseUrl),
    apiKey: config.apiKey || '',
    jsonMode: preset.jsonMode || 'object',
    numCtx: config.numCtx || 16384
  };
  if (!resolved.baseUrl) throw new LlmError('Set a base URL for this provider', 400);
  if (!resolved.model) throw new LlmError('Choose a model for this provider', 400);
  if (preset.keyEnv && !resolved.apiKey && config.provider !== 'custom')
    throw new LlmError(`Add an API key for ${preset.label}`, 400);
  return resolved;
}

/** Retries rate limits and transient failures; hosted free tiers return 429 often. */
async function send(url, init, { timeoutMs = 300_000, attempts = 4 } = {}) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (cause) {
      clearTimeout(timer);
      const reason = cause?.name === 'AbortError' ? 'timed out' : cause?.cause?.code || cause?.message || 'failed';
      last = new LlmError(`Could not reach the model server at ${new URL(url).origin} (${reason})`, 503);
      if (attempt < attempts && cause?.name !== 'AbortError') {
        await sleep(1000 * attempt);
        continue;
      }
      throw last;
    }
    clearTimeout(timer);
    if (response.ok) return response;

    const body = await response.text();
    const detail = body.slice(0, 400);
    if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
      const header = Number(response.headers.get('retry-after'));
      const hinted = Number(/try again in ([\d.]+)s/i.exec(body)?.[1]);
      const wait = Math.min(60_000, 1000 * (header || hinted || 2 ** attempt));
      last = new LlmError(`Model server returned ${response.status}: ${detail}`, response.status);
      await sleep(wait);
      continue;
    }
    // 400 and 422 pass through so callers can retry with a looser request; other failures are the server's.
    const status = [400, 401, 422].includes(response.status) ? response.status : 502;
    throw new LlmError(`Model server returned ${response.status}: ${detail}`, status);
  }
  throw last;
}

/** Pulls the first JSON object out of a reply, tolerating code fences and thinking blocks. */
export function parseJsonReply(text) {
  const cleaned = String(text ?? '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
  }
  throw new LlmError('The model did not return valid JSON', 422);
}

async function ollamaChat(cfg, { system, user, schema, maxTokens, temperature }) {
  const body = {
    model: cfg.model,
    stream: false,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    options: { temperature, num_ctx: cfg.numCtx, num_predict: maxTokens }
  };
  if (schema) body.format = schema;
  // Reasoning models (qwen3, deepseek-r1) think before answering; for extraction that only adds latency.
  body.think = false;
  let response;
  try {
    response = await send(`${cfg.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    // Models without a thinking mode reject the flag on some Ollama versions.
    if (!/think/i.test(error.message)) throw error;
    delete body.think;
    response = await send(`${cfg.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  }
  const result = await response.json();
  return result.message?.content ?? '';
}

async function openaiChat(cfg, { system, user, schema, maxTokens, temperature }) {
  const headers = { 'content-type': 'application/json' };
  if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;
  if (cfg.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://vult.local';
    headers['X-Title'] = 'Vult';
  }
  // gpt-oss reasons before it answers: keep that short and leave room for it, or the answer comes back empty.
  const reasons = /gpt-oss/i.test(cfg.model);
  const base = {
    model: cfg.model,
    temperature,
    max_tokens: reasons ? maxTokens + 4096 : maxTokens,
    ...(reasons ? { reasoning_effort: 'low' } : {}),
    messages: [
      {
        role: 'system',
        content: schema ? `${system}\n\nReply with one JSON object only, matching this JSON schema:\n${JSON.stringify(schema)}` : system
      },
      { role: 'user', content: user }
    ]
  };
  const formats = !schema
    ? [null]
    : cfg.jsonMode === 'schema'
      ? [{ type: 'json_schema', json_schema: { name: 'result', schema, strict: false } }, { type: 'json_object' }, null]
      : [{ type: 'json_object' }, null];

  let lastError;
  for (const format of formats) {
    try {
      const response = await send(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(format ? { ...base, response_format: format } : base)
      });
      const result = await response.json();
      return result.choices?.[0]?.message?.content ?? '';
    } catch (error) {
      // Some servers reject a response_format they do not support; try the next, looser one.
      lastError = error;
      if (error.status !== 400 && error.status !== 422) throw error;
    }
  }
  throw lastError;
}

async function anthropicChat(cfg, { system, user, schema, maxTokens, temperature }) {
  const body = { model: cfg.model, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: user }] };
  if (schema) {
    body.tools = [{ name: 'submit', description: 'Submit the result.', input_schema: schema }];
    body.tool_choice = { type: 'tool', name: 'submit' };
  }
  const response = await send(`${cfg.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (schema) {
    const tool = (result.content ?? []).find(block => block.type === 'tool_use');
    if (tool) return JSON.stringify(tool.input);
  }
  return (result.content ?? [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');
}

const WIRES = { ollama: ollamaChat, openai: openaiChat, anthropic: anthropicChat };

/** Plain text completion. */
export async function completeText(config, { system, user, maxTokens = 1200, temperature = 0.2 }) {
  const cfg = resolveConfig(config);
  const text = await WIRES[cfg.wire](cfg, { system, user, maxTokens, temperature });
  return String(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

/** Structured completion: returns the parsed JSON object. */
export async function completeJson(config, { system, user, schema, maxTokens = 2000, temperature = 0 }) {
  const cfg = resolveConfig(config);
  const text = await WIRES[cfg.wire](cfg, { system, user, schema, maxTokens, temperature });
  return parseJsonReply(text);
}

/** Lists the models a provider offers, for the model picker. */
export async function listModels(config) {
  const preset = PROVIDERS[config?.provider];
  if (!preset) throw new LlmError(`Unknown model provider "${config?.provider}"`, 400);
  const baseUrl = trimSlash(config.baseUrl || preset.baseUrl);
  if (!baseUrl) return [];
  if (preset.wire === 'ollama') {
    const response = await send(`${baseUrl}/api/tags`, {}, { timeoutMs: 8000, attempts: 1 });
    const result = await response.json();
    return (result.models ?? []).map(model => ({
      id: model.name,
      size: model.size || null,
      local: !/[-:]cloud$/i.test(model.name)
    }));
  }
  const headers = {};
  if (preset.wire === 'anthropic') {
    if (!config.apiKey) return [];
    headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    const response = await send(`${baseUrl}/v1/models`, { headers }, { timeoutMs: 10_000, attempts: 1 });
    return ((await response.json()).data ?? []).map(model => ({ id: model.id }));
  }
  if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
  else if (preset.keyEnv && config.provider !== 'custom') return [];
  const response = await send(`${baseUrl}/models`, { headers }, { timeoutMs: 10_000, attempts: 1 });
  const result = await response.json();
  return (result.data ?? result.models ?? [])
    .map(model => ({ id: String(model.id ?? model.name ?? '').replace(/^models\//, '') }))
    .filter(model => model.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Reads provider settings from environment variables (edge functions and engine defaults). */
export function configFromEnv(getEnv) {
  const provider = getEnv('VULT_LLM_PROVIDER') || (getEnv('ANTHROPIC_API_KEY') ? 'anthropic' : 'ollama');
  const preset = PROVIDERS[provider] ?? PROVIDERS.ollama;
  return {
    provider,
    model: getEnv('VULT_LLM_MODEL') || getEnv('VULT_MODEL') || preset.defaultModel,
    baseUrl: getEnv('VULT_LLM_BASE_URL') || (provider === 'ollama' && getEnv('OLLAMA_HOST')) || preset.baseUrl,
    apiKey: getEnv('VULT_LLM_API_KEY') || (preset.keyEnv ? getEnv(preset.keyEnv) : '') || ''
  };
}
