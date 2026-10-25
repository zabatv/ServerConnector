// scratch: targeted extraction of live page regions
import { readFileSync } from 'node:fs';
let s = readFileSync('.zwork/attachments/c98d5cbb-a643-4ade-910a-30886825d30e/pasted_text_20261019T142400254Z_c8773441.txt', 'utf8');
const at = (key, before, len) => { const i = s.indexOf(key); console.log('=== ' + key + ' @' + i + ' ==='); if (i >= 0) console.log(s.slice(Math.max(0, i - before), i + len).replace(/\s+/g, ' ').slice(0, len + 100)); console.log(''); };
at('Guestbook', 200, 1800);
at('Recent performance', 100, 700);
at('Elo change', 2200, 300);
at('Swing', 1500, 400);
console.log('recharts wrappers:', (s.match(/recharts-wrapper/g) || []).length);
for (const m of s.matchAll(/class="recharts-wrapper"[^>]*width="(\d+)" height="(\d+)"/g)) console.log('chart', m[1], 'x', m[2]);
console.log('use hrefs:', [...new Set([...s.matchAll(/<use href="([^"]+)"/g)].map((m) => m[1]))].join('\n'));
