# scratch: outline the capture's body so the template slots can be placed
import io, os, re
from lxml import html

SRC = os.path.join(
    os.path.expanduser('~'),
    r'AppData\Roaming\AutoClaw-oversea-official\accounts\e5d87ad0368e8577b04312254f70264ad278be5f03604e3673469efdfaaff25a'
    r'\projects\Default\www.faceit.com.se\en\players\hightabier.html',
)
s = io.open(SRC, encoding='utf-8', errors='replace').read()
doc = html.fromstring(s)
body = doc.find('body')

SKIP = {'svg', 'path', 'defs', 'lineargradient', 'stop', 'g', 'circle', 'rect', 'mask', 'filter', 'feflood'}

def walk(el, depth=0, out=None):
    if out is None:
        out = []
    if depth > 16:
        return out
    tag = el.tag if isinstance(el.tag, str) else '?'
    if tag.lower() in SKIP:
        cls = (el.get('class') or '')[:40]
        out.append(f'{"  " * depth}<{tag} class={cls}> …')
        return out
    cls = el.get('class') or ''
    role = el.get('data-testid') or el.get('id') or ''
    own = (el.text or '').strip()
    own = re.sub(r'\s+', ' ', own)[:60]
    extra = ''
    if tag == 'img':
        extra = ' src=' + (el.get('src') or '')[:70]
    out.append(f'{"  " * depth}<{tag}> {cls[:60]}{(" #" + role) if role else ""}{extra}{(" | " + own) if own else ""}')
    for child in el:
        walk(child, depth + 1, out)
    return out

lines = walk(body)
print('\n'.join(lines))
print('total lines', len(lines))
