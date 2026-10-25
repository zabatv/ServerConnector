// scratch: cover check for one player
const { collect } = await import('./src/collect.js');
const t0 = Date.now();
try {
  const out = await collect('hightabier');
  console.log('secs', Math.round((Date.now() - t0) / 1000));
  console.log('player.cover:', out.player.cover || 'none');
  console.log('stats.cover:', out.stats.cover || 'none');
  console.log('avatar:', (out.player.avatar || 'none').slice(0, 60), '| elo:', out.player.elo, '| lvl:', out.player.skill_level);
} catch (err) { console.log('FAILED', err.code || '', err.message.slice(0, 90)); }
process.exit(0);
