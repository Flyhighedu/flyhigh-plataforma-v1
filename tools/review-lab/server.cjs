const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readEnv, validateEnvironment, cleanEnvironment, lanAddresses } = require('./core.cjs');
const root = path.resolve(__dirname, '../..');
const runtimeDir = path.join(root, '.review-lab');

function configuration() {
  const input = readEnv(path.join(root, '.env.review.local'));
  const config = validateEnvironment(input, readEnv(path.join(root, '.env.local')));
  return { input, config };
}
function hasMobileCookie(request, token) {
  return String(request.headers.cookie || '').split(';').some(part => part.trim() === `flyhigh_review_mobile=${token}`);
}
function gatewayRoute(request, token) {
  const appPrefix = `/review/${token}`;
  const backendPrefix = `/review-backend/${token}`;
  if (request.url === appPrefix || request.url.startsWith(appPrefix + '/')) {
    return { target: 'app', path: request.url.slice(appPrefix.length) || '/', establish: true };
  }
  if (request.url === backendPrefix || request.url.startsWith(backendPrefix + '/')) {
    return { target: 'backend', path: request.url.slice(backendPrefix.length) || '/', establish: false };
  }
  if (hasMobileCookie(request, token)) return { target: 'app', path: request.url, establish: false };
  return null;
}
function proxyHeaders(request, host) {
  const headers = { ...request.headers, host };
  delete headers.connection;
  return headers;
}
async function startMobileGateway({ backendOrigin, token, advertisedHost, bindHost = '0.0.0.0', port = 0, appPort = 3100 }) {
  const backend = new URL(backendOrigin);
  // startServer passes validateEnvironment's fixed :54321 origin. Accept another
  // loopback port here only so the proxy can be tested against a synthetic server.
  if (backend.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(backend.hostname) || !/^\d+$/.test(backend.port)) {
    throw new Error('El puente móvil solo acepta el Supabase local validado.');
  }
  let publicOrigin = '';
  const server = http.createServer((request, response) => {
    const route = gatewayRoute(request, token);
    if (!route) { response.writeHead(404, { 'Cache-Control': 'no-store' }); response.end(); return; }
    const target = route.target === 'backend'
      ? { hostname: backend.hostname, port: Number(backend.port), host: backend.host }
      : { hostname: '127.0.0.1', port: appPort, host: publicOrigin ? new URL(publicOrigin).host : `127.0.0.1:${appPort}` };
    const upstream = http.request({ hostname: target.hostname, port: target.port, method: request.method, path: route.path, headers: proxyHeaders(request, target.host) }, upstreamResponse => {
      const headers = { ...upstreamResponse.headers };
      if (route.establish) {
        const existing = headers['set-cookie'];
        headers['set-cookie'] = [...(Array.isArray(existing) ? existing : existing ? [existing] : []),
          `flyhigh_review_mobile=${token}; Path=/; Max-Age=14400; HttpOnly; SameSite=Lax`];
      }
      if (route.target === 'backend' && typeof headers.location === 'string' && headers.location.startsWith(backendOrigin)) {
        headers.location = publicOrigin + `/review-backend/${token}` + headers.location.slice(backendOrigin.length);
      }
      response.writeHead(upstreamResponse.statusCode || 502, headers);
      upstreamResponse.pipe(response);
    });
    upstream.on('error', () => { if (!response.headersSent) response.writeHead(502, { 'Cache-Control': 'no-store' }); response.end(); });
    request.pipe(upstream);
  });
  server.on('upgrade', (request, socket, head) => {
    const route = gatewayRoute(request, token);
    if (!route) { socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); return; }
    const target = route.target === 'backend'
      ? { hostname: backend.hostname, port: Number(backend.port), host: backend.host }
      : { hostname: '127.0.0.1', port: appPort, host: publicOrigin ? new URL(publicOrigin).host : `127.0.0.1:${appPort}` };
    const upstream = net.connect(target.port, target.hostname, () => {
      const lines = [`${request.method} ${route.path} HTTP/${request.httpVersion}`];
      for (let index = 0; index < request.rawHeaders.length; index += 2) {
        if (request.rawHeaders[index].toLowerCase() !== 'host') lines.push(`${request.rawHeaders[index]}: ${request.rawHeaders[index + 1]}`);
      }
      lines.push(`Host: ${target.host}`, '', '');
      upstream.write(lines.join('\r\n'));
      if (head?.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    const close = () => { if (!socket.destroyed) socket.destroy(); if (!upstream.destroyed) upstream.destroy(); };
    upstream.on('error', close); socket.on('error', close);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, bindHost, () => { server.off('error', reject); resolve(); });
  });
  const actualPort = server.address().port;
  publicOrigin = `http://${advertisedHost}:${actualPort}`;
  let closed = false;
  return {
    server,
    publicOrigin,
    mobileBaseURL: `${publicOrigin}/review/${token}`,
    publicBackendURL: `${publicOrigin}/review-backend/${token}`,
    close: () => { if (closed) return; closed = true; server.closeAllConnections?.(); server.close(); },
  };
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
  const lan = lanAddresses(os.networkInterfaces())[0];
  const gateway = lan ? await startMobileGateway({ backendOrigin: config.backendOrigin, token, advertisedHost: lan.address }) : null;
  const env = { ...cleanEnvironment(root, input), FLYHIGH_REVIEW_TOKEN: token,
    FLYHIGH_REVIEW_BACKEND_ORIGIN: config.backendOrigin,
    FLYHIGH_REVIEW_MOBILE_ORIGIN: gateway?.publicOrigin || '',
    FLYHIGH_REVIEW_MOBILE_HOST: lan?.address || '' };
  if (gateway) env.NEXT_PUBLIC_SUPABASE_URL = gateway.publicBackendURL;
  // Separate secrets for the test instance; no production integration credentials.
  env.ADMIN_PASSWORD = randomUUID();
  env.ADMIN_AUTH_SECRET = randomUUID();
  const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3100'], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = fs.createWriteStream(path.join(runtimeDir, 'server.log'), { flags: 'a' });
  child.stdout.pipe(log); child.stderr.pipe(log);
  child.on('error', error => log.write('No se pudo iniciar: ' + error.message + '\n'));
  const runtime = { ...config, token, pid: child.pid, mobileBaseURL: gateway?.mobileBaseURL || '', publicBackendURL: gateway?.publicBackendURL || config.backendOrigin, lan: lan ? { name: lan.name, address: lan.address } : null };
  fs.writeFileSync(path.join(runtimeDir, 'runtime.json'), JSON.stringify(runtime, null, 2));
  child.once('exit', () => {
    gateway?.close();
    log.end();
    const file = path.join(runtimeDir, 'runtime.json');
    try { if (JSON.parse(fs.readFileSync(file)).token === token) fs.unlinkSync(file); } catch { /* already removed */ }
  });
  const stop = () => {
    gateway?.close();
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
module.exports = { configuration, startServer, startMobileGateway, gatewayRoute };
