// Pure matching rules shared by the audit and local administrative workflow.
// CCT is an identity, not a fuzzy name search. Never strip internal characters.
export const normalizeCct = value => String(value ?? '').trim().toUpperCase();
export const normalizeTurn = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
export function validCoordinates(lat, lng) {
    return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) &&
        Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}
export function sourceLocation(school) {
    if (!validCoordinates(school?.latitud, school?.longitud)) return null;
    // This catalog is Mexican; out-of-country values require manual investigation.
    if (school.latitud < 14 || school.latitud > 33 || school.longitud < -119 || school.longitud > -86) return null;
    return { lat: school.latitud, lng: school.longitud };
}
export function classifyMatch(catalog, candidates) {
    const cct = normalizeCct(catalog?.cct);
    if (!cct) return { status: 'missing_cct' };
    if (catalog.ubicacion_lat != null || catalog.ubicacion_lng != null) return { status: 'preserve_location' };
    const exact = candidates.filter(row => normalizeCct(row.cct) === cct);
    if (!exact.length) return { status: 'not_found' };
    // Even identical duplicates are reported, not silently collapsed.
    if (exact.length !== 1) return { status: 'ambiguous', count: exact.length };
    const source = exact[0];
    const turn = normalizeTurn(catalog.turno);
    if (!turn || !normalizeTurn(source.turno) || turn !== normalizeTurn(source.turno)) return { status: 'turn_review' };
    if (!sourceLocation(source)) return { status: 'invalid_coordinates' };
    return { status: 'candidate', source };
}
export function mayFillVisit(visit, today, linkedSchoolIds = new Set()) {
    return !!visit && /^\d{4}-\d{2}-\d{2}$/.test(visit.fecha_programada) && visit.fecha_programada > today &&
        visit.is_archived === false && !visit.archived_at &&
        ['PENDIENTE', 'PROGRAMADO', 'PROGRAMADA'].includes(normalizeTurn(visit.estatus)) &&
        visit.ubicacion_lat == null && visit.ubicacion_lng == null && !linkedSchoolIds.has(String(visit.id));
}
export function locationSnapshot(catalog, turno) {
    if (!catalog?.ubicacion_verificada_at || !validCoordinates(catalog.ubicacion_lat, catalog.ubicacion_lng) ||
        !normalizeTurn(turno) || normalizeTurn(catalog.turno) !== normalizeTurn(turno)) return {};
    return { ubicacion_lat: catalog.ubicacion_lat, ubicacion_lng: catalog.ubicacion_lng,
        ubicacion_fuente: catalog.ubicacion_fuente, ubicacion_verificada_at: catalog.ubicacion_verificada_at };
}
