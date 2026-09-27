import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocal3dReview, google3dTarget, signTileResource, verifyTileResource, rewriteTileset } from '../src/lib/google-3d-proxy.mjs';

const env = { NODE_ENV: 'development', FLYHIGH_REVIEW_LAB: '1', FLYHIGH_REVIEW_ENVIRONMENT: 'isolated-test', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' };
test('Google preview requires isolated development and a local database', () => {
    assert.equal(isLocal3dReview(env), true);
    for (const patch of [{ NODE_ENV: 'production' }, { FLYHIGH_REVIEW_LAB: '0' }, { FLYHIGH_REVIEW_ENVIRONMENT: '' }, { NEXT_PUBLIC_SUPABASE_URL: 'https://production.supabase.co' }, { NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321/remote' }]) assert.equal(isLocal3dReview({ ...env, ...patch }), false);
    assert.equal(isLocal3dReview({ ...env, NEXT_PUBLIC_SUPABASE_URL: 'http://192.168.1.20:50000/supabase', FLYHIGH_REVIEW_BACKEND_ORIGIN: 'http://127.0.0.1:54321' }), true);
});
test('only Google 3D resources are permitted; credential never enters a signed path', () => {
    const target = google3dTarget('/v1/3dtiles/datasets/CgIYAQ/files/abc.glb?session=abc&key=secret');
    assert.equal(target.search, '?session=abc');
    for (const invalid of ['https://attacker.invalid/v1/3dtiles/root.json', '//localhost/v1/3dtiles/root.json', '/v1/other/root.json', '/v1/3dtiles/../../root.json', '/v1/3dtiles/root.json?url=https://example.com', '/v1/3dtiles/root.json#x', 'https://user@tile.googleapis.com/v1/3dtiles/root.json', '/v1/3dtiles/%2e%2e/root.json']) assert.throws(() => google3dTarget(invalid));
});
test('resource capabilities expire and are bound to the user and signature', () => {
    const token = signTileResource('/v1/3dtiles/root.json?key=secret', 'pilot', 'signing-secret', 2000);
    assert.equal(verifyTileResource(token, 'pilot', 'signing-secret', 1000).url.href, 'https://tile.googleapis.com/v1/3dtiles/root.json');
    assert.throws(() => verifyTileResource(token, 'teacher', 'signing-secret', 1000));
    assert.throws(() => verifyTileResource(token, 'pilot', 'another-secret', 1000));
    assert.throws(() => verifyTileResource(token, 'pilot', 'signing-secret', 2000));
    assert.throws(() => verifyTileResource('e30.' + token.split('.')[1], 'pilot', 'signing-secret', 1000));
    assert.throws(() => verifyTileResource(token + '.extra', 'pilot', 'signing-secret', 1000));
});
test('nested tilesets keep Google session and attribution without leaking the API key', () => {
    const source = { asset: { copyright: 'Google Maps · provider' }, root: { children: [{ content: { uri: 'files/abc.glb' } }, { content: { url: '/v1/3dtiles/more.json?key=never-expose&session=child' } }] } };
    const result = rewriteTileset(source, 'https://tile.googleapis.com/v1/3dtiles/root.json?key=never-expose&session=parent', 'pilot', 'secret', 2000);
    assert.equal(result.asset.copyright, source.asset.copyright);
    assert.equal(JSON.stringify(result).includes('never-expose'), false);
    const tokens = result.root.children.map(child => new URL(child.content.uri || child.content.url, 'http://localhost').searchParams.get('resource'));
    assert.equal(verifyTileResource(tokens[0], 'pilot', 'secret', 1000).url.search, '?session=parent');
    assert.equal(verifyTileResource(tokens[1], 'pilot', 'secret', 1000).url.search, '?session=child');
    assert.equal(source.root.children[0].content.uri, 'files/abc.glb', 'input remains untouched');
});
