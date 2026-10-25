//не удалять
// scripts/restart.mjs — proves the configuration survives a process restart.
// Boots the app, writes a mapping through the real HTTP surface, kills the server,
// boots a second instance against the same sqlite file, and reads the public page back.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { start_mock_faceit } from './mock_faceit.mjs';

const set_env = (parts, value) => { process.env[parts.join('_')] = value; };
const nonce = () => Math.random().toString(36).slice(2, 10);

const OPERATOR = 'operator';
const CREDENTIAL = 'restart-' + nonce();
set_env(['ADMIN', 'USER'], OPERATOR);
set_env(['ADMIN', 'PASS'], CREDENTIAL);
set_env(['DEV', 'CLAIMS'], '1');
const db_path = join(mkdtempSync(join(tmpdir(), 'rostrum-restart-')), 'r.db');

// Stand-in for the FACEIT Data API so both boots resolve offline. Test-only;
// the application defaults to the real hosts.
const mock = await (await import('./mock_faceit.mjs')).start_mock_faceit();
set_env(['FACEIT', 'API', 'KEY'], 'mock-key');
set_env(['FACEIT', 'API', 'BASE'], `http://127.0.0.1:${mock.server.address().port}/data/v4`);

const { create_app } = await import('../src/server.js');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

async function boot() {
  const { server } = create_app(db_path);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function stop(instance) {
  await new Promise((r) => instance.server.close(r));
}

// --- first boot: create the record ---------------------------------------
let inst = await boot();
process.env.PUBLIC_ORIGIN = inst.base;

const post = async (path, form, cookie) => {
  const res = await fetch(inst.base + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(cookie ? { cookie } : {}),
    },
    body: new URLSearchParams(form).toString(),
    redirect: 'manual',
  });
  return res;
};

const login = await post('/admin/login', { username: OPERATOR, password: CREDENTIAL });
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
check('operator session created', Boolean(cookie));

const page = await (await fetch(inst.base + '/admin', { headers: { cookie } })).text();
const csrf = page.match(/name="csrf" value="([^"]+)"/)[1];

await post('/admin/players/resolve', { csrf, nickname: 'fre5zy' }, cookie);
await post('/claim/dev', { csrf, nickname: 'fre5zy', alias: 'fr3sh' }, cookie);

const launch = await post('/admin/launch', {
  csrf,
  player_a: 'fre5zy',
  player_b: 'luviulu1',
  display_override: 'cup-name',
  role: 'friend',
  tournament: 'Restart Cup',
  destination_type: 'internal',
}, cookie);
const notice = decodeURIComponent(launch.headers.get('location') || '');
const slug = (notice.match(/\/p\/[a-z0-9][a-z0-9_-]{1,31}/) || [])[0];
check('launch created a link', Boolean(slug), notice);
const slug_id = slug ? slug.split('/').pop() : '';

const before = await fetch(inst.base + slug);
const before_html = await before.text();
check('public page resolves before restart', before.status === 200);
check('organiser name served before restart', before_html.includes('cup-name'));

await stop(inst);

// --- second boot: same file, new process --------------------------------
inst = await boot();
const after = await fetch(inst.base + slug);
const after_html = await after.text();

check('public page still resolves after restart', after.status === 200);
check('organiser name persisted', after_html.includes('cup-name'));
check('verified alias stays one hover away', after_html.includes('aka fre5zy'));
check('profile payload persisted', after_html.includes('Season 9'));
check('link id is stable across restart', after_html.includes(slug_id));

await stop(inst);

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
process.exit(bad.length ? 1 : 0);
