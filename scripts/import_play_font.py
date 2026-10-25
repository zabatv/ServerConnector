# Bring the Play face the capture was saved with into public/, so the shell can
# keep the typography the reference actually renders with. One-shot:
#   python scripts/import_play_font.py
import io, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIRROR = os.path.join(
    os.path.expanduser('~'),
    r'AppData\Roaming\AutoClaw-oversea-official\accounts\e5d87ad0368e8577b04312254f70264ad278be5f03604e3673469efdfaaff25a'
    r'\projects\Default',
)
CSS_SRC = os.path.join(MIRROR, 'fonts.googleapis.com', 'css2@family=Play%3Awght@400;700&display=swap.css')
FONT_DIR = os.path.join(MIRROR, 'fonts.gstatic.com', 's', 'play', 'v21')
OUT_CSS = os.path.join(ROOT, 'public', 'fonts-play.css')
OUT_DIR = os.path.join(ROOT, 'public', 'fonts')

if not os.path.exists(CSS_SRC):
    sys.exit('mirrored Play stylesheet not found: %s' % CSS_SRC)

css = io.open(CSS_SRC, encoding='utf-8', errors='replace').read()
copied = 0


def take(m):
    global copied
    name = m.group(1)
    src = os.path.join(FONT_DIR, name)
    if not os.path.exists(src):
        sys.exit('missing woff2: %s' % src)
    dst = os.path.join(OUT_DIR, 'play-' + name)
    if not os.path.exists(dst):
        shutil.copyfile(src, dst)
        copied += 1
    return 'url(/fonts/play-%s) format(\'woff2\')' % name


css = re.sub(r'url\((?:\.\./)+fonts\.gstatic\.com/s/play/v21/([A-Za-z0-9_.-]+\.woff2)\)\s*format\(\'woff2\'\)', take, css)
if 'fonts.gstatic.com' in css:
    sys.exit('some Play urls were not rewritten')
css = '/* Play, self-hosted (SIL OFL) — the face the saved profile page renders with. */\n' + css
io.open(OUT_CSS, 'w', encoding='utf-8', newline='\n').write(css)
print('families:', css.count('@font-face'), 'files copied:', copied, '->', OUT_CSS)
