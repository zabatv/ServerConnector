# scratch: every player-specific value in the shell, with its context, so each
# substitution can be anchored and asserted
import io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
body = io.open(os.path.join(ROOT, 'src', 'shell', 'body.html'), encoding='utf-8').read()

NEEDLES = [
    'hightabier', '2,144', '2,108', 'Elo change', '>13<', '>17<', '>317<', '>332<',
    '>89<', '53.9', '4,273', '158,284', '1.07', '-0.64', '60%', '15 / 16 / 5',
    '0.91', '0.65', '57%', '75.6', '43%', 'Jun 1, 2014', 'POMMES', 'Germany',
    'flag-icon-', 'Avatar__Image', 'cover', 'data:image/jpeg',
]

for n in NEEDLES:
    hits = [m.start() for m in re.finditer(re.escape(n), body)]
    print(f'{n!r:20} x{len(hits)}')
    for h in hits[:6]:
        ctx = body[max(0, h - 90):h + 60].replace('\n', ' ')
        print('    …', ctx)
    print()
