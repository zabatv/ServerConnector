# scratch: the three things the screenshots show — rows, the CS2 tile, the level ring
import io, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
body = io.open(os.path.join(ROOT, 'src', 'shell', 'body.html'), encoding='utf-8').read()
row = io.open(os.path.join(ROOT, 'src', 'shell', 'row.html'), encoding='utf-8').read()
css = io.open(os.path.join(ROOT, 'public', 'faceit.shell.css'), encoding='utf-8').read()

print('--- every Avatar__Image in the shell ---')
for m in re.finditer(r'<img[^>]*Avatar__Image[^>]*>', body):
    ctx = body[max(0, m.start() - 260):m.start()]
    holder = re.findall(r'Avatar__AvatarHolder-sc-a5251ba3-1 [^"]*', ctx)
    print('  ', m.group(0)[:120])
    print('     holder:', holder[-1][-60:] if holder else '?')

print('\n--- row anchor ---')
mm = re.search(r'<a [^>]*MatchLink[^>]*>', row)
print('  ', mm.group(0) if mm else 'none')
si = re.findall(r'si\d+', mm.group(0)) if mm else []
print('   lifted classes on it:', si)
for c in si:
    decl = re.search(r'\.%s\{([^}]*)\}' % c, css)
    print('   .%s -> %s' % (c, decl.group(1)[:160] if decl else 'NO RULE'))

print('\n--- level badge gradients ---')
i = body.find('data-testid="level')
if i < 0:
    i = body.find('styles__Container-sc-c93fcff6-0')
seg = body[i:i + 4000]
print('   fill refs:', sorted(set(re.findall(r'fill="url\(#([^)]+)\)"', seg)))[:6])
print('   defs in shell:', [g for g in re.findall(r'id="(paint[^"]+)"', body)][:6])
print('   gradient ids anywhere:', len(re.findall(r'<linearGradient', body)))
