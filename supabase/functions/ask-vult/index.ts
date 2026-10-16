// POST /functions/v1/ask-vult
// Body: { engagement_id: string, question: string }
// Answers a question about one engagement using only its traced evidence.
// The model comes from VULT_LLM_PROVIDER (anthropic, groq, openai, gemini, openrouter, ollama, custom) and
// VULT_LLM_MODEL; see _shared/llm.js. Returns { text, cites, think }. With no provider configured it returns
// 501 and the app uses its built-in answer.
import { json, preflight, readJson } from '../_shared/http.ts';
import { userClient } from '../_shared/supabase.ts';
import { completeText, configFromEnv } from '../_shared/llm.js';

interface Body {
  engagement_id?: unknown;
  question?: unknown;
}

interface EvidenceRow {
  key: string;
  label: string;
  value: string;
  extract: string | null;
  reconciliation: string | null;
  page_ref: string | null;
  documents: { title: string; publisher: string | null } | null;
}

Deno.serve(async req => {
  const early = preflight(req);
  if (early) return early;

  const supabase = userClient(req);
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'Sign in to ask Vult' }, 401);

  const body = await readJson<Body>(req);
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  const engagementId = typeof body?.engagement_id === 'string' ? body.engagement_id : '';
  if (!engagementId) return json({ error: 'engagement_id is required' }, 400);
  if (!question || question.length > 2000) return json({ error: 'Ask a question of up to 2,000 characters' }, 400);

  const { data: engagement } = await supabase
    .from('engagements')
    .select('id, org_id, name, target_label, type')
    .eq('id', engagementId)
    .maybeSingle();
  if (!engagement) return json({ error: 'Engagement not found' }, 404);

  if (!Deno.env.get('VULT_LLM_PROVIDER') && !Deno.env.get('ANTHROPIC_API_KEY'))
    return json({ error: 'No model provider is configured for this project' }, 501);
  const config = configFromEnv((name: string) => Deno.env.get(name));
  if (!['ollama', 'custom'].includes(config.provider) && !config.apiKey)
    return json({ error: `No API key is set for ${config.provider}` }, 501);

  const { data } = await supabase
    .from('evidence')
    .select('key, label, value, extract, reconciliation, page_ref, documents(title, publisher)')
    .eq('engagement_id', engagementId)
    .order('key')
    .limit(80);
  const evidence = (data ?? []) as unknown as EvidenceRow[];

  const sources = evidence
    .map((e, i) => {
      const where = [e.documents?.title, e.page_ref].filter(Boolean).join(', ');
      return `[${i + 1}] ${e.label}: ${e.value}. ${e.extract ?? ''}${e.reconciliation ? ` Check: ${e.reconciliation}.` : ''} (${where || 'source on file'})`;
    })
    .join('\n');

  const system = [
    `You are Vult, the analyst co-pilot on ${engagement.name}: a ${engagement.type.toLowerCase()} of ${engagement.target_label}.`,
    'Write for an investment committee: plain English, short sentences, no hype.',
    'Use only the numbered sources for figures and cite them like [2]. If the sources do not answer the question, say so and name the document that would.',
    'Keep the answer under 180 words. Put the key figure in **bold**. Start bullet lines with "• ".',
    '',
    'Sources:',
    sources || '(no traced figures yet)'
  ].join('\n');

  let raw: string;
  try {
    raw = await completeText(config, { system, user: question, maxTokens: 700 });
  } catch (error) {
    console.error('ask-vult: model request failed', error instanceof Error ? error.message : error);
    return json({ error: 'The model request failed' }, 502);
  }
  const cites = [...new Set([...raw.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1])))]
    .map(n => evidence[n - 1]?.key)
    .filter(Boolean);
  // Citations are shown as source chips under the answer, so the inline markers are removed.
  const text = raw.replace(/\s?\[\d+\]/g, '');

  await supabase.from('copilot_messages').insert([
    { org_id: engagement.org_id, engagement_id: engagementId, role: 'user', content: question },
    { org_id: engagement.org_id, engagement_id: engagementId, role: 'assistant', content: text }
  ]);

  return json({
    text,
    cites,
    think: [
      `Reading ${evidence.length} traced figures in ${engagement.name}`,
      'Matching your question to the evidence',
      'Checking each figure against its source'
    ]
  });
});
