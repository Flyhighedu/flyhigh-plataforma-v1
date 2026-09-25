// The write/read phases use a synthetic local server. The local phase uses the
// isolated FlyHigh stack and test accounts after review:setup has completed.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { ROLES } = require('./core.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function verify({ phase, attach, panes, act, addNote, win, dataDir }) {
  if (phase === 'local' || phase === 'viewport') {
    win.show();
    const { config } = require('./server.cjs').configuration();
    await attach(config);
    const result = { ok: true, phase, roles: {}, at: new Date().toISOString() };
    for (const role of ROLES) {
      const contents = panes.get(role.id).view.webContents;
      const browserMessages = [];
      contents.on('console-message', (_event, ...details) => {
        const message = details.map(item => typeof item === 'object' ? item.message : String(item)).join(' ');
        if (browserMessages.length < 30) browserMessages.push(String(message).slice(0, 400));
      });
      await act(role.id, 'signin');
      const expected = role.id === 'supervisor' ? '/supervisor/dashboard' : '/staff/dashboard';
      let pathname;
      for (let attempt = 0; attempt < 180; attempt++) {
        await delay(500);
        pathname = new URL(contents.getURL()).pathname;
        if (pathname === expected) break;
      }
      if (pathname !== expected) {
        result.roles[role.id] = {
          pathname,
          visibleText: await contents.executeJavaScript('document.body.innerText.slice(0, 1500)'),
          emailFilled: await contents.executeJavaScript('Boolean(document.getElementById("staff-email")?.value)'),
          passwordFilled: await contents.executeJavaScript('Boolean(document.getElementById("staff-password")?.value)'),
          browserMessages,
        };
        fs.writeFileSync(path.join(dataDir, 'verification-local.json'), JSON.stringify(result, null, 2));
      }
      assert.equal(pathname, expected, `${role.name}: no llegó al tablero; pantalla: ${pathname}`);
      if (phase === 'viewport' && role.id !== 'supervisor') {
        await contents.loadURL(config.baseURL + '/staff/hub');
      }
      let visibleText = '';
      for (let attempt = 0; attempt < 120; attempt++) {
        visibleText = await contents.executeJavaScript('document.body.innerText.slice(0, 1200)');
        if (visibleText.trim() && !visibleText.trim().startsWith('Cargando')) break;
        await delay(500);
      }
      assert.ok(visibleText.trim(), `${role.name}: tablero vacío`);
      assert.ok(!visibleText.trim().startsWith('Cargando'), `${role.name}: tablero no terminó de cargar`);
      assert.doesNotMatch(visibleText, /Application error|Internal Server Error/i, `${role.name}: error al mostrar tablero`);
      await delay(3500);
      if (phase === 'viewport') {
        const metrics = await contents.executeJavaScript('({ width: innerWidth, content: document.documentElement.scrollWidth })');
        assert.ok(Math.abs(metrics.width - 390) <= 2, `${role.name}: ancho lógico ${metrics.width}`);
        assert.ok(metrics.content <= metrics.width + 1, `${role.name}: desbordamiento ${metrics.content}/${metrics.width}`);
      }
      fs.writeFileSync(path.join(dataDir, `verification-${role.id}-real.png`), (await contents.capturePage()).toPNG());
      result.roles[role.id] = { pathname, visibleText: visibleText.slice(0, 500) };
      fs.writeFileSync(path.join(dataDir, 'verification-local.json'), JSON.stringify(result, null, 2));
    }
    return;
  }
  assert.ok(['write', 'read'].includes(phase));
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    res.end('<!doctype html><html lang="es"><title>Verificación local</title><body style="font:16px system-ui;padding:24px"><h1>Sesión de prueba</h1><p>Datos ficticios para verificar aislamiento. No es la aplicación FlyHigh.</p></body></html>');
  });
  server.listen(3199, '127.0.0.1'); await once(server, 'listening');
  try {
    await attach({ baseURL: 'http://127.0.0.1:3199', backendOrigin: 'http://127.0.0.1:3199' });
    for (const pane of panes.values()) {
      for (let i = 0; i < 100 && pane.view.webContents.isLoading(); i++) await delay(50);
      assert.equal(pane.view.webContents.isLoading(), false);
    }
    for (const role of ROLES) {
      const pane = panes.get(role.id), contents = pane.view.webContents;
      assert.equal(await contents.executeJavaScript('typeof require'), 'undefined');
      assert.equal(await contents.executeJavaScript('typeof window.review'), 'undefined');
      if (phase === 'write') {
        await contents.executeJavaScript('localStorage.setItem("verification-profile",' + JSON.stringify(role.id) + ')');
        await pane.ses.cookies.set({ url: 'http://127.0.0.1:3199', name: 'verification-profile', value: role.id, expirationDate: Date.now() / 1000 + 3600 });
      }
      assert.equal(await contents.executeJavaScript('localStorage.getItem("verification-profile")'), role.id);
      assert.equal((await pane.ses.cookies.get({ name: 'verification-profile' }))[0]?.value, role.id);
      pane.ses.flushStorageData(); await pane.ses.cookies.flushStore();
    }
    const pilot = panes.get('pilot').view.webContents;
    await win.webContents.executeJavaScript(`document.querySelectorAll('.panel[data-view="wide"] [data-action="view"]').forEach(button => button.click())`);
    const dimensions = await win.webContents.executeJavaScript(`[...document.querySelectorAll('.panel')].map(panel => {
      const viewport = panel.querySelector('.viewport').getBoundingClientRect();
      return { role: panel.dataset.role, mode: panel.dataset.view, width: viewport.width, height: viewport.height };
    })`);
    for (const item of dimensions) {
      assert.equal(item.mode, 'phone');
      assert.ok(item.width >= 250 && item.width <= 350, `${item.role}: ancho celular ${item.width}`);
      assert.ok(Math.abs(item.height / item.width - 19.5 / 9) < 0.03, `${item.role}: proporción ${item.width}×${item.height}`);
    }
    await win.webContents.executeJavaScript('if (!document.body.classList.contains("fill-mode")) document.getElementById("fill").click()');
    await delay(100);
    const fitted = await win.webContents.executeJavaScript(`[...document.querySelectorAll('.panel')].map(panel => {
      const rect = panel.querySelector('.viewport').getBoundingClientRect();
      return { width: rect.width, height: rect.height, bottom: rect.bottom, windowHeight: innerHeight, panelBottom: panel.getBoundingClientRect().bottom, panelTop: panel.getBoundingClientRect().top, mode: document.body.className };
    })`);
    fs.writeFileSync(path.join(dataDir, 'verification-fill-dimensions.json'), JSON.stringify(fitted, null, 2));
    for (const item of fitted) {
      assert.ok(Math.abs(item.height / item.width - 19.5 / 9) < 0.03);
      assert.ok(item.bottom <= item.windowHeight + 1, `pantalla fuera de ventana: ${item.bottom} de ${item.windowHeight}`);
    }
    await win.webContents.executeJavaScript('if (!document.body.classList.contains("dark")) document.getElementById("theme").click()');
    assert.equal(await win.webContents.executeJavaScript('document.body.classList.contains("dark")'), true);
    await win.webContents.executeJavaScript('document.getElementById("theme").click()');
    await win.webContents.executeJavaScript('document.getElementById("fill").click()');
    await act('pilot', 'offline');
    assert.equal(await pilot.executeJavaScript('navigator.onLine'), false);
    assert.equal(await pilot.executeJavaScript('fetch("/probe").then(()=>false,()=>true)'), true);
    assert.equal(await panes.get('teacher').view.webContents.executeJavaScript('fetch("/probe").then(r=>r.ok)'), true);
    await act('pilot', 'offline');
    assert.equal(await pilot.executeJavaScript('navigator.onLine'), true);
    assert.equal(await pilot.executeJavaScript('fetch("/probe").then(r=>r.ok)'), true);
    // No external request should reach the network.
    assert.equal(await pilot.executeJavaScript('fetch("https://sbzwffqhzmlxtnjyjduk.supabase.co/rest/v1/").then(()=>false,()=>true)'), true);
    await act('pilot', 'reload');
    for (let i = 0; i < 100 && pilot.isLoading(); i++) await delay(50);
    assert.equal(await pilot.executeJavaScript('localStorage.getItem("verification-profile")'), 'pilot');
    assert.equal(await win.webContents.executeJavaScript('document.querySelector("[data-role=pilot]").dataset.view'), 'phone');
    await win.webContents.executeJavaScript('document.querySelector("[data-role=pilot] [data-action=view]").click()');
    await delay(100);
    assert.equal(await win.webContents.executeJavaScript('document.querySelector("[data-role=pilot]").dataset.view'), 'wide');
    const wide = await win.webContents.executeJavaScript(`(() => {
      const rect = document.querySelector('[data-role=pilot] .viewport').getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })()`);
    assert.ok(Math.abs(wide.width / wide.height - 16 / 9) < 0.03, `vista amplia: ${wide.width}×${wide.height}`);
    await win.webContents.executeJavaScript('document.querySelector("[data-role=pilot] [data-action=view]").click()');
    await delay(100);
    assert.equal(await win.webContents.executeJavaScript('document.querySelector("[data-role=pilot]").dataset.view'), 'phone');
    if (phase === 'write') fs.writeFileSync(path.join(dataDir, 'verification-layout.png'), await win.capturePage().then(image => image.toPNG()));
    await win.webContents.executeJavaScript('document.querySelector("[data-role=pilot] [data-action=focus]").click()');
    await delay(100);
    assert.equal(await win.webContents.executeJavaScript('document.querySelectorAll(".panel.hidden").length'), 3);
    await win.webContents.executeJavaScript('document.getElementById("grid").click()');
    await delay(100);
    assert.equal(await win.webContents.executeJavaScript('document.querySelectorAll(".panel.hidden").length'), 0);
    await win.webContents.executeJavaScript('document.querySelector("[data-role=pilot] [data-action=note]").click()');
    await delay(100);
    assert.equal(await win.webContents.executeJavaScript('document.getElementById("note-dialog").open'), true);
    assert.equal(panes.get('pilot').view.getVisible(), false);
    await win.webContents.executeJavaScript('document.getElementById("cancel-note").click()');
    await delay(100);
    addNote({ role: 'pilot', title: 'Verificación automática del laboratorio', expected: 'Sesiones separadas', observed: 'Cuatro sesiones conservadas; datos ficticios.' });
    fs.writeFileSync(path.join(dataDir, 'verification-' + phase + '.json'), JSON.stringify({ ok: true, phase, checks: ['four partitions', 'persistent cookies', 'persistent localStorage', 'no Node or IPC in app pages', 'offline one role', 'other roles stay online', 'production requests blocked', 'reload keeps session', 'phone/wide controls', 'focus/grid', 'note dialog above views', 'local report'], at: new Date().toISOString() }, null, 2));
  } finally { server.closeAllConnections(); server.close(); }
}
module.exports = { verify };
