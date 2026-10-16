import assert from 'node:assert/strict';
import test from 'node:test';
import { ANSWERED_BY, completeJson } from '../../supabase/functions/_shared/llm.js';

test('a used-up daily allowance moves to the next model at once, and says which one answered', async () => {
  const asked = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const { model } = JSON.parse(init.body);
    asked.push(model);
    if (model === 'openai/gpt-oss-120b')
      return new Response(
        JSON.stringify({ error: { message: 'Rate limit reached on tokens per day (TPD): Limit 200000' } }),
        { status: 429 }
      );
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok": true}' } }] }), { status: 200 });
  };
  try {
    const reply = await completeJson(
      { provider: 'groq', model: 'openai/gpt-oss-120b', apiKey: 'test' },
      { system: 's', user: 'u', schema: { type: 'object' } }
    );
    assert.equal(reply.ok, true);
    assert.equal(reply[ANSWERED_BY], 'openai/gpt-oss-20b');
    assert.deepEqual(asked, ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
  } finally {
    globalThis.fetch = realFetch;
  }
});
