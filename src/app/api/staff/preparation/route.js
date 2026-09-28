import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isLocal3dReview } from '@/lib/google-3d-proxy.mjs';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { GET as officialLibrary } from '@/app/api/official-pois/route';
import { buildSequence, fingerprint, sequenceChanged, preparationContext, coordinates } from '@/lib/narration-preparation.mjs';

export const dynamic = 'force-dynamic';
const json = (data, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });

async function identity() {
    const db = await createClient();
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) return { error: json({ error: 'Inicia sesión para preparar tu visita.' }, 401) };
    const { data: profile } = await db.from('staff_profiles').select('role, is_active').eq('user_id', user.id).single();
    if (!profile?.is_active || !['pilot', 'assistant'].includes(profile.role)) return { error: json({ error: 'La preparación está disponible para pilotos y auxiliares activos.' }, 403) };
    return { db, user };
}

async function catalog(db, userId) {
    const [official, personal] = await Promise.all([
        officialLibrary(),
        db.from('pilot_pois').select('*').eq('user_id', userId).order('name'),
    ]);
    if (!official.ok || personal.error) throw new Error('No se pudo cargar la biblioteca completa. Intenta de nuevo.');
    return [...(await official.json()).pois, ...(personal.data || [])];
}

function storageError(error) {
    console.error('Visit preparation:', error.code || error.message);
    return json({ error: ['42P01', 'PGRST205'].includes(error.code)
        ? 'La preparación todavía no está habilitada en este entorno.'
        : 'No se pudo completar la solicitud. Intenta de nuevo.' }, 503);
}

export async function GET(request) {
    const auth = await identity();
    if (auth.error) return auth.error;
    try {
        const { db, user } = auth;
        const visitId = new URL(request.url).searchParams.get('visit');
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
        let query = db.from('proximas_escuelas')
            .select('id, nombre_escuela, colonia, fecha_programada, estatus, cct, ubicacion_lat, ubicacion_lng, turno')
            .eq('is_archived', false).order('fecha_programada').order('id');
        if (visitId) {
            if (!/^\d+$/.test(visitId)) return json({ error: 'Visita inválida.' }, 400);
            query = query.eq('id', visitId);
        } else query = query.gte('fecha_programada', today).limit(300);
        if (process.env.FLYHIGH_REVIEW_LAB === '1' && new URL(request.url).searchParams.get('metadata') === '1') {
            const visits = await query;
            if (visits.error) return storageError(visits.error);
            if (visitId && !visits.data.length) return json({ error: 'Esta visita no está disponible.' }, 404);
            return json({ visits: visits.data });
        }
        const [visits, plans, pois] = await Promise.all([
            query, db.from('visit_narration_plans').select('*, visit:proximas_escuelas(nombre_escuela, cct)').eq('user_id', user.id), catalog(db, user.id),
        ]);
        if (visits.error || plans.error) return storageError(visits.error || plans.error);
        if (visitId && !visits.data.length) return json({ error: 'Esta visita no está disponible.' }, 404);
        return json({ userId: user.id, visits: visits.data, catalog: pois, plans: plans.data.map(plan => ({
            ...plan, content_changed: sequenceChanged(plan.items, pois),
        })) });
    } catch (error) { return storageError(error); }
}

export async function PUT(request) {
    const auth = await identity();
    if (auth.error) return auth.error;
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) {
        let reviewOrigin;
        if (isLocal3dReview(process.env)) {
            try {
                const runtime = JSON.parse(await readFile(path.join(process.cwd(), '.review-lab/runtime.json'), 'utf8'));
                reviewOrigin = new URL(runtime.mobileBaseURL).origin;
            } catch { /* No configured mobile gateway: keep the same-origin restriction. */ }
        }
        if (origin !== reviewOrigin) return json({ error: 'Origen inválido.' }, 403);
    }
    try {
        const body = await request.json();
        if (!Number.isSafeInteger(body.visitId) || body.visitId <= 0 || !Number.isInteger(body.revision) || body.revision < 0) return json({ error: 'Visita o versión inválida.' }, 400);
        const { db, user } = auth;
        const { data: visit, error } = await db.from('proximas_escuelas').select('id, fecha_programada, ubicacion_lat, ubicacion_lng').eq('id', body.visitId).eq('is_archived', false).maybeSingle();
        if (error) return storageError(error);
        if (!visit) return json({ error: 'Esta visita no está disponible.' }, 404);
        if (body.visitDate !== visit.fecha_programada) return json({ error: 'La visita cambió de fecha. Recarga antes de confirmar la preparación.' }, 409);
        let items, context;
        try {
            items = buildSequence(body.selections ?? body.ids, await catalog(db, user.id), body.status);
            if (body.context === undefined) {
                const existing = await db.from('visit_narration_plans').select('preparation_context').eq('user_id',user.id).eq('visit_id',body.visitId).maybeSingle();
                if (existing.error) return storageError(existing.error);
                context = preparationContext({ ...existing.data?.preparation_context, phase_id: items[0]?.phase_id || 'general' });
            }
            if (body.context !== undefined) {
                context = preparationContext(body.context);
                if (items.some(item => (item.phase_id || 'general') !== context.phase_id)) throw new Error('Las narraciones deben corresponder al nivel elegido.');
                if (body.status === 'ready' && !context.school_location) throw new Error('Confirma la ubicación de la escuela antes de confirmar el recorrido.');
            }
        }
        catch (error) { return json({ error: error.message }, 400); }
        if (body.status === 'ready' && JSON.stringify(body.fingerprints) !== JSON.stringify(items.map(fingerprint))) {
            return json({ error: 'Una narración cambió. Actualiza el contenido y revisa la secuencia antes de confirmarla.' }, 409);
        }
        const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
        const row = {
            user_id: user.id, visit_id: body.visitId, visit_date: visit.fecha_programada,
            ...(context ? { preparation_context: context } : {}),
            items, status: body.status, revision: body.revision + 1,
            confirmed_at: body.status === 'ready' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
        };
        const result = body.revision === 0
            ? await admin.from('visit_narration_plans').insert(row).select().single()
            : await admin.from('visit_narration_plans').update(row).eq('user_id', user.id).eq('visit_id', body.visitId).eq('revision', body.revision).select().maybeSingle();
        if (result.error?.code === '23505' || (!result.error && !result.data)) return json({ error: 'La preparación cambió en otra sesión. Recarga para continuar con la versión guardada.' }, 409);
        if (result.error) return storageError(result.error);
        return json({ plan: { ...result.data, content_changed: false } });
    } catch (error) {
        if (error instanceof SyntaxError) return json({ error: 'Solicitud inválida.' }, 400);
        return storageError(error);
    }
}
