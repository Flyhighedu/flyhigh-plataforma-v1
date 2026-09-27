const { app, BrowserWindow, WebContentsView, session, ipcMain, dialog, shell } = require('electron');
const { qrDataURL } = require('./qr.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { ROLES, partitionFor, isNavigationAllowed, safePath, reportMarkdown } = require('./core.cjs');
const { createLocationPermissions } = require('./permissions.cjs');
const root = path.resolve(__dirname, '../..');
const dataDir = path.join(root, '.review-lab');
const selfTest = process.argv.find(arg => arg.startsWith('--self-test='))?.split('=')[1];
fs.mkdirSync(dataDir, { recursive: true });
const locationPermissions = createLocationPermissions(path.join(dataDir, selfTest ? 'verification-permissions.json' : 'permissions.json'));
app.setPath('userData', path.join(dataDir, selfTest ? 'verification-profiles' : 'profiles'));
app.setPath('sessionData', app.getPath('userData'));
// Chromium includes the app name in User-Agent. Keep it ASCII so GoTrue can
// persist its audit metadata as valid UTF-8 on Windows.
app.setName('FlyHigh Review Lab');
let win, connected, managedServer, closing = false, modalOpen = false;
const panes = new Map();
const grants = new Map();
let latestBounds = [];
const shellURL = pathToFileURL(path.join(__dirname, 'shell.html')).href;
const noteFile = path.join(dataDir, selfTest ? 'verification-notes.json' : 'findings.json');
function notes() { try { const data = JSON.parse(fs.readFileSync(noteFile, 'utf8')); return Array.isArray(data) ? data : []; } catch { return []; } }
function sendState() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('review:state', {
    connected: !!connected, origin: connected?.baseURL || '', backend: connected?.backendOrigin || '',
    roles: ROLES.map(role => ({ ...role, ...panes.get(role.id)?.status })), notes: notes(),
  });
}
function assertShell(event) {
  if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== shellURL) throw new Error('Acceso no permitido.');
}
async function runtimeConfig() {
  const { config } = require('./server.cjs').configuration();
  let runtime;
  try { runtime = JSON.parse(fs.readFileSync(path.join(dataDir, 'runtime.json'), 'utf8')); } catch { throw new Error('Inicia el servidor de pruebas con npm run review:server.'); }
  if (runtime.baseURL !== config.baseURL || runtime.backendOrigin !== config.backendOrigin || typeof runtime.token !== 'string') throw new Error('La configuración cambió. Reinicia el servidor de pruebas.');
  let response;
  try {
    response = await fetch(config.baseURL + '/api/review-lab/status', { headers: { 'x-flyhigh-review-token': runtime.token }, signal: AbortSignal.timeout(3000), redirect: 'error' });
  } catch { throw new Error('El servidor de pruebas todavía no responde. Espera a que arranque y vuelve a conectar.'); }
  if (!response.ok) throw new Error('El servidor no se identificó como la instancia de pruebas.');
  const identity = await response.json();
  if (identity.environment !== 'isolated-test' || identity.backendOrigin !== config.backendOrigin) throw new Error('El destino del servidor no coincide con el entorno de pruebas.');
  return { ...config, mobileBaseURL: runtime.mobileBaseURL || '', publicBackendURL: runtime.publicBackendURL || config.backendOrigin, lan: runtime.lan || null, token: runtime.token };
}
function layout(bounds = latestBounds) {
  latestBounds = bounds;
  const [width, height] = win.getContentSize();
  const shellZoom = win.webContents.getZoomFactor();
  for (const role of ROLES) {
    const pane = panes.get(role.id); if (!pane) continue;
    const rect = bounds.find(item => item.id === role.id);
    const valid = rect && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(rect[key])) && rect.width > 0 && rect.height > 0;
    pane.view.setVisible(Boolean(valid && !modalOpen));
    if (valid) {
      const x = Math.max(0, Math.min(width, Math.round(rect.x * shellZoom)));
      const y = Math.max(0, Math.min(height, Math.round(rect.y * shellZoom)));
      const paneWidth = Math.max(0, Math.min(width - x, Math.round(rect.width * shellZoom)));
      const paneHeight = Math.max(0, Math.min(height - y, Math.round(rect.height * shellZoom)));
      pane.view.setBounds({ x, y, width: paneWidth, height: paneHeight });
      // Keep a stable phone layout width while scaling its preview to the card.
      // The shell's CSS coordinates are converted to Electron's device-independent pixels.
      const zoom = rect.mode === 'phone' ? Math.max(0.25, paneWidth / 390) : role.id === 'admin' ? Math.min(1, Math.max(0.25, paneWidth / 1280)) : 1;
      if (Math.abs(pane.view.webContents.getZoomFactor() - zoom) > 0.001) pane.view.webContents.setZoomFactor(zoom);
    }
  }
}
function allowedRequest(url, config) {
  try {
    const parsed = new URL(url);
    if (['data:', 'blob:'].includes(parsed.protocol)) return true;
    const normalized = parsed.origin.replace(/^ws/, 'http');
    if ([config.baseURL, config.backendOrigin].includes(normalized)) return true;
    if (config.publicBackendURL && parsed.href.startsWith(config.publicBackendURL.replace(/^http/, parsed.protocol.slice(0, -1)))) return true;
    // Public visual/map assets only. External APIs and other Supabase projects stay blocked.
    return parsed.protocol === 'https:' && ['fonts.googleapis.com', 'fonts.gstatic.com', 'images.unsplash.com', 'ibasemaps-api.arcgis.com', 'tile.openstreetmap.org', 'a.tile.openstreetmap.org', 'b.tile.openstreetmap.org', 'c.tile.openstreetmap.org'].includes(parsed.hostname);
  } catch { return false; }
}
async function mobileLink(roleId) {
  const config = await runtimeConfig();
  if (!config.mobileBaseURL) throw new Error('No se encontró una conexión Wi-Fi o Ethernet privada. Conecta la computadora y el celular a la misma red.');
  const role = ROLES.find(item => item.id === roleId);
  if (!role) throw new Error('Perfil desconocido.');
  const pathname = panes.get(roleId)?.status.pathname || role.route;
  const response = await fetch(config.baseURL + '/api/review-lab/mobile-link', {
    method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json', 'x-flyhigh-review-token': config.token },
    body: JSON.stringify({ role: roleId, pathname }), signal: AbortSignal.timeout(5000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.path !== 'string') throw new Error(result.error || 'No se pudo preparar el acceso móvil.');
  const url = config.mobileBaseURL + result.path;
  return { ok: true, url, qr: qrDataURL(url), role: role.name, network: config.lan?.name || 'red local', expiresInMinutes: 10 };
}
function configureSession(ses, role, config) {
  ses.webRequest.onBeforeRequest((details, callback) => callback({ cancel: panes.get(role.id)?.status.online === false || !allowedRequest(details.url, config) }));
  const approved = permission => ['fullscreen', 'screen-wake-lock'].includes(permission) ||
    (permission === 'geolocation' && locationPermissions.get(config, role.id) === true) || grants.get(role.id)?.has(permission) === true;
  ses.setPermissionCheckHandler((_contents, permission, origin) => origin === config.baseURL && approved(permission));
  ses.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    if (!contents || !isNavigationAllowed(contents.getURL(), config.baseURL) ||
      (details.requestingUrl && !isNavigationAllowed(details.requestingUrl, config.baseURL)) ||
      !['media', 'geolocation', 'fullscreen', 'screen-wake-lock'].includes(permission)) { callback(false); return; }
    if (permission === 'geolocation') {
      const saved = locationPermissions.get(config, role.id);
      if (saved !== undefined) { callback(saved); return; }
    }
    if (approved(permission)) { callback(true); return; }
    const description = permission === 'media' ? 'micrófono o cámara (' + (details.mediaTypes || []).join(', ') + ')' : 'ubicación';
    try {
      const choice = await dialog.showMessageBox(win, { type: 'question', title: role.name, message: role.name + ' solicita ' + description,
        detail: permission === 'geolocation' ? 'Puedes recordar esta decisión para este perfil de la Mesa de revisión.' : 'Permiso solo para esta sesión del laboratorio.',
        ...(permission === 'geolocation' ? { checkboxLabel: 'Recordar en esta computadora', checkboxChecked: true } : {}),
        buttons: ['No permitir', 'Permitir'], defaultId: 0, cancelId: 0 });
      if (permission === 'geolocation' && choice.checkboxChecked) locationPermissions.set(config, role.id, choice.response === 1);
      if (choice.response === 1) { if (!grants.has(role.id)) grants.set(role.id, new Set()); grants.get(role.id).add(permission); }
      callback(choice.response === 1);
    } catch (error) {
      console.error('No se pudo guardar el permiso:', error.message);
      callback(false);
    }
  });
}
async function attach(config) {
  if (connected) return;
  connected = config;
  for (const role of ROLES) {
    const ses = session.fromPartition(partitionFor(role.id, config.baseURL + '|' + config.backendOrigin));
    configureSession(ses, role, config);
    const view = new WebContentsView({ webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: false } });
    view.setBackgroundColor('#ffffff');
    const status = { pathname: role.route, online: true, loading: true, problem: '' };
    panes.set(role.id, { view, ses, status }); win.contentView.addChildView(view);
    const contents = view.webContents;
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    for (const eventName of ['will-navigate', 'will-redirect']) contents.on(eventName, (event, url) => { if (!isNavigationAllowed(url, config.baseURL)) event.preventDefault(); });
    contents.on('did-navigate', (_event, url) => { status.pathname = safePath(url); sendState(); });
    contents.on('did-navigate-in-page', (_event, url, main) => { if (main) { status.pathname = safePath(url); sendState(); } });
    contents.on('did-start-loading', () => { status.loading = true; sendState(); });
    contents.on('did-stop-loading', () => { status.loading = false; sendState(); });
    contents.on('did-fail-load', (_event, code, _description, _url, main) => { if (main && code !== -3) { status.problem = 'No cargó. Revisa conexión y pulsa Recargar.'; sendState(); } });
    contents.on('render-process-gone', () => { status.problem = 'La pantalla se cerró inesperadamente. Puedes recargarla.'; sendState(); });
    contents.on('unresponsive', () => { status.problem = 'La pantalla no responde.'; sendState(); });
    contents.on('responsive', () => { status.problem = ''; sendState(); });
    contents.on('did-finish-load', () => {
      layout();
      status.problem = '';
      if (!status.online) contents.executeJavaScript("Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); window.dispatchEvent(new Event('offline'));").catch(() => {});
      sendState();
    });
    contents.loadURL(config.baseURL + role.route).catch(() => {});
  }
  layout(); sendState();
}
async function act(roleId, action) {
  const pane = panes.get(roleId); if (!pane) throw new Error('Conecta primero el entorno de pruebas.');
  const contents = pane.view.webContents;
  if (action === 'signin') await signInRole(roleId);
  else if (action === 'reload') contents.reload();
  else if (action === 'reset-permissions') {
    locationPermissions.clear(connected, roleId);
    grants.delete(roleId);
    contents.reload();
  }
  else if (action === 'home') await contents.loadURL(connected.baseURL + ROLES.find(role => role.id === roleId).route);
  else if (action === 'offline') {
    const offline = pane.status.online;
    // Chromium's session throttling alone may leave navigator.onLine unchanged.
    // Override the page's network state too, so the app receives online/offline events.
    if (contents.isDevToolsOpened()) throw new Error('Cierra Inspeccionar antes de cambiar la simulación de red.');
    if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
    await contents.debugger.sendCommand('Network.enable');
    await contents.debugger.sendCommand('Network.overrideNetworkState', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    pane.status.online = !offline;
    if (pane.status.online) {
      pane.ses.disableNetworkEmulation(); contents.debugger.detach();
      await contents.executeJavaScript("delete navigator.onLine; window.dispatchEvent(new Event('online'));", true);
    }
    else {
      pane.ses.enableNetworkEmulation({ offline: true }); await pane.ses.closeAllConnections();
      await contents.executeJavaScript("Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); window.dispatchEvent(new Event('offline'));", true);
    }
    sendState();
  } else if (action === 'inspect') {
    if (!pane.status.online) throw new Error('Restaura la red antes de abrir Inspeccionar.');
    contents.openDevTools({ mode: 'detach' });
  }
  else throw new Error('Acción desconocida.');
}
async function signInRole(roleId) {
  if (connected?.backendOrigin !== 'http://127.0.0.1:54321' && connected?.backendOrigin !== 'http://localhost:54321') {
    throw new Error('El acceso automático solo está permitido con la base local.');
  }
  if (roleId === 'admin') {
    await runtimeConfig();
    const runtime = JSON.parse(fs.readFileSync(path.join(dataDir, 'runtime.json'), 'utf8'));
    const pane = panes.get(roleId);
    const response = await pane.ses.fetch(connected.baseURL + '/api/review-lab/admin-session', {
      method: 'POST', headers: { 'x-flyhigh-review-token': runtime.token }, redirect: 'error',
    });
    if (!response.ok) throw new Error('No se pudo abrir la sesión administrativa local. Reinicia el servidor de pruebas.');
    await pane.view.webContents.loadURL(connected.baseURL + '/admin/cronograma');
    return;
  }
  const accountFile = path.join(dataDir, 'test-accounts.json');
  let account;
  try { account = JSON.parse(fs.readFileSync(accountFile, 'utf8'))[roleId]; }
  catch { throw new Error('Faltan las cuentas locales. Ejecuta npm run review:setup.'); }
  if (!account?.email || !account?.password) throw new Error('Falta la cuenta local de este perfil. Ejecuta npm run review:setup.');
  const contents = panes.get(roleId)?.view.webContents;
  if (!contents) throw new Error('El panel todavía no está conectado.');
  await contents.loadURL(connected.baseURL + '/staff/login');
  if (!contents.getURL().startsWith(connected.baseURL + '/staff/login')) {
    // A saved session may redirect before the form appears. Return that role to
    // its intended home instead of leaving supervision on the staff dashboard.
    await contents.loadURL(connected.baseURL + ROLES.find(role => role.id === roleId).route);
    return;
  }
  const script = `(async () => {
    const form = document.querySelector('form[data-review-ready]');
    for (let attempt = 0; attempt < 200 && form?.dataset.reviewReady !== 'true'; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (form?.dataset.reviewReady !== 'true') throw new Error('El formulario real de acceso no terminó de cargar.');
    const email = document.getElementById('staff-email');
    const password = document.getElementById('staff-password');
    if (!email || !password) throw new Error('No se encontró el formulario real de acceso.');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const [element, value] of [[email, ${JSON.stringify(account.email)}], [password, ${JSON.stringify(account.password)}]]) {
      setter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!email.value || !password.value || !form.checkValidity()) throw new Error('No se pudo completar el formulario de acceso.');
    form.requestSubmit();
    return true;
  })()`;
  await contents.executeJavaScript(script, true);
}
function addNote(input) {
  const role = ROLES.find(item => item.id === input?.role); if (!role) throw new Error('Selecciona un perfil.');
  const record = { role: role.name, pathname: panes.get(role.id)?.status.pathname || role.route, at: new Date().toISOString() };
  for (const key of ['title', 'expected', 'observed']) { if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 6000) throw new Error('Completa título, esperado y observado.'); record[key] = input[key].trim(); }
  const all = [...notes(), record];
  const temp = noteFile + '.tmp'; fs.writeFileSync(temp, JSON.stringify(all, null, 2)); fs.renameSync(temp, noteFile);
  fs.writeFileSync(path.join(dataDir, selfTest ? 'verification-findings.md' : 'HALLAZGOS.md'), reportMarkdown(all));
  sendState();
  return { ok: true };
}
async function createWindow() {
  win = new BrowserWindow({ width: 1500, height: 980, minWidth: 1000, minHeight: 700, show: !selfTest, title: 'FlyHigh · Mesa de revisión', backgroundColor: '#eef2f7', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (url !== shellURL) event.preventDefault(); });
  win.on('resize', () => win.webContents.send('review:resize'));
  win.on('close', event => {
    if (closing) return;
    event.preventDefault(); closing = true;
    Promise.allSettled([...panes.values()].map(async pane => { pane.ses.flushStorageData(); await pane.ses.cookies.flushStore(); pane.view.webContents.close(); })).finally(() => { managedServer?.stop(); win.destroy(); app.quit(); });
  });
  ipcMain.handle('review:request', async (event, command, payload) => {
    assertShell(event);
    try {
      if (command === 'state') { sendState(); return { ok: true }; }
      if (command === 'connect') {
        if (connected) return { ok: true };
        await require('./setup-local.cjs').setup(message => win.webContents.send('review:progress', message));
        win.webContents.send('review:progress', 'Sincronizando narraciones oficiales…');
        try {
          const narrationSync = await require('./import-narrations.cjs').syncNarrations();
          await require('./setup-local.cjs').refreshReviewLocations();
          win.webContents.send('review:progress', `${narrationSync.imported} narraciones oficiales actualizadas.`);
        } catch (error) {
          win.webContents.send('review:progress', `No se pudo actualizar el contenido oficial; se conservará la copia local. ${error.message}`);
        }
        let config;
        try { config = await runtimeConfig(); }
        catch {
          win.webContents.send('review:progress', 'Iniciando FlyHigh con la base local…');
          managedServer = await require('./server.cjs').startServer();
          for (let attempt = 0; attempt < 30; attempt++) {
            try { config = await runtimeConfig(); break; }
            catch { await new Promise(resolve => setTimeout(resolve, 1000)); }
          }
          if (!config) throw new Error('FlyHigh no arrancó. Revisa .review-lab/server.log.');
        }
        await attach(config);
        return { ok: true };
      }
      if (command === 'action') { await act(payload?.role, payload?.action); return { ok: true }; }
      if (command === 'mobile') return await mobileLink(payload?.role);
      if (command === 'note') return addNote(payload);
      if (command === 'modal') { modalOpen = payload === true; layout(); return { ok: true }; }
      if (command === 'report') { await shell.openPath(path.join(root, 'docs/ENTORNO_REVISION.md')); return { ok: true }; }
      if (command === 'findings') { const file = path.join(dataDir, 'HALLAZGOS.md'); if (!fs.existsSync(file)) fs.writeFileSync(file, reportMarkdown([])); await shell.openPath(file); return { ok: true }; }
      throw new Error('Acción desconocida.');
    } catch (error) { return { ok: false, error: error.message }; }
  });
  ipcMain.on('review:bounds', (event, bounds) => { assertShell(event); if (Array.isArray(bounds) && bounds.length <= ROLES.length) layout(bounds); });
  await win.loadFile(path.join(__dirname, 'shell.html'));
  sendState();
  if (selfTest) {
    try { await require('./verify.cjs').verify({ phase: selfTest, attach, panes, act, addNote, win, dataDir }); app.exit(0); }
    catch (error) { fs.writeFileSync(path.join(dataDir, 'verification-error.txt'), error.stack); app.exit(1); }
  }
}
if (!selfTest && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(createWindow).catch(error => { fs.writeFileSync(path.join(dataDir, 'startup-error.txt'), error.stack); app.quit(); });
}
app.on('window-all-closed', () => app.quit());
