// scratch: check cover extraction from the live API/page
const { collect } = await import('./src/collect.js');
for (const nick of ['hightabier', 'fre5zy']) {
  try {
    const out = await collect(nick);
    console.log(nick, '| player.cover:', (out.player.cover || 'none').slice(0, 70), '| stats.cover:', (out.stats.cover || 'none').slice(0, 70),
      '| avatar:', (out.player.avatar || 'none').slice(0, 50), '| elo:', out.player.elo, '| lvl:', out.player.skill_level);
  } catch (err) { console.log(nick, 'FAILED:', err.code || '', err.message.slice(0, 80)); }
}
process.exit(0);
