const AUTH_SECRET = process.env.ADMIN_AUTH_SECRET || 'flyhigh_admin_secret_2026_do_not_share';

// Convert secret string to CryptoKey
async function getCryptoKey(secret) {
    const enc = new TextEncoder();
    return await crypto.subtle.importKey(
        "raw",
        enc.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

// Convert ArrayBuffer to Hex string
function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Verify a signed admin auth token from cookie.
 * Returns the payload if valid, null if invalid/expired.
 */
export async function verifyAdminToken(token) {
    if (!token) return null;
    try {
        const { data, signature } = JSON.parse(atob(token));
        const key = await getCryptoKey(AUTH_SECRET);
        const enc = new TextEncoder();
        const signatureBuffer = await crypto.subtle.sign(
            "HMAC",
            key,
            enc.encode(data)
        );
        const expected = bufferToHex(signatureBuffer);
        
        if (signature !== expected) return null;
        const payload = JSON.parse(data);
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}
