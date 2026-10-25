# Reference notes — the live FACEIT profile, measured off captures

Kept because the screenshots these numbers came from are gone from the chat context.
Everything here is already encoded in `src/faceit_page.js` / `public/style.css`
unless noted otherwise.

## Skill ring (SkillIcon)

- Fill = level / 10, elo does not enter it. Measured: level 7 → 70 %, level 8 → 80 %,
  level 10 → full ring.
- Small arcs seen on level-10 pages (11 % in the SSR DOM, ~25 % on a quick screenshot)
  are frames of the ring's load animation — not the resting state.
- Arc geometry: `M 6.5,18.4 A 8.4,8.4 0 1 1 17.5,18.4`, pathLength 10, dash 10.1 /
  10000, starts at the bottom-left end, gap at the bottom, stroke-width 2.4 in a
  24-unit viewBox.
- Colours sampled: level 7 `#FFC700`, level 8 `#FF4B00`, level 10 `#EF0000`.
  Other levels follow the classic palette: 1 white, 2–3 green `#1CE400`,
  4–7 `#FFC700`, 8–9 `#FF4B00`.
- Digits keep the silver gradient `#F1F1F1 → #383838`; the track is a radial
  `#5D5D5D → #242424`.
- Unranked: grey full calibration ring (radial `#2A2A2A → #4A4A4A → #8D8D8D → #A6A6A6`),
  the `?` glyph, and the word **Unranked** where the elo number normally sits.

## Season card

- Card tint follows the level colour (7 gold, 8 orange, 10 red); unranked is neutral.
- Right column: country rank + region rank pills (RU/DE + EU), then
  "<season matches> Matches • <season WR>% Win rate".
- Elo change line: sign-aware colour, W/L as green/red square badges.
- Perf block: medal + avg rating + progress bar + sparkline, Swing / Consistency,
  six cells K/D/A, K/D, K/R, HS%, ADR, Win rate (per-match averages, not totals).
- Chart: orange line WITH area fill.

## Live values seen on fre5zy (2026-10-19/20, anonymous)

2,325 → 2,355 → 2,376 elo (he was playing), level 10, RU rank ~23,625–25,917,
EU ~82,982–91,103, season 114–115 matches, WR ~48–48.7 %, avg skill of match ~2,271.
Cover image lives on `distribution.faceit-cdn.net/...webp` (read from the card's
background-image, not in the API payload).

## Layout landmarks the visual loop gates on (1440×900)

rail 240 (expanded sidebar), card_x 248, card_w 316, main_x 606, main_w 730,
avatar 140, season height 176, photo cover (`.cover`) full card inner width 298.
The reference screenshot itself is absent from the repo; these constants stand in
for it and every run prints deltas against them.

## Deliberately not rendered

- "Playing now / MATCHROOM" strip (session state), verified check next to the nick
  (project invariant: the page must not look verified from the admin),
  Steam/Discord rows, CS:GO history row, the "What did you think" survey widget —
  no data or transient UI.
- Avatar badge: the metallic octagon-with-star for level 10 is copied from the
  hightabier DOM; the level-<10 avatar badge has never been captured.
- The comparison renders in `artifacts/` (visual-ours-1440, side-*, *-crop) are
  regenerable artifacts — `npm run visual` and the crop scripts rebuild them.

## What the replaced comparison crops showed (artifacts/)

- visual-ours-1440.png — our full render at 1440x900: expanded sidebar 240, card 316 wide at x=248,
  main column at x=606, season card 176 high; used only as the visual loop's own output.
- skill-badge-crop.png — our season badge close-up (dark disc, silver digits, red arc) from the
  level-10 era; superseded by the level/10 fill rule.
- side-season.png — ours vs live season card: red arc #EF0000, DE/EU rank pills, "N Matches ¤ WR%";
  the live side had 4,244/156,072 ranks and 89 matches / 53.9% WR.
- side-avatar.png / side-badge.png — the green star (our invention) next to the live metallic
  octagon-with-star badge for level 10; the octagon + gradients were copied from the hightabier DOM.
- rating-crop.png — our rating block: medal, 1.07 gradient + orange progress bar, white sparkline,
  Swing -0.64%, Consistency 60%, six cells (K/D/A, K/D, K/R, HS%, ADR, WR).

## Exact values in the replaced rating crop

Our rating block rendered: 1.07 (medal + orange progress), sparkline white,
Swing -0.64%, Consistency 60%; cells K/D/A 15 / 16 / 5, K/D 1.12, K/R 0.81,
HS% 50%, ADR 85.9, Win rate 55%.

## Server deployment (2.26.125.147, Debian 13)

- app: /opt/rostrum, Node 24 at /opt/node24 (system node is v20 and cannot do node:sqlite).
- systemd: rostrum.service (node src/server.js, .env: PORT=4173, BIND=0.0.0.0,
  DEV_CLAIMS=1, CHROME_CDP=http://127.0.0.1:9222), chrome-cdp.service (headful Chromium under
  xvfb-run, --remote-debugging-port=9222, user-data-dir /opt/chrome-faceit).
- ufw: 4173/tcp allowed (additive); external check http://2.26.125.147:4173/admin -> 200.
- Collector passes Cloudflare from this datacenter because the Chromium is HEADFUL under Xvfb
  (headless=new was challenged). The collect() challenge-wait is up to 24 s.
- Verified: resolve fre5zy -> launch -> /p/fre5zy 200, cover webp from faceit CDN, elo 2,213,
  level 10, slug = nickname.
- If the challenge starts failing again: give that Chromium a residential proxy, or set
  PROVIDER=api + FACEIT_API_KEY; no code changes needed.
