# scratch: why did the body come out empty
import io, os
from lxml import html as LH

SRC = os.path.join(
    os.path.expanduser('~'),
    r'AppData\Roaming\AutoClaw-oversea-official\accounts\e5d87ad0368e8577b04312254f70264ad278be5f03604e3673469efdfaaff25a'
    r'\projects\Default\www.faceit.com.se\en\players\hightabier.html',
)
raw = io.open(SRC, encoding='utf-8', errors='replace').read()
doc = LH.fromstring(raw)
print('root tag', doc.tag)
print('children', [c.tag for c in doc][:10])
b = doc.find('body')
print('body', b)
print('body children', 0 if b is None else len(b))
print('text len', 0 if b is None else len(b.text or ''))
print('xpath body', len(doc.xpath('//body')))
print('serialized head', LH.tostring(doc, encoding='unicode')[:300])
# count divs in the whole document
print('divs', len(doc.xpath('//div')))
