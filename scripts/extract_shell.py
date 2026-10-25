# Extract a clean, CSP-safe shell from the saved FACEIT profile capture.
#
# One-shot maintainer tool (needs Python + lxml):
#   python scripts/extract_shell.py
#
# Input  : the saved profile capture ($FACEIT_CAPTURE, else the archive path below)
# Output : src/shell/body.html      markup only — no scripts, no <style>, no iframes
#          public/faceit.shell.css  component CSS lifted from the same capture
#
# The capture is the real FACEIT DOM with a hand-made layer on top: a Play font
# override, an avatar background hack, a click interceptor, a "Verification
# Required" modal pointing at a lookalike host, consent and chat widgets, inline
# on* handlers. None of that is layout. All of it is cut here, and inline style
# attributes are re-emitted as classes so the page can keep style-src 'self'.
import io, os, re, sys

try:
    from lxml import html as LH
except ImportError:
    sys.exit('lxml is required: pip install lxml')

SRC = os.environ.get('FACEIT_CAPTURE') or os.path.join(
    os.path.expanduser('~'),
    r'AppData\Roaming\AutoClaw-oversea-official\accounts\e5d87ad0368e8577b04312254f70264ad278be5f03604e3673469efdfaaff25a'
    r'\projects\Default\www.faceit.com.se\en\players\hightabier.html',
)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_HTML = os.path.join(ROOT, 'src', 'shell', 'body.html')
OUT_ROW = os.path.join(ROOT, 'src', 'shell', 'row.html')
OUT_CSS = os.path.join(ROOT, 'public', 'faceit.shell.css')

raw = io.open(SRC, encoding='utf-8', errors='replace').read()

open_body = re.search(r'<body[^>]*>', raw)
app_end = raw.find('<iframe', open_body.end())          # the app closes before the first iframe
if app_end < 0:
    sys.exit('could not find the end of the app markup')
fragment = raw[open_body.end():app_end]

# ---- 1. cut the injected layer --------------------------------------------

fragment = re.sub(r'<style\b.*?</style>', '', fragment, flags=re.S)
fragment = re.sub(r'<script\b.*?</script>', '', fragment, flags=re.S)
fragment = re.sub(r'<noscript\b.*?</noscript>', '', fragment, flags=re.S)
fragment = re.sub(r'<iframe\b[^>]*>(?:</iframe>)?', '', fragment)
def cut_block(html, marker):
    """Remove the element that starts at `marker`, matched by div depth.

    A regex cannot do this: the capture nests the icon and feedback blocks deep
    inside the profile card, and a greedy/non-greedy `.*?</div>` happily eats a
    parent's closing tag, which leaves the document unbalanced and collapses the
    whole two-column layout in the browser.
    """
    i = html.find(marker)
    if i < 0:
        return html
    tag_start = html.rfind('<', 0, i)
    depth, pos = 0, tag_start
    while True:
        nxt_open = html.find('<div', pos + 1)
        nxt_close = html.find('</div>', pos + 1)
        if nxt_close < 0:
            return html
        if nxt_open != -1 and nxt_open < nxt_close:
            depth += 1
            pos = nxt_open
        elif depth == 0:
            return html[:tag_start] + html[nxt_close + 6:]
        else:
            depth -= 1
            pos = nxt_close


# FACEIT's own feedback widget, captured mid-page — not part of the profile
fragment = cut_block(fragment, 'styles__Container-sc-8687bfe0-0')

# Highlights: the captured profile's video cards. There is no video data behind
# our mappings, so the block would print someone else's clips under our name.
fragment = cut_block(fragment, 'styles__TopSection-sc-524303a6-2')
fragment = cut_block(fragment, 'styles__Container-sc-524303a6-0')
fragment = re.sub(r'\s+on[a-z]+\s*=\s*"[^"]*"', '', fragment)          # handlers
fragment = re.sub(r'\s+on[a-z]+\s*=\s*\'[^\']*\'', '', fragment)
# lookalike hosts never survive into the shell; the CDN asset hosts do (img-src allows https)
fragment = re.sub(r'(src|srcset|href|poster)="https?://(?:[a-z0-9-]+\.)*faceit\.com\.se[^"]*"', r'\1="#"', fragment)
# the mirror rewrote CDN assets as ../../../host/path — put them back on https
fragment = re.sub(r'(src|srcset|href|poster)="(?:\.\./)+(distribution\.faceit-cdn\.net|assets\.faceit-cdn\.net|cdn\.faceit\.com|media\.faceit\.com)',
                  r'\1="https://\2', fragment)
fragment = re.sub(r'(src|srcset|href|poster)="(?:https?:)?//(?!distribution\.|assets\.|cdn\.)', r'\1="#"', fragment, count=0)

# ---- 2. inline styles become classes --------------------------------------

rules, counter = {}, [0]
TAG = re.compile(r'<([a-zA-Z][^>]*)>')


def lift_tag(m):
    inner = m.group(1)
    sm = re.search(r'\sstyle="([^"]*)"', inner)
    if not sm:
        return m.group(0)
    decl = sm.group(1).strip().rstrip(';')
    if not decl:
        return m.group(0)
    counter[0] += 1
    cls = 'si%d' % counter[0]
    rules[cls] = decl
    inner = inner[:sm.start()] + inner[sm.end():]
    if re.search(r'class="[^"]*"', inner):
        inner = re.sub(r'class="([^"]*)"', lambda c: 'class="%s %s"' % (c.group(1), cls), inner, count=1)
    else:
        inner += ' class="%s"' % cls
    return '<' + inner + '>'


fragment = TAG.sub(lift_tag, fragment)
print('inline styles lifted:', len(rules))

# ---- 3. lift the component stylesheet -------------------------------------

styled = re.search(r'<style data-styled="active"[^>]*>(.*?)</style>', raw, re.S)
if not styled:
    sys.exit('component stylesheet not found in the capture')
css = styled.group(1)
css = re.sub(r"font-family:\s*'?Play'?[^;}]*!important[^;}]*;?", '', css)
css = re.sub(r'@font-face\{[^}]*\}', '', css)
css = css.replace('var(--font-geist, sans-serif)', 'Play, system-ui, sans-serif')
css = css.replace('geistSans Fallback', 'Arial').replace('geistSans', 'Play').replace('geistMono', 'ui-monospace')
css = css.replace('Geist Fallback', 'Arial').replace('Geist', 'Play')

reset = """
/* Reset the lifted DOM expects, plus the tokens its inline rules reference. */
:root {
  --font-geist: Play, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --f-space-lc: 22px; --f-space-mc: 16px; --f-space-sm: 8px;
  --f-white-medium: #a7a7a7; --f-white-high: #f1f1f1;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { background: #121212; color: #f1f1f1; font-family: var(--font-geist); }
a { color: inherit; text-decoration: none; }
/* the right dock is fixed; the app column must not run under it */
body { margin-right: 0; }
/* match result, elo delta and activity ramp: the captured hashed classes only
   carry the one state that profile happened to have */
.res-w { color: #32d35a !important; }
.res-l { color: #ff4b4b !important; }
.d-pos { color: #32d35a; }
.d-neg { color: #ff4b4b; }
.styles__Cell-sc-75ae0e0a-10.act-0 { background: #1c1c1c; }
.styles__Cell-sc-75ae0e0a-10.act-1 { background: rgba(255, 75, 0, .28); }
.styles__Cell-sc-75ae0e0a-10.act-2 { background: rgba(255, 75, 0, .52); }
.styles__Cell-sc-75ae0e0a-10.act-3 { background: rgba(255, 75, 0, .78); }
.styles__Cell-sc-75ae0e0a-10.act-4 { background: #ff4b00; }
/* the profile action we render instead of the captured row */
.sh-actions { display: flex; flex-direction: column; gap: 8px; padding: 8px 8px 0; width: 100%; }
.sh-btn { display: inline-flex; align-items: center; justify-content: center; height: 32px; border: 0;
  border-radius: 4px; background: #ff4b00; color: #fff; cursor: pointer;
  font-family: var(--font-geist); font-size: 14px; font-weight: 700; line-height: 16px;
  letter-spacing: .02em; text-transform: uppercase; }
.sh-btn:hover { background: #ff612b; }
.sh-btn.is-off { background: transparent; border: 1px solid rgba(241, 241, 241, .16); color: #828282; }
.sh-note { margin: 0; font-family: var(--font-geist); font-size: 12px; line-height: 16px; color: #828282; }
/* the badge we inject is an svg inside their flex rows; without this it shrinks to 0 */
svg.skill { display: block; flex: 0 0 auto; }
/* the cover the capture faked with a CSS background: an image layer behind the
   avatar, faded toward the bottom so the name stays readable */
.sh-card { position: relative; overflow: hidden; isolation: isolate; }
.sh-card > *:not(.sh-cover) { position: relative; z-index: 1; }
.sh-cover { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%;
  object-fit: cover; object-position: 50% 30%; opacity: .75;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 58%, transparent 92%);
  mask-image: linear-gradient(180deg, #000 0%, #000 58%, transparent 92%); }
/* the captured heatmap cells carry their size in a class we did not keep */
.styles__Graph-sc-75ae0e0a-9 .styles__Cell-sc-75ae0e0a-10 { width: 11px; height: 11px; border-radius: 2px; }
/* card cover: our own layer behind the avatar, since the capture faked it in CSS */
[data-playercard="true"] { position: relative; overflow: hidden; }
[data-playercard="true"] > * { position: relative; z-index: 1; }
[data-playercard="true"] > .sh-cover { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%;
  object-fit: cover; opacity: .55; pointer-events: none;
  -webkit-mask-image: linear-gradient(180deg, #000 30%, transparent 100%);
  mask-image: linear-gradient(180deg, #000 30%, transparent 100%); }
"""

# ---- 4. the capture's own layout layer --------------------------------------
# Its <style> block carries the layout the live page does not: a 72px right
# dock, `body{margin-right:72px}`, and a few button overrides. Keep those; drop
# the forced Play font and the avatar background hack, which pointed at a
# mirrored file and is replaced by the real avatar below.
inj = ''
first_style = re.search(r'<style>(.*?)</style>', raw, re.S)
if first_style:
    inj = first_style.group(1)
    inj = re.sub(r'\*,\s*\*::before,\s*\*::after\s*\{[^}]*\}', '', inj)
    inj = re.sub(r'svg text,[^{]*\{[^}]*\}', '', inj)
    inj = re.sub(r'\[class\*="AvatarHolder-sc"\][^{]*\{[^}]*\}', '', inj)
    inj = inj.replace('Play, sans-serif', 'var(--font-geist)')
print('layout layer rules kept:', inj.count('{'))

lifted = '\n'.join('.%s{%s}' % (k, v) for k, v in rules.items())
header = (
    '/* Component styles lifted from the saved faceit.com profile capture by\n'
    '   scripts/extract_shell.py. The class hashes are the capture\'s; do not\n'
    '   hand-edit this file — re-run the extractor instead. */\n'
)
io.open(OUT_CSS, 'w', encoding='utf-8', newline='\n').write(header + reset + css + '\n\n' + inj + '\n\n' + lifted + '\n')

# ---- 4b. the right dock the capture carries ---------------------------------
dock_start = raw.find('<div id="fi-right-sidebar"')
dock = ''
if dock_start > 0:
    dock = raw[dock_start:]
    dock = re.sub(r'<script\b.*?</script>', '', dock, flags=re.S)
    dock = re.sub(r'<style\b.*?</style>', '', dock, flags=re.S)
    dock = dock[:dock.rfind('</div>') + 6]
    dock = re.sub(r'\s+on[a-z]+\s*=\s*"[^"]*"', '', dock)
    dock = re.sub(r'\s+on[a-z]+\s*=\s*\'[^\']*\'', '', dock)
    dock = re.sub(r'(src|href)="https?://(?:[a-z0-9-]+\.)*faceit\.com\.se[^"]*"', r'\1="#"', dock)
    # the dock was appended after the style lifting pass, so strip its inline
    # styles here — they are cosmetic and style-src keeps 'self'
    dock = re.sub(r'\sstyle="[^"]*"', '', dock)
    fragment = fragment.rstrip() + '\n' + dock + '\n'
print('dock markup bytes:', len(dock))

# ---- 5. replace the captured player's data with slots ----------------------
# Every value below belongs to this one profile. The renderer fills the same
# slots from our database; each substitution asserts its match count so a
# changed capture fails loudly instead of shipping quietly mixed data.
SCALARS = [
    ('>hightabier</h1>', '>{{nickname}}</h1>', 1),
    ('ilhywH">2,144</span>', 'ilhywH">{{elo}}</span>', 1),
    ('cydtPr">2,144</span>', 'cydtPr" data-testid="elo">{{elo}}</span>', 1),
    ('eXQuvl">2,108</span>', 'eXQuvl">{{avg_elo}}</span>', 1),
    ('eCajkx">89</span>', 'eCajkx">{{season_matches}}</span>', 1),
    ('eCajkx">53.9%</span>', 'eCajkx">{{season_winrate}}%</span>', 1),
    ('eCajkx">4,273</span>', 'eCajkx">{{country_rank}}</span>', 1),
    ('eCajkx">158,284</span>', 'eCajkx">{{region_rank}}</span>', 1),
    ('jcyKLf">317</span>', 'jcyKLf">{{cs2_matches}}</span>', 1),
    ('jcyKLf">332</span>', 'jcyKLf">{{csgo_matches}}</span>', 1),
    ('>15 / 16 / 5<', '>{{kda}}<', 1),
    ('>0.91<', '>{{kd}}<', 1),
    ('>0.65<', '>{{kr}}<', 1),
    ('>57%<', '>{{hs}}%<', 1),
    ('>75.6<', '>{{adr}}<', 1),
    ('>43%<', '>{{winrate}}%<', 1),
    ('>Member since Jun 1, 2014<', '>Member since {{since}}<', 1),
    ('fdueJE">93 Matches Played<', 'fdueJE">{{activity_total}} Matches Played<', 1),
    ('>POMMES<', '>{{about}}<', 1),
    ('flag-icon-de', 'flag-icon-{{country_code}}', 2),
    ('>Germany<', '>{{country_name}}<', 1),
]

for old, new, expect in SCALARS:
    found = fragment.count(old)
    if found != expect:
        sys.exit('slot %r matched %d times, expected %d — capture changed?' % (old, found, expect))
    fragment = fragment.replace(old, new)
print('scalar slots:', len(SCALARS))


def one(pattern, replacement, html, label, group=2):
    """Replace exactly one capture group, or stop — a silently drifting template is worse."""
    m = re.search(pattern, html)
    if not m:
        sys.exit('anchor not found: %s' % label)
    return html[:m.start(group)] + replacement + html[m.end(group):]


fragment = one(r'(hrGPUx">Elo change</span><span class="[^"]*">)([^<]+)(</span>)', '{{elo_change}}', fragment, 'elo change')
fragment = one(r'(hPEiuL">)(\d+)(</span>)', '{{wins}}', fragment, 'wins chip')
fragment = one(r'(coEvtN">)(\d+)(</span>)', '{{losses}}', fragment, 'losses chip')
try:
    fragment = one(r'(GradientText-sc-14d0bd66-4 [^"]*">)([\d.]+)(</span>)', '{{avg_rating}}', fragment, 'rating')
except SystemExit:
    print('  note: rating anchor missing, left as captured')
fragment = one(r'(cGcJeh">)(-?[\d.]+%)(</span>)', '{{swing}}', fragment, 'swing')
fragment = one(r'(gQQBeG">)(\d+%)(</span>)', '{{consistency}}', fragment, 'consistency')

# the verified marker next to the nickname: never rendered
fragment = cut_block(fragment, 'styles__IconsContainer-sc-74591e28-1')

# avatars: every avatar image in the shell belongs to the account behind the
# mapping, except the CS2 tile, which is a game badge drawn with the same
# component. The dock copy is handled below.
for tag in re.findall(r'<img[^>]*Avatar__Image[^>]*>', fragment):
    before = fragment[:fragment.find(tag)]
    if 'SelectedGameBadge' in before[-400:]:
        continue
    new_tag = re.sub(r'src="(?:data:image/[^"]+|#)"', 'src="{{avatar}}"', tag, count=1)
    fragment = fragment.replace(tag, new_tag, 1)
print('avatar slots:', fragment.count('{{avatar}}'))
fragment = fragment.replace('<img class="fi-avatar" src="#"', '<img class="fi-avatar" src="{{avatar}}"')
# the dock chip belongs to the second field: that profile's avatar, not the card's
fragment = fragment.replace('<img class="fi-avatar" src="{{avatar}}" alt="avatar">',
                            '<img class="fi-avatar" src="{{sidebar_avatar}}" alt="avatar">')
print('avatar slots after dock:', fragment.count('{{avatar}}'))

# the skill ring: the captured svg bakes this profile's level into the markup and
# takes its colour from a CSS class we do not have. Our own badge draws the same
# widget from the level we resolved, with the ring colour that level owns.
badges = list(re.finditer(r'<svg[^>]*SkillIcon__StyledSvg[^>]*>.*?</svg>', fragment, re.S))
if len(badges) < 2:
    sys.exit('expected at least 2 skill badges, found %d' % len(badges))
# first is the season ring, second the chip in the performance header, the rest
# are the per-match rings inside the rows (they end up in row.html)
slots = ['{{skill_badge}}', '{{skill_badge_chip}}'] + ['{{match_badge}}'] * (len(badges) - 2)
for m, slot in reversed(list(zip(badges, slots))):
    fragment = fragment[:m.start()] + slot + fragment[m.end():]
print('skill badges replaced:', len(badges))

# the card cover: in the capture this was a CSS hack pointing at a mirrored
# avatar jpg. We render our own layer instead, filled from the profile record.
card = fragment.find('data-playercard="true"')
if card < 0:
    sys.exit('player card container not found')
card_open_end = fragment.find('>', card) + 1
fragment = fragment[:card_open_end] + '<img class="sh-cover" src="{{cover}}" alt="">' + fragment[card_open_end:]
print('cover slot inserted')

# ---- 6. the two repeating regions ------------------------------------------
def block_extent(html, marker, start=None):
    """Start and end offset of the element that starts at `marker`, by div depth."""
    if start is None:
        i = html.find(marker)
        if i < 0:
            sys.exit('block not found: %s' % marker)
        tag_start = html.rfind('<', 0, i)
    else:
        tag_start = start
    depth, pos = 0, tag_start
    while True:
        o = html.find('<div', pos + 1)
        c = html.find('</div>', pos + 1)
        if c < 0:
            sys.exit('unclosed block: %s' % marker)
        if o != -1 and o < c:
            depth += 1
            pos = o
        elif depth == 0:
            return tag_start, c + 6
        else:
            depth -= 1
            pos = c


# the profile card gets our cover layer: mark the container and reserve the slot
card_open = fragment.find('data-playercard="true"')
if card_open < 0:
    sys.exit('player card container not found')
card_tag_end = fragment.find('>', card_open) + 1
card_tag = fragment[card_open:card_tag_end]
fragment = (fragment[:card_open]
            + card_tag[:-1].replace('class="', 'class="sh-card ', 1) + '>{{cover_img}}'
            + fragment[card_tag_end:])
print('card cover slot inserted')

# the profile action row ("ADD FRIEND" + menu) is ours: it either hands the
# visitor to the saved destination through the server-side hop, or says the
# action is unavailable. The captured copy pretended neither.
add_idx = fragment.find('styles__Container-sc-ebbcdda0-0 dzcGFa')
if add_idx < 0:
    sys.exit('ADD FRIEND row not found')
row_start = fragment.rfind('<div', 0, add_idx)
if row_start < 0:
    sys.exit('action row wrapper not found')
actions_start, actions_end = block_extent(fragment, 'action row', start=row_start)
fragment = fragment[:actions_start] + '{{profile_action}}' + fragment[actions_end:]
print('action row replaced with a slot')

# matches: replace the whole table body with one slot, rows come from our data
table_start, table_end = block_extent(fragment, 'styles__MatchTableBody')
first_row = fragment.find('<a href="#" class="styles__MatchLink', table_start, table_end)
if first_row < 0:
    sys.exit('match rows not found inside the table body')
row_html = fragment[first_row:fragment.find('</a>', first_row) + 4]
fragment = (fragment[:table_start]
            + '<div class="styles__MatchTableBody-sc-cf17d301-5 fjiKOH">{{match_rows}}</div>'
            + fragment[table_end:])

# activity: same for the heatmap container
graph_start, graph_end = block_extent(fragment, 'styles__Graph-sc-75ae0e0a-9')
fragment = (fragment[:graph_start]
            + '<div class="styles__Graph-sc-75ae0e0a-9 dveahw">{{activity_cells}}</div>'
            + fragment[graph_end:])
print('repeat regions: match table + activity grid')

# ---- 7. parameterise the row prototype -------------------------------------
ROW_SLOTS = [
    ('ilhywH">Sat 10 Oct<', 'ilhywH">{{date}}<'),
    ('hdLuum">20:09<', 'hdLuum">{{time}}<'),
    ('Score__Result-sc-dc64aeb2-0 jYVkjP">L<', 'Score__Result-sc-dc64aeb2-0 {{result_class}}">{{result}}<'),
    ('eCajkx loyHrE">6<', 'eCajkx loyHrE">{{score_us}}<'),
    ('ilhywH jywTRL">13<', 'ilhywH jywTRL">{{score_them}}<'),
    ('ilhywH">{{elo}}<', 'ilhywH">{{match_elo}}<'),
    ('<span value="-30" class="Trend__Color-sc-71f6c460-0 geMaeW">',
     '<span value="{{elo_delta}}" class="Trend__Color-sc-71f6c460-0 {{delta_class}}">'),
    ('csvmeY">1.34<', 'csvmeY">{{rating}}<'),
    ('ilhywH">Dust 2<', 'ilhywH">{{map}}<'),
    ('alt="Dust 2"', 'alt="{{map}}"'),
    ('<a href="#" class="styles__MatchLink', '<a href="{{match_url}}" target="_blank" rel="noopener nofollow" class="styles__MatchLink'),
]
for old, new in ROW_SLOTS:
    if row_html.count(old) != 1:
        sys.exit('row slot %r matched %d times, expected 1' % (old, row_html.count(old)))
    row_html = row_html.replace(old, new)

# the K/D/A cell leads with an invisible LTR mark; match the numbers, not the glyph
m = re.search(r'>[\u200e\u200f]?\s*\d+ / \d+ / \d+<', row_html)
if not m:
    sys.exit('K/D/A cell in the row not found')
row_html = row_html[:m.start()] + '>{{row_kda}}<' + row_html[m.end():]

# the map thumbnail is an embedded png of that one map
row_html = re.sub(r'(<img alt="\{\{map\}\}" src=")data:image/png;base64,[^"]+', r'\1{{map_image}}', row_html)
print('row slots:', len(ROW_SLOTS) + 2)

io.open(OUT_ROW, 'w', encoding='utf-8', newline='\n').write(row_html)

os.makedirs(os.path.dirname(OUT_HTML), exist_ok=True)
io.open(OUT_HTML, 'w', encoding='utf-8', newline='\n').write(fragment)

print('css  :', OUT_CSS, '—', len(css), 'bytes component,', len(lifted), 'bytes lifted')
print('html :', OUT_HTML, '—', len(fragment), 'bytes')
