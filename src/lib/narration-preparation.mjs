export const MAX_SEQUENCE_ITEMS = 40;

export function coordinates(lat, lng) {
    if (lat == null || lng == null || lat === '' || lng === '') return null;
    const pair = [Number(lat), Number(lng)];
    return pair.every(Number.isFinite) && Math.abs(pair[0]) <= 90 && Math.abs(pair[1]) <= 180 ? pair : null;
}

export function distanceKm(a, b) {
    if (!a || !b) return null;
    const rad = n => n * Math.PI / 180;
    const h = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function durationLabel(seconds) {
    if (!Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return 'Duración por confirmar';
    const value = Math.round(Number(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function snapshot(poi) {
    return {
        id: String(poi.id), name: poi.name,
        audio_url: poi.audio_url || null,
        narrative_script: poi.narrative_script || null,
        audio_duration_seconds: poi.audio_duration_seconds || null,
        audio_generated_at: poi.audio_generated_at || null,
    };
}

export function fingerprint(item) {
    return JSON.stringify([item.id, item.name, item.audio_url || null, item.narrative_script || null, item.audio_generated_at || null]);
}

export function usableAudio(url) {
    try { return ['https:', 'http:'].includes(new URL(url).protocol); } catch { return false; }
}

export function sequenceChanged(items, catalog) {
    const byId = new Map(catalog.map(p => [String(p.id), p]));
    return items.some(item => !byId.has(item.id) || fingerprint(item) !== fingerprint(snapshot(byId.get(item.id))));
}

export function buildSequence(ids, catalog, status) {
    if (!Array.isArray(ids) || ids.length > MAX_SEQUENCE_ITEMS || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
        throw new Error('La secuencia debe contener narraciones únicas (máximo 40).');
    }
    if (!['draft', 'ready'].includes(status)) throw new Error('Estado de preparación inválido.');
    const byId = new Map(catalog.map(p => [String(p.id), p]));
    const items = ids.map(id => {
        if (!byId.has(id)) throw new Error('Una narración ya no está disponible. Actualiza la biblioteca.');
        return snapshot(byId.get(id));
    });
    if (status === 'ready' && (!items.length || items.some(p => !usableAudio(p.audio_url)))) {
        throw new Error('Selecciona al menos una narración y comprueba que todas tengan audio.');
    }
    return items;
}

export function moveItem(items, index, direction) {
    const destination = index + direction;
    if (index < 0 || index >= items.length || destination < 0 || destination >= items.length) return items;
    const result = [...items];
    [result[index], result[destination]] = [result[destination], result[index]];
    return result;
}

export function visitLabel(date) {
    if (!date) return 'Fecha por confirmar';
    return new Date(`${date}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}
