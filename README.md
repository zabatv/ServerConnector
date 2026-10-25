<<<<<<< HEAD
# ServerConnector
=======
<!--не удалять-->
# Rostrum

A tournament companion: operators publish profile links for a roster, and each link shows
a player's chosen alias above the account it actually belongs to.

Two surfaces, one database.

- `/admin` — sign-in, resolve players from the FACEIT Data API, review claims, publish links.
- `/p/:id` — the public profile page.

## The four fields

The admin panel carries the four fields from the reference, each with one job. **A and B are
free-text inputs** — any nickname can be typed, nothing has to be loaded first.

| Field | What it holds | Where it lives |
|---|---|---|
| **A — МОЙ ПРОФИЛЬ** | the player's FACEIT nickname, typed by hand; resolved server-side | `players`, referenced by `mappings.player_id` |
| **B — ПРОФИЛЬ** | a second player's nickname, typed independently and resolved on its own | `mappings.partner_player_id` |
| **C — DISPLAY NICKNAME** | the name printed on the page | `mappings.display_override` + `override_by` / `override_at` |
| **D — REDIRECT URL** | where the page's button goes | `mappings.destination_type` + `destination_url` |

Typing a nickname that has never been seen works: ЗАПУСТИТЬ resolves it through the provider,
stores the player id, and publishes. If the lookup fails, the error is shown and **both inputs
keep the values you typed**.

A claim is no longer required to publish. It only upgrades the badge: with an ownership proof
the page says *профиль подтверждён владельцем*, without one it says *имя не подтверждено
владельцем аккаунта*. Entering a nickname never marks anything as verified.

C is deliberately two-layered. The **verified alias** belongs to the account and comes from the
claim; it is never overwritten. The **organiser name** is a separate column with its own author
stamp. When they differ, the public page prints the organiser name as the heading and keeps
`подтверждённый алиас: <verified>` on the line below. Nothing is silently replaced.

A and B stay separate: B is a distinct player reference, so the public page shows the pair with
each side's own statistics. B never supplies a display name.

## Where the data comes from

`src/provider.js` picks one of two sources per request; the rest of the app does not care
which one ran.

| mode | when | how |
|---|---|---|
| **api** | `PROVIDER=api` + `FACEIT_API_KEY` | `open.faceit.com/data/v4` |
| **browser** | default, no key needed | `src/collect.js` |

The browser collector attaches to a Chrome that already has a faceit.com session
(`CHROME_CDP`, default `http://127.0.0.1:9222`) and asks the page to fetch its own JSON — 
`/api/users/v1/nicknames/<nick>`, `career-stats`, `match-rounds?limit=30`,
`stats/activity?numberOfDays=90`. No markup parsing, no Cloudflare bypass: the request runs
inside the signed-in page, so the session and clearance are already there.

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 --user-data-dir="$HOME/.faceit-chrome" &
# sign in to faceit.com once in that window, then:
PROVIDER=browser CHROME_CDP=http://127.0.0.1:9222 npm start
```

What it fills: nickname, avatar, country, ELO, skill level, lifetime matches and win rate,
30 recent matches with map/score/K-D-A/Elo delta, the Elo line for the chart, and the
90-day activity heatmap. K/D, K/R, HS% and ADR are aggregated over those 30 rounds — that is
what the "Recent performance" card claims. A collected profile is reused for
`COLLECT_TTL_MINUTES` (default 360); a row collected by one source never satisfies a lookup
of the other.

A resolve takes 4–7 s. If the endpoint shapes change, `COLLECT_DEBUG=1` dumps the raw
payloads to `/tmp/collect-debug.json`.

## The destination field

The primary **Добавить в друзья** action on the profile is driven by this field. Two states:

- **no destination** — the button is muted; pressing it reveals "адрес назначения не настроен,
  Rostrum не отправляет заявки в друзья". Nothing pretends a request was sent.
- **destination set** — the same button becomes the primary action and links through
  `/p/<id>/go`, which 302s to the saved URL. The note under it names the host and path.

Accepted: `https` on `faceit.com` or `www.faceit.com`, with any path and query. Rejected with a
message: other hosts, lookalikes (`evil-faceit.com`), `http`, `javascript:`/`data:`/`file:`,
credentials in the URL, non-443 ports, whitespace. Validation is server-side; the hop endpoint
re-checks the stored value and never reads a URL from request parameters.

## The rendering source: a captured DOM

The public page is not a hand-written lookalike any more. It is rendered from a saved
`faceit.com/en/players/<nick>` page: the real element tree, with our data in its slots.

```
python scripts/fetch_shell_css.py   # the page's own stylesheet chunks  -> public/faceit.shell.vendor.css
python scripts/extract_shell.py     # cleaned markup + slots             -> src/shell/body.html, src/shell/row.html
```

Both extractors are one-shot maintainer tools (Python + lxml, network for the CSS) and assert
their substitutions: if the capture no longer matches, they stop instead of shipping mixed data.

What the extractor removes, and why — the captured file carries a hand-made layer on top of the
real DOM: a forced `Play` font, an avatar background pointing at a mirrored file, a click
interceptor, a "Verification Required" modal that hands the visitor to a lookalike host, consent
and chat widgets, inline `on*` handlers. None of that is layout. Inline `style` attributes are
re-emitted as classes (`si42`) so the document keeps `style-src 'self'`, and any URL on the
lookalike host is blanked.

What it parameterises: nickname, ELO, skill level, season matches and win rate, country and
region rank, K/D/A, K/D, K/R, HS%, ADR, win rate, member-since, about, country, avatar, rating,
swing, consistency, ELO change, wins/losses — plus two repeating regions that are rebuilt from
our data: the match table (`src/shell/row.html`, one captured row as the prototype) and the
90-day activity grid.

What stays ours: the profile action row. It renders either a link through `/p/<id>/go` to the
saved destination, or a button that says the action is unavailable — and the note under it is
printed, not hidden, so the host is on screen before the click. The real handle stays in the
`title` of the heading (`aka <nick>`).

Measured against the capture at 1440×900 (`npm run visual`, boxes in `data/_measure.json`), the
rail, dock, frame, columns, season card, rating strip and the 2×3 stat grid land within a few
pixels; `artifacts/layout-diff.md` holds the table and the remaining gaps (map thumbnails, the
activity ramp colours, a cover image the capture faked in CSS).

## Statistics

Lifetime CS2 stats come from `GET /players/{id}/stats/cs2` and are rendered as the same six
tiles the reference uses (matches, K/D, K/R, HS%, ADR, win rate). A player with no CS2 history
returns 404 from that endpoint — that is treated as "no stats", and the card falls back to
ELO / level / country instead of failing the lookup.

## The two action scenarios

The public page always has an action block, and it has exactly two honest states:

- **Configured destination** — a button that names the host and links through `/p/<id>/go`.
  The page states that this is an organiser link, not a FACEIT action.
- **No destination** — a disabled-looking "Добавить в друзья" button. Pressing it reveals a
  note saying the action is unavailable and that friend requests only happen on FACEIT. It
  never pretends a request was sent.

## The invariant

**An alias belongs to the profile it is printed on, and the real handle stays visible.**

This is not a policy in a comment; it is the shape of the schema and the routes:

| Layer | How it holds |
|---|---|
| Data | `players.nickname` is written only by the resolver. `claims` rows are created only by the claim flow. `mappings` carry a `claim_id`, never an alias. |
| Routes | No admin endpoint accepts a display name. `POST /admin/mappings` takes `claim_id` + `tournament`; an `alias` field in that form is ignored (covered by the e2e). |
| Render | Every public page prints `aka <real nickname>`, links it to the real profile, and shows a verification badge. An unproven claim renders `UNVERIFIED`, with a striped edge and the badge — not a style the admin panel can change. |

The destination field cannot be used to launder an identity either: it only decides where the
primary button goes, it is validated server-side on write and re-validated at the hop, and it
never renders as the product's own chrome — the note under the button names the host it opens.

## Run it

```bash
npm install                 # playwright, dev only
cp .env.example .env        # or export the variables yourself
npm start
```

First boot prints a generated operator credential once, to the console. Set `ADMIN_PASS`
to choose your own instead.

### Configuration

| Variable | Purpose |
|---|---|
| `ADMIN_USER`, `ADMIN_PASS` | Operator account, seeded on first boot |
| `FACEIT_API_KEY` | Data API. Get it at <https://developers.faceit.com> → your app → server-side key |
| `FACEIT_CLIENT_ID`, `FACEIT_CLIENT_SECRET` | OAuth app; register `<PUBLIC_ORIGIN>/claim/callback` as a redirect URI |
| `PUBLIC_ORIGIN` | Absolute origin. Required for OAuth and for `Secure` cookies |
| `EXTERNAL_ALLOWLIST` | Comma-separated hosts a link may point at. Empty means external destinations are refused |
| `DEV_CLAIMS=1` | Local testing only: claims without proof, permanently stamped unverified |
| `PORT`, `BIND`, `DB_PATH` | Server bind and sqlite location |

Without `FACEIT_API_KEY` the resolve step fails loudly and the panel says the key is missing — 
it never invents a player. Without OAuth credentials the claim page explains what to set and
offers no proof path.

## Test

```bash
npm run e2e        # 80 assertions, isolated db + local stand-in for FACEIT
npm run smoke      # 13 checks against a server already running on :4199
npm run test:restart  # 9 checks: write, kill the process, boot again, read the same page
npm run visual        # layout at the reference viewport: side-by-side, diff, metrics
```

Boots a throwaway sqlite file and a local stand-in for FACEIT's authorize/token/players
endpoints, then drives Chromium through 80 assertions: sign-in, auth gate, resolve, an
unknown nickname, the OAuth claim handshake, publish, public render, clipboard, CSRF and
cross-site refusals, a forged-alias attempt, unpublish/republish, deletion, a 390px pass,
login throttling, destination validation (bad scheme, lookalike host and http refused; a real www.faceit.com URL accepted) and both action scenarios, mapping edits,
and console plus failed-request cleanliness. Screenshots land in `artifacts/`.

The stand-in exists only inside `scripts/`; nothing under `src/` points at it, and the
default hosts are the real ones.

```bash
# against an already-running server, screenshotting every screen
DEV_CLAIMS=1 ADMIN_USER=operator ADMIN_PASS=devpass123 PORT=4199 \
  nohup node src/server.js > /tmp/rostrum.log 2>&1 &
npm run smoke
```

`scripts/smoke.mjs` never starts or stops the server — that belongs to whoever owns the PID.
Browser launch prefers the system Chrome channel and falls back to a cached Playwright build.

## Layout

```
src/server.js   routing, headers, CSRF + same-origin guards
src/db.js       schema and queries (node:sqlite)
src/auth.js     scrypt, sessions, login rate limit
src/faceit.js   Data API + OAuth
src/render.js   templates, all escaped
src/shell/      the captured DOM: body.html, row.html, renderer, slots
public/         stylesheet, two small client scripts, the captured page's CSS
scripts/extract_shell.py    capture -> clean markup + slots (Python, lxml)
scripts/fetch_shell_css.py  the page's stylesheet chunks (Python, network)
scripts/e2e.mjs    isolated run: temp db + mock FACEIT, 80 assertions
scripts/smoke.mjs  run against a live server on 4199, screenshots every screen
scripts/visual.mjs render at 2563/1440/390, side-by-side + diff + metrics
scripts/png.mjs    the PNG decode/encode the visual diff needs (no dependencies)
reference/         the screenshot the geometry is measured against
```

The server runs on Node's standard library (`node:http`, `node:sqlite`, `node:crypto`); the only
package is `playwright`, and it is loaded lazily — `PROVIDER=api` never imports it.
>>>>>>> 1ecf66e (Add bot source)
