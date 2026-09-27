const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLocationPermissions } = require('./permissions.cjs');

test('location choices survive restart and stay scoped to profile and environment', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flyhigh-permissions-'));
  const file = path.join(dir, 'permissions.json');
  const config = { baseURL: 'http://localhost:3100', backendOrigin: 'http://127.0.0.1:54321' };
  try {
    const permissions = createLocationPermissions(file);
    assert.equal(permissions.get(config, 'pilot'), undefined);
    permissions.set(config, 'pilot', true);
    permissions.set(config, 'admin', false);
    const restarted = createLocationPermissions(file);
    assert.equal(restarted.get(config, 'pilot'), true);
    assert.equal(restarted.get(config, 'admin'), false);
    assert.equal(restarted.get(config, 'teacher'), undefined);
    assert.equal(restarted.get({ ...config, baseURL: 'https://example.com' }, 'pilot'), undefined);
    assert.equal(restarted.get({ ...config, backendOrigin: 'http://localhost:54321' }, 'pilot'), undefined);
    restarted.clear(config, 'pilot');
    assert.equal(createLocationPermissions(file).get(config, 'pilot'), undefined);
    assert.equal(createLocationPermissions(file).get(config, 'admin'), false);
    assert.throws(() => restarted.set(config, 'pilot', 'yes'));
  } finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
});

test('invalid settings cannot silently grant location', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flyhigh-permissions-'));
  const file = path.join(dir, 'permissions.json');
  const config = { baseURL: 'http://localhost:3100', backendOrigin: 'http://127.0.0.1:54321' };
  try {
    for (const value of ['not json', 'null', '[]', JSON.stringify({ [JSON.stringify([config.baseURL, config.backendOrigin, 'pilot'])]: 'true' })]) {
      fs.writeFileSync(file, value);
      assert.equal(createLocationPermissions(file).get(config, 'pilot'), undefined);
    }
  } finally {
    fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
});
