const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { readEnv, validateEnvironment } = require('./core.cjs');

const root = path.resolve(__dirname, '../..');
const backend = path.join(__dirname, 'backend');
const dataDir = path.join(root, '.review-lab');
const cli = path.join(root, 'node_modules/supabase/dist/supabase.js');
const cliEnv = {
  ...process.env,
  SUPABASE_HOME: path.join(root, '.supabase-home'),
  SUPABASE_TELEMETRY_DISABLED: '1',
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: backend, env: cliEnv, windowsHide: true, ...options });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve(stdout) : reject(new Error((stderr || stdout || command + ' terminó con código ' + code).slice(-2000))));
  });
}
async function dockerCommand() {
  const locations = process.platform === 'win32'
    ? [
      'docker',
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker/Docker/resources/bin/docker.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/resources/bin/docker.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs/Docker/Docker/resources/bin/docker.exe'),
    ] : ['docker'];
  for (const location of locations) {
    try { await run(location, ['info', '--format', '{{.ServerVersion}}']); return location; } catch { /* next candidate */ }
  }
  throw new Error('Docker Desktop no está instalado o su motor no está en marcha. La revisión integrada necesita Docker y WSL 2 activos.');
}
function parseStatus(output) {
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  const url = values.API_URL || values.SUPABASE_URL;
  if (url !== 'http://127.0.0.1:54321' && url !== 'http://localhost:54321') {
    throw new Error('La CLI no devolvió el Supabase local esperado en el puerto 54321. Conexión rechazada.');
  }
  if (!values.ANON_KEY || !values.SERVICE_ROLE_KEY) throw new Error('Faltan las claves de la base local.');
  return {
    FLYHIGH_REVIEW_ENVIRONMENT: 'isolated-test',
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
  };
}
async function ensureStack(onProgress = () => {}) {
  const docker = await dockerCommand();
  onProgress('Comprobando la base local…');
  let output;
  try { output = await run(process.execPath, [cli, 'status', '--workdir', backend, '-o', 'env']); }
  catch {
    onProgress('Iniciando Supabase local; la primera descarga puede tardar varios minutos…');
    const network = 'flyhigh-review-local';
    try { await run(docker, ['network', 'inspect', network]); }
    catch { await run(docker, ['network', 'create', '-o', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', network]); }
    await run(process.execPath, [cli, 'start', '--workdir', backend, '--network-id', network, '--yes']);
    output = await run(process.execPath, [cli, 'status', '--workdir', backend, '-o', 'env']);
  }
  const input = parseStatus(output);
  const response = await fetch(input.NEXT_PUBLIC_SUPABASE_URL + '/auth/v1/health', { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Auth local todavía no responde.');
  validateEnvironment(input, readEnv(path.join(root, '.env.local')));
  const file = path.join(root, '.env.review.local');
  const previous = readEnv(file);
  if (previous.NEXT_PUBLIC_ARCGIS_API_KEY) input.NEXT_PUBLIC_ARCGIS_API_KEY = previous.NEXT_PUBLIC_ARCGIS_API_KEY;
  fs.writeFileSync(file, Object.entries(input).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
  return input;
}
const ROLES = [
  { id: 'pilot', email: 'piloto@revision.flyhigh.test', name: 'Piloto de prueba', role: 'pilot' },
  { id: 'teacher', email: 'maestra@revision.flyhigh.test', name: 'Maestra de prueba', role: 'teacher' },
  { id: 'assistant', email: 'auxiliar@revision.flyhigh.test', name: 'Auxiliar de prueba', role: 'assistant' },
  { id: 'supervisor', email: 'supervision@revision.flyhigh.test', name: 'Supervisión de prueba', role: 'supervisor' },
];
function todayMexico() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); }
function must(result, operation) { if (result.error) throw new Error(operation + ': ' + result.error.message); return result.data; }
async function seed(input, onProgress = () => {}) {
  onProgress('Preparando cuatro cuentas y una escuela ficticia…');
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, 'test-accounts.json');
  let accounts;
  try { accounts = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { accounts = {}; }
  for (const role of ROLES) {
    if (!accounts[role.id]) accounts[role.id] = { email: role.email, password: randomBytes(18).toString('base64url') };
  }
  fs.writeFileSync(file, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  const admin = createClient(input.NEXT_PUBLIC_SUPABASE_URL, input.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let pilotId;
  for (const role of ROLES) {
    const account = accounts[role.id];
    let user = (await admin.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true })).data?.user;
    if (!user) {
      const listed = must(await admin.auth.admin.listUsers({ page: 1, perPage: 100 }), 'Buscar usuarios locales');
      user = listed.users.find(item => item.email === account.email);
      if (!user) throw new Error('No se pudo crear el usuario local de ' + role.id + '.');
      must(await admin.auth.admin.updateUserById(user.id, { password: account.password }), 'Actualizar contraseña local');
    }
    if (role.id === 'pilot') pilotId = user.id;
    must(await admin.from('staff_profiles').upsert({ user_id: user.id, full_name: role.name, role: role.role, is_active: true }, { onConflict: 'user_id' }), 'Crear perfil de ' + role.id);
  }
  const cct = 'TEST-LOCAL-0001';
  let school = must(await admin.from('proximas_escuelas').select('id, fecha_programada').eq('cct', cct).maybeSingle(), 'Buscar escuela local');
  if (!school) school = must(await admin.from('proximas_escuelas').insert({
    cct, nombre_escuela: 'ESCUELA FICTICIA · REVISIÓN LOCAL', colonia: 'Laboratorio local',
    fecha_programada: todayMexico(), estatus: 'pendiente', numero_ninos: 24, turno: 'Matutino',
    registrado_via: 'review-lab',
  }).select('id').single(), 'Crear escuela ficticia');
  else if (school.fecha_programada !== todayMexico()) must(await admin.from('proximas_escuelas').update({ fecha_programada: todayMexico(), estatus: 'pendiente' }).eq('id', school.id), 'Reprogramar escuela ficticia');
  let journey = must(await admin.from('staff_journeys').select('id').eq('school_id', school.id).eq('date', todayMexico()).maybeSingle(), 'Buscar jornada local');
  if (!journey) journey = must(await admin.from('staff_journeys').insert({
    date: todayMexico(), school_id: school.id, school_name: 'ESCUELA FICTICIA · REVISIÓN LOCAL',
    status: 'prep', mission_state: 'PILOT_PREP', meta: { review_lab: true }, created_by: pilotId,
  }).select('id').single(), 'Crear jornada ficticia');
  await seedPreparationVisits(admin);
  return { schoolId: school.id, journeyId: journey.id, accountFile: file };
}

async function seedPreparationVisits(admin) {
  // Clearly fictional upcoming visits, only in the validated local database.
  const { data: points } = await admin.from('master_route_pois').select('lat, lng').not('lat', 'is', null).not('lng', 'is', null).limit(1);
  const location = points?.[0];
  for (const [offset, suffix, name] of [[1, '0002', 'ESCUELA FICTICIA · PREPARAR VISITA'], [3, '0003', 'ESCUELA FICTICIA · SIN UBICACIÓN']]) {
    const date = new Date(todayMexico() + 'T12:00:00Z');
    date.setUTCDate(date.getUTCDate() + offset);
    const cct = 'TEST-LOCAL-' + suffix;
    const row = { cct, nombre_escuela: name, colonia: 'Laboratorio local', fecha_programada: date.toISOString().slice(0, 10), estatus: 'pendiente', registrado_via: 'review-lab', turno: 'Matutino',
      ubicacion_lat: offset === 1 && location ? location.lat + 0.002 : null,
      ubicacion_lng: offset === 1 && location ? location.lng + 0.002 : null };
    const existing = must(await admin.from('proximas_escuelas').select('id').eq('cct', cct).maybeSingle(), 'Buscar visita ficticia');
    if (!existing) must(await admin.from('proximas_escuelas').insert(row), 'Crear visita ficticia de preparación');
    else must(await admin.from('proximas_escuelas').update(row).eq('id', existing.id), 'Actualizar visita ficticia de preparación');
  }
}
async function setup(onProgress) {
  const input = await ensureStack(onProgress);
  await require('./migrate-preparations.cjs').migratePreparations(input);
  await require('./migrate-school-locations.cjs').migrateSchoolLocations(input);
  const seeded = await seed(input, onProgress);
  await require('./seed-school-locations.cjs').seedSchoolLocations(input);
  return { backendOrigin: input.NEXT_PUBLIC_SUPABASE_URL, ...seeded };
}
if (require.main === module) {
  setup(message => console.log(message)).then(result => {
    console.log('Base local lista en ' + result.backendOrigin);
    console.log('Cuentas de prueba guardadas en ' + result.accountFile);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { setup, parseStatus, todayMexico, seedPreparationVisits };
