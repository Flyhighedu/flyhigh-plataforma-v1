// One live, hidden view against the authorized Google API. No image capture,
// export, persistent Google data, or operations against production databases.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const assert = require('node:assert/strict');
const { startMobileGateway } = require('./server.cjs');
app.setName('FlyHigh 3D Regression');
app.setPath('userData', path.resolve(__dirname, '../../.review-lab/google-verification'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, description, seconds = 90) {
  for (let n = 0; n < seconds * 2; n++) { if (await check()) return; await delay(500); }
  throw new Error('Timeout: ' + description);
}
app.whenReady().then(async () => {
  const runtime = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../.review-lab/runtime.json')));
  const key = parseEnv(fs.readFileSync(path.resolve(__dirname, '../../.env.local'), 'utf8')).GOOGLE_MAP_TILES_API_KEY;
  assert.ok(key, 'dedicated key configured');
  const gateway = await startMobileGateway({ backendOrigin: runtime.backendOrigin, token: runtime.token, advertisedHost: runtime.lan.address });
  const win = new BrowserWindow({ show: false, width: 390, height: 844, webPreferences: { partition: `google-regression-${Date.now()}`, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  const wc = win.webContents;
  let leaked = false;
  let roots = 0;
  let resources = 0;
  let workerRequests = 0;
  const failed = [];
  const consoleErrors = [];
  const watchdog = setTimeout(() => { console.error('Global timeout in hidden 3D check'); app.exit(1); }, 220000);
  const navigate = async url => {
    console.log('Loading:', new URL(url).pathname.replace(/\/review\/[^/]+/, '/review/[temporary]'));
    const timer = setTimeout(() => { console.log('Stopping stalled document load'); wc.stop(); }, 30000);
    try { await wc.loadURL(url); } finally { clearTimeout(timer); }
    console.log('Loaded:', new URL(wc.getURL()).pathname);
  };
  try {
    wc.session.webRequest.onBeforeRequest((details, callback) => { if (details.url.includes(key) || details.url.startsWith('https://tile.googleapis.com')) leaked = true; callback({}); });
    wc.session.webRequest.onCompleted(details => {
      const u = new URL(details.url);
      if (u.pathname.startsWith('/api/review-lab/google-3d')) {
        if (details.statusCode === 200) { if (u.searchParams.has('visit')) roots++; else resources++; }
        else failed.push(details.statusCode);
      }
      if (u.pathname.includes('/cesium/Workers/') && details.statusCode === 200) workerRequests++;
    });
    wc.on('console-message', event => {
      if (event.level === 'error') {
        const message = event.message.split(key).join('[KEY]').replace(/https?:\/\/\S+/g, '[URL]').slice(0, 500);
        consoleErrors.push(message);
        console.error('Renderer:', message);
      }
    });
    const linkResponse = await fetch(runtime.baseURL + '/api/review-lab/mobile-link', { method: 'POST', headers: { 'content-type': 'application/json', 'x-flyhigh-review-token': runtime.token }, body: JSON.stringify({ role: 'pilot' }) });
    assert.equal(linkResponse.status, 200);
    await navigate(gateway.mobileBaseURL + (await linkResponse.json()).path);
    await until(() => wc.executeJavaScript(`Array.from(document.querySelectorAll('a')).some(a=>a.textContent.includes('Preparar visita'))`), 'pilot sign in');
    const href = await wc.executeJavaScript(`Array.from(document.querySelectorAll('a')).find(a=>a.textContent.includes('Preparar visita')).getAttribute('href')`);
    await navigate(gateway.publicOrigin + href);
    await until(() => wc.executeJavaScript(`Array.from(document.querySelectorAll('a')).some(a=>a.textContent.includes('Probar relieve 3D'))`), 'separate 3D entry');
    console.log('PASS authenticated LAN access and separate 3D entry');
    await navigate(gateway.publicOrigin + href + '/simulacion-3d');
    await until(async () => {
      const status = await wc.executeJavaScript(`(() => { const m=document.querySelector('[aria-label="Mapa del ensayo de vuelo"]'); return { ready:m?.dataset.engine==='google-3d', status:[...document.querySelectorAll('[role="status"]')].map(e=>e.textContent).join(' '), body:document.body.innerText }; })()`);
      if (/No se pudo|El relieve de esta|Este dispositivo|Falta GOOGLE|Google rechazó|Se alcanzó/.test(status.body)) throw new Error(status.body.slice(0, 900));
      return status.ready;
    }, 'Google 3D surface and camera', 110);
    // Uncompressed Google meshes do not necessarily need a decoding worker.
    await until(() => resources > 0, 'tile resources');
    await until(() => wc.executeJavaScript(`Number(document.querySelector('[aria-label="Mapa del ensayo de vuelo"]').dataset.tilesRendered)>0`), 'rendered 3D meshes');
    const geometry = await wc.executeJavaScript(`(() => { const m=document.querySelector('[aria-label="Mapa del ensayo de vuelo"]'), c=m.querySelector('canvas'); window.__googleCanvas=c; return {w:c.clientWidth,h:c.clientHeight,ground:m.dataset.groundReady,tiles:Number(m.dataset.tilesRendered),markers:m.querySelectorAll('.flight-google-marker').length,credits:document.querySelector('.cesium-widget-credits')?.innerText}; })()`);
    assert.ok(geometry.w > 300 && geometry.h > 500);
    assert.equal(geometry.ground, 'true');
    assert.ok(geometry.markers > 0);
    assert.ok(geometry.credits, 'provider credits must be visible');
    assert.equal(leaked, false, 'API key stays server-side');
    assert.equal(roots, 1, 'one billable root session');
    console.log('PASS real Google meshes, surface positioning, markers and attribution:', geometry);
    const altitude = () => wc.executeJavaScript(`Number(document.querySelector('[aria-label="Mapa del ensayo de vuelo"]').dataset.cameraHeight)`);
    const before = await altitude();
    const pad = await wc.executeJavaScript(`(() => { const r=document.querySelector('[aria-label="Altura · giro"]').getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`);
    wc.sendInputEvent({ type: 'mouseDown', ...pad, button: 'left', clickCount: 1 });
    await delay(250);
    assert.equal(await altitude(), before, 'touch establishes neutral origin');
    wc.sendInputEvent({ type: 'mouseMove', x: pad.x, y: pad.y - 35 });
    await delay(900);
    wc.sendInputEvent({ type: 'mouseUp', ...pad, button: 'left', clickCount: 1 });
    await delay(250);
    assert.ok(await altitude() > before, 'right control raises real 3D camera');
    await wc.executeJavaScript(`document.querySelector('[aria-label="Regresar a la escuela"]').click()`);
    await until(async () => await altitude() === before, 'camera reset');
    await wc.executeJavaScript(`document.querySelector('[role="slider"]').focus()`);
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'End' });
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'End' });
    await until(() => wc.executeJavaScript(`Number(document.querySelector('[aria-label="Mapa del ensayo de vuelo"]').dataset.cameraPitch)===0`), 'actual horizontal camera at zero gimbal');
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'Home' });
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Home' });
    await until(() => wc.executeJavaScript(`Number(document.querySelector('[aria-label="Mapa del ensayo de vuelo"]').dataset.cameraPitch)===-90`), 'actual downwards camera');
    await wc.executeJavaScript(`document.querySelector('[aria-label="Pantalla completa horizontal"]').click()`, true);
    await until(() => wc.executeJavaScript('Boolean(document.fullscreenElement)'), '3D fullscreen');
    await until(() => wc.executeJavaScript(`Boolean(document.querySelector('[aria-label="Salir de pantalla completa"]'))`), 'fullscreen control');
    await wc.executeJavaScript(`document.querySelector('[aria-label="Salir de pantalla completa"]').click()`, true);
    await until(() => wc.executeJavaScript('!document.fullscreenElement'), 'exit 3D fullscreen');
    win.setContentSize(844, 390);
    await delay(700);
    assert.equal(await wc.executeJavaScript(`window.__googleCanvas===document.querySelector('.cesium-widget canvas')`), true, 'rotation keeps same WebGL context');
    await delay(17000);
    assert.equal(await wc.executeJavaScript(`window.__googleCanvas===document.querySelector('.cesium-widget canvas')`), true, 'metadata polling keeps same WebGL context');
    assert.equal(roots, 1, 'no root session recreated during controls, rotation or polling');
    assert.equal(leaked, false);
    assert.deepEqual(failed, []);
    assert.deepEqual(consoleErrors.filter(message => /error|failed|exception/i.test(message)), []);
    console.log('PASS altitude, gimbal 0/-90, reset, fullscreen, landscape, polling stability and credential privacy:', { roots, resources, workerRequests });
    const unauthorized = await fetch(runtime.baseURL + '/api/review-lab/google-3d?visit=1', { redirect: 'manual' });
    assert.equal(unauthorized.status, 401);
    const negative = await wc.executeJavaScript(`Promise.all(['/api/review-lab/google-3d?resource=invalid','/api/review-lab/google-3d?visit=not-an-id','/api/review-lab/cesium/package.json'].map(async p=>(await fetch(p)).status))`);
    assert.deepEqual(negative, [403, 400, 404]);
    console.log('PASS anonymous, forged resource, invalid visit and private file access rejected');
  } finally { clearTimeout(watchdog); win.destroy(); gateway.close(); }
}).then(() => app.exit(0)).catch(error => { console.error(error.message); app.exit(1); });
