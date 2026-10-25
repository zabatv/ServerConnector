//не удалять
// src/collect.js — the "no API key" provider.
//
// The live site renders its own data from same-origin JSON endpoints under
// /api/… . A plain server-side fetch gets a Cloudflare challenge; a request made
// *inside* the page context carries the browser's cookies and clearance, so that
// is what this module does: open the profile in a real Chrome (the one already
// running with --remote-debugging-port, or a server one), then ask the page to
// fetch its own endpoints and hand back JSON.
//
// Env:
//   CHROME_CDP   CDP endpoint of a Chrome that is signed in to faceit.com
//                (default http://127.0.0.1:9222)
//   COLLECT_DEBUG=1  dump the raw payloads to /tmp/collect-debug.json
//
// Nothing here parses markup except the "is this a challenge / a 404" check.

import { writeFileSync } from 'node:fs';

const cdp_url = () => process.env.CHROME_CDP || 'http://127.0.0.1:9222';

export class CollectError extends Error {
  constructor(message, { code = 'collect_error', status = 0 } = {}) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const has_browser = () => Boolean(cdp_url());

let browser_promise = null;
async function browser() {
  if (!browser_promise) {
    // Imported lazily: api deployments never load the browser build.
    const { chromium } = await import('playwright').catch(() => {
      throw new CollectError('playwright is not installed — run npm install, or set PROVIDER=api.', { code: 'no_playwright' });
    });
    browser_promise = chromium.connectOverCDP(cdp_url()).catch((err) => {
      browser_promise = null;
      throw new CollectError(
        `Chrome is not reachable on ${cdp_url()} — start it with --remote-debugging-port=9222. (${err.message})`,
        { code: 'no_browser' },
      );
    });
  }
  const b = await browser_promise;
  if (!b.isConnected()) {
    browser_promise = null;
    return browser();
  }
  return b;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const pct = (wins, matches) => (matches ? Math.round((wins / matches) * 100) : null);

function normalise_user(raw) {
  const u = Array.isArray(raw?.payload) ? raw.payload[0] : raw?.payload;
  if (!u?.id) return null;
  const cs2 = u.games?.cs2 ?? {};
  return {
    player_id: u.id,
    nickname: u.nickname,
    avatar: u.avatar || null,
    cover: u.cover || u.cover_image || u.coverImage || null,
    country: u.country || null,
    elo: num(cs2.faceit_elo),
    skill_level: num(cs2.skill_level),
    since: u.activated_at ? new Date(u.activated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,
  };
}

const MAPS = {
  de_mirage: ['Mirage', 'b412609d-c2a7-40ce-8b82-79e193da1c9c'],
  de_dust2: ['Dust 2', 'c1040791-5184-4d9e-85e0-f4ee9f60b385'],
  de_nuke: ['Nuke', '723663eb-485e-4121-b367-bf43a16f8b3d'],
  de_inferno: ['Inferno', 'e8a79a43-e6b8-42e4-b6ee-2dc366365e60'],
  de_ancient: ['Ancient', ''],
  de_anubis: ['Anubis', ''],
  de_vertigo: ['Vertigo', ''],
  de_overpass: ['Overpass', ''],
  de_train: ['Train', ''],
};
const map_name = (m) => (MAPS[m] ? MAPS[m][0] : String(m || '—').replace(/^de_/, '').replace(/^./, (c) => c.toUpperCase()));
const map_icon = (m) => (MAPS[m] && MAPS[m][1] ? `https://distribution.faceit-cdn.net/images/${MAPS[m][1]}.png?width=48&height=48` : null);

const rounds_of = (raw) => {
  const cs2 = raw?.payload?.cs2 ?? {};
  return cs2.matchRounds ?? cs2.match_rounds ?? raw?.payload?.rounds ?? [];
};
const pick = (o, ...names) => { for (const n of names) if (o[n] !== undefined) return o[n]; return undefined; };

function normalise_rounds(raw) {
  const list = rounds_of(raw);
  if (!Array.isArray(list)) return [];
  return list.slice(0, 30).map((r) => {
    const d = new Date(pick(r, 'endTime', 'end_time', 'startTime', 'start_time') ?? 0);
    const before = Number(pick(r, 'eloBefore', 'elo_before'));
    const delta = Number(pick(r, 'eloDelta', 'elo_delta'));
    // Older rows carry elo 0 — that is "not recorded", not a rating.
    const eloAfter = Number.isFinite(before) && before > 0 && Number.isFinite(delta) ? before + delta : null;
    return {
      day: `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`,
      time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      result: pick(r, 'win') ? 'W' : 'L',
      score: `${pick(r, 'teamScore', 'team_score') ?? '—'} : ${pick(r, 'opponentTeamScore', 'opponent_team_score') ?? '—'}`,
      map: map_name(pick(r, 'map')),
      map_icon: map_icon(pick(r, 'map')),
      kd: Number.isFinite(Number(pick(r, 'kd'))) ? Number(pick(r, 'kd')).toFixed(2) : null,
      kda: `${pick(r, 'kills') ?? '—'} / ${pick(r, 'deaths') ?? '—'} / ${pick(r, 'assists') ?? '—'}`,
      elo: eloAfter,
      delta: eloAfter != null && delta !== 0 ? (delta > 0 ? `+${delta}` : String(delta)) : null,
      up: delta > 0,
      rating: Number.isFinite(Number(pick(r, 'faceitRating', 'faceit_rating'))) ? Number(pick(r, 'faceitRating', 'faceit_rating')).toFixed(2) : null,
    };
  });
}

// The reference card is "Recent performance — Last 30 Matches", so the six
// numbers are aggregated over the same 30 rounds the API returns.
function aggregate(list, recent) {
  const rounds_played = list.reduce((a, r) => a + (Number(pick(r, 'roundsPlayed', 'rounds_played')) || 0), 0);
  const kills = list.reduce((a, r) => a + (Number(r.kills) || 0), 0);
  const deaths = list.reduce((a, r) => a + (Number(r.deaths) || 0), 0);
  const assists = list.reduce((a, r) => a + (Number(r.assists) || 0), 0);
  const hs = list.reduce((a, r) => a + (Number(r.headshots) || 0), 0);
  const dmg = list.reduce((a, r) => a + (Number(r.damage) || 0), 0);
  const wins = recent.filter((r) => r.result === 'W').length;
  const elo_change = list.reduce((a, r) => a + (Number(pick(r, 'eloDelta', 'elo_delta')) || 0), 0);
  const n = list.length;
  // The live card shows per-match averages (17 / 15 / 4, K/D 1.12), not ratios of
  // totals — so average the per-round values where the payload carries them.
  const mean_of = (fn) => {
    const vals = list.map((r) => fn(r)).map(Number).filter((v) => Number.isFinite(v) && v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const kd_mean = mean_of((r) => (Number(r.deaths) > 0 ? Number(r.kills) / Number(r.deaths) : null));
  const hs_mean = mean_of((r) => (Number(r.kills) > 0 ? (Number(r.headshots) / Number(r.kills)) * 100 : null));
  const adr_mean = mean_of((r) => (Number(pick(r, 'roundsPlayed', 'rounds_played')) > 0 ? Number(r.damage) / Number(pick(r, 'roundsPlayed', 'rounds_played')) : null));
  return {
    kd: kd_mean != null ? Number(kd_mean.toFixed(2)) : (deaths ? Number((kills / deaths).toFixed(2)) : null),
    kr: rounds_played ? Number((kills / rounds_played).toFixed(2)) : null,
    hs: hs_mean != null ? Math.round(hs_mean) : (kills ? Math.round((hs / kills) * 100) : null),
    adr: adr_mean != null ? Number(adr_mean.toFixed(1)) : (rounds_played ? Number((dmg / rounds_played).toFixed(1)) : null),
    kda: n ? `${Math.round(kills / n)} / ${Math.round(deaths / n)} / ${Math.round(assists / n)}` : null,
    wins,
    losses: recent.length - wins,
    winrate_recent: recent.length ? Math.round((wins / recent.length) * 100) : null,
    elo_change: elo_change ? (elo_change > 0 ? `+${elo_change}` : String(elo_change)) : null,
  };
}

// The perf-card rating widgets are not in the Data API; they are derived from the
// same 30 round ratings the chart uses. FACEIT's exact formulas are not public, so
// swing (later half vs earlier half) and consistency (100 − stdev/mean) are
// documented approximations.
function rating_widgets(list) {
  const chrono = list.map((r) => num(pick(r, 'faceitRating', 'faceit_rating'))).filter((v) => v != null).reverse();
  if (chrono.length < 4) return {};
  const mean = chrono.reduce((a, b) => a + b, 0) / chrono.length;
  const half = Math.max(1, Math.floor(chrono.length / 2));
  const older = chrono.slice(0, half);
  const newer = chrono.slice(chrono.length - half);
  const older_mean = older.reduce((a, b) => a + b, 0) / older.length;
  const newer_mean = newer.reduce((a, b) => a + b, 0) / newer.length;
  const swing_pct = older_mean ? ((newer_mean - older_mean) / older_mean) * 100 : 0;
  const variance = chrono.reduce((a, b) => a + (b - mean) ** 2, 0) / chrono.length;
  const consistency = mean ? Math.max(0, Math.min(100, 100 - (Math.sqrt(variance) / mean) * 100)) : 0;
  return {
    avg_rating: mean.toFixed(2),
    rating_history: chrono.map((v) => Number(v.toFixed(2))),
    rating_swing: `${swing_pct > 0 ? '+' : ''}${swing_pct.toFixed(2)}%`,
    rating_consistency: `${Math.round(consistency)}%`,
  };
}

// The Elo-widget ranks and the profile about-line exist only on the profile page.
// A short navigation inside the signed-in browser reads them off the card the same
// way a visitor sees them; best effort — any failure yields empty fields.
async function page_extras(page, nickname) {
  const url = `https://www.faceit.com/en/players/${encodeURIComponent(nickname)}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const title = await page.title();
    if (/just a moment|attention required|not found/i.test(title)) return {};
    // The SPA hydrates the card asynchronously — anonymous visits do render it, but
    // later than DOMContentLoaded, so poll for the widgets instead of a fixed wait.
    await page.waitForSelector("[class*='RankPill']", { timeout: 25_000 }).catch(() => {});
    // Recent performance hydrates on its own beat; without it we would fall back
    // to the Data-API approximations, which visibly drift from the site's math.
    await page.waitForSelector("[class*='StatsGrid'], [class*='FaceitRating__RatingValue']", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(600);
    // The cover background can land a beat later than the pills; poll for it.
    await page.waitForFunction(() => {
      const els = document.querySelectorAll('[data-playercard], [class*="CardContent"], [class*="styles__Card-"], [class*="Cover"]');
      for (const el of els) {
        const bg = getComputedStyle(el).backgroundImage;
        if (bg && bg.includes('url(')) return true;
      }
      return false;
    }, { timeout: 10_000 }).catch(() => {});
    return await page.evaluate(() => {
      const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
      const num_of = (el) => { const m = text(el).match(/\d[\d,\.]*/); return m ? Number(m[0].replace(/,/g, '')) : null; };
      const pills = [...document.querySelectorAll("[class*='RankPill']")];
      const region_el = pills[1];
      const season = [...document.querySelectorAll("[class*='MatchesStat']")].map((el) => text(el));

      // --- Recent performance card: the site's own numbers, read where they print ---
      const tile_label = /K\/D\/A|K\/D|K\/R|HS%|ADR|Win rate/;
      const tiles = {};
      for (const el of document.querySelectorAll("[class*='StatsGrid'] > div")) {
        const t = text(el);
        const label = (t.match(tile_label) || [])[0];
        if (!label) continue;
        tiles[label] = t.slice(0, t.length - label.length).trim();
      }
      const strip_pct = (s) => { const m = String(s).match(/-?[\d.]+/); return m ? Number(m[0]) : null; };

      const wins_bar = text(document.querySelector("[class*='WinsBar__Container']"));
      const elo_m = wins_bar.match(/Elo change\s*(\+?-?\d[\d,]*)/);
      const w_m = wins_bar.match(/\bW\s*(\d+)/);
      const l_m = wins_bar.match(/\bL\s*(\d+)/);
      // FACEIT prints the sign in the token; strip and normalise so we never
      // double a leading "+".
      const elo_norm = elo_m ? (() => {
        const v = Number(elo_m[1].replace(/^\+/, '').replace(/,/g, ''));
        return Number.isFinite(v) ? (v > 0 ? `+${v}` : String(v)) : null;
      })() : null;

      const skill_trigger = text(document.querySelector("[class*='MatchesSkillLevel__PopoverTrigger']")) || '';
      const avg_skill_m = skill_trigger.match(/([\d][\d,\.]*)\s*Avg\s+skill/) ?? skill_trigger.match(/Avg skill[^]*([\d][\d,\.]*)/);

      const rank_badge_el = document.querySelector("[class*='RankBadge']");

      const perf = {
        avg_rating: text(document.querySelector("[class*='FaceitRating__RatingValue']")) || null,
        rating_swing: text(document.querySelector("[class*='FaceitRatingSwing']")) || null,
        rating_consistency: text(document.querySelector("[class*='Consistency__ConsistencyText']")) || null,
        avg_skill: avg_skill_m ? Number(avg_skill_m[1].replace(/,/g, '')) : null,
        challenger_rank: rank_badge_el ? text(rank_badge_el).replace(/^\D*#?|^\/?\D*?/, '').replace(/\D.*$/, '') || text(rank_badge_el) : null,
        challenger_rank_raw: rank_badge_el ? text(rank_badge_el) : null,
        elo_change: elo_norm,
        wins_recent: w_m ? Number(w_m[1]) : null,
        losses_recent: l_m ? Number(l_m[1]) : null,
        kd: tiles['K/D'] ?? null,
        kr: tiles['K/R'] ?? null,
        hs: tiles['HS%'] ? strip_pct(tiles['HS%']) : null,
        adr: tiles['ADR'] ?? null,
        kda: tiles['K/D/A'] ?? null,
        winrate_recent: tiles['Win rate'] ? Number(tiles['Win rate'].replace('%', '')) : null,
      };

      // The cover background can land a beat later than the pills; poll for it.
      // The card carries the profile cover as a CSS background (inline style on the
      // live page); read it as a fallback when the API payload has no cover field.
      let cover = null;
      for (const el of document.querySelectorAll('[data-playercard], [class*="CardContent"], [class*="styles__Card-"], [class*="Cover"]')) {
        const bg = getComputedStyle(el).backgroundImage;
        const m = bg && bg.match(/url\("?(https:[^")]+)"?\)/);
        if (m) { cover = m[1]; break; }
      }
      return {
        about: text(document.querySelector("[class*='AboutText']")) || null,
        cover,
        country_rank: num_of(pills[0]),
        region_rank: num_of(region_el),
        region: region_el ? (region_el.querySelector('i[title]')?.getAttribute('title') || 'EU') : null,
        season_matches: season[0] ? Number((season[0].match(/\d[\d,]*/) || [])[0]?.replace(/,/g, '')) || null : null,
        season_winrate: season[1] ? Number((season[1].match(/[\d.]+/) || [])[0]) || null : null,
        ...perf,
      };
    });
  } catch { return {}; }
}

function normalise_activity(raw) {
  if (!Array.isArray(raw)) return [];
  const by_day = new Map(raw.map((d) => [new Date(d.date).toISOString().slice(0, 10), d.matches ?? 0]));
  const out = [];
  const today = new Date();
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    out.push(by_day.get(d) ?? 0);
  }
  return out;
}

function normalise_history(raw) {
  const list = raw?.payload?.items ?? raw?.payload ?? [];
  return Array.isArray(list) ? list : [];
}

export async function collect(nickname) {
  const b = await browser();
  const ctx = b.contexts()[0];
  if (!ctx) throw new CollectError('The browser has no context to work in.', { code: 'no_context' });
  const page = await ctx.newPage();
  const url = 'https://www.faceit.com/en/';
  try {
    // A light page is enough: the fetches below are same-origin, so they carry the
    // session. Rendering a full profile SPA would cost ~10s for the same JSON.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch((err) => {
      throw new CollectError(`Could not open ${url}: ${err.message}`, { code: 'network' });
    });
    // A managed challenge can take a few seconds to clear; wait it out before
    // calling it a block (a signed-in desktop Chrome clears it silently).
    let title = await page.title();
    for (let i = 0; i < 12 && /just a moment|attention required/i.test(title); i++) {
      await page.waitForTimeout(2000);
      title = await page.title();
    }
    if (/just a moment|attention required/i.test(title)) {
      throw new CollectError('FACEIT answered with a Cloudflare challenge — sign in to that browser once and retry.', { code: 'challenge' });
    }

    const data = await page.evaluate(async (nick) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const get = async (path) => {
        try {
          const r = await fetch(path, { credentials: 'include', headers: { accept: 'application/json' } });
          const text = await r.text();
          try { return { status: r.status, json: JSON.parse(text) }; } catch { return { status: r.status, json: null, text: text.slice(0, 120) }; }
        } catch (err) { return { status: 0, json: null, text: String(err) }; }
      };
      // The shell hydrates its session after load; retry briefly instead of guessing a delay.
      let user = await get(`/api/users/v1/nicknames/${encodeURIComponent(nick)}`);
      for (let i = 0; i < 6 && (user.status === 0 || user.status === 401 || user.status === 403); i++) {
        await sleep(700);
        user = await get(`/api/users/v1/nicknames/${encodeURIComponent(nick)}`);
      }
      const id = user?.json?.payload?.id ?? user?.json?.payload?.[0]?.id;
      if (!id) return { user, id: null };
      // The shell hydrates its session after load; every endpoint retries briefly
      // instead of trusting one response that raced the hydration.
      const get_retry = async (path) => {
        let r = await get(path);
        for (let i = 0; i < 4 && (r.status === 0 || r.status === 401 || r.status === 403); i++) {
          await sleep(600);
          r = await get(path);
        }
        return r;
      };
      const [career, rounds, activity] = await Promise.all([
        get_retry(`/api/statistics/v1/cs2/players/${id}/career-stats`),
        get_retry(`/api/statistics/v1/cs2/players/${id}/match-rounds?limit=30`),
        get_retry(`/api/stats/v3/stats/activity/${id}?numberOfDays=90`),
      ]);
      return { user, career, rounds, activity, id };
    }, nickname);

    if (process.env.COLLECT_DEBUG === '1') {
      writeFileSync('/tmp/collect-debug.json', JSON.stringify(data, null, 1));
    }

    const user = normalise_user(data.user?.json);
    if (!user) {
      const status = data.user?.status ?? 0;
      if (status === 404) throw new CollectError(`No FACEIT player named "${nickname}".`, { code: 'not_found', status: 404 });
      throw new CollectError(`FACEIT did not return a player for "${nickname}" (status ${status || 'network'}).`, { code: 'shape' });
    }

    const cs2 = data.career?.json?.payload?.cs2 ?? {};
    // The career payload nests lifetime totals with capitalised keys (Matches/Wins).
    const lifetime = cs2.lifetime ?? {};
    const matches = num(lifetime.Matches ?? lifetime.matches ?? cs2.matches);
    const wins = num(lifetime.Wins ?? lifetime.wins ?? cs2.wins);
    const rounds_raw = rounds_of(data.rounds?.json);
    const recent = normalise_rounds(data.rounds?.json);
    const agg = aggregate(rounds_raw, recent);
    const widgets = rating_widgets(rounds_raw);
    const history = rounds_raw
      .slice()
      .reverse()
      .map((r) => num(pick(r, 'eloBefore', 'elo_before')))
      .filter((v) => v != null && v > 0);

    const stats = {
      matches,
      wins,
      losses: matches != null && wins != null ? matches - wins : null,
      winrate: pct(wins, matches),
      kd: agg.kd,
      kr: agg.kr,
      hs: agg.hs,
      adr: agg.adr,
      kda: agg.kda,
      elo_change: agg.elo_change,
      wins_recent: agg.wins,
      losses_recent: agg.losses,
      winrate_recent: agg.winrate_recent,
      ...widgets,
      history,
      activity: normalise_activity(data.activity?.json),
      recent,
      since: user.since,
      collected_at: new Date().toISOString(),
    };
    if (user.cover) stats.cover = user.cover;
    const extras = await page_extras(page, nickname);
    for (const [k, v] of Object.entries(extras)) if (v !== null && v !== undefined && v !== '') stats[k] = v;

    return { player: { ...user, source: 'browser' }, stats };
  } finally {
    await page.close().catch(() => {});
  }
}
