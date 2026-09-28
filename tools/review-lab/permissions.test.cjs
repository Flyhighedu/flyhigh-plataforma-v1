const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reviewLocationAllowed } = require('./permissions.cjs');

test('local workbench location is approved for every profile and after restart', () => {
  const config = { baseURL: 'http://localhost:3100', backendOrigin: 'http://127.0.0.1:54321' };
  assert.equal(reviewLocationAllowed(config), true);
  assert.equal(reviewLocationAllowed({ ...config, backendOrigin: 'http://localhost:54321' }), true);
  const restarted = require('./permissions.cjs');
  assert.equal(restarted.reviewLocationAllowed(config), true);
});

test('remote or malformed destinations never receive location permission', () => {
  const config = { baseURL: 'http://localhost:3100', backendOrigin: 'http://127.0.0.1:54321' };
  for (const bad of [
    { ...config, baseURL: 'https://example.com' },
    { ...config, backendOrigin: 'https://example.com' },
    { ...config, backendOrigin: 'http://192.168.1.113:54321' },
    { ...config, backendOrigin: 'http://127.0.0.1:54322' },
    { ...config, backendOrigin: 'http://127.0.0.1:54321/other' },
    { ...config, backendOrigin: 'garbage' },
  ]) assert.equal(reviewLocationAllowed(bad), false);
});
