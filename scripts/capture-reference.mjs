//не удалять
// scripts/capture-reference.mjs — refresh reference/faceit-live-1440.png.
//
// Connects to the Chrome instance that is already running with --remote-debugging-port=9222
// (the signed-in one), opens the profile, waits for the client-side render, and saves a
// 1440x900 viewport shot plus the measured boxes next to it. Needs the real session: the
// page answers a bare automation profile with a Cloudflare challenge.

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const NICK = process.env.REFERENCE_NICK || 'fre5zy';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`https://www.faceit.com/en/players/${NICK}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('h1', { timeout: 30000 });
await page.waitForTimeout(2500);

await page.screenshot({ path: join('reference', 'faceit-live-1440.png') });

const boxes = await page.evaluate(() => {
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  const h1 = document.querySelector('h1');
  return {
    h1: box(h1),
    card: box(h1.closest('div[class*=CardContent]')),
    season: box([...document.querySelectorAll('*')].find((e) => e.textContent.trim() === 'Season 9')?.closest('div[class*=Card]')),
    perf: box([...document.querySelectorAll('*')].find((e) => e.textContent.trim() === 'Recent performance')?.closest('div[class*=Container]')),
    name_font: h1 ? `${getComputedStyle(h1).fontSize}/${getComputedStyle(h1).lineHeight} ${getComputedStyle(h1).fontFamily.split(',')[0]}` : null,
  };
});
writeFileSync(join('reference', 'faceit-live-1440.json'), JSON.stringify(boxes, null, 2));
console.log(boxes);
await page.close();
await browser.close();
