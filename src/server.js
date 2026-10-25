//не удалять
// src/server.js — HTTP surface. node:http, no framework.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

import * as db from './db.js';
import * as auth from './auth.js';
import * as faceit from './faceit.js';
import * as provider from './provider.js';
import * as view from './render.js';
import { validate_destination, ROLE_LABELS } from './destination.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const SESSION_TTL = 8 * 60 * 60 * 1000;
const BODY_LIMIT = 64 * 1024;

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' https: data:; style-src 'self'; script-src 'self'; " +
    "connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  // same-origin, not no-referrer: Chromium serializes a form POST's Origin as the
  // literal "null" under no-referrer, which makes the same-origin guard reject
  // legitimate logins. same-origin keeps the referrer away from other sites and
  // leaves the Origin header intact for our own forms.
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// ---------- helpers ----------

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Length': buf.length,
    ...headers,
  });
  res.end(buf);
}

const html = (res, status, body, extra = {}) =>
  send(res, status, body, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...extra });

function see_other(res, location, extra = {}) {
  const safe = location.startsWith('/') && !location.startsWith('//') ? location : '/admin';
  send(res, 303, '', { Location: safe, ...extra });
}

// Outbound redirect, closed to a single allowlisted origin: the OAuth authorize host.
function see_other_external(res, location) {
  let target = '/admin';
  try {
    const u = new URL(location);
    if (u.protocol === 'https:' || u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
      if (u.origin === faceit.authorize_origin()) target = u.href;
    }
  } catch { /* fall through to /admin */ }
  send(res, 303, '', { Location: target });
}

async function read_body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new Error('body too large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = req.headers['content-type'] || '';
  if (type.includes('application/x-www-form-urlencoded')) {
    const out = {};
    for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
    return out;
  }
  if (type.includes('application/json')) {
    try { return JSON.parse(raw || '{}'); } catch { return {}; }
  }
  return {};
}

// Same-origin guard for every state-changing request.
// Sec-Fetch-Site is set by the browser and cannot be forged from page script, so it
// decides when present. Origin is the fallback; the Referrer-Policy is same-origin,
// so a same-origin form POST carries the real Origin (under no-referrer Chromium
// serializes it as the literal "null" and the login would be rejected).
function same_origin(req) {
  const site = req.headers['sec-fetch-site'];
  if (site === 'same-origin' || site === 'none') return true;
  if (site === 'cross-site') return false;

  const origin = req.headers.origin;
  if (!origin) return true;      // non-browser client; the CSRF token still applies
  if (origin === 'null') return false;
  try {
    const o = new URL(origin);
    const public_origin = process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN) : null;
    if (public_origin && o.host === public_origin.host) return true;
    return o.host === req.headers.host;
  } catch { return false; }
}

const client_ip = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'local';

function session_of(ctx) {
  return db.read_session(ctx.db, ctx.cookies.sid);
}

function csrf_ok(session, form) {
  if (!session || typeof form.csrf !== 'string') return false;
  const a = Buffer.from(session.csrf);
  const b = Buffer.from(form.csrf);
  return a.length === b.length && auth.timingSafeEqual?.(a, b) !== false && a.equals(b);
}

// ---------- bootstrap ----------

export function create_app(dbPath = process.env.DB_PATH || join(ROOT, 'data', 'rostrum.db')) {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const conn = db.open_db(dbPath);

  // Seed the operator account. Credential comes from env, else is generated once and
  // written to the server console only — never into a page.
  let seeded_account = null;
  if (db.count_admins(conn) === 0) {
    const username = process.env.ADMIN_USER || 'operator';
    const generated = randomBytes(9).toString('base64url');
    const credential = process.env.ADMIN_PASS || generated;
    db.create_admin(conn, username, auth.hash_password(credential), 'operator');
    seeded_account = { username, credential: process.env.ADMIN_PASS ? '(from env)' : generated };
  }

  // Seed the read-only "developer" account: its dashboard shows the audit feed
  // (logins from IPs, devices, profile views, redirect clicks). Same one-time
  // credential pattern: env override, else a generated password on the console.
  let seeded_dev_account = null;
  if (db.count_admins_by_role(conn, 'developer') === 0) {
    const username = process.env.DEVELOPER_USER || 'developer';
    const generated = randomBytes(9).toString('base64url');
    const credential = process.env.DEVELOPER_PASS || generated;
    db.create_admin(conn, username, auth.hash_password(credential), 'developer');
    seeded_dev_account = { username, credential: process.env.DEVELOPER_PASS ? '(from env)' : generated };
  }
  if (seeded_account || seeded_dev_account) {
    if (seeded_account) console.log(`[seed] operator "${seeded_account.username}" password: ${seeded_account.credential}`);
    if (seeded_dev_account) console.log(`[seed] developer "${seeded_dev_account.username}" password: ${seeded_dev_account.credential}`);
  }

  // Audit: every request-level event goes through here. A failing insert must
  // never take the request down, hence the swallow.
  const audit_req = (req, event, { actor = '', detail = '' } = {}) => {
    try {
      db.add_audit(conn, {
        actor, event,
        ip: client_ip(req),
        ua: req.headers['user-agent'] || '',
        detail,
      });
    } catch { /* audit is best-effort */ }
  };

  const status = () => ({
    lookup: provider.provider_name(),
    browser: process.env.CHROME_CDP || 'http://127.0.0.1:9222',
    api_key: faceit.has_api_key(),
    oauth: faceit.has_oauth(),
    dev_claims: process.env.DEV_CLAIMS === '1',
  });

  // Shared by create, launch and edit: one place decides what a mapping may contain.
  // Fields absent from the submitted form keep their stored value, so a partial post
  // (or an older form) cannot silently reset the destination.
  const read_mapping_form = (form, base = {}, admin_id = '') => {
    const has = (k) => Object.prototype.hasOwnProperty.call(form, k);
    const tournament = has('tournament')
      ? String(form.tournament || '').trim().slice(0, 64)
      : (base.tournament ?? '');
    const role = has('role')
      ? String(form.role || '').trim().toLowerCase()
      : (base.role ?? '');
    if (!Object.prototype.hasOwnProperty.call(ROLE_LABELS, role)) {
      return { ok: false, error: 'Неизвестная роль.' };
    }

    // B — a second player, stored as its own reference. It never contributes a name.
    const partner_player_id = has('partner_player_id')
      ? String(form.partner_player_id || '').trim().slice(0, 64)
      : (base.partner_player_id ?? '');
    if (partner_player_id && !db.get_player(conn, partner_player_id)) {
      return { ok: false, error: 'Второй профиль не найден — загрузи его.' };
    }

    // C — an organiser name. Kept in its own column with its own author stamp;
    // the verified claim alias is never overwritten by it.
    const display_override = has('display_override')
      ? String(form.display_override || '').trim()
      : (base.display_override ?? '');
    if (display_override && !/^[A-Za-z0-9 _\-.]{1,24}$/.test(display_override)) {
      return { ok: false, error: 'Имя организатора: 1–24 символа, латиница, цифры, пробел, _ - .' };
    }

    const dest = validate_destination(
      has('destination_type') ? form.destination_type : (base.destination_type ?? 'internal'),
      has('destination_url') ? form.destination_url : (base.destination_url ?? ''),
    );
    if (!dest.ok) return { ok: false, error: dest.error };
    return {
      ok: true,
      value: {
        tournament,
        role,
        partner_player_id,
        display_override,
        override_by: display_override ? admin_id : '',
        destination_type: dest.type,
        destination_url: dest.url,
      },
    };
  };

  // One path for every source: the Data API or the browser collector.
  // A fresh cached row is reused unless the caller forces a refresh.
  const resolve_and_store = async (nickname, { refresh = false } = {}) => {
    const provider_now = provider.provider_name();
    const row = refresh ? null : db.find_player_by_nickname(conn, nickname);
    // Cache only within one source: a row collected by the browser collector
    // must never satisfy an API-keyed lookup, and the other way around.
    const cached = row && row.source === provider_now ? row : null;
    const found = await provider.lookup(nickname, { cached });
    return db.upsert_player(conn, {
      ...found.player,
      stats: found.stats,
      source: found.provider,
    });
  };

  // Sweeping every request would mean a DELETE per request for no gain.
  let last_sweep = 0;
  const sweep = () => {
    const t = Date.now();
    if (t - last_sweep < 60_000) return;
    last_sweep = t;
    db.sweep_sessions(conn);
  };

  const server = createServer(async (req, res) => {
    sweep();
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;
    const method = req.method || 'GET';
    const ctx = { db: conn, cookies: auth.parse_cookies(req.headers.cookie || '') };

    try {
      // ---- static ----
      // Static files: the two scripts, the two stylesheets, the icon, and the
      // self-hosted webfonts the profile renders with.
      const font = path.match(/^\/fonts\/[A-Za-z0-9_.-]+\.woff2$/);
      // fuse-icons sprites: hash-named SVG symbol sheets page markup <use>s against
      const icon_sprite = path.match(/^\/fuse-icons\/[A-Za-z0-9_.-]+\.svg$/);
      if (method === 'GET' && (path === '/style.css' || path === '/fonts.css' || path === '/public.css'
        || path === '/faceit.shell.css' || path === '/faceit.shell.vendor.css' || path === '/fonts-play.css'
        || path === '/admin.js' || path === '/public.js' || path === '/mark.svg' || path === '/favicon.ico'
        || font || icon_sprite)) {
        const file = join(PUBLIC, path.slice(1));
        if (existsSync(file)) {
          const body = await readFile(file);
          return send(res, 200, body, {
            'Content-Type': MIME[extname(file)] || 'application/octet-stream',
            'Cache-Control': 'public, max-age=300',
          });
        }
        return send(res, 404, 'not found', { 'Content-Type': 'text/plain' });
      }

      // ---- root ----
      if (method === 'GET' && path === '/') {
        return see_other(res, session_of(ctx) ? '/admin' : '/admin');
      }

      // ---- admin ----
      if (method === 'GET' && path === '/admin') {
        const session = session_of(ctx);
        if (!session) {
          return html(res, 200, view.login_page({
            error: url.searchParams.get('error') || undefined,
            notice: (seeded_account || seeded_dev_account)
              ? 'Первый запуск. Аккаунты созданы; одноразовые пароли выданы в лог сервера (journalctl).'
              : url.searchParams.get('notice') || undefined,
          }));
        }
        const audit_q = url.searchParams.get('q') || '';
        const audit_event = url.searchParams.get('event') || '';
        const audit_page = Number(url.searchParams.get('page') || '1') || 1;
        const audit = db.list_audit(conn, { event: audit_event, q: audit_q, page: audit_page });
        return html(res, 200, view.admin_page({
          session,
          players: db.list_players(conn),
          claims: db.list_claims(conn),
          mappings: db.list_mappings(conn),
          status: status(),
          notice: url.searchParams.get('notice') || undefined,
          error: url.searchParams.get('error') || undefined,
          fresh_a: url.searchParams.get('a') || undefined,
          fresh_b: url.searchParams.get('b') || undefined,
          origin: 'http://' + (url.host || 'localhost:4173'),
          audit: { ...audit, event: audit_event, q: audit_q },
        }));
      }

      if (method === 'POST' && path === '/admin/login') {
        const form = await read_body(req);
        const ip = client_ip(req);
        if (!same_origin(req)) return html(res, 403, view.login_page({ error: 'Cross-origin request rejected.' }));
        if (!auth.login_allowed(ip)) {
          audit_req(req, 'login_rate_limited', { actor: String(form.username || '') });
          return html(res, 429, view.login_page({ error: `Too many attempts. Retry in ${auth.retry_after(ip)}s.` }));
        }
        const admin = db.find_admin(conn, String(form.username || ''));
        const ok = admin && auth.verify_password(String(form.password || ''), admin.pw_hash);
        if (!ok) {
          auth.note_failure(ip);
          audit_req(req, 'login_fail', { actor: String(form.username || '') });
          return html(res, 401, view.login_page({ error: 'Wrong username or password.' }));
        }
        auth.note_success(ip);
        const sid = db.create_session(conn, admin.id, auth.token(24), SESSION_TTL);
        audit_req(req, 'login_ok', { actor: admin.username, detail: `role=${admin.role}` });
        const secure = (process.env.PUBLIC_ORIGIN || '').startsWith('https://');
        return see_other(res, '/admin', { 'Set-Cookie': auth.session_cookie(sid, secure) });
      }

      if (method === 'POST' && path === '/admin/logout') {
        const session = session_of(ctx);
        const form = await read_body(req);
        if (!session) return see_other(res, '/admin');
        // Without a valid token and a same-origin request this must not end the session,
        // otherwise any third-party page can log the operator out.
        if (!same_origin(req) || !csrf_ok(session, form)) {
          return see_other(res, '/admin?error=Bad+request');
        }
        db.drop_session(conn, session.id);
        audit_req(req, 'logout', { actor: session.username });
        const secure = (process.env.PUBLIC_ORIGIN || '').startsWith('https://');
        return see_other(res, '/admin', { 'Set-Cookie': auth.clear_cookie(secure) });
      }

      // Everything below is authenticated.
      const admin_prefixes = ['/admin/', '/claim/'];
      const needs_auth = admin_prefixes.some((p) => path.startsWith(p));
      if (needs_auth && path !== '/claim/callback') {
        const s = session_of(ctx);
        if (!s) return see_other(res, '/admin');
      }

      // The "developer" role has no write access: its dashboard is the audit
      // feed. Every state-changing admin POST below re-checks this.
      const can_write = (session) => session && session.role !== 'developer';
      const reject_role = (res) => see_other(res, `/admin?error=${encodeURIComponent('Роль developer — только просмотр.')}`);

      if (method === 'POST' && path === '/admin/players/resolve') {
        const session = session_of(ctx);
        const form = await read_body(req);
        if (!same_origin(req) || !csrf_ok(session, form)) return see_other(res, '/admin?error=Bad+request');
        const nickname = String(form.nickname || '').trim();
        if (!can_write(session)) return reject_role(res);
        if (!/^[A-Za-z0-9_\-]{1,32}$/.test(nickname)) {
          return see_other(res, '/admin?error=' + encodeURIComponent('Ник: 1–32 символа, латиница, цифры, _ или -'));
        }
        try {
          // refresh=1 skips the cache: re-run the collector for fresh numbers
          const refresh = form.refresh === '1' || form.refresh === 1 || form.refresh === true;
          const p = await resolve_and_store(nickname, { refresh });
          audit_req(req, 'resolve', { actor: session.username, detail: `nickname=${p.nickname} refresh=${refresh ? '1' : '0'}` });
          return see_other(res, `/admin?notice=${encodeURIComponent(`Профиль ${p.nickname} загружен.`)}`);
        } catch (err) {
          audit_req(req, 'resolve_fail', { actor: session.username, detail: `nickname=${nickname} err=${err.message}`.slice(0, 400) });
          return see_other(res, `/admin?error=${encodeURIComponent(err.message)}`);
        }
      }

      if (method === 'GET' && path === '/admin/claim') {
        const session = session_of(ctx);
        return html(res, 200, view.claim_page({
          session, status: status(),
          error: url.searchParams.get('error') || undefined,
          notice: url.searchParams.get('notice') || undefined,
        }));
      }

      // GET, because CSP form-action blocks a form submission whose redirect chain
      // leaves the origin — and this one has to reach the authorize host. The state
      // value is minted here, bound to the admin session, and consumed once.
      if (method === 'GET' && path === '/claim/start') {
        const session = session_of(ctx);
        if (!faceit.has_oauth()) {
          return see_other(res, '/admin/claim?error=FACEIT+OAuth+is+not+configured+on+this+server');
        }
        const state = auth.token(24);
        db.put_state(conn, state, session.admin_id);
        return see_other_external(res, faceit.authorize_url(state));
      }

      // /claim/callback is hit by FACEIT's redirect, which carries no session cookie.
      if (method === 'GET' && path === '/claim/callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code || !state) return see_other(res, '/admin/claim?error=OAuth+callback+missing+parameters');
        const row = db.take_state(conn, state);
        if (!row) return see_other(res, '/admin/claim?error=OAuth+state+expired+or+unknown');
        try {
          const ident = await faceit.exchange_code(code);
          const live = await (async () => {
            if (faceit.has_api_key()) {
              const by_id = await faceit.resolve(ident.nickname || '');
              return db.upsert_player(conn, by_id);
            }
            return db.upsert_player(conn, {
              player_id: ident.player_id, nickname: ident.nickname, source: 'faceit',
            });
          })();
          const pending = auth.token(18);
          db.put_pending(conn, pending, row.admin_id, live.player_id, live.nickname);
          // Reuse the browser's session if it still has one; otherwise mint one.
          const old_sid = ctx.cookies.sid;
          if (old_sid) db.drop_session(conn, old_sid);
          const sid = db.create_session(conn, row.admin_id, auth.token(24), SESSION_TTL);
          const secure = (process.env.PUBLIC_ORIGIN || '').startsWith('https://');
          return html(res, 200, view.alias_step({
            session: db.read_session(conn, sid),
            real_nickname: live.nickname,
            player_id: pending,
          }), { 'Set-Cookie': auth.session_cookie(sid, secure) });
        } catch (err) {
          return see_other(res, `/admin/claim?error=${encodeURIComponent(err.message)}`);
        }
      }

      if (method === 'POST' && path === '/claim/finish') {
        const session = session_of(ctx);
        const form = await read_body(req);
        if (!session || !same_origin(req) || !csrf_ok(session, form)) return see_other(res, '/admin/claim?error=Bad+request');
        if (!can_write(session)) return reject_role(res);
        const pending = db.take_pending(conn, String(form.player_id || ''), session.admin_id);
        if (!pending) return see_other(res, '/admin/claim?error=Claim+expired,+start+again');
        const alias = String(form.alias || '').trim();
        if (!/^[A-Za-z0-9 _\-.]{1,24}$/.test(alias)) {
          return see_other(res, '/admin/claim?error=Alias+must+be+1-24+characters');
        }
        db.create_claim(conn, {
          player_id: pending.player_id,
          real_nickname: pending.nickname,
          alias,
          method: 'oauth',
          verified: 1,
        });
        audit_req(req, 'claim_create', { actor: session.username, detail: `alias=${alias} player=${pending.nickname} method=oauth` });
        return see_other(res, `/admin?notice=${encodeURIComponent(`Claim создан: ${alias} → ${pending.nickname}.`)}`);
      }

      if (method === 'POST' && path === '/claim/dev') {
        if (process.env.DEV_CLAIMS !== '1') return see_other(res, '/admin/claim?error=Dev+claims+disabled');
        const session = session_of(ctx);
        const form = await read_body(req);
        if (!session || !same_origin(req) || !csrf_ok(session, form)) return see_other(res, '/admin/claim?error=Bad+request');
        if (!can_write(session)) return reject_role(res);
        const nickname = String(form.nickname || '').trim();
        const alias = String(form.alias || '').trim();
        if (!/^[A-Za-z0-9 _\-.]{1,24}$/.test(alias)) {
          return see_other(res, '/admin/claim?error=Alias+must+be+1-24+characters');
        }
        const player = db.find_player_by_nickname(conn, nickname);
        if (!player) return see_other(res, '/admin/claim?error=Resolve+that+nickname+on+the+roster+first');
        audit_req(req, 'claim_create', { actor: session.username, detail: `alias=${alias} player=${player.nickname} method=dev-unverified` });
        db.create_claim(conn, {
          player_id: player.player_id,
          real_nickname: player.nickname,
          alias,
          method: 'dev-unverified',
          verified: 0,
        });
        return see_other(res, `/admin?notice=${encodeURIComponent(`Claim без подтверждения: ${alias} → ${player.nickname}. Страница будет помечена.`)}`);
      }

      // NOTE: no route accepts a display alias or a destination URL from the admin panel.
      // "ЗАПУСТИТЬ": takes the typed nicknames, resolves both against the data source,
      // and writes one record per player pair. Nothing is read from a preloaded list.
      if (method === 'POST' && path === '/admin/launch') {
        const session = session_of(ctx);
        const form = await read_body(req);
        if (!same_origin(req) || !csrf_ok(session, form)) return see_other(res, '/admin?error=' + encodeURIComponent('Плохой запрос.'));
        if (!can_write(session)) return reject_role(res);

        const rerender = (message) => html(res, 200, view.admin_page({
          session,
          players: db.list_players(conn),
          claims: db.list_claims(conn),
          mappings: db.list_mappings(conn),
          status: status(),
          error: message,
          draft: form,
        }));

        const nick_a = String(form.player_a || '').trim();
        const nick_b = String(form.player_b || '').trim();

        if (!/^[A-Za-z0-9_\-]{1,32}$/.test(nick_a)) {
          return rerender('Поле A: 1–32 символа, латиница, цифры, _ или -.');
        }
        if (nick_b && !/^[A-Za-z0-9_\-]{1,32}$/.test(nick_b)) {
          return rerender('Поле B: 1–32 символа, латиница, цифры, _ или -.');
        }

        let player_a;
        try {
          player_a = await resolve_and_store(nick_a);
        } catch (err) {
          audit_req(req, 'launch_fail', { actor: session.username, detail: `player_a=${nick_a} err=${err.message}`.slice(0, 400) });
          return rerender(`Профиль «${nick_a}» не найден: ${err.message}`);
        }

        let player_b = null;
        if (nick_b) {
          try {
            player_b = await resolve_and_store(nick_b);
          } catch (err) {
            audit_req(req, 'launch_fail', { actor: session.username, detail: `player_b=${nick_b} err=${err.message}`.slice(0, 400) });
            return rerender(`Профиль «${nick_b}» не найден: ${err.message}`);
          }
          if (player_b.player_id === player_a.player_id) {
            return rerender('A и B указывают на один аккаунт — во втором поле нужен другой игрок.');
          }
        }

        const existing = db.find_mapping_by_players(conn, player_a.player_id, player_b?.player_id ?? '');
        const parsed = read_mapping_form(form, existing ?? {}, session.admin_id);
        if (!parsed.ok) return rerender(parsed.error);

        const claim = db.find_claim_by_player(conn, player_a.player_id);
        const value = { ...parsed.value, partner_player_id: player_b?.player_id ?? '', claim_id: claim?.id ?? null };

        // Ссылка А — как ввёл оператор. variant='A': на странице рисуется карточка
        // второго профиля (B), аватар — от профиля из первой строки, кнопка — фейковая ошибка.
        let slug_a;
        if (existing) {
          db.update_mapping(conn, existing.id, { ...value, variant: 'A' });
          slug_a = existing.id;
        } else {
          slug_a = db.create_mapping(conn, { player_id: player_a.player_id, ...value, variant: 'A' }).id;
        }

        // Ссылка Б — те же профили, но 1 и 2 меняются местами, третье поле (C) пусто.
        // Без второго профиля менять местами нечего — Б не создаётся.
        let slug_b = null;
        if (player_b) {
          const claim_b = db.find_claim_by_player(conn, player_b.player_id);
          const value_b = { ...value, partner_player_id: player_a.player_id, claim_id: claim_b?.id ?? null, display_override: '', override_by: '', variant: 'B' };
          const existing_b = db.find_mapping_by_players(conn, player_b.player_id, player_a.player_id);
          if (existing_b) {
            db.update_mapping(conn, existing_b.id, value_b);
            slug_b = existing_b.id;
          } else {
            slug_b = db.create_mapping(conn, { player_id: player_b.player_id, ...value_b }).id;
          }
        }

        audit_req(req, 'launch', { actor: session.username, detail: `slug_a=${slug_a} slug_b=${slug_b || '—'} a=${player_a.nickname} b=${player_b?.nickname || ''} display=${value.display_override} dest=${value.destination_type === 'external' ? value.destination_url : 'internal'}` });
        const params = new URLSearchParams();
        if (slug_b) {
          params.set('notice', `Ссылки: /players/${slug_a} (А) и /players/${slug_b} (Б).`);
          params.set('b', slug_b);
        } else {
          params.set('notice', `Ссылка /players/${slug_a} (А) создана — второй профиль не задан, Б не нужен.`);
        }
        params.set('a', slug_a);
        return see_other(res, `/admin?${params.toString()}`);
      }

      if (method === 'POST' && path === '/admin/mappings') {
        const session = session_of(ctx);
        const form = await read_body(req);
        if (!same_origin(req) || !csrf_ok(session, form)) return see_other(res, '/admin?error=Bad+request');
        const claim = db.get_claim(conn, String(form.claim_id || ''));
        if (!claim) return see_other(res, '/admin?error=' + encodeURIComponent('Неизвестный claim.'));
        const existing = db.find_mapping_by_players(conn, claim.player_id, '');
        const parsed = read_mapping_form(form, existing ?? {}, session.admin_id);
        if (!parsed.ok) return see_other(res, '/admin?error=' + encodeURIComponent(parsed.error));
        const value = { ...parsed.value, partner_player_id: '', claim_id: claim.id };
        if (existing) {
          db.update_mapping(conn, existing.id, value);
          return see_other(res, `/admin?notice=${encodeURIComponent(`Ссылка /p/${existing.id} обновлена.`)}`);
        }
        const m = db.create_mapping(conn, { player_id: claim.player_id, ...value });
        return see_other(res, `/admin?notice=${encodeURIComponent(`Ссылка /p/${m.id} создана.`)}`);
      }

      const edit_action = path.match(/^\/admin\/mappings\/([A-Za-z0-9_-]+)\/update$/);
      if (method === 'POST' && edit_action) {
        const session = session_of(ctx);
        const form = await read_body(req);
        if (!same_origin(req) || !csrf_ok(session, form)) return see_other(res, '/admin?error=' + encodeURIComponent('Плохой запрос.'));
        if (!can_write(session)) return reject_role(res);
        const current = db.get_mapping(conn, edit_action[1]);
        if (!current) return see_other(res, '/admin?error=' + encodeURIComponent('Такой ссылки нет.'));
        const parsed = read_mapping_form(form, current, session.admin_id);
        if (!parsed.ok) return see_other(res, '/admin?error=' + encodeURIComponent(parsed.error));
        // The claim link is identity, not a form field: an edit must not clear it.
        const claim_id = current.claim_id || db.find_claim_by_player(conn, current.player_id)?.id || null;
        const updated = db.update_mapping(conn, edit_action[1], { ...parsed.value, claim_id });
        audit_req(req, 'mapping_update', { actor: session.username, detail: `slug=${edit_action[1]}` });
        return see_other(res, `/admin?notice=${encodeURIComponent(updated ? 'Маппинг обновлён.' : 'Такой ссылки нет.')}`);
      }

      const map_action = path.match(/^\/admin\/mappings\/([A-Za-z0-9_-]+)\/(publish|delete)$/);
      if (method === 'POST' && map_action) {
        const session = session_of(ctx);
        const form = await read_body(req);
        if (!same_origin(req) || !csrf_ok(session, form)) return see_other(res, '/admin?error=Bad+request');
        if (!can_write(session)) return reject_role(res);
        const [, id, action] = map_action;
        if (action === 'publish') {
          const wanted = form.published === '1';
          db.set_published(conn, id, wanted);
          audit_req(req, 'mapping_publish', { actor: session.username, detail: `slug=${id} published=${wanted ? '1' : '0'}` });
          return see_other(res, `/admin?notice=${encodeURIComponent(wanted ? 'Ссылка открыта.' : 'Ссылка скрыта.')}`);
        }
        const gone = db.delete_mapping(conn, id);
        audit_req(req, 'mapping_delete', { actor: session.username, detail: `slug=${id}${gone ? '' : ' (missing)'}` });
        return see_other(res, `/admin?notice=${encodeURIComponent(gone ? 'Ссылка удалена.' : 'Такой ссылки нет.')}`);
      }

      // Wipe the audit feed. Operator only — the developer role reads, never writes.
      if (method === 'POST' && path === '/admin/audit/clear') {
        const session = session_of(ctx);
        const form = await read_body(req);
        if (!session || !same_origin(req) || !csrf_ok(session, form)) return see_other(res, '/admin?error=Bad+request');
        if (session.role !== 'operator') return reject_role(res);
        audit_req(req, 'audit_clear', { actor: session.username });
        db.clear_audit(conn);
        return see_other(res, `/admin?notice=${encodeURIComponent('Лог аудита очищен.')}`);
      }

      // ---- public ----
      // /players/<slug> — the real-FACEIT-looking path. /p/<slug> kept as a
      // working alias so links handed out earlier don't 404.
      const pub = path.match(/^\/(?:players|p)\/([A-Za-z0-9_-]{2,32})$/);
      if (method === 'GET' && pub) {
        const m = db.get_mapping(conn, pub[1]);
        if (!m || !m.published) {
          return html(res, 404, view.error_page({ code: 404, message: 'No published profile at this link.' }));
        }
        const referer = (req.headers.referer || '').slice(0, 200);
        audit_req(req, 'profile_view', { actor: 'guest', detail: `slug=${pub[1]}${m.display_override ? ` display=${m.display_override}` : ''}${referer ? ` ref=${referer}` : ''}` });
        return html(res, 200, view.public_page({ m }));
      }

      // Outbound navigation for a configured destination. The allowlist is re-checked at
      // click time, so removing a host from the environment kills every link that used it.
      const go = path.match(/^\/(?:players|p)\/([A-Za-z0-9_-]{2,32})\/go$/);
        if (method === 'GET' && go) {
        const m = db.get_mapping(conn, go[1]);
        if (!m || !m.published) {
          return html(res, 404, view.error_page({ code: 404, message: 'No published profile at this link.' }));
        }
        if (m.destination_type !== 'external' || !m.destination_url) {
          // Default destination: the player's own FACEIT profile.
          audit_req(req, 'go_click', { actor: 'guest', detail: `slug=${go[1]} dest=faceit:${m.current_nickname}` });
          return send(res, 302, '', {
            Location: `https://www.faceit.com/en/players/${encodeURIComponent(m.current_nickname)}`,
            'Cache-Control': 'no-store',
          });
        }
        const recheck = validate_destination(m.destination_type, m.destination_url);
        if (!recheck.ok) {
          return html(res, 404, view.error_page({
            code: 404,
            message: 'Перенаправление по ссылке отклонено — адрес назначения больше не в списке разрешённых. Пересоздай ссылку в админке.',
          }));
        }
        audit_req(req, 'go_click', { actor: 'guest', detail: `slug=${go[1]} dest=${recheck.url}` });
        return send(res, 302, '', { Location: recheck.url, 'Cache-Control': 'no-store' });
      }

      return html(res, 404, view.error_page({ code: 404, message: 'Nothing here.' }));
    } catch (err) {
      // Body limit and unexpected faults both land here rather than killing the process.
      const status_code = /body too large/.test(err.message) ? 413 : 500;
      if (status_code === 500) {
        console.error(`[500] ${req.method} ${req.url}\n${err.stack || err.message}`);
      }
      return html(res, status_code, view.error_page({
        code: status_code,
        message: status_code === 500 ? 'Server error. The operator log has the detail.' : 'Request too large.',
      }));
    }
  });

  return { server, conn, seeded_account, seeded_dev_account };
}

// ---------- entrypoint ----------

// Exported so an entry wrapper (scripts/dev.mjs) can boot the same listener with the
// same banner without duplicating it.
export function start() {
  const { server, seeded_account } = create_app();
  const port = Number(process.env.PORT || 4173);
  const host = process.env.BIND || '127.0.0.1';
  server.listen(port, host, () => {
    console.log('Rostrum listening on http://' + host + ':' + port);
    console.log('  Data API key : ' + (faceit.has_api_key() ? 'configured' : 'MISSING — set FACEIT_API_KEY'));
    console.log('  OAuth proof  : ' + (faceit.has_oauth() ? 'configured' : 'MISSING — set FACEIT_CLIENT_ID / FACEIT_CLIENT_SECRET / PUBLIC_ORIGIN'));
    console.log('  Dev claims   : ' + (process.env.DEV_CLAIMS === '1' ? 'ENABLED — pages stamped UNVERIFIED' : 'disabled'));
    const p = provider.status();
    console.log('  Profiles from: ' + (p.provider === 'browser'
      ? `browser collector via ${p.browser} (no API key needed)`
      : 'open.faceit.com Data API'));
    if (seeded_account) {
      console.log('\n  operator  : ' + seeded_account.username);
      console.log('  one-time  : ' + seeded_account.generated);
      console.log('  (printed once; not stored in plaintext)\n');
    }
  });
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => server.close(() => process.exit(0)));
  }
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) start();
