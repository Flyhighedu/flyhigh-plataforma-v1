import test from 'node:test';
import assert from 'node:assert/strict';
import { signAdminToken, verifyAdminToken } from '../src/lib/adminAuth.js';

test('admin tokens reject missing configuration, forgery, expiry and non-admin roles', async () => {
    const original = process.env.ADMIN_AUTH_SECRET;
    try {
        delete process.env.ADMIN_AUTH_SECRET;
        assert.equal(await verifyAdminToken('anything'), null);
        await assert.rejects(signAdminToken({ role: 'admin' }));
        process.env.ADMIN_AUTH_SECRET = 'test-only-secret-never-used-in-production';
        const payload = { role: 'admin', exp: Date.now() + 60000 };
        const valid = await signAdminToken(payload);
        assert.deepEqual(await verifyAdminToken(valid), payload);
        const forged = JSON.parse(atob(valid));
        forged.data = JSON.stringify({ ...payload, exp: Date.now() + 86400000 });
        assert.equal(await verifyAdminToken(btoa(JSON.stringify(forged))), null);
        for (const invalid of [{ role: 'admin' }, { role: 'admin', exp: 1 }, { role: 'staff', exp: payload.exp }]) {
            assert.equal(await verifyAdminToken(await signAdminToken(invalid)), null);
        }
        assert.equal(await verifyAdminToken('malformed'), null);
        process.env.ADMIN_AUTH_SECRET = 'different-secret';
        assert.equal(await verifyAdminToken(valid), null);
    } finally {
        if (original === undefined) delete process.env.ADMIN_AUTH_SECRET;
        else process.env.ADMIN_AUTH_SECRET = original;
    }
});
