import { verifyAdminToken } from '@/lib/adminAuth';
import { cookies } from 'next/headers';
import { locationSnapshot, normalizeCct } from './school-locations.mjs';

export function localSchoolLocationsEnabled() {
    return process.env.NODE_ENV === 'development' && process.env.FLYHIGH_REVIEW_LAB === '1' &&
        process.env.FLYHIGH_REVIEW_ENVIRONMENT === 'isolated-test' &&
        ['http://127.0.0.1:54321', 'http://localhost:54321'].includes(process.env.FLYHIGH_REVIEW_BACKEND_ORIGIN || process.env.NEXT_PUBLIC_SUPABASE_URL);
}
export async function locationAdminAuthorized(request) {
    if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) return false;
    return !!await verifyAdminToken((await cookies()).get('flyhigh_admin_auth')?.value);
}
export async function snapshotForNewVisit(db, cct, turno) {
    if (!localSchoolLocationsEnabled() || !normalizeCct(cct)) return {};
    // Catalog rows imported by this workflow have canonical CCTs. Never fuzzy-match.
    const { data, error } = await db.from('catalogo_escuelas').select('cct,turno,ubicacion_lat,ubicacion_lng,ubicacion_fuente,ubicacion_verificada_at').eq('cct', cct).maybeSingle();
    if (error) throw new Error('No se pudo comprobar la ubicación del catálogo. No se guardó la visita.');
    return locationSnapshot(data, turno);
}
