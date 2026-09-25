const { spawn } = require('node:child_process');
const { startServer } = require('./server.cjs');
async function launch() {
  let executable;
  try { executable = require('electron'); } catch { throw new Error('Instala primero la herramienta: npm install --prefix tools/review-lab'); }
  let server;
  if (process.argv.includes('--server')) server = await startServer();
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(executable, [__dirname, ...process.argv.slice(2).filter(arg => arg !== '--server')], { env, windowsHide: false, stdio: 'ignore' });
  child.on('error', error => { server?.stop(); console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { server?.stop(); process.exitCode = code || 0; });
}
launch().catch(error => { console.error(error.message); process.exitCode = 1; });
