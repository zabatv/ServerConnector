# scratch: inspect the tail of the capture + inline style attributes
import io, os, re

SRC = os.path.join(
    os.path.expanduser('~'),
    r'AppData\Roaming\AutoClaw-oversea-official\accounts\e5d87ad0368e8577b04312254f70264ad278be5f03604e3673469efdfaaff25a'
    r'\projects\Default\www.faceit.com.se\en\players\hightabier.html',
)
s = io.open(SRC, encoding='utf-8', errors='replace').read()

print('fi-right-sidebar at', s.find('fi-right-sidebar'))
print('fc-overlay div at', s.find('<div id="fc-overlay"'))
print('body end at', s.rfind('</body>'))

print('\n--- tail 477200..478950 ---')
print(s[477200:478950])

print('\n--- inline style attributes ---')
attrs = re.findall(r'\sstyle="([^"]{0,120})"', s)
print('count', len(attrs))
from collections import Counter
for a, c in Counter(attrs).most_common(12):
    print(f'  {c:3}  {a[:110]}')

print('\n--- on* handlers ---')
print(Counter(re.findall(r'\son(click|load|error|mouseover)=', s)))

print('\n--- iframes ---')
for m in re.finditer(r'<iframe[^>]*>', s):
    print('  ', m.group(0)[:140])
