# scratch: exact tail layout of the capture, so the cut points are chosen on real markers
import io, os, re
SRC = os.path.join(
    os.path.expanduser('~'),
    r'AppData\Roaming\AutoClaw-oversea-official\accounts\e5d87ad0368e8577b04312254f70264ad278be5f03604e3673469efdfaaff25a'
    r'\projects\Default\www.faceit.com.se\en\players\hightabier.html',
)
s = io.open(SRC, encoding='utf-8', errors='replace').read()

marks = ['<iframe', '<noscript', 'next-route-announcer', 'zsiq_theme1', 'usercentrics-cmp-ui',
         '<style>.notification-overlay', '<div id="fc-overlay"', '<div id="fi-right-sidebar"',
         'styles__BottomStatusBarHolder', '</body>']
for m in marks:
    starts = [x.start() for x in re.finditer(re.escape(m), s)]
    print(f'{m!r:42} {starts}')

i = s.find('styles__BottomStatusBarHolder')
print('\n--- from bottom status bar to end (first 2600 chars) ---')
print(s[i:i + 2600])
