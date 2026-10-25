//не удалять
// scripts/dev.mjs — dev entry point. The POSIX one-liner
// `DEV_CLAIMS=1 node src/server.js` dies under the cmd.exe that npm runs scripts
// through on Windows, so the defaults are set here instead. An explicit
// environment wins.
process.env.DEV_CLAIMS ||= '1';
const { start } = await import('../src/server.js');
start();
