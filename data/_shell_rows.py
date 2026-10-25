# scratch: grab one match row and the activity-cell level classes from the shell
import io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
body = io.open(os.path.join(ROOT, 'src', 'shell', 'body.html'), encoding='utf-8').read()
css = io.open(os.path.join(ROOT, 'public', 'faceit.shell.css'), encoding='utf-8').read()

# --- activity cells ---------------------------------------------------------
graph = re.search(r'<div class="styles__Graph-sc-75ae0e0a-9 [^"]*">', body)
print('graph at', graph.start() if graph else None)
cells = re.findall(r'<div class="[^"]*styles__Cell-sc-75ae0e0a-10 ([^"]*)"[^>]*></div>', body)
print('cells', len(cells), 'distinct classes', sorted(set(cells)))
for cls in sorted(set(cells)):
    m = re.search(r'\.%s\{([^}]*)\}' % re.escape(cls), body + css)
    m2 = re.search(r'\.%s\{([^}]*)\}' % re.escape(cls), css)
    print('  ', cls, '->', (m2.group(1) if m2 else '?')[:90])

# --- one match row ----------------------------------------------------------
m = re.search(r'(<div class="[^"]*styles__MatchTableRow[^"]*"[^>]*>.*?)(?=<div class="[^"]*styles__MatchTableRow)', body, re.S)
if not m:
    # fall back: first cell wrapper after the table header
    idx = body.find('styles__MatchTableCells')
    print('\nno MatchTableRow; around table:', body[idx - 200:idx + 200] if idx > 0 else 'n/a')
else:
    row = m.group(1)
    print('\nrow bytes', len(row))
    print(row[:3000])
