# scratch: what the mirror actually contains, and where its fonts live
import io, os, re

MIRROR = os.path.join(
    os.path.expanduser('~'),
    r'AppData\Roaming\AutoClaw-oversea-official\accounts\e5d87ad0368e8577b04312254f70264ad278be5f03604e3673469efdfaaff25a'
    r'\projects\Default',
)
SRC = os.path.join(MIRROR, 'www.faceit.com.se', 'en', 'players', 'hightabier.html')

print('--- .css files in the mirror ---')
for dp, _, fn in os.walk(MIRROR):
    for f in fn:
        if f.endswith('.css'):
            print('  ', os.path.relpath(os.path.join(dp, f), MIRROR))

s = io.open(SRC, encoding='utf-8', errors='replace').read()
print('\n--- woff2 preloads in the capture ---')
for m in re.finditer(r'<link[^>]+as="font"[^>]*>', s):
    href = re.search(r'href="([^"]+)"', m.group(0))
    print('  ', (href.group(1) if href else '(no href)')[:120])

print('\n--- @font-face src inside the inline styles ---')
for m in re.finditer(r'src:url\(([^)]+)\)', s[:130000]):
    print('  ', m.group(1)[:110])
