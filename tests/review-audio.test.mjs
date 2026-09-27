import test from 'node:test';
import assert from 'node:assert/strict';
import { localReviewAudioPath } from '../src/lib/review-audio.mjs';
test('audio forwarding permits only local public storage and never arbitrary URLs', () => {
    assert.equal(localReviewAudioPath('http://127.0.0.1:54321/storage/v1/object/public/poi-audio/official/a.wav'), '/storage/v1/object/public/poi-audio/official/a.wav');
    for (const url of ['http://evil.test/storage/v1/object/public/a', 'http://localhost:54321/auth/v1/user', 'http://localhost:3100/storage/v1/object/public/a', 'http://localhost:54321/storage/v1/object/public/../../auth', 'http://user:pass@localhost:54321/storage/v1/object/public/a', 'http://localhost:54321/storage/v1/object/public/a?redirect=http://evil.test']) assert.equal(localReviewAudioPath(url), null);
});
