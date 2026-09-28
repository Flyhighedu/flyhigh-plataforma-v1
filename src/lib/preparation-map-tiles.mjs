import { createHmac, timingSafeEqual } from 'node:crypto';

const SESSION_PATTERN = /^[A-Za-z0-9_-]{16,512}$/;

export function signTilePermit(session, expires, key) {
    return createHmac('sha256', key).update(`preparation-satellite-v1:${session}:${expires}`).digest('base64url');
}

export function validTilePermit(session, expires, permit, key, now = Date.now()) {
    if (!SESSION_PATTERN.test(session || '') || !/^\d{13}$/.test(String(expires || '')) ||
        !/^[A-Za-z0-9_-]{43}$/.test(permit || '') || Number(expires) <= now) return false;
    const expected = Buffer.from(signTilePermit(session, expires, key));
    const actual = Buffer.from(permit);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function tileCoordinates(z, x, y) {
    if (![z, x, y].every(value => /^(0|[1-9]\d*)$/.test(String(value)))) return null;
    const zoom = Number(z), column = Number(x), row = Number(y);
    const width = 2 ** zoom;
    return zoom <= 19 && column < width && row < width ? { zoom, column, row } : null;
}

export function viewportParameters(params) {
    if (['zoom', 'north', 'south', 'east', 'west'].some(name => !params.has(name) || !params.get(name)?.trim())) return null;
    const zoom = Number(params.get('zoom'));
    const north = Number(params.get('north'));
    const south = Number(params.get('south'));
    const east = Number(params.get('east'));
    const west = Number(params.get('west'));
    if (![zoom, north, south, east, west].every(Number.isFinite) || !Number.isInteger(zoom) ||
        zoom < 0 || zoom > 19 || north <= south || north > 85.05113 || south < -85.05113 ||
        Math.abs(east) > 180 || Math.abs(west) > 180) return null;
    return { zoom, north, south, east, west };
}

// A brief upstream interruption should not make MapLibre abandon its imagery.
// Retry only temporary failures; authentication and invalid requests fail fast.
export async function fetchMapResource(load, signal, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
    for (let attempt = 0; attempt < 3; attempt++) {
        if (signal?.aborted) throw new Error('Map request cancelled');
        let response;
        try { response = await load(); }
        catch (error) {
            if (signal?.aborted || attempt === 2) throw error;
            await wait(300 * 2 ** attempt);
            continue;
        }
        if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) return response;
        await response.body?.cancel();
        await wait(300 * 2 ** attempt);
    }
}
