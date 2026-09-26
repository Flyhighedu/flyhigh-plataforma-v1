const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { startMobileGateway } = require('./server.cjs');

async function fixture(label) {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
    response.end(`${label}:${request.url}`);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}
test('temporary LAN gateway separates app and backend and rejects uninvited clients', async () => {
  const app = await fixture('app');
  const backend = await fixture('backend');
  const token = 'gateway-test-token';
  const gateway = await startMobileGateway({
    backendOrigin: `http://127.0.0.1:${backend.address().port}`,
    token, advertisedHost: '127.0.0.1', bindHost: '127.0.0.1', appPort: app.address().port,
  });
  try {
    assert.equal((await fetch(gateway.publicOrigin + '/uninvited')).status, 404);
    const entry = await fetch(gateway.mobileBaseURL + '/staff/dashboard');
    assert.equal(await entry.text(), 'app:/staff/dashboard');
    const cookie = entry.headers.get('set-cookie').split(';')[0];
    const asset = await fetch(gateway.publicOrigin + '/_next/asset.js', { headers: { cookie } });
    assert.equal(await asset.text(), 'app:/_next/asset.js');
    const api = await fetch(gateway.publicBackendURL + '/rest/v1/schools');
    assert.equal(await api.text(), 'backend:/rest/v1/schools');
  } finally {
    gateway.close(); app.closeAllConnections(); backend.closeAllConnections(); app.close(); backend.close();
  }
});
