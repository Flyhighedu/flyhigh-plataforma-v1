const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROLES, validateEnvironment, cleanEnvironment, partitionFor, isNavigationAllowed, safePath, reportMarkdown } = require('./core.cjs');
const config = { FLYHIGH_REVIEW_ENVIRONMENT: 'isolated-test', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon', SUPABASE_SERVICE_ROLE_KEY: 'test-service' };
test('refuses missing environment, known production, copied secrets and mismatched JWT project', () => {
  assert.throws(() => validateEnvironment({}), /Falta/);
  assert.throws(() => validateEnvironment({ ...config, NEXT_PUBLIC_SUPABASE_URL: 'https://sbzwffqhzmlxtnjyjduk.supabase.co' }), /producción/);
  assert.throws(() => validateEnvironment(config, { NEXT_PUBLIC_SUPABASE_URL: config.NEXT_PUBLIC_SUPABASE_URL }), /producción/);
  assert.throws(() => validateEnvironment(config, { SUPABASE_SERVICE_ROLE_KEY: config.SUPABASE_SERVICE_ROLE_KEY }), /producción/);
  const jwt = 'e30.' + Buffer.from(JSON.stringify({ ref: 'wrong-project' })).toString('base64url') + '.sig';
  assert.throws(() => validateEnvironment({ ...config, SUPABASE_SERVICE_ROLE_KEY: jwt }), /no coincide/);
});
test('accepts only the local backend, rejects ambiguous destinations', () => {
  assert.equal(validateEnvironment(config).baseURL, 'http://localhost:3100');
  assert.equal(validateEnvironment({ ...config, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }).backendOrigin, 'http://127.0.0.1:54321');
  for (const url of ['http://example.com', 'https://test-only.supabase.co', 'http://localhost:54322', 'http://localhost:54321/x', 'http://user:pass@localhost:54321', 'http://localhost:54321/?key=x', 'http://localhost.evil.com:54321']) {
    assert.throws(() => validateEnvironment({ ...config, NEXT_PUBLIC_SUPABASE_URL: url }));
  }
});
test('separates all roles and backend identities and never allows navigation off the app origin', () => {
  assert.equal(new Set(ROLES.map(role => partitionFor(role.id, 'env-a'))).size, 5);
  assert.notEqual(partitionFor('pilot', 'env-a'), partitionFor('pilot', 'env-b'));
  assert.throws(() => partitionFor('unknown', 'env-a'));
  assert.equal(isNavigationAllowed('http://localhost:3100/staff/dashboard', 'http://localhost:3100'), true);
  for (const url of ['http://localhost:3000', 'https://flyhighedu.com.mx', 'file:///C:/secret', 'javascript:alert(1)', 'http://localhost:3100.evil.com']) assert.equal(isNavigationAllowed(url, 'http://localhost:3100'), false);
});
test('Next process cannot inherit integration secrets or backfill them from .env files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flyhigh-review-test-'));
  try {
    fs.writeFileSync(path.join(dir, '.env.local'), 'OPENAI_API_KEY=production-key\nNEXT_PUBLIC_SUPABASE_URL=https://prod.supabase.co\nADMIN_PASSWORD=prod-password\n');
    const env = cleanEnvironment(dir, config, { PATH: 'runtime', SystemRoot: 'Windows', OPENAI_API_KEY: 'inherited-key', NODE_OPTIONS: '--require=evil', ANOTHER_SECRET: 'secret' });
    assert.equal(env.OPENAI_API_KEY, '');
    assert.equal(env.ADMIN_PASSWORD, '');
    assert.equal(env.NODE_OPTIONS, undefined);
    assert.equal(env.ANOTHER_SECRET, undefined);
    assert.equal(env.PATH, 'runtime');
    assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_URL);
    assert.equal(env.FLYHIGH_REVIEW_LAB, '1');
  } finally { for (const name of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, name)); fs.rmdirSync(dir); }
});

test('review environment only forwards the optional public map credential', () => {
  const env = cleanEnvironment(__dirname, { ...config, NEXT_PUBLIC_ARCGIS_API_KEY: 'review-map-key' }, { SECRET_TOKEN: 'do-not-forward' });
  assert.equal(env.NEXT_PUBLIC_ARCGIS_API_KEY, 'review-map-key');
  assert.equal(env.SECRET_TOKEN, undefined);
});
test('notes only expose pathname and remain explicitly unverified', () => {
  assert.equal(safePath('http://localhost:3100/staff?token=secret#private'), '/staff');
  assert.match(reportMarkdown([{ title: 'Prueba', role: 'Piloto', pathname: '/staff', at: 'today', expected: 'a', observed: 'b' }]), /Por revisar/);
});
test('handshake endpoint is disabled in production and requires exact random token', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/app/api/review-lab/status/route.js'), 'utf8');
  const { GET } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const keys = ['NODE_ENV', 'FLYHIGH_REVIEW_TOKEN', 'FLYHIGH_REVIEW_LAB', 'FLYHIGH_REVIEW_ENVIRONMENT', 'NEXT_PUBLIC_SUPABASE_URL'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, { NODE_ENV: 'development', FLYHIGH_REVIEW_TOKEN: 'random-test-token', FLYHIGH_REVIEW_LAB: '1', FLYHIGH_REVIEW_ENVIRONMENT: 'isolated-test', NEXT_PUBLIC_SUPABASE_URL: config.NEXT_PUBLIC_SUPABASE_URL });
    const request = token => new Request('http://localhost:3100/api/review-lab/status', { headers: { 'x-flyhigh-review-token': token } });
    assert.equal((await GET(request('wrong'))).status, 404);
    assert.equal((await GET(request('random-test-tokex'))).status, 404);
    const response = await GET(request('random-test-token'));
    assert.deepEqual(await response.json(), { environment: 'isolated-test', backendOrigin: config.NEXT_PUBLIC_SUPABASE_URL });
    process.env.NODE_ENV = 'production';
    assert.equal((await GET(request('random-test-token'))).status, 404);
  } finally { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } }
});
