// Model provider settings for the engine. Saved to .vult/engine.json (git-ignored) on this machine.
// Environment variables give the defaults; anything saved from the app overrides them.
import fs from 'node:fs';
import path from 'node:path';
import { PROVIDERS, configFromEnv } from '../supabase/functions/_shared/llm.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const FILE = path.join(ROOT, '.vult', 'engine.json');

const env = name => process.env[name] || '';

function readFile() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeFile(data) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

/** Full config for one provider, with its key. Never send this to the browser. */
export function providerConfig(provider) {
  const preset = PROVIDERS[provider];
  if (!preset) return null;
  const saved = readFile().providers?.[provider] ?? {};
  const fromEnv = configFromEnv(env);
  const envMatches = fromEnv.provider === provider;
  return {
    provider,
    model: saved.model || (envMatches ? fromEnv.model : '') || preset.defaultModel,
    baseUrl:
      saved.baseUrl ||
      (envMatches ? fromEnv.baseUrl : '') ||
      (provider === 'ollama' && env('OLLAMA_HOST')) ||
      preset.baseUrl,
    apiKey: saved.apiKey || (preset.keyEnv ? env(preset.keyEnv) : '') || (envMatches ? fromEnv.apiKey : '')
  };
}

export function activeProvider() {
  return readFile().provider || configFromEnv(env).provider;
}

export const activeConfig = () => providerConfig(activeProvider());

/** Settings safe to show in the app: keys are reduced to "set" or "not set". */
export function publicSettings() {
  return {
    provider: activeProvider(),
    providers: Object.fromEntries(
      Object.entries(PROVIDERS).map(([id, preset]) => {
        const config = providerConfig(id);
        return [
          id,
          {
            label: preset.label,
            local: preset.local,
            note: preset.note,
            needsKey: Boolean(preset.keyEnv) && id !== 'custom',
            model: config.model,
            baseUrl: config.baseUrl,
            hasKey: Boolean(config.apiKey),
            keyHint: config.apiKey ? `…${config.apiKey.slice(-4)}` : ''
          }
        ];
      })
    )
  };
}

/** Saves a provider choice. An empty apiKey keeps the saved key; null removes it. */
export function saveSettings({ provider, model, baseUrl, apiKey }) {
  if (!PROVIDERS[provider]) throw Object.assign(new Error(`Unknown provider "${provider}"`), { status: 400 });
  const data = readFile();
  data.provider = provider;
  data.providers ??= {};
  const current = data.providers[provider] ?? {};
  const next = { ...current };
  if (typeof model === 'string') next.model = model.trim();
  if (typeof baseUrl === 'string') next.baseUrl = baseUrl.trim();
  if (apiKey === null) delete next.apiKey;
  else if (typeof apiKey === 'string' && apiKey.trim()) next.apiKey = apiKey.trim();
  data.providers[provider] = next;
  writeFile(data);
  return publicSettings();
}
