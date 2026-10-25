// scratch: inventory of the pasted live page — visible text + section map
import { readFileSync } from 'node:fs';
let s = readFileSync('.zwork/attachments/c98d5cbb-a643-4ade-910a-30886825d30e/pasted_text_20261019T142400254Z_c8773441.txt', 'utf8');
s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ');
const text = s.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !/^[A-Za-z0-9+/=]{200,}$/.test(l));
console.log('--- visible text (deduped, in order) ---');
const seen = new Set();
for (const l of text) { const k = l.slice(0, 60); if (seen.has(k)) continue; seen.add(k); console.log(l.slice(0, 110)); }
console.log('\n--- structural markers ---');
for (const m of s.matchAll(/class="([^"]*(?:MainNav|Header|Tab|GameBar|gamebar|Performance|PerformanceCard|MatchesTable|Footer|Dock|RightRail|profile)[^"]*)"/g)) {
  console.log(m[1].slice(0, 100));
}
