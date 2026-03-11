'use client';

// =====================================================
// ClosureLegacy.js
// Wrapper del cierre de misión original como componente
// reutilizable para integrar en el stepper.
// =====================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, Camera, Send, Check } from 'lucide-react';
import { syncMissionClosure, syncAllPendingFlights, syncAllPendingPauses } from '@/utils/staff/sync';
import SignaturePad from '@/components/staff/SignaturePad';
import DailyImpactReport from '@/components/staff/DailyImpactReport';

export default function ClosureLegacy({ journeyId, onComplete, preview = false }) {
    const router = useRouter();
    const [stats, setStats] = useState({ flights: [], totalStudents: 0, totalDuration: 0 });
    const [checks, setChecks] = useState({ gear: false, zone: false, battery: false });
    const [photo, setPhoto] = useState(null);
    const [signature, setSignature] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [missionId, setMissionId] = useState(null);

    useEffect(() => {
        const logs = JSON.parse(localStorage.getItem('flyhigh_flight_logs') || '[]');
        const currentMission = JSON.parse(localStorage.getItem('flyhigh_staff_mission') || '{}');
        const mid = String(currentMission.id || '');
        const jid = String(currentMission.journey_id || currentMission.journeyId || '');

        // [BUG-FIX] Filter logs by mission_id or journey_id to get correct stats
        const missionLogs = logs.filter(log => {
            const logMid = String(log.mission_id || '');
            const logJid = String(log.journey_id || '');
            if (mid && logMid === mid) return true;
            if (jid && (logJid === jid || logMid === jid)) return true;
            return false;
        });
        const filtered = missionLogs.length > 0 ? missionLogs : logs;
        const totalStudents = filtered.reduce((acc, log) => acc + (log.studentCount || 0), 0);
        const totalDuration = filtered.reduce((acc, log) => acc + (log.durationSeconds || 0), 0);

        setStats({ flights: filtered, totalStudents, totalDuration });
        setMissionId(currentMission.id);
    }, []);

    const toggleCheck = (key) => setChecks(prev => ({ ...prev, [key]: !prev[key] }));

    const handlePhotoCapture = (e) => {
        if (preview) return; // Preview: no capturar fotos
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => setPhoto(ev.target.result);
            reader.readAsDataURL(file);
        }
    };

    const handleFinishMission = async () => {
        if (preview) {
            alert('Preview: Esta acción no se ejecuta en modo preview.');
            return;
        }
        if (!confirm("¿Confirmar cierre de misión? Esta acción no se puede deshacer.")) return;

        setSubmitting(true);

        const currentMission = JSON.parse(localStorage.getItem('flyhigh_staff_mission') || '{}');

        const closureData = {
            mission_id: currentMission.id,
            journey_id: currentMission.journey_id || currentMission.journeyId || null,
            stats: stats,
            checklistVerified: Object.values(checks).every(Boolean),
            photo: photo,
            signature: signature,
            mission: currentMission,
            school_id: /^\d+$/.test(String(currentMission.id || '')) ? Number(currentMission.id) : null,
            school_name_snapshot: currentMission.school_name || currentMission.nombre_escuela || null,
            mission_datetime: new Date().toISOString()
        };

        const flightSyncResult = await syncAllPendingFlights();
        console.log("Pre-closure flight sync:", flightSyncResult);

        const pauseSyncResult = await syncAllPendingPauses(currentMission.id);
        console.log("Pre-closure pause sync:", pauseSyncResult);

        const result = await syncMissionClosure(closureData);

        if (result.success) {
            localStorage.removeItem('flyhigh_selected_mission_id');
            localStorage.removeItem('flyhigh_flight_logs');
            localStorage.removeItem('flyhigh_staff_mission');
            localStorage.removeItem('flyhigh_completed_pauses');
            localStorage.removeItem('flyhigh_active_pause');
            localStorage.removeItem('flyhigh_active_flight');
            setShowReport(true);
        } else {
            alert(`Error al sincronizar: ${result.error || 'Intenta nuevamente.'}`);
        }
        setSubmitting(false);
    };

    const allChecks = Object.values(checks).every(Boolean);
    const canSubmit = allChecks && signature && photo;

    if (showReport) {
        return <DailyImpactReport missionId={missionId} journeyId={journeyId} onExit={() => {
            if (onComplete) onComplete();
            else router.push('/staff/dashboard');
        }} />;
    }

    return (
        <div className="space-y-8 animate-in slide-in-from-right-8 duration-300">
            <h2 className="text-2xl font-bold text-slate-900">Cierre de Misión</h2>

            {/* Summary Card */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-xl">
                <h3 className="text-sm tracking-widest text-slate-400 uppercase font-bold mb-4">Resumen del Día</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div className="text-3xl font-bold">{stats.flights.length}</div>
                        <div className="text-xs text-slate-400">Vuelos</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold">{stats.totalStudents}</div>
                        <div className="text-xs text-slate-400">Niños Impactados</div>
                    </div>
                    <div>
                        <div className="text-3xl font-bold">{Math.floor(stats.totalDuration / 60)}</div>
                        <div className="text-xs text-slate-400">Minutos Totales</div>
                    </div>
                </div>
            </div>

            {/* Safety Checklist */}
            <div className="space-y-3">
                <h3 className="font-bold text-slate-900 flex items-center gap-2"><CheckSquare size={18} /> Protocolo de Seguridad</h3>
                {[
                    { key: 'gear', label: 'Equipo guardado y completo' },
                    { key: 'zone', label: 'Zona limpia y ordenada' },
                    { key: 'battery', label: 'Baterías en modo almacenamiento' }
                ].map((item) => (
                    <label key={item.key} className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-blue-50 transition-colors">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${checks[item.key] ? 'bg-blue-500 border-blue-500' : 'border-slate-300'}`}>
                            {checks[item.key] && <Check size={14} className="text-white" />}
                        </div>
                        <span className="text-slate-700 font-medium">{item.label}</span>
                        <input type="checkbox" className="hidden" checked={checks[item.key]} onChange={() => toggleCheck(item.key)} />
                    </label>
                ))}
            </div>

            {/* Evidence & Signature */}
            <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                    <label className="font-bold text-slate-900 flex items-center gap-2"><Camera size={18} /> Foto Grupal / Despedida</label>
                    <div className="relative h-40 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-colors">
                        {photo ? (
                            <img src={photo} className="w-full h-full object-cover" alt="Despedida" />
                        ) : (
                            <div className="text-slate-400 text-center">
                                <Camera className="mx-auto mb-2" />
                                <span className="text-xs">Tocar para capturar</span>
                            </div>
                        )}
                        <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handlePhotoCapture} />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="font-bold text-slate-900">Firma del Responsable</label>
                    <SignaturePad onEnd={setSignature} />
                </div>
            </div>

            {/* Final Action */}
            <div className="pt-4 pb-10">
                <button
                    onClick={handleFinishMission}
                    disabled={preview || !canSubmit || submitting}
                    className={`w-full py-4 ${preview ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg ${preview ? 'shadow-amber-500/30' : 'shadow-blue-500/30'} flex items-center justify-center gap-2 transition-all`}
                >
                    {submitting ? 'Sincronizando...' : 'CONFIRMAR CIERRE DE MISIÓN'}
                    {!submitting && <Send size={18} />}
                </button>
            </div>
        </div>
    );
}
