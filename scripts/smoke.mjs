//не удалять
// scripts/smoke.mjs — drives an already-running server (default http://127.0.0.1:4199),
// screenshots every screen, and reports console/network defects.
//
//   DEV_CLAIMS=1 ADMIN_USER=operator ADMIN_PASS=devpass123 PORT=4199 \
//     nohup node src/server.js > /tmp/rostrum.log 2>&1 &
//   node scripts/smoke.mjs
//
// The server it drives resolves profiles live (Data API with FACEIT_API_KEY, or
// the browser collector). SMOKE_NICK names the nickname to resolve.
//
// It never starts or stops the server; that belongs to the shell that owns the PID.

import { chromium } from 'playwright';
import { mkdirSync, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4199';
const OPERATOR = process.env.ADMIN_USER || 'operator';
const CREDENTIAL = process.env.ADMIN_PASS || 'devpass123';
const NICK = process.env.SMOKE_NICK || 'fre5zy';
const ALIAS = process.env.SMOKE_ALIAS || 'smoke-alias';

const artifacts = join(process.cwd(), 'artifacts');
mkdirSync(artifacts, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

async function launch() {
  try {
    return await chromium.launch({ channel: 'chrome', headless: true });
  } catch (err) {
    const base = join(homedir(), 'Library', 'Caches', 'ms-playwright');
    if (existsSync(base)) {
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
    throw err;
  }
}

const browser = await launch();
const context = await browser.newContext({ baseURL: BASE });
const page = await context.newPage();

const errors = [];
const failed = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => {
  const t = r.failure()?.errorText || '';
  if (!t.includes('ERR_ABORTED')) failed.push(`${r.url()} ${t}`);
});

const shot = (name) => page.screenshot({ path: join(artifacts, `smoke-${name}.png`), fullPage: true });

try {
  await page.goto('/admin', { waitUntil: 'networkidle' });
  await shot('01-login');
  check('server answers on /admin', await page.locator('[data-testid=login-form]').isVisible());

  await page.fill('input[name=username]', OPERATOR);
  await page.fill('input[name=password]', CREDENTIAL);
  await page.click('[data-testid=login-form] button[type=submit]');
  await page.waitForSelector('[data-testid=roster]', { timeout: 10000 });
  check('signed in', true);
  await shot('02-roster');

  await page.fill('input[name=nickname]', NICK);
  await page.click('[data-testid=resolve-form] button[type=submit]');
  await page.waitForSelector('[data-testid=banner-ok]', { timeout: 10000 });
  check('player resolved', (await page.locator('[data-testid=player-row]').count()) > 0,
    (await page.locator('[data-testid=banner-ok]').first().innerText()).trim());

  await page.goto('/admin/claim', { waitUntil: 'networkidle' });
  await shot('03-claim');
  const devForm = page.locator('[data-testid=dev-claim-form]');
  check('dev claim path is offered', await devForm.count() === 1);

  if (await devForm.count()) {
    await devForm.locator('input[name=nickname]').fill(NICK);
    await devForm.locator('input[name=alias]').fill(ALIAS);
    await devForm.locator('button[type=submit]').click();
    await page.waitForSelector('[data-testid=roster]', { timeout: 10000 });
    check('unverified claim created', (await page.locator('[data-testid=claims-table] [data-testid=proof-unverified]').count()) > 0);
  }

  if (await page.locator('[data-testid=player-a]').count()) {
    await page.fill('[data-testid=player-a]', NICK);
    await page.fill('#tlabel', 'Smoke Run');
    await page.click('[data-testid=launch-form] button[type=submit]');
    await page.waitForSelector('[data-testid=banner-ok]');
    const slug = (await page.locator('code.slug').first().innerText()).trim();
    check('link published', /^\/p\//.test(slug), slug);
    await shot('04-roster-with-link');

    await page.goto(slug, { waitUntil: 'networkidle' });
    await shot('05-public');
    check('public page renders the alias', (await page.locator('[data-testid=alias]').innerText()).trim().length > 0);
    const alias_title = await page.locator('[data-testid=alias]').getAttribute('title');
    check('public page keeps the real handle a hover away', (alias_title || '').includes('aka'), String(alias_title));
    check('FACEIT chrome is rendered', (await page.locator('.tabs a.is-active').innerText()).trim() === 'GAMES');
    check('season card is rendered', (await page.locator('.season').innerText()).includes('Season 9'));

    const mobile = await context.newPage();
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.goto(slug, { waitUntil: 'networkidle' });
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('mobile has no horizontal overflow', overflow <= 1, `${overflow}px`);
    await mobile.screenshot({ path: join(artifacts, 'smoke-06-public-mobile.png'), fullPage: true });
    await mobile.close();
  }

  check('no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  check('no failed requests', failed.length === 0, failed.slice(0, 3).join(' | '));
} catch (err) {
  check('smoke completed without throwing', false, err.message.split('\n')[0]);
  await page.screenshot({ path: join(artifacts, 'smoke-failure.png'), fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed against ${BASE}`);
process.exit(bad.length ? 1 : 0);
