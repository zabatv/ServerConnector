// scratch: match row + gamebar + rating block extraction
import { readFileSync } from 'node:fs';
let s = readFileSync('.zwork/attachments/c98d5cbb-a643-4ade-910a-30886825d30e/pasted_text_20261019T142400254Z_c8773441.txt', 'utf8');
const at = (key, before, len) => { const i = s.indexOf(key); console.log('=== ' + key + ' @' + i + ' ==='); if (i >= 0) console.log(s.slice(Math.max(0, i - before), i + len).replace(/\s+/g, ' ')); console.log(''); };
at('Recent matches', 300, 2600);
at('>Summary<', 1600, 400);
at('FaceitRating__RatingValue', 2600, 500);
console.log('thumbs/up-down:', (s.match(/graphDown|graphUp/g) || []).join(','));
console.log('What did you think idx:', s.indexOf('What did you think'));
