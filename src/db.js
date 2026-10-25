//не удалять
// src/db.js — schema + queries. node:sqlite (sync API), WAL on.
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admins (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  pw_hash     TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'operator', -- 'operator' | 'developer'
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  csrf        TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

-- Written only by the FACEIT resolver. No admin path touches this table.
CREATE TABLE IF NOT EXISTS players (
  player_id   TEXT PRIMARY KEY,
  nickname    TEXT NOT NULL,
  avatar      TEXT,
  country     TEXT,
  elo         INTEGER,
  skill_level INTEGER,
  stats_json  TEXT,                             -- lifetime CS2 stats, JSON
  source      TEXT NOT NULL DEFAULT 'faceit',   -- which collector wrote it: 'api' | 'browser'
  fetched_at  INTEGER NOT NULL
);

-- Ownership proof. The only way an alias comes into existence.
CREATE TABLE IF NOT EXISTS claims (
  id            TEXT PRIMARY KEY,
  player_id     TEXT NOT NULL REFERENCES players(player_id),
  real_nickname TEXT NOT NULL,          -- snapshot at claim time, never editable
  alias         TEXT NOT NULL,
  method        TEXT NOT NULL,          -- 'oauth' | 'dev-unverified'
  verified      INTEGER NOT NULL,       -- 1 only when proven by OAuth
  created_at    INTEGER NOT NULL
);

-- A published profile page. Requires an existing claim; carries no alias of its own.
CREATE TABLE IF NOT EXISTS mappings (
  id          TEXT PRIMARY KEY,
  claim_id    TEXT NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  tournament  TEXT NOT NULL DEFAULT '',
  published   INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL
);

-- Carries a proven identity between the OAuth callback and the alias form.
CREATE TABLE IF NOT EXISTS pending_claims (
  state       TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL,
  player_id   TEXT NOT NULL,
  nickname    TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_claims_player  ON claims(player_id);
CREATE INDEX IF NOT EXISTS idx_mappings_claim ON mappings(claim_id);

-- Who did what, from where: logins, mapping changes, profile views, redirect
-- clicks. Written by server hooks only; never by a page.
CREATE TABLE IF NOT EXISTS audit_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     INTEGER NOT NULL,
  actor  TEXT NOT NULL DEFAULT '',   -- nickname of the admin, or 'guest'
  event  TEXT NOT NULL,              -- login_ok | login_fail | login_rate_limited |
                                     -- logout | resolve | launch | mapping_update |
                                     -- mapping_publish | mapping_delete |
                                     -- claim_create | profile_view | go_click
  ip     TEXT NOT NULL DEFAULT '',
  ua     TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_ts    ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(event);
`;

export function open_db(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// Columns added after the first release. Idempotent, so an existing database keeps working.
function ensure_column(db, table, name, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${decl}`);
}

function migrate(db) {
  ensure_column(db, 'admins', 'role', "TEXT NOT NULL DEFAULT 'operator'");
  ensure_column(db, 'mappings', 'role', "TEXT NOT NULL DEFAULT ''");
  ensure_column(db, 'mappings', 'destination_type', "TEXT NOT NULL DEFAULT 'internal'");
  ensure_column(db, 'mappings', 'destination_url', "TEXT NOT NULL DEFAULT ''");
  // B — the second player in the configuration, stored separately from A.
  ensure_column(db, 'mappings', 'partner_player_id', "TEXT NOT NULL DEFAULT ''");
  // C — an organiser-set display name, kept apart from the verified claim alias.
  ensure_column(db, 'mappings', 'display_override', "TEXT NOT NULL DEFAULT ''");
  ensure_column(db, 'mappings', 'override_by', "TEXT NOT NULL DEFAULT ''");
  ensure_column(db, 'mappings', 'override_at', 'INTEGER NOT NULL DEFAULT 0');
  // A — the mapping points at a player directly. A claim is optional and only
  // upgrades the badge; it is no longer the anchor of the record.
  ensure_column(db, 'mappings', 'player_id', "TEXT NOT NULL DEFAULT ''");
  // variant — which of the two launch links the row is: 'A' ( dj's profile + victim's
  // card on top) or 'B' (the plain swapped pair). Empty = pre-variant rows.
  ensure_column(db, 'mappings', 'variant', "TEXT NOT NULL DEFAULT ''");
  ensure_column(db, 'players', 'stats_json', 'TEXT');
  relax_claim_requirement(db);
}

// The first schema made claim_id NOT NULL, so a profile without a claim could not be
// published. Rebuild the table once with a nullable claim_id and backfill player_id.
function relax_claim_requirement(db) {
  const cols = db.prepare('PRAGMA table_info(mappings)').all();
  const claim = cols.find((c) => c.name === 'claim_id');
  if (!claim || !claim.notnull) return;

  db.exec(`
    BEGIN;
    CREATE TABLE mappings_v2 (
      id                 TEXT PRIMARY KEY,
      player_id          TEXT NOT NULL DEFAULT '',
      claim_id           TEXT,
      partner_player_id  TEXT NOT NULL DEFAULT '',
      tournament         TEXT NOT NULL DEFAULT '',
      role               TEXT NOT NULL DEFAULT '',
      destination_type   TEXT NOT NULL DEFAULT 'internal',
      destination_url    TEXT NOT NULL DEFAULT '',
      display_override   TEXT NOT NULL DEFAULT '',
      override_by        TEXT NOT NULL DEFAULT '',
      override_at        INTEGER NOT NULL DEFAULT 0,
      published          INTEGER NOT NULL DEFAULT 1,
      created_at         INTEGER NOT NULL
    );
    INSERT INTO mappings_v2
      (id, player_id, claim_id, partner_player_id, tournament, role, destination_type,
       destination_url, display_override, override_by, override_at, published, created_at)
    SELECT m.id,
           COALESCE(NULLIF(m.player_id, ''), c.player_id, ''),
           NULLIF(m.claim_id, ''),
           COALESCE(m.partner_player_id, ''), COALESCE(m.tournament, ''), COALESCE(m.role, ''),
           COALESCE(m.destination_type, 'internal'), COALESCE(m.destination_url, ''),
           COALESCE(m.display_override, ''), COALESCE(m.override_by, ''), COALESCE(m.override_at, 0),
           COALESCE(m.published, 1), m.created_at
    FROM mappings m LEFT JOIN claims c ON c.id = m.claim_id;
    DROP TABLE mappings;
    ALTER TABLE mappings_v2 RENAME TO mappings;
    COMMIT;
  `);
}

const now = () => Date.now();

// ---------- admins / sessions ----------

export function create_admin(db, username, pw_hash, role = 'operator') {
  const id = randomUUID();
  db.prepare('INSERT INTO admins (id, username, pw_hash, role, created_at) VALUES (?,?,?,?,?)')
    .run(id, username, pw_hash, role, now());
  return id;
}

export function count_admins_by_role(db, role) {
  return db.prepare('SELECT COUNT(*) AS n FROM admins WHERE role = ?').get(role).n;
}

export function find_admin(db, username) {
  return db.prepare('SELECT * FROM admins WHERE username = ?').get(username) ?? null;
}

export function count_admins(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
}

export function create_session(db, admin_id, csrf, ttl_ms) {
  const id = randomUUID();
  db.prepare('INSERT INTO sessions (id, admin_id, csrf, created_at, expires_at) VALUES (?,?,?,?,?)')
    .run(id, admin_id, csrf, now(), now() + ttl_ms);
  return id;
}

export function read_session(db, sid) {
  if (!sid) return null;
  const row = db.prepare(`
    SELECT s.*, a.username AS username, a.role AS role
    FROM sessions s JOIN admins a ON a.id = s.admin_id
    WHERE s.id = ?`).get(sid);
  if (!row) return null;
  if (row.expires_at < now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
    return null;
  }
  return row;
}

export function drop_session(db, sid) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
}

export function sweep_sessions(db) {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now());
}

// ---------- audit log ----------

// Online forever never breaks a request: an insert failure must be swallowed.
export function add_audit(db, { actor = '', event, ip = '', ua = '', detail = '' }) {
  db.prepare('INSERT INTO audit_log (ts, actor, event, ip, ua, detail) VALUES (?,?,?,?,?,?)')
    .run(now(), String(actor || '').slice(0, 64) || 'unknown', String(event || '').slice(0, 32),
         String(ip || '').slice(0, 64), String(ua || '').slice(0, 300), String(detail || '').slice(0, 400));
}

const AUDIT_PER_PAGE = 200;

export function list_audit(db, { event = '', q = '', page = 1 } = {}) {
  const clauses = [];
  const args = [];
  if (event) { clauses.push('event = ?'); args.push(event); }
  if (q) {
    clauses.push('(actor LIKE ? OR ip LIKE ? OR detail LIKE ? OR ua LIKE ?)');
    const like = `%${q}%`;
    args.push(like, like, like, like);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM audit_log${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...args, AUDIT_PER_PAGE, Math.max(0, page - 1) * AUDIT_PER_PAGE);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM audit_log${where}`).get(...args).n;
  return { rows, total, per_page: AUDIT_PER_PAGE, page: Math.max(1, page) };
}

export function clear_audit(db) {
  db.exec('DELETE FROM audit_log');
  db.exec("DELETE FROM sqlite_sequence WHERE name = 'audit_log'");
}

// ---------- players ----------

export function upsert_player(db, p) {
  const stats_json = p.stats ? JSON.stringify(p.stats) : null;
  db.prepare(`
    INSERT INTO players (player_id, nickname, avatar, country, elo, skill_level, stats_json, source, fetched_at)
    VALUES (?,?,?,?,?,?,?,?,?)
    ON CONFLICT(player_id) DO UPDATE SET
      nickname = excluded.nickname,
      avatar   = excluded.avatar,
      country  = excluded.country,
      elo      = excluded.elo,
      skill_level = excluded.skill_level,
      stats_json = COALESCE(excluded.stats_json, players.stats_json),
      source   = excluded.source,
      fetched_at = excluded.fetched_at
  `).run(p.player_id, p.nickname, p.avatar ?? null, p.country ?? null,
         p.elo ?? null, p.skill_level ?? null, stats_json, p.source ?? 'faceit', now());
  return get_player(db, p.player_id);
}

export function get_player(db, player_id) {
  return db.prepare('SELECT * FROM players WHERE player_id = ?').get(player_id) ?? null;
}

export function list_players(db, limit = 50) {
  return db.prepare('SELECT * FROM players ORDER BY fetched_at DESC LIMIT ?').all(limit);
}

// Case-insensitive lookup used by the claim flow, so an older cached player is still findable.
export function find_player_by_nickname(db, nickname) {
  return db.prepare('SELECT * FROM players WHERE lower(nickname) = lower(?)').get(String(nickname)) ?? null;
}

// ---------- claims ----------

export function create_claim(db, { player_id, real_nickname, alias, method, verified }) {
  const id = randomUUID();
  db.prepare(`INSERT INTO claims (id, player_id, real_nickname, alias, method, verified, created_at)
              VALUES (?,?,?,?,?,?,?)`)
    .run(id, player_id, real_nickname, alias, method, verified ? 1 : 0, now());
  return get_claim(db, id);
}

export function get_claim(db, id) {  return db.prepare(`
    SELECT c.*, p.avatar, p.country, p.elo, p.skill_level, p.nickname AS current_nickname, p.source
    FROM claims c JOIN players p ON p.player_id = c.player_id
    WHERE c.id = ?
  `).get(id) ?? null;
}

export function list_claims(db) {  return db.prepare(`
    SELECT c.*, p.avatar, p.country, p.elo, p.skill_level, p.nickname AS current_nickname, p.source
    FROM claims c JOIN players p ON p.player_id = c.player_id
    ORDER BY c.created_at DESC
  `).all();
}

export function find_claim_by_player(db, player_id) {
  return db.prepare(`
    SELECT c.*, p.avatar, p.country, p.elo, p.skill_level, p.nickname AS current_nickname, p.source
    FROM claims c JOIN players p ON p.player_id = c.player_id
    WHERE c.player_id = ?
    ORDER BY c.created_at DESC LIMIT 1
  `).get(player_id) ?? null;
}

// ---------- mappings ----------

// The public link is the player's nickname (/p/fre5zy), not a random token. Duplicates
// get a numeric suffix; the id stays the primary key the routes work on.
function mapping_slug(db, player_id) {
  const nick = db.prepare('SELECT nickname FROM players WHERE player_id = ?').get(player_id)?.nickname || '';
  const base = nick.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^[-_]+|[-_]+$/g, '').slice(0, 24) || 'player';
  const taken = new Set(db.prepare('SELECT id FROM mappings').all().map((r) => r.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

export function create_mapping(db, {
  player_id, claim_id = null, partner_player_id = '', tournament = '', role = '',
  destination_type = 'internal', destination_url = '',
  display_override = '', override_by = '',
  variant = '',
}) {
  const id = mapping_slug(db, player_id);
  db.prepare(`INSERT INTO mappings
    (id, player_id, claim_id, partner_player_id, tournament, role, destination_type,
     destination_url, display_override, override_by, override_at, published, variant, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, player_id, claim_id || null, partner_player_id, tournament, role,
         destination_type, destination_url, display_override, override_by,
         display_override ? now() : 0, 1, variant, now());
  return get_mapping(db, id);
}

export function update_mapping(db, id, {
  claim_id, partner_player_id = '', tournament = '', role = '',
  destination_type = 'internal', destination_url = '',
  display_override = '', override_by = '',
  variant = '',
}) {
  const info = db.prepare(`UPDATE mappings SET
      claim_id = ?, partner_player_id = ?, tournament = ?, role = ?,
      destination_type = ?, destination_url = ?,
      display_override = ?, override_by = ?, override_at = ?, variant = ?
    WHERE id = ?`)
    .run(claim_id || null, partner_player_id, tournament, role,
         destination_type, destination_url, display_override, override_by,
         display_override ? now() : 0, variant, id);
  return info.changes > 0 ? get_mapping(db, id) : null;
}

const MAPPING_SELECT = `
  SELECT m.*,
         COALESCE(c.alias, '')   AS alias,
         COALESCE(c.verified, 0) AS verified,
         COALESCE(c.method, '')  AS method,
         m.player_id             AS player_id,
         p.nickname AS current_nickname, p.avatar, p.country, p.elo, p.skill_level, p.source, p.stats_json,
         pp.nickname AS partner_nickname, pp.avatar AS partner_avatar, pp.country AS partner_country,
         pp.elo AS partner_elo, pp.skill_level AS partner_level, pp.player_id AS partner_id,
         pp.stats_json AS partner_stats_json
  FROM mappings m
  JOIN players p  ON p.player_id = m.player_id
  LEFT JOIN claims c ON c.id = m.claim_id
  LEFT JOIN players pp ON pp.player_id = m.partner_player_id
`;

export function get_mapping(db, id) {
  return db.prepare(`${MAPPING_SELECT} WHERE m.id = ?`).get(id) ?? null;
}

export function list_mappings(db) {
  return db.prepare(`${MAPPING_SELECT} ORDER BY m.created_at DESC`).all();
}

// A record is identified by its pair of players, so pressing Launch twice updates
// the same row instead of creating a twin.
export function find_mapping_by_players(db, player_id, partner_player_id = '') {
  return db.prepare(
    'SELECT * FROM mappings WHERE player_id = ? AND partner_player_id = ? ORDER BY created_at DESC LIMIT 1',
  ).get(player_id, partner_player_id || '') ?? null;
}

export function find_mapping_by_claim(db, claim_id) {
  return db.prepare('SELECT * FROM mappings WHERE claim_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(claim_id) ?? null;
}

export function delete_mapping(db, id) {
  const info = db.prepare('DELETE FROM mappings WHERE id = ?').run(id);
  return info.changes > 0;
}

export function set_published(db, id, published) {
  const info = db.prepare('UPDATE mappings SET published = ? WHERE id = ?').run(published ? 1 : 0, id);
  return info.changes > 0;
}

// ---------- oauth state ----------

export function put_state(db, state, admin_id) {
  db.prepare('INSERT INTO oauth_states (state, admin_id, created_at) VALUES (?,?,?)')
    .run(state, admin_id, now());
}

export function put_pending(db, state, admin_id, player_id, nickname) {
  db.prepare('INSERT INTO pending_claims (state, admin_id, player_id, nickname, created_at) VALUES (?,?,?,?,?)')
    .run(state, admin_id, player_id, nickname, now());
}

export function take_pending(db, state, admin_id) {
  const row = db.prepare('SELECT * FROM pending_claims WHERE state = ?').get(state);
  if (!row) return null;
  db.prepare('DELETE FROM pending_claims WHERE state = ?').run(state);
  if (row.admin_id !== admin_id) return null;
  if (row.created_at < now() - 10 * 60 * 1000) return null;
  return row;
}

export function take_state(db, state) {
  const row = db.prepare('SELECT * FROM oauth_states WHERE state = ?').get(state);
  if (!row) return null;
  db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);
  if (row.created_at < now() - 10 * 60 * 1000) return null;
  return row;
}
