// Hidden Chromium regression against the running isolated review lab.
const { app, BrowserWindow } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

app.setName('FlyHigh Recovery Test');
app.setPath('userData', path.resolve(__dirname, `../../.review-lab/recovery-verification-${process.pid}`));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) {
  for (let n = 0; n < 120; n++) {
    if (await check()) return;
    await delay(500);
  }
  throw new Error('Timeout: ' + label);
}

app.whenReady().then(async () => {
  const runtime = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../.review-lab/runtime.json')));
  // A successfully downloaded script with no webpack registration reproduces
  // the screenshot's "missing" chunk error, rather than a generic network error.
  const fixture = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/javascript', 'cache-control': 'no-store' });
    response.end('/* Simulated missing chunk registration. */');
  });
  await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
  const win = new BrowserWindow({ show: false, width: 390, height: 844,
    webPreferences: { partition: `recovery-${Date.now()}`, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  const wc = win.webContents;
  let fail = false;
  let failures = 0;
  let navigations = 0;
  const isNarrationChunk = url => /\/_next\/static\/chunks\/app\/staff\/(?:narraciones|academia)\/page\.js$/.test(new URL(url).pathname);
  wc.on('did-start-navigation', (_event, url, inPlace, mainFrame) => {
    if (mainFrame && !inPlace && new URL(url).pathname === '/staff/narraciones') navigations++;
  });
  wc.session.webRequest.onBeforeRequest((details, callback) => {
    if (fail && isNarrationChunk(details.url)) {
      failures++;
      fail = false;
      callback({ redirectURL: `http://127.0.0.1:${fixture.address().port}/empty.js` });
    } else callback({});
  });
  const body = () => wc.executeJavaScript('document.body.innerText');
  const timeout = setTimeout(() => {
    console.error('Verification exceeded 120 seconds', { failures, navigations });
    app.exit(1);
  }, 120000);
  try {
    const response = await fetch(runtime.baseURL + '/api/review-lab/mobile-link', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-flyhigh-review-token': runtime.token },
      body: JSON.stringify({ role: 'pilot' }),
    });
    assert.equal(response.status, 200);
    await wc.loadURL(runtime.mobileBaseURL + (await response.json()).path);
    await until(async () => new URL(wc.getURL()).pathname === '/staff/dashboard' && (await body()).includes('Preparar visita'), 'pilot session');
    console.log('PASS: local pilot session ready');
    fail = true;
    await wc.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Abrir narraciones')).click(); true;`);
    await until(async () => failures === 1 && (await body()).includes('ACADEMIA'), 'automatic recovery from a transient failure');
    assert.ok(!(await body()).includes('No se pudo cargar la pantalla'));
    assert.equal(navigations, 1, 'exactly one automatic reload after client navigation');
    assert.equal(await wc.executeJavaScript(`sessionStorage.getItem('flyhigh:chunk-recovery:/staff/narraciones')`), '1');
    console.log('PASS: transient missing chunk recovers automatically');
  } catch (error) {
    console.error('Recovery state:', { failures, navigations, body: (await body()).slice(0, 1200) });
    throw error;
  } finally {
    clearTimeout(timeout);
    win.destroy(); fixture.closeAllConnections(); fixture.close();
  }
}).then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });
