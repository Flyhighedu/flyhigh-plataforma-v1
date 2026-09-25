// Shared by the login route and Edge middleware. Never use a default secret.
async function getSigningKey() {
    const secret = process.env.ADMIN_AUTH_SECRET;
    if (!secret) return null;
    return crypto.subtle.importKey(
        'raw', new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
    );
}

export async function signAdminToken(payload) {
    const key = await getSigningKey();
    if (!key) throw new Error('Admin authentication is not configured');
    const data = JSON.stringify(payload);
    const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    const signature = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    return btoa(JSON.stringify({ data, signature }));
}

export async function verifyAdminToken(token) {
    if (!token) return null;
    try {
        const key = await getSigningKey();
        if (!key) return null;
        const { data, signature } = JSON.parse(atob(token));
        if (typeof data !== 'string' || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return null;
        const bytes = Uint8Array.from(signature.match(/../g), byte => parseInt(byte, 16));
        if (!await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(data))) return null;
        const payload = JSON.parse(data);
        if (payload.role !== 'admin' || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}
