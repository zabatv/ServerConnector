// scratch: resolve + verify live data end to end
const BASE = 'http://127.0.0.1:4173';
const post = async (path, form, cookie) => fetch(BASE + path, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded', ...(cookie ? { cookie } : {}) },
  body: new URLSearchParams(form).toString(),
  redirect: 'manual',
});
const login = await post('/admin/login', { username: 'operator', password: 'rostrum-dev-2026' });
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
const page = await (await fetch(BASE + '/admin', { headers: { cookie } })).text();
const csrf = page.match(/name="csrf" value="([^"]+)"/)[1];
const t0 = Date.now();
const res = await post('/admin/players/resolve', { csrf, nickname: 'fre5zy' }, cookie);
console.log('resolve:', res.status, Math.round((Date.now() - t0) / 1000) + 's');
const html = await (await fetch(BASE + '/p/e7f6682ae6')).text();
const has = (x) => html.includes(x) ? 'yes' : 'no';
console.log('live avatar:', has('distribution.faceit-cdn.net/images'));
console.log('elo 2,295:', has('2,295'), '| kda:', (html.match(/(\d+ \/ \d+ \/ \d+)/) || ['—'])[0]);
console.log('avg rating:', (html.match(/([\d.]+)\s*<\/span>\s*<svg width="88"/) || [])[1] || '—');
console.log('star badge (lvl10):', has('M32 19.08'));
console.log('matches:', (html.match(/([\d,]+)<\/b> Matches/) || [])[1] || '—');
process.exit(0);
