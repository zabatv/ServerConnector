// scripts/mock_faceit.mjs — stand-in for the FACEIT Data API v4 used by the
// offline harnesses (restart, visual). Test-only: the application defaults to
// the real hosts and there is no switch inside src/ pointing it anywhere else.
//
//   start_mock_faceit() → { server }
//   set FACEIT_API_KEY and FACEIT_API_BASE=`<origin>/data/v4` before booting src/.

import { createServer } from 'node:http';

function start_mock_faceit() {
  const roster = {
    fre5zy: { player_id: 'faceit-9f2c41', nickname: 'fre5zy', avatar: '', country: 'de',
      games: { cs2: { faceit_elo: 2004, skill_level: 9 } } },
    luviulu1: { player_id: 'faceit-3a71bd', nickname: 'luviulu1', avatar: '', country: 'fr',
      games: { cs2: { faceit_elo: 2310, skill_level: 10 } } },
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/data/v4/players') {
      const hit = roster[(url.searchParams.get('nickname') || '').toLowerCase()];
      if (!hit) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(hit));
    }
    if (url.pathname.endsWith('/stats/cs2')) {
      const id = url.pathname.split('/')[4];
      if (!Object.values(roster).some((p) => p.player_id === id)) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ lifetime: {
        Matches: '2004', 'Average K/D Ratio': '1.12', 'Average K/R Ratio': '0.81',
        'Average Headshots %': '50', ADR: '85.9', 'Win Rate %': '55',
      } }));
    }
    res.writeHead(404).end();
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server })));
}

export { start_mock_faceit };
