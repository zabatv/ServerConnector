//РЅРµ СѓРґР°Р»СЏС‚СЊ
// src/faceit.js вЂ” FACEIT Data API (v4) + OAuth2 code exchange.
//
// Two distinct jobs:
//   1. resolve(nickname)  вЂ” read public player data. Needs FACEIT_API_KEY.
//   2. oauth_*           вЂ” prove that the person claiming an alias controls the account.
//                          Needs FACEIT_CLIENT_ID / FACEIT_CLIENT_SECRET.
//
// Without credentials both paths fail loudly and the UI says so. Nothing here
// fabricates a response; every row it writes comes from a live call.

const API = () => (process.env.FACEIT_API_BASE || 'https://open.faceit.com/data/v4').replace(/\/$/, '');
const AUTHORIZE_BASE = () => process.env.FACEIT_AUTHORIZE_BASE || 'https://accounts.faceit.com/oauth/authorize';
const TOKEN_BASE = () => process.env.FACEIT_TOKEN_BASE || 'https://api.faceit.com/auth/v1/oauth/token';

export const authorize_origin = () => {
  try { return new URL(AUTHORIZE_BASE()).origin; } catch { return ''; }
};

export class FaceitError extends Error {
  constructor(message, { status = 0, code = 'faceit_error' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const api_key = () => process.env.FACEIT_API_KEY || '';
export const has_api_key = () => Boolean(api_key());
export const has_oauth = () =>
  Boolean(process.env.FACEIT_CLIENT_ID && process.env.FACEIT_CLIENT_SECRET && process.env.PUBLIC_ORIGIN);

// Normalize the Data API payload into the shape the app stores.
function normalize(raw, source = 'faceit') {
  const cs2 = raw?.games?.cs2 ?? {};
  return {
    player_id: raw.player_id,
    nickname: raw.nickname,
    avatar: raw.avatar || null,
    country: raw.country || null,
    elo: Number.isFinite(Number(cs2.faceit_elo)) ? Number(cs2.faceit_elo) : null,
    skill_level: Number.isFinite(Number(cs2.skill_level)) ? Number(cs2.skill_level) : null,
    source,
  };
}

export async function resolve(nickname) {
  if (!has_api_key()) {
    throw new FaceitError('FACEIT_API_KEY is not configured on the server.', { code: 'no_key' });
  }
  const url = `${API()}/players?nickname=${encodeURIComponent(nickname)}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${api_key()}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new FaceitError(`Data API unreachable: ${err.message}`, { code: 'network' });
  }
  if (res.status === 404) throw new FaceitError(`No FACEIT player named "${nickname}".`, { status: 404, code: 'not_found' });
  if (res.status === 401 || res.status === 403) throw new FaceitError('FACEIT_API_KEY rejected by the Data API.', { status: res.status, code: 'bad_key' });
  if (res.status === 429) throw new FaceitError('Data API rate limit hit. Back off and retry.', { status: 429, code: 'rate_limited' });
  if (!res.ok) throw new FaceitError(`Data API returned ${res.status}.`, { status: res.status });
  const body = await res.json();
  if (!body?.player_id) throw new FaceitError('Data API returned an unexpected payload.', { code: 'shape' });
  return normalize(body);
}

// Lifetime CS2 statistics. Public data: no OAuth, just the server-side API key.
// A player with no CS2 history returns 404 вЂ” that is "no stats", not an error.
export async function stats(player_id) {
  if (!has_api_key()) {
    throw new FaceitError('FACEIT_API_KEY is not configured on the server.', { code: 'no_key' });
  }
  const url = `${API()}/players/${encodeURIComponent(player_id)}/stats/cs2`;
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${api_key()}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new FaceitError(`Stats endpoint unreachable: ${err.message}`, { code: 'network' });
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new FaceitError(`Stats endpoint returned ${res.status}.`, { status: res.status });
  const body = await res.json();
  const lt = body?.lifetime ?? {};
  const num = (v) => {
    const n = Number(String(v ?? '').replace('%', '').trim());
    return Number.isFinite(n) ? n : null;
  };
  return {
    matches: num(lt['Matches']),
    kd: num(lt['Average K/D Ratio']),
    kr: num(lt['Average K/R Ratio']),
    hs: num(lt['Average Headshots %']),
    adr: num(lt['ADR']),
    winrate: num(lt['Win Rate %']),
  };
}

export function authorize_url(state) {
  const params = new URLSearchParams({
    client_id: process.env.FACEIT_CLIENT_ID,
    redirect_uri: `${process.env.PUBLIC_ORIGIN}/claim/callback`,
    response_type: 'code',
    scope: 'openid public',
    state,
  });
  return `${AUTHORIZE_BASE()}?${params}`;
}

// Exchange the code, then read identity claims from the id_token.
// The id_token arrives straight from the token endpoint over TLS; the signature is
// FACEIT's to guarantee, and nothing downstream trusts it for authorization вЂ”
// ownership is established by the fact that this exchange succeeded.
export async function exchange_code(code) {
  if (!has_oauth()) throw new FaceitError('FACEIT OAuth is not configured on the server.', { code: 'no_oauth' });
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('client_id', process.env.FACEIT_CLIENT_ID || '');
  body.set('client_secret', process.env.FACEIT_CLIENT_SECRET || '');
  body.set('code', code);
  body.set('redirect_uri', `${process.env.PUBLIC_ORIGIN}/claim/callback`);
  let res;
  try {
    res = await fetch(TOKEN_BASE(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new FaceitError(`OAuth token endpoint unreachable: ${err.message}`, { code: 'network' });
  }
  if (!res.ok) throw new FaceitError(`OAuth token exchange failed (${res.status}).`, { status: res.status, code: 'oauth_failed' });
  const tokens = await res.json();
  const claims = decode_jwt_payload(tokens.id_token);
  if (!claims?.guid && !claims?.sub) throw new FaceitError('OAuth response carried no account id.', { code: 'shape' });
  return { player_id: claims.guid || claims.sub, nickname: claims.nickname || claims.preferred_username || '' };
}

export function decode_jwt_payload(jwt) {
  if (typeof jwt !== 'string') return null;
  const part = jwt.split('.')[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
