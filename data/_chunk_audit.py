# scratch: do the raw CDN chunks carry the match-table layout, and did the
# normalisation step eat it?
import io, os, re, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(
    os.path.expanduser('~'),
    r'AppData\Roaming\AutoClaw-oversea-official\accounts\e5d87ad0368e8577b04312254f70264ad278be5f03604e3673469efdfaaff25a'
    r'\projects\Default\www.faceit.com.se\en\players\hightabier.html',
)
raw = io.open(SRC, encoding='utf-8', errors='replace').read()
hrefs = re.findall(r'<link[^>]+rel="stylesheet"[^>]*href="([^"]+\.css[^"]*)"', raw)
hrefs += re.findall(r'<link[^>]+href="([^"]+\.css[^"]*)"[^>]*rel="stylesheet"', raw)
seen, ordered = set(), []
for h in hrefs:
    if 'zohocdn' in h or not h.startswith('http') or h in seen:
        continue
    seen.add(h)
    ordered.append(h)

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36')
found = []
for i, h in enumerate(ordered, 1):
    try:
        req = urllib.request.Request(h, headers={'User-Agent': UA, 'Referer': 'https://www.faceit.com/'})
        css = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
    except Exception as e:                                    # noqa: BLE001
        print('FAIL', h.rsplit('/', 1)[-1], e)
        continue
    if 'fjiKOH' in css or 'cf17d301' in css:
        found.append((i, h.rsplit('/', 1)[-1], css.count('fjiKOH'), css.count('cf17d301')))

print('chunks:', len(ordered))
print('chunks with table classes:', found if found else 'none')

# and the inline component block
block = re.search(r'<style data-styled="active"[^>]*>(.*?)</style>', raw, re.S).group(1)
print('inline block fjiKOH:', block.count('fjiKOH'), 'cf17d301:', block.count('cf17d301'),
      'dlliWd:', block.count('dlliWd'), 'fmNail:', block.count('fmNail'))
