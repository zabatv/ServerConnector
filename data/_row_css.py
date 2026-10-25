# scratch: how the captured match row gets its columns
import io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
css = (io.open(os.path.join(ROOT, 'public', 'faceit.shell.vendor.css'), encoding='utf-8').read()
       + io.open(os.path.join(ROOT, 'public', 'faceit.shell.css'), encoding='utf-8').read())

PATTERNS = [
    r'\.dlliWd\{[^}]*\}',
    r'\.fjiKOH\{[^}]*\}',
    r'\.fmNail\{[^}]*\}',
    r'\[class\*="MatchLink"\][^{]*\{[^}]*\}',
    r'\[class\*="MatchTableBody"\][^{]*\{[^}]*\}',
]

for pat in PATTERNS:
    hits = re.findall(pat, css)
    print(pat, '->', len(hits))
    for h in hits[:3]:
        print('   ', h[:320])
    print()
