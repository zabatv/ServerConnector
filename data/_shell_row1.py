# scratch: one match row + the activity level classes, ready to become templates
import io, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
body = io.open(os.path.join(ROOT, 'src', 'shell', 'body.html'), encoding='utf-8').read()
vendor = io.open(os.path.join(ROOT, 'public', 'faceit.shell.vendor.css'), encoding='utf-8').read()
comp = io.open(os.path.join(ROOT, 'public', 'faceit.shell.css'), encoding='utf-8').read()
allcss = vendor + comp

# activity levels
print('--- activity cell classes ---')
for cls in ['cGJmuf', 'bhYjZN', 'eBOxGc', 'dOKwKr', 'duvyqt', 'bwXEuu']:
    for m in re.finditer(r'\.%s\{([^}]{0,120})\}' % cls, allcss):
        print(f'  {cls}: {m.group(1)}')

# first match row
i = body.find('styles__MatchTableBody')
seg = body[i:i + 20000]
a = seg.find('styles__MatchLink')
start = seg.rfind('<a ', 0, a)
end = seg.find('</a>', a) + 4
row = seg[start:end]
print('\n--- first row (%d bytes) ---' % len(row))
print(row)
