const { createHash } = require('node:crypto');
const { parseEnv } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');

const ROLES = Object.freeze([
  { id: 'pilot', name: 'Piloto', route: '/staff/dashboard' },
  { id: 'teacher', name: 'Maestra', route: '/staff/dashboard' },
  { id: 'assistant', name: 'Auxiliar', route: '/staff/dashboard' },
  { id: 'supervisor', name: 'Supervisión general', route: '/supervisor/dashboard' },
  { id: 'admin', name: 'Administración', route: '/admin/cronograma' },
]);
const KNOWN_PRODUCTION_HOST = 'sbzwffqhzmlxtnjyjduk.supabase.co';
function loopback(host) { return ['localhost', '127.0.0.1', '[::1]'].includes(host); }
function privateIPv4(address) {
  const parts = String(address || '').split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
}
function lanAddresses(interfaces) {
  const matches = [];
  for (const [name, entries] of Object.entries(interfaces || {})) {
    for (const entry of entries || []) {
      if (entry.internal || !['IPv4', 4].includes(entry.family) || !privateIPv4(entry.address)) continue;
      const normalized = name.toLowerCase();
      const score = /wi-?fi|wlan|wireless/.test(normalized) ? 4 : /^ethernet/.test(normalized) ? 3 : /vethernet|docker|wsl|virtual|vmware|hyper-v/.test(normalized) ? 0 : 2;
      matches.push({ address: entry.address, name, score });
    }
  }
  return matches.sort((a, b) => b.score - a.score || a.address.localeCompare(b.address));
}
function readEnv(file) { return fs.existsSync(file) ? parseEnv(fs.readFileSync(file, 'utf8')) : {}; }
function validateEnvironment(input, production = {}) {
  if (input.FLYHIGH_REVIEW_ENVIRONMENT !== 'isolated-test') {
    throw new Error('Falta .env.review.local con un entorno exclusivo de pruebas. La configuración habitual no se reutiliza.');
  }
  let backend;
  try { backend = new URL(input.NEXT_PUBLIC_SUPABASE_URL); } catch { throw new Error('Falta la URL de Supabase de pruebas.'); }
  const denied = new Set([KNOWN_PRODUCTION_HOST]);
  try { denied.add(new URL(production.NEXT_PUBLIC_SUPABASE_URL).hostname); } catch { /* no production file */ }
  if (denied.has(backend.hostname)) throw new Error('Ese Supabase coincide con producción. Conexión de pruebas rechazada.');
  if (backend.username || backend.password || backend.search || backend.hash || backend.pathname !== '/') throw new Error('La URL de Supabase debe ser solo su origen.');
  if (!loopback(backend.hostname) || backend.protocol !== 'http:' || backend.port !== '54321') {
    throw new Error('La mesa de revisión solo acepta Supabase local en el puerto 54321.');
  }
  for (const key of ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!input[key]) throw new Error('Faltan claves del proyecto de pruebas en .env.review.local.');
    if (production[key] && input[key] === production[key]) throw new Error('Una clave coincide con producción. Conexión rechazada.');
    if (input[key].split('.').length === 3) {
      let claims;
      try { claims = JSON.parse(Buffer.from(input[key].split('.')[1], 'base64url').toString()); } catch { throw new Error('Una clave JWT no tiene formato válido.'); }
      if (claims.ref && claims.ref !== backend.hostname.split('.')[0]) throw new Error('La referencia de una clave no coincide con el Supabase de pruebas.');
    }
  }
  return { backendOrigin: backend.origin, baseURL: 'http://localhost:3100', label: 'FlyHigh · pruebas aisladas' };
}
function cleanEnvironment(root, input, inherited = process.env) {
  // Only retain OS/runtime essentials. Blank all Next env-file keys so @next/env
  // cannot fill missing variables from the ordinary production-connected .env.local.
  const env = {};
  for (const [key, value] of Object.entries(inherited)) {
    if (/^(path|systemroot|windir|comspec|pathext|temp|tmp|userprofile|appdata|localappdata|programfiles|programfiles\(x86\)|programw6432|homedrive|homepath|processor_architecture|number_of_processors)$/i.test(key)) env[key] = value;
  }
  for (const name of fs.readdirSync(root).filter(name => /^\.env(?:\.|$)/.test(name))) {
    const file = path.join(root, name);
    if (fs.statSync(file).isFile()) for (const key of Object.keys(readEnv(file))) env[key] = '';
  }
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) env[key] = input[key];
  if (input.NEXT_PUBLIC_ARCGIS_API_KEY) env.NEXT_PUBLIC_ARCGIS_API_KEY = input.NEXT_PUBLIC_ARCGIS_API_KEY;
  // Optional, explicit laboratory credential only; never inherit production's.
  if (input.GEMINI_API_KEY) env.GEMINI_API_KEY = input.GEMINI_API_KEY;
  return { ...env, NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', FLYHIGH_REVIEW_LAB: '1', NEXT_PUBLIC_FLYHIGH_REVIEW_LAB: '1', FLYHIGH_REVIEW_ENVIRONMENT: 'isolated-test' };
}
function partitionFor(role, identity) {
  if (!ROLES.some(item => item.id === role)) throw new Error('Perfil desconocido.');
  return 'persist:review-' + createHash('sha256').update(identity).digest('hex').slice(0, 16) + '-' + role;
}
function isNavigationAllowed(raw, origin) {
  try { const url = new URL(raw); return url.origin === origin && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
function safePath(raw) { try { return new URL(raw).pathname; } catch { return '/'; } }
function reportMarkdown(notes) {
  const clean = value => String(value || '').replaceAll('\r', '').slice(0, 6000);
  return '# Revisión de FlyHigh\n\nHallazgos manuales. No son errores confirmados automáticamente.\n\n' + notes.map((note, i) =>
    `## ${i + 1}. ${clean(note.title)}\n\n- Perfil: ${clean(note.role)}\n- Pantalla: ${clean(note.pathname)}\n- Fecha: ${clean(note.at)}\n- Estado: Por revisar\n\nEsperado: ${clean(note.expected)}\n\nObservado: ${clean(note.observed)}\n`
  ).join('\n');
}
module.exports = { ROLES, loopback, privateIPv4, lanAddresses, readEnv, validateEnvironment, cleanEnvironment, partitionFor, isNavigationAllowed, safePath, reportMarkdown };
