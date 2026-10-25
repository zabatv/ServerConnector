//не удалять
// src/render.js — templates. Every interpolation goes through esc().
import { ROLE_LABELS } from './destination.js';
import { esc, document_page } from './render_util.js';
import { fmt_ua } from './ua.js';
import { faceit_page } from './faceit_page.js';
import { shell_page, shell_profile } from './shell/index.js';

export { esc };

const FLAGS = { rs: '🇷🇸', fr: '🇫🇷', de: '🇩🇪', us: '🇺🇸', ru: '🇷🇺', ua: '🇺🇦', pl: '🇵🇱', se: '🇸🇪', gb: '🇬🇧', br: '🇧🇷' };
const flag = (cc) => FLAGS[String(cc || '').toLowerCase()] ?? '';
const day = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : '—');
const dtm = (ms) => new Date(ms).toLocaleString('ru-RU', {
  year: 'numeric', month: 'short', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
});

function layout({ title, body, nav = '', body_class = '' }) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Rostrum</title>
<meta name="robots" content="noindex">
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="/favicon.ico" type="image/jpeg">
</head>
<body class="${body_class}">
${nav}
<main>${body}</main>
</body>
</html>`;
}

const nav = (session) => `<header class="topbar">
  <a class="brand" href="/"><span class="mark" aria-hidden="true"></span>Rostrum</a>
  <nav class="links">
    ${session
      ? `${session.role === 'developer' ? '<span class="pill warn">ROLE: DEVELOPER — только просмотр</span>' : ''}
         <a href="/admin">Панель</a><a href="/admin/claim">Claim</a>
         <form method="post" action="/admin/logout" class="inline">
           <input type="hidden" name="csrf" value="${esc(session.csrf)}">
           <button class="linkish" type="submit">Выйти</button>
         </form>`
      : `<a href="/admin">Вход</a>`}
  </nav>
</header>`;

const banner = (msg, kind = 'info') =>
  msg ? `<p class="banner ${esc(kind)}" role="${kind === 'error' ? 'alert' : 'status'}" data-testid="banner-${esc(kind)}">${esc(msg)}</p>` : '';

const role_chip = (role) => (ROLE_LABELS[role]
  ? `<span class="role-chip" data-testid="role-chip">${esc(ROLE_LABELS[role])}</span>`
  : '');

export function login_page({ error, notice } = {}) {
  return layout({
    title: 'Вход',
    nav: nav(null),
    body_class: 'bench',
    body: `<section class="panel-bench narrow">
      <p class="eyebrow">ДОСТУП</p>
      <h1 class="bench-h1">Вход для оператора</h1>
      <p class="bench-sub">Алиасы здесь не назначаются — их подтверждает владелец аккаунта.</p>
      ${banner(error, 'error')}${banner(notice, 'ok')}
      <form method="post" action="/admin/login" class="setup" data-testid="login-form">
        <div class="field"><label for="u">ЛОГИН</label>
          <input id="u" name="username" autocomplete="username" required></div>
        <div class="field"><label for="p">ПАРОЛЬ</label>
          <input id="p" name="password" type="password" autocomplete="current-password" required></div>
        <button class="launch" type="submit">ВОЙТИ</button>
      </form>
    </section>`,
  });
}

function status_pill(verified, method) {
  if (verified) return `<span class="pill ok" data-testid="proof-verified">подтверждён</span>`;
  return `<span class="pill warn" data-testid="proof-unverified" title="Без доказательства владения (${esc(method)})">НЕ ПОДТВЕРЖДЁН</span>`;
}

const role_options = (current = '') => Object.entries(ROLE_LABELS)
  .map(([value, label]) => `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label || '— нет —')}</option>`)
  .join('');

export function admin_page({ session, players, claims, mappings, status, notice, error, draft = null, audit = null, fresh_a = '', fresh_b = '', origin = '' }) {
  // Suggestions only: the inputs accept any nickname, known or not.
  const suggestions = players.map((p) => `<option value="${esc(p.nickname)}"></option>`).join('');

  // После ЗАПУСТИТЬ: два свежих слага в redirect и под формой — копируй сразу.
  const base = origin ? `${origin}/players/` : '/players/';
  const copybar = fresh_a ? `
        <div class="copybar" data-testid="copy-links">
          <p class="eyebrow">СКОПИРОВАТЬ</p>
          <div class="copyrow"><span class="tag">А</span><code>${esc(base)}${esc(fresh_a)}</code><button class="btn dark tiny" data-copy="${esc(fresh_a)}" type="button" aria-label="Скопировать ссылку А">COPY</button></div>
          ${fresh_b ? `<div class="copyrow"><span class="tag">Б</span><code>${esc(base)}${esc(fresh_b)}</code><button class="btn dark tiny" data-copy="${esc(fresh_b)}" type="button" aria-label="Скопировать ссылку Б">COPY</button></div>` : ''}
        </div>` : '';



  return layout({
    title: 'Панель',
    nav: nav(session),
    body_class: 'bench',
    body: `
    <section class="panel-bench center" data-testid="roster">
      <p class="eyebrow">НАСТРОЙКА</p>

          <form method="post" action="/admin/launch" class="setup" data-testid="launch-form">
            <input type="hidden" name="csrf" value="${esc(session.csrf)}">
            <div class="field">
              <label for="pa">МОЙ ПРОФИЛЬ <span>(A · мой ник на FACEIT)</span></label>
              <input id="pa" name="player_a" list="known-players" maxlength="32" required
                     value="${esc(draft?.player_a ?? '')}" placeholder="ник на FACEIT" data-testid="player-a">
            </div>

            <div class="field">
              <label for="pb">НИК ЖЕРТВЫ <span>(B · профиль жертвы)</span></label>
              <input id="pb" name="player_b" list="known-players" maxlength="32"
                     value="${esc(draft?.player_b ?? '')}" placeholder="ник жертвы" data-testid="player-b">
            </div>
            <datalist id="known-players">${suggestions}</datalist>

            <div class="field">
              <label for="display">DISPLAY NICKNAME <span>(C · ПЕЧАТАЕТСЯ В ПРОФИЛЕ)</span></label>
              <input id="display" name="display_override" maxlength="24" value="${esc(draft?.display_override ?? '')}"
                     placeholder="пусто = подтверждённый алиас" data-testid="display-nick">
              <span class="hint" data-testid="verified-alias-hint">пусто — печатается реальный ник; алиас берётся из claim, если он есть</span>
            </div>

            <div class="field">
              <label for="dtype">НАЗНАЧЕНИЕ</label>
              <select id="dtype" name="destination_type" data-testid="destination-type">
                <option value="internal"${!draft || draft.destination_type !== 'external' ? ' selected' : ''}>внутренняя страница</option>
                <option value="external"${draft?.destination_type === 'external' ? ' selected' : ''}>внешний сайт</option>
              </select>
            </div>

            <div class="field">
              <label for="durl">REDIRECT URL <span>(КНОПКА ADD FRIEND)</span></label>
              <input id="durl" name="destination_url" placeholder="https://мой-домен/target"${draft && draft.destination_type === 'external' ? '' : ' disabled'} value="${esc(draft?.destination_url ?? '')}" data-testid="destination-url">
            </div>

            <button class="launch" type="submit">ЗАПУСТИТЬ</button>
          </form>

          ${banner(notice, 'ok')}${banner(error, 'error')}
          ${copybar}
        </section>
    <div class="launch-progress" data-testid="launch-progress" hidden>
      <div class="lp-card">
        <p class="lp-title">Создание ссылки</p>
        <div class="lp-track"><div class="lp-fill" data-testid="launch-progress-fill"></div></div>
        <p class="lp-step" data-testid="launch-progress-step">Готовим запрос…</p>
      </div>
    </div>
    <p class="sr-only" aria-live="polite" data-testid="copy-status"></p>
    <script src="/admin.js?v=5" defer></script>`,
  });
}

export function claim_page({ session, status, error, notice }) {
  return layout({
    title: 'Claim',
    nav: nav(session),
    body_class: 'bench',
    body: `<section class="panel-bench" data-testid="claim-page">
      <p class="eyebrow">CLAIM</p>
      <h1 class="bench-h1">Заявка на алиас</h1>
      <p class="bench-sub">Алиас — это имя, привязанное к <em>твоему</em> аккаунту. Доказательство владения и есть весь смысл: именно оно позволяет печатать кастомное имя, не выдавая его за чужое.</p>
      ${banner(error, 'error')}${banner(notice, 'ok')}
      ${status.oauth
        ? `<p class="bench-sub">Дальше уходишь на FACEIT, входишь там и возвращаешься с доказательством, привязанным к id аккаунта.</p>
           <p><a class="launch inline-launch" href="/claim/start" data-testid="claim-verify">ПОДТВЕРДИТЬ ЧЕРЕЗ FACEIT</a></p>`
        : `<p class="banner error" role="alert">FACEIT OAuth не настроен — доказать владение нельзя.</p>
           <p class="bench-sub">Нужны <code>FACEIT_CLIENT_ID</code>, <code>FACEIT_CLIENT_SECRET</code> и <code>PUBLIC_ORIGIN</code>. Redirect URI: <code>&lt;PUBLIC_ORIGIN&gt;/claim/callback</code>.</p>`}

      ${status.dev_claims ? `<p class="banner warn" role="alert">Локальная ветка без доказательства. Всё, что из неё получится, навсегда помечено «НЕ ПОДТВЕРЖДЁН».</p>
        <form method="post" action="/claim/dev" class="setup" data-testid="dev-claim-form">
          <input type="hidden" name="csrf" value="${esc(session.csrf)}">
          <div class="field"><label for="dn">РЕАЛЬНЫЙ НИК (сначала загрузи его)</label>
            <input id="dn" name="nickname" required maxlength="32"></div>
          <div class="field"><label for="da">АЛИАС</label>
            <input id="da" name="alias" required maxlength="24" pattern="[A-Za-z0-9 _\\-.]{1,24}"></div>
          <button class="launch" type="submit">СОЗДАТЬ БЕЗ ПОДТВЕРЖДЕНИЯ</button>
        </form>` : ''}
    </section>`,
  });
}

export function alias_step({ session, real_nickname, player_id }) {
  return layout({
    title: 'Алиас',
    nav: nav(session),
    body_class: 'bench',
    body: `<section class="panel-bench narrow" data-testid="alias-step">
      <p class="eyebrow">АККАУНТ ПОДТВЕРЖДЁН</p>
      <h1 class="bench-h1">${esc(real_nickname)}</h1>
      <p class="bench-sub">Аккаунт привязан к сессии. Выбери имя, которое будет напечатано над ним.</p>
      <form method="post" action="/claim/finish" class="setup">
        <input type="hidden" name="csrf" value="${esc(session.csrf)}">
        <input type="hidden" name="player_id" value="${esc(player_id)}">
        <div class="field"><label for="al">АЛИАС</label>
          <input id="al" name="alias" required maxlength="24" pattern="[A-Za-z0-9 _\\-.]{1,24}" data-testid="alias-input"></div>
        <button class="launch" type="submit">СОЗДАТЬ CLAIM</button>
      </form>
    </section>`,
  });
}

const SVG = {
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.4" r="3.6"/><path d="M4.8 20c1.1-3.5 3.9-5.3 7.2-5.3s6.1 1.8 7.2 5.3"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4.5 19.5V11"/><path d="M9.8 19.5V5"/><path d="M15.2 19.5v-6"/><path d="M20.5 19.5V8.5"/></svg>',
  duo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8.6" cy="9" r="3"/><circle cx="16.4" cy="9" r="3"/><path d="M2.8 19c.8-3 2.9-4.6 5.8-4.6s5 1.6 5.8 4.6"/><path d="M14.7 14.6c2.7-.5 5 .9 6.5 4.4"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.2 19 6v5.4c0 4.2-2.8 7.5-7 9.4-4.2-1.9-7-5.2-7-9.4V6z"/><path d="m9 12 2.1 2.1L15.2 10"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.8 8.6h16.4v4H3.8z"/><path d="M5.4 12.6v7.6h13.2v-7.6"/><path d="M12 8.6v11.6"/><path d="M12 8.6C10.4 5.4 9 4 7.4 4 6 4 5 4.9 5 6.1c0 1.4 1.6 2.5 4 2.5z"/><path d="M12 8.6C13.6 5.4 15 4 16.6 4 18 4 19 4.9 19 6.1c0 1.4-1.6 2.5-4 2.5z"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.4"/><circle cx="12" cy="7.9" r=".9" fill="currentColor" stroke="none"/></svg>',
};

const fmt_n = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ru-RU') : '—');

// Skill level badge: neutral disc, arc = level/10, digits in the middle.
function skill_badge(level, size = 56) {
  const lv = Math.max(0, Math.min(10, Number(level) || 0));
  const circ = 2 * Math.PI * 20.5;
  const arc = (lv / 10) * circ;
  const label = lv ? String(lv) : '—';
  return `<svg class="lvlbadge" viewBox="0 0 48 48" width="${size}" height="${size}" role="img" aria-label="Уровень ${esc(label)}">
      <circle cx="24" cy="24" r="23" fill="#0d0d0d" stroke="#242424" stroke-width="1"/>
      <circle cx="24" cy="24" r="20.5" fill="none" stroke="#262626" stroke-width="2.6"/>
      <circle cx="24" cy="24" r="20.5" fill="none" stroke="#2fa972" stroke-width="2.6" stroke-linecap="round"
              stroke-dasharray="${arc.toFixed(1)} ${(circ - arc).toFixed(1)}" transform="rotate(-90 24 24)"/>
      <text x="24" y="24" text-anchor="middle" dominant-baseline="central"
            font-size="${label.length > 1 ? 15 : 17}" font-weight="800" fill="#f1f1f1">${esc(label)}</text>
    </svg>`;
}

const parse_stats = (raw) => { try { return JSON.parse(raw || 'null'); } catch { return null; } };

// The Data API has no elo history, so the performance panel plots the lifetime
// numbers as bars against a fixed scale instead of inventing a line chart.
const METRICS = [
  { key: 'kd', label: 'K/D', max: 2, show: (v) => Number(v).toFixed(2) },
  { key: 'kr', label: 'K/R', max: 1.2, show: (v) => Number(v).toFixed(2) },
  { key: 'hs', label: 'HS%', max: 100, show: (v) => `${v}%` },
  { key: 'adr', label: 'ADR', max: 150, show: (v) => Number(v).toFixed(1) },
  { key: 'winrate', label: 'Win rate', max: 100, show: (v) => `${v}%` },
];

function duel_rows(stats, peer) {
  return METRICS.map(({ key, label, max, show }) => {
    const mine = Number(stats?.[key]);
    if (!Number.isFinite(mine)) return '';
    const w = Math.max(2, Math.min(100, (mine / max) * 100)).toFixed(1);
    const other = peer ? Number(peer[key]) : NaN;
    const pw = Number.isFinite(other) ? Math.max(2, Math.min(100, (other / max) * 100)).toFixed(1) : null;
    return `<div class="duel-row">
        <span class="duel-k">${esc(label)}</span>
        <span class="duel-bars">
          <svg class="bar me" viewBox="0 0 100 7" preserveAspectRatio="none" aria-hidden="true"><rect width="${w}" height="7" rx="3.5"/></svg>
          ${pw === null ? '' : `<svg class="bar peer" viewBox="0 0 100 7" preserveAspectRatio="none" aria-hidden="true"><rect width="${pw}" height="7" rx="3.5"/></svg>`}
        </span>
        <span class="duel-v tnum">${esc(show(mine))}${pw === null ? '' : ` <span class="peer-v">/ ${esc(show(other))}</span>`}</span>
      </div>`;
  }).join('');
}

function stat_tiles(stats) {
  const cells = [
    [stats.kd, 'K/D'],
    [stats.kr, 'K/R'],
    [`${stats.hs}%`, 'HS%'],
    [stats.adr, 'ADR'],
    [`${stats.winrate}%`, 'Win rate'],
    [fmt_n(stats.matches), 'Матчи'],
  ];
  return `<div class="tiles" data-testid="stat-tiles">
    ${cells.map(([v, k]) => `<div class="tile"><span class="v tnum">${esc(v ?? '—')}</span><span class="k">${esc(k)}</span></div>`).join('')}
  </div>`;
}

export function public_page({ m }) {
  // Variant A renders the second profile's card, so the fallback name comes
  // from that row too; the presenter override (C) still stamps over it.
  const card_nick = m.variant === 'A' ? (m.partner_nickname || m.current_nickname) : m.current_nickname;
  const shown = m.display_override || m.alias || card_nick;
  // Rendered from the captured FACEIT DOM (src/shell/body.html): the real element
  // tree, with this mapping's data filled into its slots.
  return shell_page({
    title: `${esc(shown)} - Player Profile`,
    body: shell_profile({ m, shown }),
  });
}

export function error_page({ code, message }) {
  return layout({
    title: String(code),
    nav: nav(null),
    body_class: 'bench',
    body: `<section class="panel-bench narrow" data-testid="error-page"><h1 class="bench-h1">${esc(code)}</h1>
      <p class="bench-sub">${esc(message)}</p>
      <p><a class="btn dark" href="/admin">К панели</a></p></section>`,
  });
}
