// Real Chromium regression checks against the running isolated lab; no visible UI.
const { app, BrowserWindow, nativeImage } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { startMobileGateway } = require('./server.cjs');
const { qrDataURL } = require('./qr.cjs');
const verifyFlightInteractions = require('./verify-flight-interactions.cjs');
app.setName('FlyHigh Regression');
app.setPath('userData', path.resolve(__dirname, '../../.review-lab/mobile-verification'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, description) {
  for (let n = 0; n < 180; n++) { if (await check()) return; await delay(500); }
  throw new Error('Timeout: ' + description);
}
app.whenReady().then(async () => {
  // Exercise pan/zoom without automated harvesting of public map tiles.
  const tile = nativeImage.createFromBitmap(Buffer.alloc(256 * 256 * 4, 220), { width: 256, height: 256 }).toPNG();
  const fixtureServer = http.createServer((_req, res) => { res.writeHead(200, { 'content-type': 'image/png', 'access-control-allow-origin': '*', 'cache-control': 'max-age=3600' }); res.end(tile); });
  await new Promise(resolve => fixtureServer.listen(0, '127.0.0.1', resolve));
  const tileOrigin = `http://127.0.0.1:${fixtureServer.address().port}`;
  const runtime = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../.review-lab/runtime.json')));
  const gateway = await startMobileGateway({ backendOrigin: runtime.backendOrigin, token: runtime.token, advertisedHost: runtime.lan.address });
  const windows = [];
  try {
    for (const role of process.argv.includes('--flight-only') ? ['pilot'] : ['pilot', 'teacher', 'assistant', 'supervisor', 'admin']) {
      const win = new BrowserWindow({ show: false, width: 390, height: 844, webPreferences: { partition: `regression-${role}-${Date.now()}`, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
      windows.push(win);
      const wc = win.webContents;
      const errors = [];
      const tiles = [];
      wc.session.webRequest.onBeforeRequest((details, callback) => {
        callback(/tile\.openstreetmap\.org|ibasemaps-api\.arcgis\.com/.test(details.url) ? { redirectURL: `${tileOrigin}/tile.png` } : {});
      });
      wc.on('console-message', event => {
        if (event.level === 'error') { errors.push(event.message); console.error('Renderer:', event.message.replace(/https?:\/\/\S+/g, '[URL]').slice(0, 900)); }
      });
      wc.session.webRequest.onCompleted(details => {
        if (details.url.startsWith(tileOrigin) && details.statusCode === 200) tiles.push(details.url);
      });
      const response = await fetch(runtime.baseURL + '/api/review-lab/mobile-link', {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-flyhigh-review-token': runtime.token }, body: JSON.stringify({ role }),
      });
      assert.equal(response.status, 200);
      const link = gateway.mobileBaseURL + (await response.json()).path;
      await wc.loadURL('data:text/html,<html><body></body></html>');
      const qr = await wc.executeJavaScript(`new Promise(resolve => { const image = new Image(); image.onload = () => resolve({width:image.naturalWidth,height:image.naturalHeight}); image.onerror=()=>resolve(null); image.src=${JSON.stringify(qrDataURL(link))}; document.body.append(image); })`);
      assert.deepEqual(qr, { width: 272, height: 272 });
      await wc.loadURL(link);
      const destination = role === 'admin' ? '/admin/cronograma' : role === 'supervisor' ? '/supervisor/dashboard' : '/staff/dashboard';
      await until(async () => {
        assert.equal(new URL(wc.getURL()).origin, gateway.publicOrigin, 'redirect must stay on LAN');
        const body = await wc.executeJavaScript('document.body.innerText');
        if (body.includes('No pudimos abrir la sesión')) throw new Error(`${role}: ${body}`);
        return new URL(wc.getURL()).pathname === destination && !body.trim().startsWith('Cargando') && body.length > 100;
      }, role + ' sign in');
      console.log(`PASS ${role}: QR decoded as image, LAN redirects, authenticated dashboard`);
      if (role === 'pilot') {
        await until(() => wc.executeJavaScript(`Array.from(document.querySelectorAll('a')).some(a=>a.textContent.includes('Preparar visita'))`), 'pilot preparation link');
        const href = await wc.executeJavaScript(`Array.from(document.querySelectorAll('a')).find(a=>a.textContent.includes('Preparar visita'))?.getAttribute('href')`);
        assert.ok(href, 'pilot preparation link exists');
        const rehearsal = href + '/simulacion';
        await wc.loadURL(gateway.publicOrigin + rehearsal);
        await until(() => wc.executeJavaScript(`Boolean(document.querySelector('.maplibregl-marker'))`), '3D map loads with markers');
        await until(() => tiles.length > 0, 'basemap image tiles received');
        const layout = await wc.executeJavaScript(`(() => {
          const map = document.querySelector('[aria-label="Mapa del ensayo de vuelo"]');
          const r = map.getBoundingClientRect();
          const canvas = map.querySelector('canvas').getBoundingClientRect();
          return {position:getComputedStyle(map).position,width:r.width,height:r.height,canvasWidth:canvas.width,canvasHeight:canvas.height};
        })()`);
        console.log('Map layout:', layout);
        assert.ok(layout.width > 300 && layout.height > 500, 'map must occupy the phone screen, not a zero-height clipped container');
        assert.equal(layout.position, 'absolute');
        assert.ok(Math.abs(layout.canvasHeight - layout.height) < 2 && Math.abs(layout.canvasWidth - layout.width) < 2, 'canvas must match visible map bounds');
        await wc.executeJavaScript(`window.__flightCanvas = document.querySelector('.maplibregl-canvas'); window.__metadataRefreshes=0; const originalFetch=window.fetch; window.fetch=async (...args)=>{ const r=await originalFetch(...args); if(String(args[0]).includes('metadata=1') && r.ok) window.__metadataRefreshes++; return r; }; true;`);
        const workerErrors = errors.filter(message => /worker failed|worker.*error|No se pudo iniciar/i.test(message));
        assert.deepEqual(workerErrors, []);
        assert.equal(await wc.executeJavaScript(`document.querySelectorAll('[role="application"]').length`), 2);
        const altitude = () => wc.executeJavaScript(`Array.from(document.querySelectorAll('p')).find(p=>p.textContent==='ALTURA').nextElementSibling.textContent`);
        const markerTransforms = () => wc.executeJavaScript(`Array.from(document.querySelectorAll('.maplibregl-marker')).map(e=>e.style.transform).join('|')`);
        const before = await altitude();
        const transformsBefore = await markerTransforms();
        const pad = await wc.executeJavaScript(`(() => { const r=document.querySelector('[aria-label="Altura · giro"]').getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`);
        wc.sendInputEvent({ type: 'mouseDown', ...pad, button: 'left', clickCount: 1 });
        await delay(300);
        assert.equal(await altitude(), before, 'touching a joystick only establishes its neutral center');
        wc.sendInputEvent({ type: 'mouseMove', x: pad.x, y: pad.y - 35 });
        await delay(800);
        wc.sendInputEvent({ type: 'mouseUp', ...pad, button: 'left', clickCount: 1 });
        await delay(250);
        assert.notEqual(await altitude(), before, 'joystick changes flight altitude');
        assert.notEqual(await markerTransforms(), transformsBefore, 'altitude changes actual projected POIs, not only the HUD number');
        const high = parseFloat(await altitude());
        const lowerPad = await wc.executeJavaScript(`(() => { const r=document.querySelector('[aria-label="Altura · giro"]').getBoundingClientRect(); return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`);
        wc.sendInputEvent({ type: 'mouseMove', ...lowerPad });
        wc.sendInputEvent({ type: 'mouseDown', ...lowerPad, button: 'left', clickCount: 1 });
        wc.sendInputEvent({ type: 'mouseMove', x: lowerPad.x, y: lowerPad.y + 35 });
        await delay(1200);
        wc.sendInputEvent({ type: 'mouseUp', ...lowerPad, button: 'left', clickCount: 1 });
        await delay(250);
        console.log('Altitude:', { before, high, descended: await altitude() });
        assert.ok(parseFloat(await altitude()) < high, 'right joystick descends');
        await wc.executeJavaScript(`document.querySelector('[aria-label="Regresar a la escuela"]').click()`);
        await until(async () => (await altitude()) === before, 'reset flight');
        await until(() => wc.executeJavaScript('window.__metadataRefreshes >= 4'), 'four periodic school metadata refreshes');
        assert.equal(await wc.executeJavaScript('window.__flightCanvas === document.querySelector(".maplibregl-canvas")'), true, 'metadata polling must never recreate the map canvas');
        console.log('PASS stability: same canvas survived four metadata refreshes; climb and descent move the camera');
        await wc.executeJavaScript(`document.querySelector('[aria-label="Pantalla completa horizontal"]').click()`, true);
        await until(() => wc.executeJavaScript('Boolean(document.fullscreenElement)'), 'fullscreen user gesture');
        await until(() => wc.executeJavaScript(`document.querySelector('[aria-label="Salir de pantalla completa"]') !== null`), 'fullscreen button state');
        await wc.executeJavaScript(`document.querySelector('[aria-label="Salir de pantalla completa"]').click()`, true);
        await until(() => wc.executeJavaScript('!document.fullscreenElement'), 'exit fullscreen');
        win.setContentSize(844, 390);
        await delay(500);
        const horizontal = await wc.executeJavaScript(`(() => { const r=document.querySelector('main').getBoundingClientRect(); return {w:r.width,h:r.height,viewport:innerHeight,controls:[...document.querySelectorAll('[role="application"]')].map(el=>{const r=el.getBoundingClientRect();return {bottom:r.bottom,right:r.right}})}; })()`);
        assert.ok(horizontal.w > horizontal.h && Math.abs(horizontal.h-horizontal.viewport) < 2, 'landscape fills the viewport without vertical overflow');
        assert.ok(horizontal.controls.every(r=>r.bottom <= horizontal.h && r.right <= horizontal.w), 'both joysticks fit in landscape');
        assert.equal(await wc.executeJavaScript('window.__flightCanvas === document.querySelector(".maplibregl-canvas")'), true, 'fullscreen and rotation must keep the same map');
        console.log('PASS fullscreen: enter, exit, landscape layout and preserved map');
        await verifyFlightInteractions(wc, until);
        assert.deepEqual(errors.filter(message => /worker failed|worker.*error|No se pudo iniciar/i.test(message)), []);
        console.log('PASS rehearsal: native worker, fixture tiles, markers, joystick movement and reset');
      }
    }
    console.log('PASS all mobile regression checks');
  } finally {
    for (const win of windows) win.destroy();
    gateway.close();
    fixtureServer.close();
  }
}).then(() => app.exit(0)).catch(error => { console.error(error); app.exit(1); });
