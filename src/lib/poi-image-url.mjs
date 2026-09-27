export function poiImageUrlForBrowser(savedUrl, backendUrl) {
    if (!savedUrl) return null;
    try {
        const image = new URL(savedUrl);
        if (image.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(image.hostname) ||
            image.port !== '54321' || !image.pathname.startsWith('/storage/v1/object/public/poi-images/') ||
            image.search || image.hash || image.username || image.password) return savedUrl;
        const backend = new URL(backendUrl);
        if (!['http:', 'https:'].includes(backend.protocol) || backend.search || backend.hash) return savedUrl;
        return `${backendUrl.replace(/\/$/, '')}${image.pathname}`;
    } catch { return savedUrl; }
}
