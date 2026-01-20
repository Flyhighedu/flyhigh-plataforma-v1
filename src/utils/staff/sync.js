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
        const { error } = await supabase
            .from('bitacora_vuelos')
            .insert({
                mission_id: missionIdToSend,
                mission_data: flightLog.mission_data || {},
                duration_seconds: flightLog.durationSeconds,
                student_count: flightLog.studentCount,
                staff_count: flightLog.staffCount,
                start_time: new Date(flightLog.startTime).toISOString(),
                end_time: new Date(flightLog.endTime).toISOString(),
                incidents: processedIncidents
            });

        if (error) throw error;
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
        // 1. Upload Signature and Group Photo
        const signatureUrl = await uploadImage(closureData.signature, 'staff-signatures', 'sig');
        const photoUrl = await uploadImage(closureData.photo, 'staff-evidence', 'group');

        // 2. Insert Closure Record
        const { error: insertError } = await supabase
            .from('cierres_mision')
            .insert({
                mission_id: closureData.mission_id?.toString(),
                total_flights: closureData.stats.flights.length,
                total_students: closureData.stats.totalStudents,
                checklist_verified: closureData.checklistVerified,
                signature_url: signatureUrl,
                group_photo_url: photoUrl,
                end_time: new Date().toISOString()
            });

        if (insertError) throw insertError;

        // 3. Mark mission as completed in proximas_escuelas (if ID exists)
        if (closureData.mission_id && !closureData.mission_id.toString().startsWith('manual')) {
            await supabase
                .from('proximas_escuelas')
                .update({ estatus: 'completado' })
                .eq('id', closureData.mission_id);
        }

        return true;

    } catch (error) {
        console.error("Sync Closure Error:", error);
        return false;
    }
}
