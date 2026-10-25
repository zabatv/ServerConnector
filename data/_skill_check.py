# scratch: is the per-match badge actually in the rendered row?
import io, re

b = io.open('data/_render_probe.html', encoding='utf-8').read()
print('class="skill" count:', b.count('class="skill"'))
i = b.find('class="skill"')
print(repr(b[max(0, i - 160):i + 220]))
print()
print('rows:', len(re.findall(r'styles__MatchLink', b)))
print('badges inside rows:', len(re.findall(r'styles__MatchLink.*?class="skill"', b, re.S)))
