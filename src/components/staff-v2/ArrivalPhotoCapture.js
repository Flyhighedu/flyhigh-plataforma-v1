'use client';
import { useState, useRef } from 'react';
import { Camera, RefreshCw, CheckCircle, WifiOff } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { saveOfflineEvent } from '@/utils/offlineQueue';
import { parseMeta } from '@/utils/metaHelpers';

export default function ArrivalPhotoCapture({ journeyId, userId, onComplete }) {
    const [preview, setPreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const [compressedFile, setCompressedFile] = useState(null);

    // Helper: Compress image
    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1280;
                    const scaleSize = MAX_WIDTH / img.width;
                    const width = (img.width > MAX_WIDTH) ? MAX_WIDTH : img.width;
                    const height = (img.width > MAX_WIDTH) ? img.height * scaleSize : img.height;
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                        else resolve(file);
                    }, 'image/jpeg', 0.7);
                };
            };
        });
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const compressed = await compressImage(file);
            setCompressedFile(compressed);
            const reader = new FileReader();
            reader.onload = (ev) => setPreview(ev.target.result);
            reader.readAsDataURL(compressed);
        } catch (err) {
            console.error('Compression error', err);
        }
    };

    const handleSave = async () => {
        if (!compressedFile) return;
        setUploading(true);

        const isOnline = navigator.onLine;
        const timestamp = new Date().toISOString();
        const filename = `arrival_${journeyId}_${Date.now()}.jpg`;

        if (isOnline) {
            try {
                const supabase = createClient();
                // 1. Upload
                const { error: uploadError } = await supabase.storage
                    .from('staff-arrival')
                    .upload(filename, compressedFile);

                if (uploadError) throw uploadError;

                const publicUrl = supabase.storage.from('staff-arrival').getPublicUrl(filename).data.publicUrl;

                const { data: journeySnapshot, error: journeyReadError } = await supabase
                    .from('staff_journeys')
                    .select('meta')
                    .eq('id', journeyId)
                    .single();

                if (journeyReadError) throw journeyReadError;

                const currentMeta = parseMeta(journeySnapshot?.meta);
                const nextMeta = { ...currentMeta };

                delete nextMeta.pilot_ready;
                delete nextMeta.pilot_ready_at;
                delete nextMeta.pilot_ready_source;
                delete nextMeta.pilot_spot_set_at;
                delete nextMeta.pilot_spot_photo_url;
                delete nextMeta.pilot_spot_note;
                delete nextMeta.pilot_prep_checks;
                delete nextMeta.pilot_prep_complete_at;
                delete nextMeta.pilot_controller_connected;
                delete nextMeta.pilot_controller_connected_at;
                delete nextMeta.pilot_audio_checks;
                delete nextMeta.pilot_audio_configured;
                delete nextMeta.pilot_audio_configured_at;
                delete nextMeta.global_seat_deployment_done;
                delete nextMeta.global_seat_deployment_done_at;
                delete nextMeta.global_seat_deployment_done_by;
                delete nextMeta.global_seat_deployment_done_by_name;
                delete nextMeta.global_headphones_checks;
                delete nextMeta.global_headphones_done;
                delete nextMeta.global_headphones_done_at;
                delete nextMeta.global_headphones_done_by;
                delete nextMeta.global_headphones_done_by_name;
                delete nextMeta.global_headphones_control_mode;
                delete nextMeta.global_headphones_controller_user_id;
                delete nextMeta.global_headphones_controller_name;
                delete nextMeta.global_headphones_controller_role;
                delete nextMeta.global_headphones_control_locked_at;
                delete nextMeta.global_glasses_station_count;
                delete nextMeta.global_glasses_checks;
                delete nextMeta.global_glasses_done;
                delete nextMeta.global_glasses_done_at;
                delete nextMeta.global_glasses_done_by;
                delete nextMeta.global_glasses_done_by_name;
                delete nextMeta.global_glasses_functional_count;
                delete nextMeta.global_glasses_control_mode;
                delete nextMeta.global_glasses_controller_user_id;
                delete nextMeta.global_glasses_controller_name;
                delete nextMeta.global_glasses_controller_role;
                delete nextMeta.global_glasses_control_locked_at;
                delete nextMeta.aux_ad_wall_checks;
                delete nextMeta.aux_ad_wall_evidence_url;
                delete nextMeta.aux_ad_wall_evidence_at;
                delete nextMeta.aux_ad_wall_evidence_by;
                delete nextMeta.aux_ad_wall_done;
                delete nextMeta.aux_ad_wall_done_at;
                delete nextMeta.aux_ad_wall_done_by;
                delete nextMeta.aux_ad_wall_done_by_name;
                delete nextMeta.civic_parallel_status;
                delete nextMeta.civic_parallel_started_at;
                delete nextMeta.civic_parallel_started_by;
                delete nextMeta.civic_parallel_teacher_ack_at;
                delete nextMeta.civic_parallel_aux_status;
                delete nextMeta.civic_parallel_aux_started_at;
                delete nextMeta.civic_parallel_aux_stopped_at;
                delete nextMeta.civic_parallel_aux_duration_sec;
                delete nextMeta.civic_parallel_aux_video_url;
                delete nextMeta.civic_parallel_aux_uploaded_at;
                delete nextMeta.civic_parallel_aux_error;
                delete nextMeta.civic_parallel_aux_error_code;
                delete nextMeta.civic_parallel_aux_failed_at;
                delete nextMeta.civic_parallel_aux_capture_mode;
                delete nextMeta.civic_parallel_teacher_audio_required_sec;
                delete nextMeta.civic_parallel_teacher_audio_status;
                delete nextMeta.civic_parallel_teacher_audio_started_at;
                delete nextMeta.civic_parallel_teacher_audio_stopped_at;
                delete nextMeta.civic_parallel_teacher_audio_duration_sec;
                delete nextMeta.civic_parallel_teacher_audio_url;
                delete nextMeta.civic_parallel_teacher_audio_uploaded_at;
                delete nextMeta.civic_parallel_teacher_audio_error;
                delete nextMeta.civic_parallel_teacher_audio_ended_early;
                delete nextMeta.civic_parallel_teacher_audio_early_reason;
                delete nextMeta.civic_parallel_teacher_audio_early_reason_detail;
                delete nextMeta.civic_parallel_teacher_done_at;
                delete nextMeta.civic_parallel_teacher_done_by;
                delete nextMeta.civic_parallel_teacher_done_by_name;
                delete nextMeta.pilot_music_ambience_checks;
                delete nextMeta.pilot_music_ambience_done;
                delete nextMeta.pilot_music_ambience_done_at;
                delete nextMeta.pilot_music_ambience_done_by;
                delete nextMeta.pilot_music_ambience_done_by_name;
                delete nextMeta.teacher_operation_ready_checks;
                delete nextMeta.teacher_operation_ready;
                delete nextMeta.teacher_operation_ready_at;
                delete nextMeta.teacher_operation_ready_by;
                delete nextMeta.teacher_operation_ready_by_name;
                delete nextMeta.aux_operation_stand_photo_url;
                delete nextMeta.aux_operation_stand_photo_at;
                delete nextMeta.aux_operation_stand_photo_by;
                delete nextMeta.aux_operation_ready;
                delete nextMeta.aux_operation_ready_at;
                delete nextMeta.aux_operation_ready_by;
                delete nextMeta.aux_operation_ready_by_name;
                delete nextMeta.operation_start_bridge_at;
                delete nextMeta.operation_start_bridge_by;
                delete nextMeta.operation_started_at;

                // 2. Update Journey
                await supabase.from('staff_journeys').update({
                    arrival_photo_url: publicUrl,
                    arrival_photo_taken_at: timestamp,
                    arrival_photo_taken_by: userId,
                    mission_state: 'ARRIVAL_PHOTO_DONE', // or straight to OPERATION?
                    meta: nextMeta,
                    updated_at: timestamp
                }).eq('id', journeyId);

                // 3. Log Event
                await supabase.from('staff_events').insert({
                    journey_id: journeyId,
                    type: 'ARRIVAL_FACADE_PHOTO_TAKEN',
                    actor_user_id: userId,
                    payload: { url: publicUrl }
                });

                onComplete?.();
            } catch (error) {
                console.error('Upload failed, keeping offline', error);
                saveOffline(filename, timestamp);
            }
        } else {
            saveOffline(filename, timestamp);
        }
    };

    const saveOffline = (filename, timestamp) => {
        // Save to offline queue
        const reader = new FileReader();
        reader.readAsDataURL(compressedFile);
        reader.onload = (e) => {
            const base64 = e.target.result;
            saveOfflineEvent({
                type: 'ARRIVAL_FACADE_PHOTO_TAKEN',
                journey_id: journeyId,
                payload: { filename, imageBase64: base64 }, // Store base64 for later upload
                actor_user_id: userId
            });
            onComplete?.(true); // true = offline mode
        };
    };

    if (preview) {
        return (
            <div className="space-y-4">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <img src={preview} alt="Fachada" className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { setPreview(null); setCompressedFile(null); }}
                        className="flex-1 py-3 border border-slate-300 rounded-xl font-bold text-slate-600"
                    >
                        Retomar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={uploading}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                    >
                        {uploading ? <RefreshCw className="animate-spin" /> : <CheckCircle />}
                        {uploading ? 'Guardando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-center space-y-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-500">
                <Camera size={32} />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">Foto de Fachada</h3>
            <p className="text-slate-500 text-sm">Toma una foto clara de la entrada de la escuela para confirmar llegada.</p>

            <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />

            <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200"
            >
                Abrir Cámara
            </button>
            {!navigator.onLine && (
                <div className="text-xs text-amber-600 flex items-center justify-center gap-1">
                    <WifiOff size={12} /> Modo Offline: La foto se guardará localmente.
                </div>
            )}
        </div>
    );
}
