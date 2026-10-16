// Who may call the engine. On a laptop (the default) the engine answers only on localhost and needs no
// sign-in. Deployed on a server (VULT_ENGINE_ALLOW_REMOTE=1) every request must carry either:
//
//   Authorization: Bearer <Supabase access token>   checked against the project's signing keys (JWKS) or
//                                                    its legacy JWT secret; expiry and audience enforced
//   Authorization: Bearer <VULT_ENGINE_TOKEN>        a shared secret for scripts and the Excel add-in
//
// Only Node's crypto is used; no token library.
import crypto from 'node:crypto';
import process from 'node:process';

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.status = 401;
  }
}

const b64url = text => Buffer.from(String(text).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const decodePart = part => JSON.parse(b64url(part).toString('utf8'));

let jwksCache = { at: 0, keys: [] };
async function signingKeys(supabaseUrl) {
  if (Date.now() - jwksCache.at < 10 * 60 * 1000) return jwksCache.keys;
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`, {
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new AuthError('Could not load the sign-in keys');
  const { keys = [] } = await response.json();
  jwksCache = { at: Date.now(), keys };
  return keys;
}

const ALGORITHMS = {
  RS256: { hash: 'sha256' },
  ES256: { hash: 'sha256', dsaEncoding: 'ieee-p1363' },
  HS256: { hmac: 'sha256' }
};

/** Verifies a Supabase access token. Returns its claims, or throws AuthError. */
export async function verifySupabaseToken(token, { supabaseUrl, jwtSecret, now = Date.now() } = {}) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new AuthError('Malformed token');
  const [h, p, s] = parts;
  let header;
  let claims;
  try {
    header = decodePart(h);
    claims = decodePart(p);
  } catch {
    throw new AuthError('Malformed token');
  }
  const alg = ALGORITHMS[header.alg];
  if (!alg) throw new AuthError(`Unsupported token algorithm ${header.alg}`);
  const data = Buffer.from(`${h}.${p}`);
  const signature = b64url(s);
  let valid;
  if (alg.hmac) {
    if (!jwtSecret) throw new AuthError('HS256 tokens need SUPABASE_JWT_SECRET');
    const expected = crypto.createHmac(alg.hmac, jwtSecret).update(data).digest();
    valid = expected.length === signature.length && crypto.timingSafeEqual(expected, signature);
  } else {
    if (!supabaseUrl) throw new AuthError('Asymmetric tokens need SUPABASE_URL');
    const jwk = (await signingKeys(supabaseUrl)).find(key => key.kid === header.kid);
    if (!jwk) throw new AuthError('Unknown signing key');
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    valid = crypto.verify(alg.hash, data, alg.dsaEncoding ? { key, dsaEncoding: alg.dsaEncoding } : key, signature);
  }
  if (!valid) throw new AuthError('Invalid token signature');
  if (!claims.exp || claims.exp * 1000 < now) throw new AuthError('Token expired');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes('authenticated')) throw new AuthError('Token is not for a signed-in user');
  return claims;
}

const sameSecret = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * Checks a request when the engine is reachable beyond localhost (or a shared token is configured).
 * Returns { user, kind } or null when no check applies.
 */
export async function authenticate(req, env = process.env) {
  const remote = env.VULT_ENGINE_ALLOW_REMOTE === '1';
  const shared = env.VULT_ENGINE_TOKEN;
  if (!remote && !shared) return null;
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new AuthError('Sign in to use the engine');
  if (shared && sameSecret(token, shared)) return { user: 'service', kind: 'token' };
  if (!remote) throw new AuthError('Invalid engine token');
  const claims = await verifySupabaseToken(token, {
    supabaseUrl: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    jwtSecret: env.SUPABASE_JWT_SECRET
  });
  return { user: claims.sub, email: claims.email, kind: 'supabase' };
}
