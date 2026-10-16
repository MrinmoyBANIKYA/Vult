import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import test from 'node:test';
import { authenticate, verifySupabaseToken } from './auth.js';
import { queue } from './queue.js';

const b64 = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
const hs256 = (claims, secret) => {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(claims);
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
};
const future = () => Math.floor(Date.now() / 1000) + 600;

test('verifies a Supabase token and rejects tampered, expired or anonymous ones', async () => {
  const secret = 'test-secret-that-is-long-enough';
  const good = hs256({ sub: 'user-1', aud: 'authenticated', exp: future() }, secret);
  assert.equal((await verifySupabaseToken(good, { jwtSecret: secret })).sub, 'user-1');
  await assert.rejects(verifySupabaseToken(good, { jwtSecret: 'other' }), /signature/);
  await assert.rejects(
    verifySupabaseToken(hs256({ sub: 'u', aud: 'authenticated', exp: 1 }, secret), { jwtSecret: secret }),
    /expired/
  );
  await assert.rejects(
    verifySupabaseToken(hs256({ sub: 'u', aud: 'anon', exp: future() }, secret), { jwtSecret: secret }),
    /signed-in/
  );
});

test('verifies an ES256 token against a signing key', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
  const head = b64({ alg: 'ES256', kid: 'k1' });
  const body = b64({ sub: 'user-2', aud: 'authenticated', exp: future() });
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }));
  try {
    const claims = await verifySupabaseToken(`${head}.${body}.${sig.toString('base64url')}`, {
      supabaseUrl: 'https://x.supabase.co'
    });
    assert.equal(claims.sub, 'user-2');
  } finally {
    globalThis.fetch = original;
  }
});

test('a laptop engine needs no sign-in; a deployed one does', async () => {
  assert.equal(await authenticate({ headers: {} }, {}), null);
  const env = { VULT_ENGINE_ALLOW_REMOTE: '1', VULT_ENGINE_TOKEN: 'shared-token' };
  await assert.rejects(authenticate({ headers: {} }, env), /Sign in/);
  assert.equal((await authenticate({ headers: { authorization: 'Bearer shared-token' } }, env)).kind, 'token');
});

test('a queue runs one job at a time and refuses work when full', async () => {
  const q = queue('test', { concurrency: 1, limit: 1 });
  let running = 0;
  let peak = 0;
  const job = () =>
    q.run(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise(r => setTimeout(r, 20));
      running -= 1;
    });
  const first = job();
  const second = job();
  await assert.rejects(job(), /busy/);
  await Promise.all([first, second]);
  assert.equal(peak, 1);
});
