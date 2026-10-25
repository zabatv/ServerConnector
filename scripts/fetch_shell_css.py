# Download the stylesheet chunks the saved profile page links to, and concatenate
# them into one self-hosted file. One-shot maintainer tool:
#   python scripts/fetch_shell_css.py
#
# The captured page keeps its styles in ~38 <link rel=stylesheet> chunks on
# cdn-frontend.faceit-cdn.net; the inline <style data-styled> block only covers
# component internals. A shell without these chunks collapses into plain flow.
import io, os, re, sys, urllib.request

SRC = os.environ.get('FACEIT_CAPTURE') or os.path.join(
    os.path.expanduser('~'),
    r'AppData\Roaming\AutoClaw-oversea-official\accounts\e5d87ad0368e8577b04312254f70264ad278be5f03604e3673469efdfaaff25a'
    r'\projects\Default\www.faceit.com.se\en\players\hightabier.html',
)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'faceit.shell.vendor.css')

raw = io.open(SRC, encoding='utf-8', errors='replace').read()
hrefs = re.findall(r'<link[^>]+rel="stylesheet"[^>]*href="([^"]+\.css[^"]*)"', raw)
hrefs += re.findall(r'<link[^>]+href="([^"]+\.css[^"]*)"[^>]*rel="stylesheet"', raw)
seen, ordered = set(), []
for href in hrefs:
    if 'zohocdn' in href or href in seen:
        continue
    seen.add(href)
    ordered.append(href)
print('stylesheets:', len(ordered))

parts = [
    '/* FACEIT stylesheet chunks fetched from cdn-frontend.faceit-cdn.net by\n'
    '   scripts/fetch_shell_css.py — the same files the saved profile page linked.\n'
    '   Concatenated in document order; do not hand-edit. */\n'
]
total = 0
fonts, others = set(), set()
for i, href in enumerate(ordered, 1):
    if not href.startswith('http'):
        print('  skip', href[:60])
        continue
    try:
        req = urllib.request.Request(href, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                          '(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
            'Accept': 'text/css,*/*;q=0.1',
            'Referer': 'https://www.faceit.com/',
        })
        with urllib.request.urlopen(req, timeout=30) as r:
            css = r.read().decode('utf-8', 'replace')
    except Exception as e:                                    # noqa: BLE001
        print('  FAIL', href, e)
        continue
    total += len(css)
    fonts.update(re.findall(r'url\((?:"|\')?(https?://[^)"\']*\.woff2[^)"\']*)', css))
    others.update(re.findall(r'url\((?:"|\')?(https?://(?![^)"\']*\.woff2)[^)"\']*)', css))
    parts.append('\n/* ==== chunk %d/%d %s ==== */\n' % (i, len(ordered), href.rsplit('/', 1)[-1].split('?')[0]))
    parts.append(css)

out = ''.join(parts)


def normalize(css):
    """Make the chunk CSS usable from our origin.

    Their @font-face blocks point at ../media/*.woff2, which only exists on their
    deployment — every one of them 404s here, and text that asks for `geistSans`
    falls back to a generic sans with different metrics. Swap the family names to
    the Geist we self-host and drop the dead faces; same for relative CDN images.
    """
    css = re.sub(r'@font-face\{[^}]*\}', '', css)
    css = css.replace('geistSans Fallback', 'Arial')
    css = css.replace('geistSans', 'Play')
    css = css.replace('geistMono', 'ui-monospace')
    # the capture renders with Play everywhere (it forced it); match the reference
    css = css.replace('Geist Fallback', 'Arial').replace('Geist', 'Play')
    css = re.sub(r'url\((?:"|\')?(?:\.\./)+(distribution\.faceit-cdn\.net|assets\.faceit-cdn\.net|cdn-frontend\.faceit-cdn\.net)',
                 r'url(https://\1', css)
    return css


out = normalize(out)
# their fonts are pinned to the CDN; the project self-hosts Geist under /fonts
out = re.sub(r'url\((?:"|\')?https?://[^)"\']*?([A-Za-z0-9_.-]+\.woff2)[^)"\']*(?:"|\')?\)',
             lambda m: 'url(/fonts/%s)' % m.group(1), out)
io.open(OUT, 'w', encoding='utf-8', newline='\n').write(out)

print('bytes written:', total, '->', len(out))
print('woff2 urls seen:', len(fonts))
for f in sorted(fonts)[:6]:
    print('   ', f.rsplit('/', 1)[-1])
print('other absolute urls:', len(others))
for o in sorted(others)[:8]:
    print('   ', o[:110])
