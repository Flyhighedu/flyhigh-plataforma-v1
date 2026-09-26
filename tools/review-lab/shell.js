const panelRoot = document.getElementById('panels');
const message = document.getElementById('message');
const noteDialog = document.getElementById('note-dialog');
const mobileDialog = document.getElementById('mobile-dialog');
let state, focusRole = null, noteRole = null;
let workspace = 'operations', compareRole = 'pilot';
const savedTheme = localStorage.getItem('flyhigh-review-theme') === 'dark';
const savedFill = localStorage.getItem('flyhigh-review-fill') === 'true';
document.body.classList.toggle('dark', savedTheme);
document.body.classList.toggle('fill-mode', savedFill);
document.getElementById('theme').textContent = savedTheme ? 'Modo claro' : 'Modo oscuro';
document.getElementById('fill').textContent = savedFill ? 'Vista normal' : 'Ocupar ventana';
const viewModes = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('flyhigh-review-view-modes') || '{}');
    return Object.fromEntries(['pilot', 'teacher', 'assistant', 'supervisor', 'admin'].map(id => [id, saved[id] === 'wide' || (id === 'admin' && saved[id] !== 'phone') ? 'wide' : 'phone']));
  } catch { return { pilot: 'phone', teacher: 'phone', assistant: 'phone', supervisor: 'phone', admin: 'wide' }; }
})();
function tell(text, error = false) { message.textContent = text; message.classList.toggle('error', error); }
async function request(command, payload) { const result = await window.review.request(command, payload); if (!result.ok) tell(result.error, true); return result; }
function measure() {
  window.review.bounds([...document.querySelectorAll('.panel')].map(panel => {
    const viewport = panel.querySelector('.viewport');
    if (document.body.classList.contains('fill-mode') && !panel.classList.contains('hidden')) {
      const availableHeight = Math.max(1, panel.getBoundingClientRect().bottom - viewport.getBoundingClientRect().top - 2);
      const availableWidth = Math.max(1, panel.clientWidth - 2);
      const ratio = panel.dataset.view === 'wide' ? 16 / 9 : 9 / 19.5;
      const width = Math.floor(Math.min(availableWidth, availableHeight * ratio));
      viewport.style.width = width + 'px';
      viewport.style.height = Math.floor(width / ratio) + 'px';
    } else {
      viewport.style.removeProperty('width');
      viewport.style.removeProperty('height');
    }
    const rect = viewport.getBoundingClientRect();
    return { id: panel.dataset.role, mode: panel.dataset.view, x: rect.x, y: rect.y, width: panel.classList.contains('hidden') ? 0 : rect.width, height: rect.height };
  }));
}
function focus(id) {
  focusRole = id === focusRole ? null : id;
  applyWorkspace();
}
function applyWorkspace() {
  panelRoot.dataset.workspace = workspace;
  panelRoot.classList.toggle('focused', !!focusRole);
  document.querySelectorAll('.panel').forEach(panel => {
    const id = panel.dataset.role;
    const visible = focusRole ? id === focusRole : workspace === 'operations' ? id !== 'admin' : workspace === 'admin' ? id === 'admin' : id === 'admin' || id === compareRole;
    panel.classList.toggle('hidden', !visible);
    panel.querySelector('[data-action="focus"]').textContent = focusRole === id ? 'Volver a la vista' : 'Enfocar';
  });
  document.querySelectorAll('[data-workspace]').forEach(button => {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.workspace === workspace));
  });
  document.getElementById('compare-label').hidden = workspace !== 'compare';
  measure();
}
function toggleView(id) {
  const panel = document.querySelector('[data-role="' + id + '"]');
  viewModes[id] = viewModes[id] === 'phone' ? 'wide' : 'phone';
  panel.dataset.view = viewModes[id];
  panel.querySelector('.ratio-label').textContent = viewModes[id] === 'phone' ? '9:19,5' : '16:9';
  panel.querySelector('[data-action="view"]').textContent = viewModes[id] === 'phone' ? 'Vista amplia' : 'Vista celular';
  panelRoot.classList.toggle('all-wide', ['pilot', 'teacher', 'assistant', 'supervisor'].every(id => viewModes[id] === 'wide'));
  localStorage.setItem('flyhigh-review-view-modes', JSON.stringify(viewModes));
  measure();
}
async function openNote(id) {
  noteRole = id;
  const role = state.roles.find(item => item.id === id);
  await request('modal', true);
  document.getElementById('note-context').textContent = role.name + ' · ' + (role.pathname || role.route);
  document.getElementById('note-error').textContent = '';
  noteDialog.showModal();
}
async function openMobile(id) {
  tell('Preparando un acceso temporal para el celular…');
  const result = await request('mobile', { role: id });
  if (!result.ok) return;
  await request('modal', true);
  document.getElementById('mobile-context').textContent = `${result.role} · ${result.network} · expira en ${result.expiresInMinutes} minutos`;
  document.getElementById('mobile-qr').src = result.qr;
  document.getElementById('mobile-url').value = result.url;
  document.getElementById('mobile-copy-status').textContent = '';
  mobileDialog.showModal();
  tell('QR listo. Mantén abierta la Mesa mientras revisas en el celular.');
}
function createPanel(role, index) {
  const panel = document.createElement('article'); panel.className = 'panel'; panel.dataset.role = role.id; panel.dataset.view = viewModes[role.id];
  panel.innerHTML = '<div class="panel-header"><span class="role-badge"></span><h2></h2><span class="ratio-label"></span><span class="pane-state">Sin conectar</span></div><div class="path"></div><div class="controls"></div><div class="viewport"><div class="placeholder"><span class="step"></span><strong></strong><p></p></div></div>';
  panel.querySelector('h2').textContent = role.name;
  panel.querySelector('.role-badge').textContent = role.name[0];
  panel.querySelector('.ratio-label').textContent = viewModes[role.id] === 'phone' ? '9:19,5' : '16:9';
  panel.querySelector('.step').textContent = index + 1;
  panel.querySelector('.path').textContent = role.route;
  panel.querySelector('.placeholder strong').textContent = 'Sesión de ' + role.name.toLowerCase();
  panel.querySelector('.placeholder p').textContent = index === 3 ? 'Aquí verás el panel general mientras los otros tres perfiles trabajan en la misma jornada de pruebas.' : 'Aquí abrirás la aplicación real con su propia cuenta. La sesión se conservará al cerrar esta ventana.';
  const controls = panel.querySelector('.controls');
  const more = document.createElement('details'); more.className = 'more-controls';
  const summary = document.createElement('summary'); summary.textContent = 'Opciones'; more.appendChild(summary);
  const menu = document.createElement('div'); menu.className = 'menu-actions'; more.appendChild(menu);
  more.addEventListener('toggle', () => {
    if (more.open) document.querySelectorAll('.more-controls').forEach(other => { if (other !== more) other.open = false; });
    measure();
  });
  const actions = [['view', viewModes[role.id] === 'phone' ? 'Vista amplia' : 'Vista celular'], ['focus', 'Enfocar'], ['signin', 'Entrar'], ['mobile', 'Abrir en celular'], ['home', 'Inicio'], ['reload', 'Recargar'], ['offline', 'Sin red'], ['note', 'Anotar'], ['inspect', 'Inspeccionar']];
  for (const [action, label] of actions) {
    const button = document.createElement('button'); button.textContent = label; button.dataset.action = action;
    button.addEventListener('click', async () => {
      if (action === 'view') toggleView(role.id);
      else if (action === 'focus') focus(role.id);
      else if (action === 'note') await openNote(role.id);
      else if (action === 'mobile') await openMobile(role.id);
      else await request('action', { role: role.id, action });
      if (more.open) more.open = false;
    }); (['view', 'focus', 'signin'].includes(action) ? controls : menu).appendChild(button);
  }
  controls.appendChild(more);
  panelRoot.appendChild(panel);
}
window.review.onState(next => {
  const first = !state; state = next;
  if (first) state.roles.forEach(createPanel);
  panelRoot.classList.toggle('all-wide', ['pilot', 'teacher', 'assistant', 'supervisor'].every(id => viewModes[id] === 'wide'));
  document.getElementById('connection').textContent = state.connected ? 'Pruebas conectadas' : 'Sin conectar';
  document.getElementById('target').textContent = state.connected ? 'Base local aislada · cinco sesiones' : 'Cinco sesiones independientes · producción bloqueada';
  document.querySelector('.environment').classList.toggle('connected', state.connected);
  document.getElementById('connect').disabled = state.connected;
  document.getElementById('findings').textContent = 'Mis hallazgos (' + state.notes.length + ')';
  for (const role of state.roles) {
    const panel = document.querySelector('[data-role="' + role.id + '"]');
    panel.querySelector('.path').textContent = role.pathname || role.route;
    panel.querySelector('.pane-state').textContent = !state.connected ? 'Sin conectar' : role.problem || (!role.online ? 'Sin red simulada' : role.loading ? 'Cargando…' : 'Disponible');
    panel.querySelector('.placeholder').hidden = state.connected;
    for (const action of ['signin', 'mobile', 'home', 'reload', 'offline', 'inspect']) panel.querySelector('[data-action="' + action + '"]').disabled = !state.connected;
    const offline = panel.querySelector('[data-action="offline"]'); offline.textContent = role.online === false ? 'Restaurar red' : 'Sin red'; offline.classList.toggle('offline', role.online === false);
  }
  applyWorkspace();
});
document.getElementById('connect').addEventListener('click', async () => {
  const button = document.getElementById('connect'); button.disabled = true; tell('Comprobando el destino del servidor…');
  const result = await request('connect');
  if (result.ok) tell('Pruebas conectadas. Pulsa Entrar en cada perfil.');
  else button.disabled = false;
});
document.getElementById('grid').addEventListener('click', () => { workspace = 'operations'; focusRole = null; applyWorkspace(); });
document.querySelectorAll('button[data-workspace]').forEach(button => button.addEventListener('click', () => { workspace = button.dataset.workspace; focusRole = null; applyWorkspace(); }));
document.getElementById('compare-profile').addEventListener('change', event => { compareRole = event.target.value; focusRole = null; applyWorkspace(); });
document.getElementById('theme').addEventListener('click', () => {
  const dark = document.body.classList.toggle('dark');
  localStorage.setItem('flyhigh-review-theme', dark ? 'dark' : 'light');
  document.getElementById('theme').textContent = dark ? 'Modo claro' : 'Modo oscuro';
});
document.getElementById('fill').addEventListener('click', () => {
  if (focusRole) focus(focusRole);
  const filled = document.body.classList.toggle('fill-mode');
  localStorage.setItem('flyhigh-review-fill', String(filled));
  document.getElementById('fill').textContent = filled ? 'Vista normal' : 'Ocupar ventana';
  measure();
});
document.getElementById('guide').addEventListener('click', () => request('report'));
document.getElementById('findings').addEventListener('click', () => request('findings'));
document.getElementById('cancel-note').addEventListener('click', () => noteDialog.close());
noteDialog.addEventListener('close', () => request('modal', false));
document.getElementById('close-mobile').addEventListener('click', () => mobileDialog.close());
mobileDialog.addEventListener('close', () => request('modal', false));
document.getElementById('copy-mobile').addEventListener('click', async () => {
  const status = document.getElementById('mobile-copy-status');
  try { await navigator.clipboard.writeText(document.getElementById('mobile-url').value); status.textContent = 'Enlace copiado'; }
  catch { status.textContent = 'Selecciona y copia el enlace manualmente'; document.getElementById('mobile-url').select(); }
});
document.getElementById('note-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target; const data = Object.fromEntries(new FormData(form));
  const result = await request('note', { ...data, role: noteRole });
  if (result.ok) { form.reset(); noteDialog.close(); tell('Hallazgo guardado. Puedes pedirme que revise el archivo HALLAZGOS.md.'); }
  else document.getElementById('note-error').textContent = result.error;
});
new ResizeObserver(measure).observe(panelRoot);
window.review.onResize(measure);
window.review.onProgress(progress => tell(progress));
window.review.request('state');
