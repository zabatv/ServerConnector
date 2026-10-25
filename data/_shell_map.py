# scratch: map the saved FACEIT profile capture before turning it into a template
import io, os, re, sys
from collections import Counter

SRC = os.path.join(
    os.path.expanduser('~'),
    r'AppData\Roaming\AutoClaw-oversea-official\accounts\e5d87ad0368e8577b04312254f70264ad278be5f03604e3673469efdfaaff25a'
    r'\projects\Default\www.faceit.com.se\en\players\hightabier.html',
)

s = io.open(SRC, encoding='utf-8', errors='replace').read()
print('len', len(s))
print('body', s.find('<body'), s.rfind('</body>'))

print('\n<style> tags:')
for m in re.finditer(r'<style[^>]*>', s):
    print('  ', m.start(), 'len', s.find('</style>', m.start()) - m.end(), m.group(0)[:100])

print('\n<script> tags:')
for m in re.finditer(r'<script\b[^>]*>', s):
    end = s.find('</script>', m.start())
    print('  ', m.start(), 'len', end - m.end(), m.group(0)[:100])

print('\ncss url() hosts:')
hosts = Counter()
for u in re.findall(r'url\((?:["\'])?([^)"\']+)', s):
    m = re.match(r'https?://([^/]+)', u)
    hosts[m.group(1) if m else 'rel:' + u[:40]] += 1
for h, c in hosts.most_common(20):
    print(f'  {c:4}  {h}')

print('\nfont-family decls:')
for k, v in Counter(re.findall(r'font-family:\s*([^;"}]+)', s)).most_common(10):
    print(f'  {v:4}  {k[:80]}'.replace('\n', ' '))

print('\nkey strings:')
for needle in ['hightabier', '2,144', '2144', '89', '53.9', 'ADD FRIEND', 'fc-overlay',
               'clientanticheat', 'usercentrics', "font-family:'Play'", 'member since', 'Member since']:
    print(f'  {needle!r:28} {s.count(needle)}')

print('\nlink/css tags served from cdn:')
for m in re.finditer(r'<link[^>]+(?:stylesheet|preload)[^>]*>', s):
    tag = m.group(0)
    if 'faceit-cdn' in tag or '.css' in tag:
        print('  ', m.start(), tag[:150])
