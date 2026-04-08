import { createHmac } from 'crypto';

const AUTH_SECRET = process.env.ADMIN_AUTH_SECRET || 'flyhigh_admin_secret_2026_do_not_share';

/**
 * Verify a signed admin auth token from cookie.
 * Returns the payload if valid, null if invalid/expired.
 */
export function verifyAdminToken(token) {
    if (!token) return null;
    try {
        const { data, signature } = JSON.parse(Buffer.from(token, 'base64').toString());
        const expected = createHmac('sha256', AUTH_SECRET).update(data).digest('hex');
        if (signature !== expected) return null;
        const payload = JSON.parse(data);
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}
