import { createClient } from '@/utils/supabase/client';

const supabase = createClient();

/**
 * Uploads a base64 image to Supabase Storage
 * @param {string} base64Data - The data URL
 * @param {string} bucket - 'staff-evidence' or 'staff-signatures'
 * @param {string} prefix - Filename prefix
 * @returns {Promise<string|null>} - Public URL or null if failed
 */
async function uploadImage(base64Data, bucket, prefix = 'evidencia') {
    if (!base64Data || !base64Data.startsWith('data:')) return base64Data; // Already a URL or empty

    try {
        // Convert base64 to Blob
        const res = await fetch(base64Data);
        const blob = await res.blob();

        const ext = base64Data.split(';')[0].split('/')[1] || 'jpg';
        const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filename, blob);

        if (error) throw error;

        const { data: publicData } = supabase.storage
            .from(bucket)
            .getPublicUrl(filename);

        return publicData.publicUrl;
    } catch (error) {
        console.error(`Error uploading to ${bucket}:`, error);
        return null; // Keep base64? No, better to fail upload than save huge string in DB if we want clean data.
        // Actually, if upload fails, we might want to retry later.
        // For now, return null and log functionality is compromised for that image.
    }
}

function parseSchoolId(missionId) {
    const value = String(missionId || '').trim();
    if (!/^\d+$/.test(value)) return null;
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : null;
}

function resolveSchoolSnapshotName(closureData) {
    if (closureData?.school_name_snapshot) {
        return closureData.school_name_snapshot;
    }

    const mission = closureData?.mission || {};
    const fromMission = mission.school_name || mission.nombre_escuela;
    if (fromMission) return fromMission;

    const flights = closureData?.stats?.flights || [];
    const firstFlightWithMission = flights.find((flight) => flight?.mission_data);
    if (firstFlightWithMission?.mission_data) {
        const payload = firstFlightWithMission.mission_data;
        return payload.school_name || payload.nombre_escuela || null;
    }

    return null;
}

function isUuid(value) {
    const normalized = String(value || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
}

/**
 * Syncs a single flight log to Supabase
 * @param {Object} flightLog - The flight log object from local storage
 * @returns {Promise<boolean>} - Success status
 */
export async function syncFlightLog(flightLog) {
    try {
        // 0. Check Auth
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (authError || !session) {
            console.error("Sync Error: User not authenticated.", authError);
            throw new Error("Usuario no autenticado. Inicia sesión nuevamente.");
        }

        // 1. Process Incidents Images
        const processedIncidents = await Promise.all(
            (flightLog.incidents || []).map(async (inc) => {
                if (inc.image && inc.image.startsWith('data:')) {
                    const url = await uploadImage(inc.image, 'staff-evidence', 'incident');
                    return { ...inc, image: url || inc.image };
                }
                return inc;
            })
        );

        // Handle mission_id checking - DB column is TEXT so we can store 'manual-...' explicitly.
        // No need to nullify it.
        const missionIdToSend = flightLog.mission_id?.toString();

        // 2. Insert into DB
        const payload = {
            mission_id: missionIdToSend,
            journey_id: flightLog.journey_id || null,
            mission_data: flightLog.mission_data || {},
            duration_seconds: flightLog.durationSeconds,
            student_count: flightLog.studentCount,
            staff_count: flightLog.staffCount,
            start_time: new Date(flightLog.startTime).toISOString(),
            end_time: new Date(flightLog.endTime).toISOString(),
            incidents: processedIncidents
        };

        let insertedRowId = null;
        let { data: insertedRow, error } = await supabase
            .from('bitacora_vuelos')
            .insert(payload)
            .select('id')
            .single();

        if (insertedRow?.id) {
            insertedRowId = insertedRow.id;
        }

        if (error && /journey_id|column/i.test(error.message || '')) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.journey_id;

            const fallback = await supabase
                .from('bitacora_vuelos')
                .insert(fallbackPayload)
                .select('id')
                .single();

            if (fallback?.data?.id) {
                insertedRowId = fallback.data.id;
            }
            error = fallback.error;
        }

        if (error) throw error;

        if (flightLog && typeof flightLog === 'object' && insertedRowId) {
            flightLog.cloud_row_id = insertedRowId;
        }

        return true;

    } catch (error) {
        console.error("Sync Flight Error Detailed:", JSON.stringify(error, null, 2));
        // Also log the message if it's a standard Error object
        if (error.message) console.error("Error Message:", error.message);
        return false;
    }
}

/**
 * Syncs mission closure report
 * @param {Object} closureData - Data collected at closure
 * @returns {Promise<boolean>}
 */
export async function syncMissionClosure(closureData) {
    try {
        // 0. Ensure Auth (Auto-recover session if possible)
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            console.warn("Session lost during closure. Attempting emergency re-auth as Test User...");
            const { error: loginError } = await supabase.auth.signInWithPassword({
                email: 'staff_test@flyhigh.com',
                password: 'flyhigh_test_123'
            });

            if (loginError) {
                console.error("Emergency re-auth failed:", loginError);
                throw new Error("No hay sesión y falló la re-autenticación.");
            }
        }

        // 1. Upload Signature and Group Photo
        const signatureUrl = await uploadImage(closureData.signature, 'staff-signatures', 'sig');
        const photoUrl = await uploadImage(closureData.photo, 'staff-evidence', 'group');

        const missionId = closureData.mission_id?.toString();
        const journeyId = closureData.journey_id?.toString() || null;
        const missionDateTime = closureData.mission_datetime || new Date().toISOString();
        const schoolId = closureData.school_id ?? parseSchoolId(missionId);
        const schoolNameSnapshot = resolveSchoolSnapshotName(closureData);

        const basePayload = {
            mission_id: missionId,
            journey_id: journeyId,
            total_flights: closureData.stats.flights.length,
            total_students: closureData.stats.totalStudents,
            checklist_verified: closureData.checklistVerified,
            signature_url: signatureUrl,
            group_photo_url: photoUrl,
            end_time: missionDateTime
        };

        const extendedPayload = {
            ...basePayload,
            mission_datetime: missionDateTime,
            school_id: schoolId,
            school_name_snapshot: schoolNameSnapshot
        };

        let { error: insertError } = await supabase
            .from('cierres_mision')
            .insert(extendedPayload);

        if (insertError && /column/i.test(insertError.message || '')) {
            console.warn('Columnas snapshot no disponibles en cierres_mision. Guardando payload base.', insertError.message);
            const fallback = await supabase
                .from('cierres_mision')
                .insert(basePayload);
            insertError = fallback.error;
        }

        if (insertError) throw insertError;

        // 3. Mark mission as completed in proximas_escuelas (if ID exists)
        if (closureData.mission_id && !closureData.mission_id.toString().startsWith('manual')) {
            await supabase
                .from('proximas_escuelas')
                .update({ estatus: 'completado' })
                .eq('id', closureData.mission_id);
        }

        return { success: true };

    } catch (error) {
        console.error("Sync Closure Error:", error);
        return {
            success: false,
            error: error.message || "Error desconocido al guardar en base de datos."
        };
    }
}

/**
 * Syncs ALL pending (unsynced) flight logs from localStorage
 * Called before mission closure to ensure all data is in DB
 * @returns {Promise<{synced: number, failed: number}>}
 */
export async function syncAllPendingFlights() {
    const logs = JSON.parse(localStorage.getItem('flyhigh_flight_logs') || '[]');
    const pendingLogs = logs.filter(l => !l.synced);

    if (pendingLogs.length === 0) {
        console.log("No pending flights to sync.");
        return { synced: 0, failed: 0 };
    }

    console.log(`Syncing ${pendingLogs.length} pending flights...`);

    // Ensure auth before batch sync
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        console.warn("No session for batch sync. Attempting emergency re-auth...");
        const { error: loginError } = await supabase.auth.signInWithPassword({
            email: 'staff_test@flyhigh.com',
            password: 'flyhigh_test_123'
        });
        if (loginError) {
            console.error("Emergency re-auth failed for batch sync:", loginError);
            return { synced: 0, failed: pendingLogs.length };
        }
    }

    let syncedCount = 0;
    let failedCount = 0;
    const updatedLogs = [...logs];

    for (const flight of pendingLogs) {
        const success = await syncFlightLog(flight);
        if (success) {
            syncedCount++;
            const idx = updatedLogs.findIndex(l => l.id === flight.id);
            if (idx !== -1) updatedLogs[idx].synced = true;
        } else {
            failedCount++;
        }
    }

    localStorage.setItem('flyhigh_flight_logs', JSON.stringify(updatedLogs));

    console.log(`Batch sync complete: ${syncedCount} synced, ${failedCount} failed.`);
    return { synced: syncedCount, failed: failedCount };
}

/**
 * Starts a pause event and saves to DB
 * @param {Object} pauseData - { mission_id, type, reason, maintenanceChecklist }
 * @returns {Promise<{success: boolean, pauseId?: string}>}
 */
export async function syncPauseStart(pauseData) {
    try {
        let { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            console.warn("No session for pause sync. Attempting emergency re-auth...");
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: 'staff_test@flyhigh.com',
                password: 'flyhigh_test_123'
            });
            if (authError) throw authError;
            session = authData.session;
        }

        const { data, error } = await supabase
            .from('bitacora_pausas')
            .insert({
                mission_id: pauseData.mission_id?.toString(),
                pause_type: pauseData.type,
                reason: pauseData.reason,
                maintenance_checklist: pauseData.maintenanceChecklist || {},
                start_time: new Date().toISOString(),
                created_by: session?.user?.id
            })
            .select('id')
            .single();

        if (error) throw error;

        console.log("Pause started and synced:", data.id);
        return { success: true, pauseId: data.id };

    } catch (error) {
        console.error("Sync Pause Start Error:", error.message || error);
        return { success: false };
    }
}

/**
 * Ends a pause event
 * @param {string} pauseId - The pause record ID
 * @param {Object} resumeChecklist - The safety checks completed
 * @returns {Promise<boolean>}
 */
export async function syncPauseEnd(pauseId, resumeChecklist) {
    try {
        // Ensure we have a session
        let { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            console.warn("No session for pause end. Attempting emergency re-auth...");
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: 'staff_test@flyhigh.com',
                password: 'flyhigh_test_123'
            });
            if (authError) throw authError;
        }

        const { error } = await supabase
            .from('bitacora_pausas')
            .update({
                end_time: new Date().toISOString(),
                resume_checklist: resumeChecklist
            })
            .eq('id', pauseId);

        if (error) throw error;

        console.log("Pause ended and synced:", pauseId);
        return true;

    } catch (error) {
        console.error("Sync Pause End Error:", error.message || error);
        return false;
    }
}

/**
 * Syncs ALL pending pauses from localStorage before closure
 * @param {string} missionId - Current mission ID
 * @returns {Promise<{synced: number, failed: number}>}
 */
export async function syncAllPendingPauses(missionId) {
    const allPauses = JSON.parse(localStorage.getItem('flyhigh_completed_pauses') || '[]');
    const pendingPauses = allPauses.filter(p =>
        p.mission_id?.toString() === missionId?.toString() &&
        p.pauseId?.startsWith('local-')
    );

    if (pendingPauses.length === 0) {
        console.log("No pending pauses to sync.");
        return { synced: 0, failed: 0 };
    }

    console.log(`Syncing ${pendingPauses.length} pending pauses...`);

    // Ensure auth
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: 'staff_test@flyhigh.com',
            password: 'flyhigh_test_123'
        });
        if (authError) {
            console.error("Emergency re-auth failed for pause sync:", authError);
            return { synced: 0, failed: pendingPauses.length };
        }
        session = authData.session;
    }

    let syncedCount = 0;
    let failedCount = 0;

    for (const pause of pendingPauses) {
        try {
            const { error } = await supabase
                .from('bitacora_pausas')
                .insert({
                    mission_id: pause.mission_id?.toString(),
                    pause_type: pause.type,
                    reason: pause.reason,
                    maintenance_checklist: pause.maintenanceChecklist || {},
                    resume_checklist: pause.resumeChecklist || {},
                    start_time: pause.startTime,
                    end_time: pause.endTime,
                    created_by: session?.user?.id
                });

            if (error) throw error;
            syncedCount++;
        } catch (err) {
            console.error("Failed to sync pause:", err);
            failedCount++;
        }
    }

    console.log(`Pause sync complete: ${syncedCount} synced, ${failedCount} failed.`);
    return { synced: syncedCount, failed: failedCount };
}

/**
 * Syncs pending check-ins from localStorage
 * @returns {Promise<void>}
 */
export async function syncPendingCheckIns() {
    const pending = JSON.parse(localStorage.getItem('pending_checkins') || '[]');
    if (pending.length === 0) return;

    console.log(`Syncing ${pending.length} pending check-ins...`);
    const supabase = createClient();
    const remaining = [];
    let authUserId = null;

    const resolveAuthUserId = async () => {
        if (authUserId) return authUserId;
        const { data: authData } = await supabase.auth.getUser();
        if (isUuid(authData?.user?.id)) {
            authUserId = String(authData.user.id).trim();
        }
        return authUserId;
    };

    for (const item of pending) {
        try {
            let eventUserId = isUuid(item?.userId) ? String(item.userId).trim() : '';

            if (!eventUserId) {
                eventUserId = await resolveAuthUserId();
            }

            if (!eventUserId) {
                throw new Error('No se pudo validar user_id para sincronizar check-in pendiente.');
            }

            const { error } = await supabase.from('staff_prep_events').insert({
                journey_id: item.journeyId,
                user_id: eventUserId,
                event_type: 'checkin',
                payload: item.payload
            });

            if (error) throw error;
            console.log("Check-in synced for:", item.journeyId);
        } catch (e) {
            console.warn("Failed to sync check-in:", e);
            remaining.push(item);
        }
    }

    localStorage.setItem('pending_checkins', JSON.stringify(remaining));
}
