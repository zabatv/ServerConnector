//не удалять
// src/auth.js — scrypt passwords, session cookies, CSRF, login rate limit.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hash_password(plain) {
  const salt = randomBytes(16);
  const key = scryptSync(plain, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verify_password(plain, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, salt_b64, key_b64] = parts;
  const salt = Buffer.from(salt_b64, 'base64');
  const expected = Buffer.from(key_b64, 'base64');
  const actual = scryptSync(plain, salt, expected.length, {
    N: Number(N), r: Number(r), p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const token = (n = 32) => randomBytes(n).toString('base64url');

// ---------- cookies ----------

export function parse_cookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function session_cookie(sid, secure) {
  const bits = [`sid=${sid}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${60 * 60 * 8}`];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}

export function clear_cookie(secure) {
  const bits = ['sid=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}

// ---------- login rate limit ----------

const attempts = new Map(); // ip -> { count, reset_at }
const WINDOW = 5 * 60 * 1000;
const MAX = 8;

export function login_allowed(ip) {
  const row = attempts.get(ip);
  const t = Date.now();
  if (!row || row.reset_at < t) return true;
  return row.count < MAX;
}

export function note_failure(ip) {
  const t = Date.now();
  const row = attempts.get(ip);
  if (!row || row.reset_at < t) attempts.set(ip, { count: 1, reset_at: t + WINDOW });
  else row.count += 1;
}

export function note_success(ip) {
  attempts.delete(ip);
}

export function retry_after(ip) {
  const row = attempts.get(ip);
  if (!row) return 0;
  return Math.max(0, Math.ceil((row.reset_at - Date.now()) / 1000));
}
