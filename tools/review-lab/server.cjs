const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readEnv, validateEnvironment, cleanEnvironment } = require('./core.cjs');
const root = path.resolve(__dirname, '../..');
const runtimeDir = path.join(root, '.review-lab');

function configuration() {
  const input = readEnv(path.join(root, '.env.review.local'));
  const config = validateEnvironment(input, readEnv(path.join(root, '.env.local')));
  return { input, config };
}
async function startServer() {
  const { input, config } = configuration();
  // Refuse to borrow an unrelated dev server on this port.
  const net = require('node:net');
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error('El puerto 3100 ya está ocupado. Cierra ese servidor antes de iniciar el laboratorio.')));
    probe.listen(3100, '127.0.0.1', () => probe.close(resolve));
  });
  fs.mkdirSync(runtimeDir, { recursive: true });
  const token = randomUUID();
  const env = { ...cleanEnvironment(root, input), FLYHIGH_REVIEW_TOKEN: token };
  // Separate secrets for the test instance; no production integration credentials.
  env.ADMIN_PASSWORD = randomUUID();
  env.ADMIN_AUTH_SECRET = randomUUID();
  const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3100'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = fs.createWriteStream(path.join(runtimeDir, 'server.log'), { flags: 'a' });
  child.stdout.pipe(log); child.stderr.pipe(log);
  child.on('error', error => log.write('No se pudo iniciar: ' + error.message + '\n'));
  const runtime = { ...config, token, pid: child.pid };
  fs.writeFileSync(path.join(runtimeDir, 'runtime.json'), JSON.stringify(runtime, null, 2));
  child.once('exit', () => {
    log.end();
    const file = path.join(runtimeDir, 'runtime.json');
    try { if (JSON.parse(fs.readFileSync(file)).token === token) fs.unlinkSync(file); } catch { /* already removed */ }
  });
  const stop = () => {
    if (child.exitCode !== null || child.killed) return;
    // Stop only the child process tree created by this launcher, including Next's worker.
    if (process.platform === 'win32') spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
    else child.kill();
  };
  return { child, runtime, stop };
}
if (require.main === module) {
  (async () => {
    const { config } = configuration();
    console.log('Destino de pruebas: ' + config.backendOrigin);
    if (process.argv.includes('--check')) { console.log('Configuración distinta de producción. Falta validar esquema, usuarios y flujos.'); return; }
    const { stop } = await startServer();
    console.log('Servidor de revisión iniciándose en http://localhost:3100. Registro: .review-lab/server.log');
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { configuration, startServer };
