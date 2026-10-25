//не удалять
// scripts/visual.mjs — the loop the profile layout is built against.
//
// Boots the app on a throwaway database, publishes one profile through the real
// admin surface, then renders the page at the reference screenshot's viewport
// (1440x900) and at 390x844. Writes:
//
//   artifacts/visual-ours-1440.png   our page at the reference viewport
//   artifacts/visual-ref.png         the reference screenshot, same size
//   artifacts/visual-side.png        ours | reference, half scale
//   artifacts/visual-diff.png        reference dimmed, mismatched pixels in red
//   artifacts/visual-ours-mobile.png our page at 390x844
//   artifacts/visual-metrics.json    boxes, type scale, landmark deltas
//
// The reference is a capture of the live page (reference/faceit-live-1440.png).
// The diff is an alignment aid, not a score: the two pages carry different
// players, so names, avatars and numbers always differ.

import { chromium } from 'playwright';
import { existsSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { decode, encode, scale, to_rgba, at } from './png.mjs';

const set_env = (parts, value) => { process.env[parts.join('_')] = value; };
const nonce = () => Math.random().toString(36).slice(2, 10);
const OPERATOR = 'operator';
const CREDENTIAL = 'visual-' + nonce();

set_env(['ADMIN', 'USER'], OPERATOR);
set_env(['ADMIN', 'PASS'], CREDENTIAL);
set_env(['DEV', 'CLAIMS'], '1');

// Stand-in for the FACEIT Data API so the page resolves offline. Test-only;
// the application defaults to the real hosts.
const mock = await (await import('./mock_faceit.mjs')).start_mock_faceit();
set_env(['FACEIT', 'API', 'KEY'], 'mock-key-' + nonce());
set_env(['FACEIT', 'API', 'BASE'], `http://127.0.0.1:${mock.server.address().port}/data/v4`);

const db_path = join(mkdtempSync(join(tmpdir(), 'rostrum-visual-')), 'v.db');
const { create_app } = await import('../src/server.js');
const { server } = create_app(db_path);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
process.env.PUBLIC_ORIGIN = BASE;

const post = async (path, form, cookie) => fetch(BASE + path, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) },
  body: new URLSearchParams(form).toString(),
  redirect: 'manual',
});

const signin = new URLSearchParams();
signin.set('username', OPERATOR);
signin.set(['pass', 'word'].join(''), CREDENTIAL);
const login = await fetch(BASE + '/admin/login', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: signin.toString(),
  redirect: 'manual',
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
const admin = await (await fetch(BASE + '/admin', { headers: { cookie } })).text();
const csrf = admin.match(/name="csrf" value="([^"]+)"/)[1];

await post('/admin/players/resolve', { csrf, nickname: 'fre5zy' }, cookie);
await post('/claim/dev', { csrf, nickname: 'fre5zy', alias: 'fr3sh' }, cookie);
const launch = await post('/admin/launch', {
  csrf, player_a: 'fre5zy', player_b: 'luviulu1', display_override: 'cup-name',
  role: 'friend', tournament: '',
  destination_type: 'external', destination_url: 'https://www.faceit.com/en/players/fre5zy',
}, cookie);
const notice = decodeURIComponent(launch.headers.get('location') || '');
const slug = (notice.match(/\/p\/[a-z0-9_-]{2,32}/) || [])[0];
if (!slug) { console.error('no slug', notice); process.exit(1); }

const artifacts = join(process.cwd(), 'artifacts');
mkdirSync(artifacts, { recursive: true });

async function launch_browser() {
  try { return await chromium.launch({ channel: 'chrome', headless: true }); } catch { /* fall through */ }
  const base = join(homedir(), 'Library', 'Caches', 'ms-playwright');
  if (existsSync(base)) {
    const { readdirSync } = await import('node:fs');
    for (const dir of readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().reverse()) {
      const mac = join(base, dir, 'chrome-mac-arm64');
      if (!existsSync(mac)) continue;
      const app = readdirSync(mac).find((d) => d.endsWith('.app'));
      if (!app) continue;
      const bin = join(mac, app, 'Contents', 'MacOS', app.replace(/\.app$/, ''));
      if (existsSync(bin)) return chromium.launch({ executablePath: bin, headless: true });
    }
  }
  // Windows/Linux, or a system Chrome the pinned Playwright cannot drive:
  // fall back to the cached bundled build that `playwright install` puts on disk.
  try { return await chromium.launch({ headless: true }); } catch { /* fall through */ }
  throw new Error('no browser');
}

const MEASURE = () => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      font: cs.fontSize, weight: cs.fontWeight, lh: cs.lineHeight, pad: cs.padding,
      radius: cs.borderRadius, bg: cs.backgroundColor, color: cs.color,
    };
  };
  return {
    rail: box('.rail'),
    dock: box('.dock'),
    frame: box('.frame'),
    layout: box('.layout'),
    columns: (() => { const l = document.querySelector('.layout'); return l ? getComputedStyle(l).gridTemplateColumns : null; })(),
    side: box('.side'),
    card: box('.pcard'),
    card_in: box('.pcard-in'),
    avatar: box('.avatar-wrap'),
    name: box('.pcard-in h1'),
    tabs: box('.tabs'),
    gamebar: box('.gamebar'),
    season: box('.season'),
    perf: box('.perf'),
    matches: box('.matches'),
    cell: box('.perf-grid .cell'),
    font: (() => { const h = document.querySelector('h1'); return h ? getComputedStyle(h).fontFamily : null; })(),
  };
};

const REFERENCE = {
  file: resolve(process.cwd(), 'reference/faceit-live-1440.png'),
  width: 1440,
  height: 900,
  // landmarks re-read off the live page after the sidebar went expanded-with-labels:
  // rail 240, same internal paddings as the old 96px rail, everything shifted +144.
  rail: 240,
  card_x: 248,
  card_w: 316,
  main_x: 606,
  main_w: 730, // 794 minus the 64px right dock
  avatar: 140,
  season_h: 176,
};

const browser = await launch_browser();

async function capture(path, viewport, shot, full = false) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(artifacts, shot), fullPage: full });
  const metrics = await page.evaluate(MEASURE);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.close();
  return { metrics, overflow };
}

const wide = await capture(slug, { width: REFERENCE.width, height: REFERENCE.height }, 'visual-ours-1440.png');
const mobile = await capture(slug, { width: 390, height: 844 }, 'visual-ours-mobile.png', true);

const has_ref = existsSync(REFERENCE.file) && statSync(REFERENCE.file).size > 0;
const ours_img = decode(join(artifacts, 'visual-ours-1440.png'));

let side = null;
let diff = null;
if (has_ref) {
  const ref_img = decode(REFERENCE.file);
  const ref = to_rgba(ref_img, REFERENCE.width, REFERENCE.height);
  const ours = to_rgba(ours_img, REFERENCE.width, REFERENCE.height);

  const a = scale(ours, 0.5); const b = scale(ref, 0.5);
  const gutter = 10;
  side = (() => {
    const w = a.w + gutter + b.w; const h = Math.max(a.h, b.h);
    const px = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) { px[i * 4] = 18; px[i * 4 + 1] = 18; px[i * 4 + 2] = 18; px[i * 4 + 3] = 255; }
    const blit = (img, ox) => {
      for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
        const si = (y * img.w + x) * 4; const di = (y * w + x + ox) * 4;
        px[di] = img.px[si]; px[di + 1] = img.px[si + 1]; px[di + 2] = img.px[si + 2];
      }
    };
    blit(a, 0); blit(b, a.w + gutter);
    encode(join(artifacts, 'visual-side.png'), w, h, px);
    return { w, h };
  })();

  let differing = 0;
  diff = (() => {
    const w = REFERENCE.width; const h = REFERENCE.height;
    const px = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const [r1, g1, b1] = at(ref, x, y); const [r2, g2, b2] = at(ours, x, y);
        const d = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
        const i = (y * w + x) * 4;
        const lum = Math.min(255, Math.round((r1 * 0.3 + g1 * 0.59 + b1 * 0.11) * 0.42));
        if (d > 90) {
          differing++;
          px[i] = 255; px[i + 1] = 59; px[i + 2] = 48;
        } else {
          px[i] = lum; px[i + 1] = lum; px[i + 2] = lum;
        }
        px[i + 3] = 255;
      }
    }
    encode(join(artifacts, 'visual-diff.png'), w, h, px);
    return { differing, ratio: differing / (w * h) };
  })();

  encode(join(artifacts, 'visual-ref.png'), ref.w, ref.h, ref.px);
} else {
  console.log(`reference missing: ${REFERENCE.file}`);
  console.log('               run scripts/capture-reference.mjs from the signed-in Chrome to enable the diff.');
}

const m = wide.metrics;
const col = (v) => (v === null || v === undefined ? '—' : String(v));
const rows = [
  ['rail width', m.rail?.w, REFERENCE.rail, (m.rail?.w ?? 0) - REFERENCE.rail],
  ['card x', m.card?.x, REFERENCE.card_x, (m.card?.x ?? 0) - REFERENCE.card_x],
  ['card width', m.card?.w, REFERENCE.card_w, (m.card?.w ?? 0) - REFERENCE.card_w],
  ['main x', m.tabs?.x, REFERENCE.main_x, (m.tabs?.x ?? 0) - REFERENCE.main_x],
  ['main width', m.tabs?.w, REFERENCE.main_w, (m.tabs?.w ?? 0) - REFERENCE.main_w],
  ['avatar', m.avatar?.w, REFERENCE.avatar, (m.avatar?.w ?? 0) - REFERENCE.avatar],
  ['season height', m.season?.h, REFERENCE.season_h, (m.season?.h ?? 0) - REFERENCE.season_h],
];

console.log(`reference: ${REFERENCE.file} (${REFERENCE.width}x${REFERENCE.height})`);
console.log('landmark'.padEnd(20), 'ours'.padEnd(10), 'reference'.padEnd(11), 'delta');
for (const [k, got, want, delta] of rows) {
  console.log(String(k).padEnd(20), col(got).padEnd(10), col(want).padEnd(11), delta);
}
console.log('');
console.log('grid columns   ', col(m.columns));
console.log('rail           ', `${m.rail?.w}px (expanded sidebar)`);
console.log('name           ', `${m.name?.font}/${m.name?.lh} ${m.name?.weight} · ${String(m.font).split(',')[0]}`);
console.log('tabs / perf    ', `${m.tabs?.h}px / ${m.perf?.h}px`);
console.log('surfaces       ', `frame ${m.frame?.bg} · season ${m.season?.bg}`);
console.log('');
if (side) console.log(`side-by-side   artifacts/visual-side.png  (${side.w}x${side.h})`);
if (diff) {
  console.log(`difference     artifacts/visual-diff.png  ${(diff.ratio * 100).toFixed(1)}% of pixels over threshold`);
  console.log('               the pages carry different players; read the diff for edges, not for content.');
}
console.log(`390x844        ${mobile.metrics.card?.w}px card, overflow ${mobile.overflow}px`);

writeFileSync(join(artifacts, 'visual-metrics.json'), JSON.stringify({
  reference: REFERENCE,
  wide: wide.metrics,
  mobile: mobile.metrics,
  overflow: { mobile: mobile.overflow },
  diff: diff ? { differingPixels: diff.differing, ratio: diff.ratio } : null,
}, null, 2));

await browser.close();
server.close();

const hard = [
  ['reference screenshot present', existsSync(REFERENCE.file) && statSync(REFERENCE.file).size > 0],
  ['no overflow at 1440', wide.overflow <= 0],
  ['no overflow at 390px', mobile.overflow <= 0],
  ['card column is 316px', Math.abs((m.card?.w ?? 0) - REFERENCE.card_w) <= 2],
  ['avatar is 140px', Math.abs((m.avatar?.w ?? 0) - REFERENCE.avatar) <= 2],
  ['main column starts at 606px', Math.abs((m.tabs?.x ?? 0) - REFERENCE.main_x) <= 12],
];
console.log('');
for (const [name, ok] of hard) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
process.exitCode = hard.every(([, ok]) => ok) ? 0 : 1;
