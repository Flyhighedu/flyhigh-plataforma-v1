import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

function normalize(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseMissionData(value) {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_error) {
            return {};
        }
    }
    return typeof value === 'object' ? value : {};
}

async function run() {
    loadEnvLocal();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRole) {
        throw new Error('Faltan variables NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
    }

    const supabase = createClient(supabaseUrl, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: closures, error: closuresError } = await supabase
        .from('cierres_mision')
        .select('*')
        .order('created_at', { ascending: false });

    if (closuresError) throw closuresError;

    const missionIds = (closures || []).map((c) => c.mission_id).filter(Boolean);
    const numericMissionIds = [...new Set(
        missionIds
            .map((missionId) => String(missionId))
            .filter((missionId) => /^\d+$/.test(missionId))
            .map((missionId) => Number(missionId))
    )];

    const { data: schools } = numericMissionIds.length > 0
        ? await supabase
            .from('proximas_escuelas')
            .select('id, nombre_escuela')
            .in('id', numericMissionIds)
        : { data: [] };

    const { data: flights } = missionIds.length > 0
        ? await supabase
            .from('bitacora_vuelos')
            .select('mission_id, mission_data, created_at')
            .in('mission_id', missionIds)
            .order('created_at', { ascending: true })
        : { data: [] };

    const schoolMap = {};
    for (const school of schools || []) {
        const name = normalize(school?.nombre_escuela);
        if (name && school?.id !== undefined && school?.id !== null) {
            schoolMap[String(school.id)] = name;
        }
    }

    const flightSnapshotMap = {};
    for (const flight of flights || []) {
        const key = String(flight.mission_id || '');
        if (!key || flightSnapshotMap[key]) continue;

        const payload = parseMissionData(flight.mission_data);
        const name = normalize(payload.school_name) || normalize(payload.nombre_escuela);
        if (name) {
            flightSnapshotMap[key] = name;
        }
    }

    const resolvedHistory = (closures || []).map((closure) => {
        const missionId = String(closure.mission_id || '');
        const linkedSchoolId =
            closure.school_id !== undefined && closure.school_id !== null
                ? String(closure.school_id)
                : (/^\d+$/.test(missionId) ? missionId : null);

        const schoolName =
            (linkedSchoolId && schoolMap[linkedSchoolId]) ||
            normalize(closure.school_name_snapshot) ||
            flightSnapshotMap[missionId] ||
            'Escuela no vinculada';

        const dateValue = closure.mission_datetime || closure.end_time || closure.created_at;
        const date = dateValue ? new Date(dateValue).toLocaleDateString() : '';

        return {
            mission_id: closure.mission_id,
            schoolName,
            date
        };
    });

    const oldMission = resolvedHistory.find((item) => String(item.mission_id).startsWith('manual-'));
    const newMission = resolvedHistory.find((item) => /^\d+$/.test(String(item.mission_id)));

    if (!oldMission || !newMission) {
        throw new Error('No se encontraron ejemplos suficientes (manual + programada) para smoke test.');
    }

    const textSearchTerm = oldMission.schoolName.split(' ')[0];
    const byText = resolvedHistory.filter((item) => item.schoolName.toLowerCase().includes(textSearchTerm.toLowerCase()));
    const byDate = resolvedHistory.filter((item) => item.date.includes(oldMission.date));

    const reportSample = async (missionId) => {
        const { data: reportFlights } = await supabase
            .from('bitacora_vuelos')
            .select('id')
            .eq('mission_id', missionId)
            .limit(1);

        const { data: reportClosure } = await supabase
            .from('cierres_mision')
            .select('id')
            .eq('mission_id', missionId)
            .limit(1);

        return {
            missionId,
            hasFlights: (reportFlights || []).length > 0,
            hasClosure: (reportClosure || []).length > 0
        };
    };

    const oldReport = await reportSample(oldMission.mission_id);
    const newReport = await reportSample(newMission.mission_id);

    console.log(JSON.stringify({
        ok: true,
        totals: {
            history_rows: resolvedHistory.length,
            unresolved_rows: resolvedHistory.filter((row) => row.schoolName === 'Escuela no vinculada').length
        },
        search_checks: {
            text_term: textSearchTerm,
            text_matches: byText.length,
            date_term: oldMission.date,
            date_matches: byDate.length
        },
        report_checks: {
            old: oldReport,
            newer: newReport
        }
    }, null, 2));
}

run().catch((error) => {
    console.error('Smoke test historial/informe falló:', error.message);
    process.exit(1);
});
