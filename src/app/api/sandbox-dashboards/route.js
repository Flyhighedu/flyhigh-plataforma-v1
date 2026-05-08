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
        // 'week' and 'month' are VIEW MODES (grouping), not data filters
        case 'week': return null;
        case 'month': return null;
        case 'year': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
        default: return null;
    }
}

// Returns [startISO, endISO] for a specific month like '2026-03'
function getMonthBoundary(monthStr) {
    if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return null;
    const [year, month] = monthStr.split('-').map(Number);
    // Use Date.UTC to prevent Local Time shifting which loses up to 6 hours of flight data at month boundaries
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1)); // first day of NEXT month
    return [start.toISOString(), end.toISOString()];
}

export async function GET(request) {
    try {
        const supabase = getAdminSupabase();
        const { searchParams } = new URL(request.url);
        const range = searchParams.get('range') || 'all';
        const monthFilter = searchParams.get('month') || null; // e.g. '2026-03'
        const startDateParam = searchParams.get('start');
        const endDateParam = searchParams.get('end');

        const monthBounds = monthFilter ? getMonthBoundary(monthFilter) : null;
        const dateBoundary = getDateBoundary(range);

        // ── PANEL 1: Impacto General ──
        let cierresQuery = supabase.from('cierres_mision')
            .select('journey_id, total_students, total_flights, becados, created_at, school_name_snapshot, end_time');
        
        if (startDateParam && endDateParam) {
            cierresQuery = cierresQuery.gte('created_at', startDateParam).lte('created_at', endDateParam);
        } else if (monthBounds) {
            cierresQuery = cierresQuery.gte('created_at', monthBounds[0]).lt('created_at', monthBounds[1]);
        } else if (dateBoundary) {
            cierresQuery = cierresQuery.gte('created_at', dateBoundary);
        }
        const { data: cierres } = await cierresQuery;

        let bitacoraQuery = supabase.from('bitacora_vuelos')
            .select('duration_seconds, student_count, start_time, end_time, created_at, journey_id');
            
        if (startDateParam && endDateParam) {
            bitacoraQuery = bitacoraQuery.gte('created_at', startDateParam).lte('created_at', endDateParam);
        } else if (monthBounds) {
            bitacoraQuery = bitacoraQuery.gte('created_at', monthBounds[0]).lt('created_at', monthBounds[1]);
        } else if (dateBoundary) {
            bitacoraQuery = bitacoraQuery.gte('created_at', dateBoundary);
        }
        const { data: bitacora } = await bitacoraQuery;

        const { data: statsRow } = await supabase.from('stats').select('total_sponsored_kids').single();
        const { data: fondo } = await supabase.from('fondo_patrocinadores')
            .select('patrocinador_id, categoria, monto_asignado, monto_consumido');

        // Fetch staff journeys to get real school names for active missions
        const { data: rawJourneys } = await supabase.from('staff_journeys').select('id, school_name');
        const journeyNameMap = (rawJourneys || []).reduce((acc, j) => { acc[j.id] = j.school_name; return acc; }, {});

        // ── SSoT: Unified Missions (Vuelos Vivos as Source of Truth) ──
        const flightMap = {};
        for (const b of (bitacora || [])) {
            // Use journey_id as the primary identifier for flights, fallback to mission_id (school id)
            const id = b.journey_id || b.mission_id; 
            if (!id) continue;
            
            if (!flightMap[id]) {
                flightMap[id] = {
                    id,
                    date: b.created_at, // Will use earliest flight start time
                    total_students: 0,
                    total_flights: 0,
                    becados: 0, // Will be enriched from cierres
                    school_name: journeyNameMap[id] || 'Misión Activa'
                };
            }
            flightMap[id].total_students += (b.student_count || 0);
            flightMap[id].total_flights += 1;
            if (new Date(b.created_at) < new Date(flightMap[id].date)) {
                flightMap[id].date = b.created_at;
            }
        }

        // Enrich with cierres_mision metadata and add empty closures
        for (const c of (cierres || [])) {
            const id = c.journey_id || c.mission_id;
            if (id && flightMap[id]) {
                flightMap[id].becados = c.becados || 0;
                flightMap[id].school_name = c.school_name_snapshot || flightMap[id].school_name;
                // If the closure happened earlier, use its date (edge case)
                if (new Date(c.created_at) < new Date(flightMap[id].date)) {
                    flightMap[id].date = c.created_at;
                }
            } else if (id) {
                // If there's a closure without ANY flights in bitacora, we include it but trust its counts 
                // ONLY if we have absolutely zero flights recorded.
                flightMap[id] = {
                    id: c.journey_id || `orphan-${c.id}`,
                    date: c.created_at,
                    total_students: c.total_students || 0, // Fallback to closure counts ONLY if no flights exist
                    total_flights: c.total_flights || 0,
                    becados: c.becados || 0,
                    school_name: c.school_name_snapshot || (c.journey_id ? journeyNameMap[c.journey_id] : 'Sin nombre'),
                };
            }
        }

        const unifiedMissions = Object.values(flightMap);

        const totalStudents = unifiedMissions.reduce((s, c) => s + (c.total_students || 0), 0);
        const totalFlights = unifiedMissions.reduce((s, c) => s + (c.total_flights || 0), 0);
        const totalBecados = unifiedMissions.reduce((s, c) => s + (c.becados || 0), 0);
        const totalSeconds = (bitacora || []).reduce((s, b) => s + (b.duration_seconds || 0), 0);
        const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;

        // Formatos UTC estrictos para agrupaciones cronológicas
        // 1. Mensual (YYYY-MM)
        const monthMap = {};
        for (const c of unifiedMissions) {
            const d = new Date(c.date);
            const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
            if (!monthMap[key]) monthMap[key] = { month: key, students: 0, flights: 0, missions: 0 };
            monthMap[key].students += (c.total_students || 0);
            monthMap[key].flights += (c.total_flights || 0);
            monthMap[key].missions += 1;
        }
        const monthlyTrend = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

        // 2. Totales por escuela
        const schoolTotals = {};
        for (const c of unifiedMissions) {
            const school = c.school_name || 'Sin nombre';
            if (!schoolTotals[school]) schoolTotals[school] = { name: school, students: 0, flights: 0, missions: 0, becados: 0 };
            schoolTotals[school].students += (c.total_students || 0);
            schoolTotals[school].flights += (c.total_flights || 0);
            schoolTotals[school].missions += 1;
            schoolTotals[school].becados += (c.becados || 0);
        }

        // 3. Anual (YYYY)
        const yearMap = {};
        for (const c of unifiedMissions) {
            const d = new Date(c.date);
            const key = `${d.getUTCFullYear()}`;
            if (!yearMap[key]) yearMap[key] = { year: key, students: 0, flights: 0, missions: 0, schools: {} };
            yearMap[key].students += (c.total_students || 0);
            yearMap[key].flights += (c.total_flights || 0);
            yearMap[key].missions += 1;
            const school = c.school_name || 'Sin nombre';
            if (!yearMap[key].schools[school]) yearMap[key].schools[school] = { name: school, students: 0, flights: 0, missions: 0 };
            yearMap[key].schools[school].students += (c.total_students || 0);
            yearMap[key].schools[school].flights += (c.total_flights || 0);
            yearMap[key].schools[school].missions += 1;
        }
        const yearlyTrend = Object.values(yearMap).sort((a, b) => a.year.localeCompare(b.year)).map(y => ({
            ...y,
            schools: Object.values(y.schools).sort((a, b) => b.students - a.students)
        }));

        // 4. Semanal estricto en Lunes (ISO 8601) anclado en UTC
        const weekMap = {};
        for (const c of unifiedMissions) {
            const d = new Date(c.date);
            const utcDay = d.getUTCDay();
            // Si es Domingo(0) restamos 6 dias, de lo contrario restamos el día actual y sumamos 1 para Lunes(1)
            const diff = d.getUTCDate() - utcDay + (utcDay === 0 ? -6 : 1);
            // Date.UTC para crear el Lunes congelado a las 00:00:00Z exactas y prevenir fuga de husos
            const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
            const weekKey = monday.toISOString().substring(0, 10);
            
            if (!weekMap[weekKey]) weekMap[weekKey] = { week: weekKey, students: 0, flights: 0, missions: 0, schools: {} };
            weekMap[weekKey].students += (c.total_students || 0);
            weekMap[weekKey].flights += (c.total_flights || 0);
            weekMap[weekKey].missions += 1;
            const school = c.school_name || 'Sin nombre';
            if (!weekMap[weekKey].schools[school]) weekMap[weekKey].schools[school] = { name: school, students: 0, flights: 0, missions: 0 };
            weekMap[weekKey].schools[school].students += (c.total_students || 0);
            weekMap[weekKey].schools[school].flights += (c.total_flights || 0);
            weekMap[weekKey].schools[school].missions += 1;
        }
        const weeklyTrend = Object.values(weekMap).sort((a, b) => a.week.localeCompare(b.week)).map(w => ({
            ...w,
            schools: Object.values(w.schools).sort((a, b) => b.students - a.students)
        }));

        // 5. Diario estricto UTC
        const dailyMap = {};
        for (const c of unifiedMissions) {
            const d = new Date(c.date);
            const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
            if (!dailyMap[key]) dailyMap[key] = { day: key, students: 0, flights: 0, missions: 0, schools: {} };
            dailyMap[key].students += (c.total_students || 0);
            dailyMap[key].flights += (c.total_flights || 0);
            dailyMap[key].missions += 1;
            const school = c.school_name || 'Sin nombre';
            if (!dailyMap[key].schools[school]) dailyMap[key].schools[school] = { name: school, students: 0, flights: 0, missions: 0 };
            dailyMap[key].schools[school].students += (c.total_students || 0);
            dailyMap[key].schools[school].flights += (c.total_flights || 0);
            dailyMap[key].schools[school].missions += 1;
        }
        const dailyTrend = Object.values(dailyMap).sort((a, b) => a.day.localeCompare(b.day)).map(d => ({
            ...d,
            schools: Object.values(d.schools).sort((a, b) => b.students - a.students)
        }));

        // Añadir detalle mensual
        const monthDetailMap = {};
        for (const c of unifiedMissions) {
            const d = new Date(c.date);
            const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
            if (!monthDetailMap[key]) monthDetailMap[key] = {};
            const school = c.school_name || 'Sin nombre';
            if (!monthDetailMap[key][school]) monthDetailMap[key][school] = { name: school, students: 0, flights: 0, missions: 0 };
            monthDetailMap[key][school].students += (c.total_students || 0);
            monthDetailMap[key][school].flights += (c.total_flights || 0);
            monthDetailMap[key][school].missions += 1;
        }
        const monthlyTrendWithDetail = monthlyTrend.map(m => ({
            ...m,
            schools: Object.values(monthDetailMap[m.month] || {}).sort((a, b) => b.students - a.students)
        }));

        const totalSponsoredKidsGoal = (fondo || []).reduce(
            (sum, f) => sum + Math.floor((f.monto_asignado || 0) / 150), 0
        );

        const impacto = {
            totalStudents,
            totalFlights,
            totalHours,
            totalMissions: unifiedMissions.length,
            totalBecados,
            sponsoredKidsGoal: totalSponsoredKidsGoal,
            yearlyTrend,
            monthlyTrend: monthlyTrendWithDetail,
            weeklyTrend,
            dailyTrend,
            schoolTotals: Object.values(schoolTotals).sort((a, b) => b.students - a.students),
        };

        // ── PANEL 2: Eficiencia Operativa ──
        const { data: catalogo } = await supabase.from('catalogo_escuelas').select('nombre_escuela, ninos');
        
        const catalogMap = {};
        for (const esc of (catalogo || [])) {
            if (esc.nombre_escuela && esc.ninos > 0) {
                catalogMap[esc.nombre_escuela.trim().toLowerCase()] = esc.ninos;
            }
        }

        const visitedSchools = new Set();
        for (const c of unifiedMissions) {
            if (c.school_name) visitedSchools.add(c.school_name.trim().toLowerCase());
        }

        let visitedCapacity = 0;
        let flownInKnownCapacity = 0;

        for (const schoolName of visitedSchools) {
            const capacity = catalogMap[schoolName];
            if (capacity) {
                visitedCapacity += capacity;
                const flown = unifiedMissions
                    .filter(c => c.school_name && c.school_name.trim().toLowerCase() === schoolName)
                    .reduce((s, c) => s + (c.total_students || 0), 0);
                flownInKnownCapacity += flown;
            }
        }

        const capacityUtil = visitedCapacity > 0 ? Math.round((flownInKnownCapacity / visitedCapacity) * 100) : 0;
        
        // Filtrar vuelos válidos para duración (excluye < 30 segs o > 30 mins generados por bugs)
        const validFlightsForDuration = (bitacora || []).filter(b => b.duration_seconds >= 30 && b.duration_seconds <= 1800);
        const avgFlightDuration = validFlightsForDuration.length > 0
            ? Math.round(validFlightsForDuration.reduce((s, b) => s + b.duration_seconds, 0) / validFlightsForDuration.length)
            : 0;
            
        // Filtrar vuelos válidos para alumnos (excluye vuelos de prueba con 0 alumnos o errores absurdos > 50)
        const validFlightsForStudents = (bitacora || []).filter(b => b.student_count > 0 && b.student_count <= 50);
        const avgStudentsPerFlight = validFlightsForStudents.length > 0
            ? Math.round(validFlightsForStudents.reduce((s, b) => s + b.student_count, 0) / validFlightsForStudents.length * 10) / 10
            : 0;

        // Wait time between flights per journey (Tiempo entre vuelos)
        const journeyFlights = {};
        for (const b of (bitacora || [])) {
            if (!b.journey_id || !b.start_time) continue;
            if (!journeyFlights[b.journey_id]) journeyFlights[b.journey_id] = [];
            journeyFlights[b.journey_id].push(new Date(b.start_time).getTime());
        }
        let totalWait = 0, waitCount = 0;
        const waitBuckets = { '0-2 min': 0, '3-5 min': 0, '6-10 min': 0, '11-15 min': 0, '15-20 min': 0 };
        for (const times of Object.values(journeyFlights)) {
            times.sort((a, b) => a - b);
            for (let i = 1; i < times.length; i++) {
                const gap = (times[i] - times[i - 1]) / 60000;
                // Filtrar gaps irreales: > 20 minutos usualmente indica el bug de "último vuelo" contado hasta fin de misión
                if (gap > 0 && gap <= 20) { 
                    totalWait += gap; 
                    waitCount++;
                    if (gap <= 2) waitBuckets['0-2 min']++;
                    else if (gap <= 5) waitBuckets['3-5 min']++;
                    else if (gap <= 10) waitBuckets['6-10 min']++;
                    else if (gap <= 15) waitBuckets['11-15 min']++;
                    else waitBuckets['15-20 min']++;
                }
            }
        }
        const avgWaitMinutes = waitCount > 0 ? Math.round(totalWait / waitCount * 10) / 10 : 0;
        const waitDistribution = Object.entries(waitBuckets).map(([range, count]) => ({ range, count }));

        // Metricas adicionales (Ciclo total y Alumnos por hora)
        const cycleTimeMinutes = (avgFlightDuration / 60) + avgWaitMinutes;
        const avgStudentsPerHour = cycleTimeMinutes > 0 ? Math.round((avgStudentsPerFlight / cycleTimeMinutes) * 60 * 10) / 10 : 0;

        // Flight duration distribution (basado solo en vuelos válidos)
        const durationBuckets = { '0-3 min': 0, '3-5 min': 0, '5-8 min': 0, '8-12 min': 0, '12+ min': 0 };
        for (const b of validFlightsForDuration) {
            const mins = b.duration_seconds / 60;
            if (mins <= 3) durationBuckets['0-3 min']++;
            else if (mins <= 5) durationBuckets['3-5 min']++;
            else if (mins <= 8) durationBuckets['5-8 min']++;
            else if (mins <= 12) durationBuckets['8-12 min']++;
            else durationBuckets['12+ min']++;
        }

        // Students per flight distribution (basado solo en vuelos válidos)
        const studentsBuckets = { '1-5': 0, '6-8': 0, '9-10': 0, '11-12': 0, '13+': 0 };
        for (const b of validFlightsForStudents) {
            const sc = b.student_count;
            if (sc <= 5) studentsBuckets['1-5']++;
            else if (sc <= 8) studentsBuckets['6-8']++;
            else if (sc <= 10) studentsBuckets['9-10']++;
            else if (sc <= 12) studentsBuckets['11-12']++;
            else studentsBuckets['13+']++;
        }

        const operacion = {
            avgFlightDuration,
            avgStudentsPerFlight,
            avgStudentsPerHour,
            cycleTimeMinutes: Math.round(cycleTimeMinutes * 10) / 10,
            totalFlightRecords: validFlightsForDuration.length,
            capacityUtilization: capacityUtil,
            avgWaitMinutes,
            durationDistribution: Object.entries(durationBuckets).map(([range, count]) => ({ range, count })),
            studentsDistribution: Object.entries(studentsBuckets).map(([range, count]) => ({ range, count })),
            waitDistribution,
            flightsPerMission: (cierres || []).length > 0 ? Math.round(totalFlights / (cierres || []).length * 10) / 10 : 0,
        };

        // ── PANEL 3: Escuelas ──
        const schoolAgg = {};
        for (const c of unifiedMissions) {
            const name = c.school_name || 'Sin nombre';
            if (!schoolAgg[name]) schoolAgg[name] = { name, students: 0, flights: 0, missions: 0 };
            schoolAgg[name].students += (c.total_students || 0);
            schoolAgg[name].flights += (c.total_flights || 0);
            schoolAgg[name].missions += 1;
        }
        const topSchools = Object.values(schoolAgg).sort((a, b) => b.students - a.students);

        let journeysQuery = supabase.from('staff_journeys')
            .select('id, date, school_name, cct, status, created_at')
            .order('date', { ascending: false });
        
        if (startDateParam && endDateParam) {
            journeysQuery = journeysQuery.gte('created_at', startDateParam).lte('created_at', endDateParam);
        } else if (dateBoundary) {
            journeysQuery = journeysQuery.gte('created_at', dateBoundary);
        }
        const { data: journeys } = await journeysQuery;

        const unifiedJourneyMap = {};
        for (const c of unifiedMissions) {
            if (c.id) unifiedJourneyMap[c.id] = c;
        }

        const history = (journeys || []).map(j => {
            const c = unifiedJourneyMap[j.id];
            return {
                date: j.date,
                school: j.school_name || c?.school_name || 'Sin nombre',
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
