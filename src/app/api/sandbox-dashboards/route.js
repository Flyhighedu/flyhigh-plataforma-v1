import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

function getDateBoundary(range) {
    const now = new Date();
    switch (range) {
        case 'week': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        case 'month': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        case 'year': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
        default: return null;
    }
}

export async function GET(request) {
    try {
        const supabase = getAdminSupabase();
        const { searchParams } = new URL(request.url);
        const range = searchParams.get('range') || 'all';
        const dateBoundary = getDateBoundary(range);

        // ── PANEL 1: Impacto General ──
        let cierresQuery = supabase.from('cierres_mision')
            .select('total_students, total_flights, becados, created_at, school_name_snapshot, end_time');
        if (dateBoundary) cierresQuery = cierresQuery.gte('created_at', dateBoundary);
        const { data: cierres } = await cierresQuery;

        let bitacoraQuery = supabase.from('bitacora_vuelos')
            .select('duration_seconds, student_count, start_time, end_time, created_at, journey_id');
        if (dateBoundary) bitacoraQuery = bitacoraQuery.gte('created_at', dateBoundary);
        const { data: bitacora } = await bitacoraQuery;

        const { data: statsRow } = await supabase.from('stats').select('total_sponsored_kids').single();

        const totalStudents = (cierres || []).reduce((s, c) => s + (c.total_students || 0), 0);
        const totalFlights = (cierres || []).reduce((s, c) => s + (c.total_flights || 0), 0);
        const totalBecados = (cierres || []).reduce((s, c) => s + (c.becados || 0), 0);
        const totalSeconds = (bitacora || []).reduce((s, b) => s + (b.duration_seconds || 0), 0);
        const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;

        // Monthly trend
        const monthMap = {};
        for (const c of (cierres || [])) {
            const d = new Date(c.created_at);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!monthMap[key]) monthMap[key] = { month: key, students: 0, flights: 0, missions: 0 };
            monthMap[key].students += (c.total_students || 0);
            monthMap[key].flights += (c.total_flights || 0);
            monthMap[key].missions += 1;
        }
        const monthlyTrend = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

        const impacto = {
            totalStudents,
            totalFlights,
            totalHours,
            totalMissions: (cierres || []).length,
            totalBecados,
            sponsoredKidsGoal: statsRow?.total_sponsored_kids || 7209,
            monthlyTrend,
        };

        // ── PANEL 2: Eficiencia Operativa ──
        const { data: catalogo } = await supabase.from('catalogo_escuelas').select('ninos');
        const totalCatalogKids = (catalogo || []).reduce((s, e) => s + (e.ninos || 0), 0);
        const capacityUtil = totalCatalogKids > 0 ? Math.round((totalStudents / totalCatalogKids) * 100) : 0;
        const avgFlightDuration = (bitacora || []).length > 0
            ? Math.round((bitacora || []).reduce((s, b) => s + (b.duration_seconds || 0), 0) / (bitacora || []).length)
            : 0;
        const avgStudentsPerFlight = (bitacora || []).length > 0
            ? Math.round((bitacora || []).reduce((s, b) => s + (b.student_count || 0), 0) / (bitacora || []).length * 10) / 10
            : 0;

        // Wait time between flights per journey
        const journeyFlights = {};
        for (const b of (bitacora || [])) {
            if (!b.journey_id || !b.start_time) continue;
            if (!journeyFlights[b.journey_id]) journeyFlights[b.journey_id] = [];
            journeyFlights[b.journey_id].push(new Date(b.start_time).getTime());
        }
        let totalWait = 0, waitCount = 0;
        for (const times of Object.values(journeyFlights)) {
            times.sort((a, b) => a - b);
            for (let i = 1; i < times.length; i++) {
                const gap = (times[i] - times[i - 1]) / 60000;
                if (gap > 0 && gap < 120) { totalWait += gap; waitCount++; }
            }
        }
        const avgWaitMinutes = waitCount > 0 ? Math.round(totalWait / waitCount * 10) / 10 : 0;

        // Flight duration distribution
        const durationBuckets = { '0-3 min': 0, '3-5 min': 0, '5-8 min': 0, '8-12 min': 0, '12+ min': 0 };
        for (const b of (bitacora || [])) {
            const mins = (b.duration_seconds || 0) / 60;
            if (mins <= 3) durationBuckets['0-3 min']++;
            else if (mins <= 5) durationBuckets['3-5 min']++;
            else if (mins <= 8) durationBuckets['5-8 min']++;
            else if (mins <= 12) durationBuckets['8-12 min']++;
            else durationBuckets['12+ min']++;
        }

        const operacion = {
            avgFlightDuration,
            avgStudentsPerFlight,
            totalFlightRecords: (bitacora || []).length,
            capacityUtilization: capacityUtil,
            avgWaitMinutes,
            durationDistribution: Object.entries(durationBuckets).map(([range, count]) => ({ range, count })),
            flightsPerMission: (cierres || []).length > 0 ? Math.round(totalFlights / (cierres || []).length * 10) / 10 : 0,
        };

        // ── PANEL 3: Escuelas ──
        const schoolAgg = {};
        for (const c of (cierres || [])) {
            const name = c.school_name_snapshot || 'Sin nombre';
            if (!schoolAgg[name]) schoolAgg[name] = { name, students: 0, flights: 0, missions: 0 };
            schoolAgg[name].students += (c.total_students || 0);
            schoolAgg[name].flights += (c.total_flights || 0);
            schoolAgg[name].missions += 1;
        }
        const topSchools = Object.values(schoolAgg).sort((a, b) => b.students - a.students);

        let journeysQuery = supabase.from('staff_journeys')
            .select('id, date, school_name, cct, status, created_at')
            .order('date', { ascending: false });
        if (dateBoundary) journeysQuery = journeysQuery.gte('created_at', dateBoundary);
        const { data: journeys } = await journeysQuery;

        // Build cierre map
        const cierreMap = {};
        for (const c of (cierres || [])) {
            if (c.school_name_snapshot) {
                const jid = c.end_time; // use for matching
                cierreMap[c.school_name_snapshot + c.created_at] = c;
            }
        }

        // Full cierres for history
        let allCierresQuery = supabase.from('cierres_mision')
            .select('journey_id, total_students, total_flights, becados, school_name_snapshot, created_at, end_time')
            .order('created_at', { ascending: false });
        if (dateBoundary) allCierresQuery = allCierresQuery.gte('created_at', dateBoundary);
        const { data: allCierres } = await allCierresQuery;

        const historyJourneyMap = {};
        for (const c of (allCierres || [])) {
            if (c.journey_id) historyJourneyMap[c.journey_id] = c;
        }

        const history = (journeys || []).map(j => {
            const c = historyJourneyMap[j.id];
            return {
                date: j.date,
                school: j.school_name || c?.school_name_snapshot || 'Sin nombre',
                students: c?.total_students || 0,
                flights: c?.total_flights || 0,
                becados: c?.becados || 0,
                status: j.status,
            };
        });

        const { count: visitedCount } = await supabase
            .from('catalogo_escuelas')
            .select('*', { count: 'exact', head: true })
            .eq('visitada', true);

        const escuelas = {
            topSchools: topSchools.slice(0, 10),
            history,
            totalCatalog: (catalogo || []).length,
            visitedCount: visitedCount || 0,
        };

        // ── PANEL 4: Patrocinios ──
        const { data: sponsors } = await supabase.from('patrocinadores').select('id, nombre, aportacion_total');
        const { data: fondo } = await supabase.from('fondo_patrocinadores')
            .select('patrocinador_id, categoria, monto_asignado, monto_consumido');

        const sponsorList = (sponsors || []).map(s => ({
            id: s.id,
            name: s.nombre,
            total: Number(s.aportacion_total) || 0,
        }));

        const totalFund = sponsorList.reduce((s, sp) => s + sp.total, 0);
        const totalConsumed = (fondo || []).reduce((s, f) => s + (Number(f.monto_consumido) || 0), 0);
        const totalAssigned = (fondo || []).reduce((s, f) => s + (Number(f.monto_asignado) || 0), 0);

        // Category breakdown
        const catMap = {};
        for (const f of (fondo || [])) {
            if (!catMap[f.categoria]) catMap[f.categoria] = { category: f.categoria, assigned: 0, consumed: 0 };
            catMap[f.categoria].assigned += Number(f.monto_asignado) || 0;
            catMap[f.categoria].consumed += Number(f.monto_consumido) || 0;
        }

        // Sponsor fund detail
        const sponsorNameMap = {};
        for (const s of (sponsors || [])) sponsorNameMap[s.id] = s.nombre;
        const fundDetail = (fondo || []).map(f => ({
            sponsor: sponsorNameMap[f.patrocinador_id] || 'Desconocido',
            category: f.categoria,
            assigned: Number(f.monto_asignado) || 0,
            consumed: Number(f.monto_consumido) || 0,
        }));

        const patrocinios = {
            sponsors: sponsorList,
            categoryBreakdown: Object.values(catMap),
            fundDetail,
            totalFund,
            totalAssigned,
            totalConsumed,
        };

        return NextResponse.json({ impacto, operacion, escuelas, patrocinios });
    } catch (err) {
        console.error('[API] sandbox-dashboards GET error:', err);
        return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
    }
}
