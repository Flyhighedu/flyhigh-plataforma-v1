export function isChunkLoadError(error) {
    return error?.name === 'ChunkLoadError' ||
        /Loading (?:CSS )?chunk .+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(error?.message || '');
}

// A reset of React's boundary keeps the failed webpack runtime in memory.
// Reload once per route/tab instead; persist the guard BEFORE navigating so a
// missing deployment asset cannot send the user into an endless reload loop.
export function recoverChunkLoad(error, browser) {
    if (!isChunkLoadError(error) || browser.navigator.onLine === false) return false;
    try {
        const key = `flyhigh:chunk-recovery:${browser.location.pathname}`;
        if (browser.sessionStorage.getItem(key)) return false;
        browser.sessionStorage.setItem(key, '1');
    } catch {
        // Without storage we cannot guarantee the loop guard. Leave manual retry.
        return false;
    }
    browser.location.reload();
    return true;
}
