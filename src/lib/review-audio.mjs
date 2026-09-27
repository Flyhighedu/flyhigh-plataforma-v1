export function localReviewAudioPath(value) {
    try {
        const url = new URL(value);
        if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.port !== '54321') return null;
        if (!url.pathname.startsWith('/storage/v1/object/public/') || url.search || url.hash || url.username || url.password) return null;
        return url.pathname;
    } catch { return null; }
}
