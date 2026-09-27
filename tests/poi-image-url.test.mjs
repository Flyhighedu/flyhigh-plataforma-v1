import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poiImageUrlForBrowser } from '../src/lib/poi-image-url.mjs';

test('local review images use the backend address exposed to the current browser', () => {
    const saved = 'http://127.0.0.1:54321/storage/v1/object/public/poi-images/official/place.jpg';
    assert.equal(poiImageUrlForBrowser(saved, 'http://192.168.1.50:3101/review-backend/token'),
        'http://192.168.1.50:3101/review-backend/token/storage/v1/object/public/poi-images/official/place.jpg');
    assert.equal(poiImageUrlForBrowser(saved, 'http://127.0.0.1:54321'), saved);
});

test('external images and empty image fields retain their original behavior', () => {
    const remote = 'https://upload.wikimedia.org/example.jpg';
    assert.equal(poiImageUrlForBrowser(remote, 'http://127.0.0.1:54321'), remote);
    assert.equal(poiImageUrlForBrowser(null, 'http://127.0.0.1:54321'), null);
    assert.equal(poiImageUrlForBrowser('http://127.0.0.1:54321/storage/v1/object/public/poi-audio/test.jpg', 'http://example.com'),
        'http://127.0.0.1:54321/storage/v1/object/public/poi-audio/test.jpg');
});
