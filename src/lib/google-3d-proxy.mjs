import { createHmac, timingSafeEqual } from 'node:crypto';

export function isLocal3dReview(env) {
    if (env.NODE_ENV !== 'development' || env.FLYHIGH_REVIEW_LAB !== '1' || env.FLYHIGH_REVIEW_ENVIRONMENT !== 'isolated-test') return false;
    try {
        const url = new URL(env.FLYHIGH_REVIEW_BACKEND_ORIGIN || env.NEXT_PUBLIC_SUPABASE_URL);
        return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.protocol === 'http:' && url.port === '54321' && url.pathname === '/' && !url.username && !url.password && !url.search;
    } catch { return false; }
}

export function google3dTarget(uri, base = 'https://tile.googleapis.com/v1/3dtiles/root.json') {
    const url = new URL(uri, base);
    if (url.origin !== 'https://tile.googleapis.com' || url.username || url.password
        || !/^\/v1\/3dtiles\/[A-Za-z0-9_./-]+\.(json|glb|b3dm)$/.test(url.pathname)
        || url.pathname.includes('..') || url.hash) throw new Error('Invalid tile resource');
    url.searchParams.delete('key');
    for (const key of url.searchParams.keys()) if (!['session', 'v'].includes(key)) throw new Error('Invalid tile parameter');
    return url;
}

export function signTileResource(target, userId, secret, expires = Date.now() + 150 * 60 * 1000) {
    const url = google3dTarget(target);
    const payload = Buffer.from(JSON.stringify({ path: url.pathname + url.search, userId, expires })).toString('base64url');
    return payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url');
}

export function verifyTileResource(token, userId, secret, now = Date.now()) {
    if (typeof token !== 'string' || token.length > 12000) throw new Error('Invalid resource');
    const [payload, signature, extra] = token.split('.');
    const expected = createHmac('sha256', secret).update(payload || '').digest();
    const supplied = Buffer.from(signature || '', 'base64url');
    if (extra || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error('Invalid signature');
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.userId !== userId || !Number.isFinite(data.expires) || data.expires <= now) throw new Error('Expired resource');
    return { url: google3dTarget(data.path), expires: data.expires };
}

export function rewriteTileset(value, upstreamUrl, userId, secret, expires) {
    if (Array.isArray(value)) return value.map(item => rewriteTileset(item, upstreamUrl, userId, secret, expires));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
        if (['uri', 'url'].includes(key) && typeof item === 'string' && !item.startsWith('data:')) {
            const target = google3dTarget(item, upstreamUrl);
            // Relative content sometimes inherits the parent's Google session.
            const parent = new URL(upstreamUrl);
            if (!target.searchParams.has('session') && parent.searchParams.has('session')) target.searchParams.set('session', parent.searchParams.get('session'));
            return [key, '/api/review-lab/google-3d?resource=' + signTileResource(target, userId, secret, expires)];
        }
        return [key, rewriteTileset(item, upstreamUrl, userId, secret, expires)];
    }));
}
