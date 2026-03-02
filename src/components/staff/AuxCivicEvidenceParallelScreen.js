'use client';

import { useEffect, useState, useMemo } from 'react';
import { Loader2, Radio, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';

// ── Tiny inline notification beep (440Hz sine, 0.15s, 44.1kHz mono WAV) ──
const NOTIFICATION_BEEP_B64 = (() => {
    if (typeof window === 'undefined') return '';
    try {
        const sampleRate = 44100;
        const duration = 0.15;
        const freq = 880;
        const numSamples = Math.floor(sampleRate * duration);
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);
        const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + numSamples * 2, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeStr(36, 'data');
        view.setUint32(40, numSamples * 2, true);
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const envelope = Math.min(1, (duration - t) * 15); // fast fade-out
            const sample = Math.sin(2 * Math.PI * freq * t) * 0.35 * envelope;
            view.setInt16(44 + i * 2, sample * 32767, true);
        }
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return 'data:audio/wav;base64,' + btoa(binary);
    } catch { return ''; }
})();

function playNotificationBeep() {
    try {
        if (!NOTIFICATION_BEEP_B64) return;
        const audio = new Audio(NOTIFICATION_BEEP_B64);
        audio.volume = 0.5;
        audio.play().catch(() => { });
    } catch { }
}

export default function AuxCivicEvidenceParallelScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh,
    onBackToTask
}) {
    const [isFinishing, setIsFinishing] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [finishError, setFinishError] = useState('');

    const meta = parseMeta(missionInfo?.meta);
    const roleName = profile?.role ? (ROLE_LABELS[profile.role] || profile.role) : '';

    const teacherName = useMemo(() => {
        const fullName = missionInfo?.teacher_name || '';
        return fullName.split(/\s+/)[0] || 'el Docente';
    }, [missionInfo?.teacher_name]);

    // ── Action Phase: Aggressive attention grab on mount ──
    useEffect(() => {
        // Strong vibration
        if (navigator.vibrate) {
            navigator.vibrate([300, 100, 300, 100, 300]);
        }
        // 3x sequential beeps
        let count = 0;
        const interval = setInterval(() => {
            if (count >= 3) { clearInterval(interval); return; }
            playNotificationBeep();
            count++;
        }, 600);
        return () => clearInterval(interval);
    }, []);

    const updateJourneyMeta = async (patch) => {
        const supabase = createClient();
        const currentMeta = parseMeta(missionInfo?.meta);
        const nextMeta = { ...currentMeta, ...patch };

        const { error } = await supabase
            .from('staff_journeys')
            .update({ meta: nextMeta, updated_at: new Date().toISOString() })
            .eq('id', journeyId);

        if (error) throw error;
    };

    const handleFinishRecording = async () => {
        if (isFinishing || isFinished) return;
        setIsFinishing(true);
        setFinishError('');

        try {
            const now = new Date().toISOString();
            await updateJourneyMeta({
                civic_parallel_aux_status: 'uploaded',
                civic_parallel_aux_done_at: now,
                civic_parallel_aux_finished_by: userId,
                civic_parallel_aux_recording_method: 'dji_osmo'
            });
            setIsFinished(true);

            // Brief delay to show success state, then return
            setTimeout(() => {
                if (onBackToTask) onBackToTask();
            }, 800);
        } catch (error) {
            console.error('Error finalizando tarea de grabación:', error);
            setFinishError('No se pudo finalizar. Intenta nuevamente.');
        } finally {
            setIsFinishing(false);
        }
    };

    return (
        <div className="min-h-dvh flex flex-col bg-slate-50">

            <SyncHeader
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionInfo={missionInfo}
                missionState={missionState}
                onRefresh={onRefresh}
                roleName={roleName}
                chipOverride="Evidencia"
                hideTeacherCivicFab={true}
            />

            {/* ── Main Content ── */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-48 pt-8">

                {/* Card */}
                <div className="w-full max-w-sm rounded-3xl bg-white border border-gray-100 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.08)] overflow-hidden"
                    style={{ animation: 'fadeInUp 0.4s ease-out' }}>

                    {/* Top accent bar */}
                    <div className="h-1 bg-gradient-to-r from-blue-500 via-blue-400 to-sky-400" />

                    {/* Card content */}
                    <div className="p-7 flex flex-col items-center">

                        {/* Camera icon */}
                        <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
                            <Radio size={36} className="text-blue-600" strokeWidth={2} />
                        </div>

                        {/* Recording indicator — iOS-style */}
                        <div className="inline-flex items-center gap-2.5 rounded-full bg-red-50 border border-red-100 px-4 py-2 mb-5">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                            </span>
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-red-700">
                                Grabación en progreso
                            </span>
                        </div>

                        {/* Title */}
                        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight text-center mb-2">
                            Grabación con DJI Osmo
                        </h2>

                        {/* Description */}
                        <p className="text-sm text-gray-500 text-center leading-relaxed mb-6">
                            Enfoca a <strong className="text-slate-700">{teacherName}</strong> durante el acto cívico.
                            La grabación se realiza con la cámara DJI Osmo.
                        </p>

                        {/* Info tip */}
                        <div className="w-full rounded-xl bg-blue-50 border border-blue-100 p-4 flex items-start gap-3">
                            <span className="material-symbols-outlined shrink-0 mt-0.5" style={{ fontSize: 18, color: '#2563EB', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>info</span>
                            <p className="m-0 text-[13px] text-blue-800 leading-snug">
                                Presiona <strong>"Finalizar"</strong> cuando {teacherName} termine el acto cívico.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Sticky Bottom ── */}
            <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-slate-50 via-slate-50/95 to-transparent"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
                <div className="max-w-sm mx-auto px-6 pt-6">

                    {/* Error */}
                    {finishError && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3 mb-3 text-center">
                            <p className="m-0 text-sm font-bold text-red-700">{finishError}</p>
                        </div>
                    )}

                    {/* Finish button — Primary Blue */}
                    <button
                        onClick={handleFinishRecording}
                        disabled={isFinishing || isFinished}
                        className={`w-full transition-all font-semibold py-4 rounded-xl flex items-center justify-center gap-2.5 text-base ${isFinished
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-lg shadow-blue-500/30'
                            }`}
                        style={{ opacity: isFinishing ? 0.65 : 1 }}
                    >
                        {isFinishing ? (
                            <><Loader2 size={17} className="animate-spin" /> Finalizando...</>
                        ) : isFinished ? (
                            <><CheckCircle2 size={17} /> ¡Tarea completada!</>
                        ) : (
                            <>
                                <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1, 'wght' 500" }}>stop_circle</span>
                                Finalizar Tarea de Grabación
                            </>
                        )}
                    </button>

                    {/* Back to task */}
                    {!isFinished && (
                        <button
                            onClick={onBackToTask}
                            className="mt-2.5 w-full py-3 rounded-xl border border-gray-200 bg-white text-gray-500 font-semibold text-[13px] hover:bg-gray-50 transition-colors"
                        >
                            Volver a mi tarea
                        </button>
                    )}
                </div>
            </div>

            <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
    );
}
