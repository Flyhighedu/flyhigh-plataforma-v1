'use client';

// =====================================================
// SupervisorBitacoraScreen.js
// Pantalla de operación para el Supervisor (Teacher/Docente).
// Muestra el Master Wizard de operación guiada continua.
//
// SAFETY: Componente puro. No modifica mission_state.
// Escribe solo en meta con prefijo escuadron_*.
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { META_KEYS, PREFLIGHT_TIMER_SECONDS } from '@/config/escuadronConfig';
import { atomicMetaUpdate, parseMeta } from '@/utils/metaHelpers';
import SyncHeader from '@/components/staff/SyncHeader';
import ContingencyBypassMenu from '@/components/staff/ContingencyBypassMenu';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import useAudioRecorder from '@/hooks/useAudioRecorder';
import IdentityScanner from '@/components/staff/IdentityScanner';
import SquadronCalculator from '@/components/staff/SquadronCalculator';
import { triggerAudioAudit } from '@/utils/triggerAudioAudit';
import { Rocket, Send, ChevronRight, CheckCircle2, Mic, Zap, AlertTriangle, Radio } from 'lucide-react';

export default function SupervisorBitacoraScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    // Master Wizard State
    const [masterStep, setMasterStep] = useState('idle'); // 'idle' | 'scanner' | 'calculator' | 'review'
    
    // Data States
    const [nombreClave, setNombreClave] = useState('');
    const [destinos, setDestinos] = useState('');
    const [destinoPersonalizado, setDestinoPersonalizado] = useState('');
    const [ruta, setRuta] = useState(null);
    
    // UI & Modal States
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [bitacoraHistory, setBitacoraHistory] = useState([]);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [calcOpen, setCalcOpen] = useState(false);
    const [navExpanded, setNavExpanded] = useState(false);
    
    // Timer & Recording States
    const [timerSeconds, setTimerSeconds] = useState(PREFLIGHT_TIMER_SECONDS);
    const [timerRunning, setTimerRunning] = useState(false);
    const timerRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState(null);

    // AI Quality Monitoring — feedback toast state
    const [qaFeedback, setQaFeedback] = useState(null);
    const qaFeedbackTimerRef = useRef(null);

    // Audio recording (mission telemetry)
    const {
        isSupported: micSupported,
        isRecording: micRecording,
        durationSeconds: recDuration,
        permissionState: micPermission,
        startRecording,
        stopRecording
    } = useAudioRecorder();

    const firstName = profile?.full_name?.split(' ')[0] || 'Supervisor';
    const roleName = ROLE_LABELS[profile?.role] || 'Supervisor';

    // Load existing bitácoras from meta/localStorage
    useEffect(() => {
        try {
            const meta = parseMeta(missionInfo?.meta);
            const history = meta?.[META_KEYS.BITACORA_HISTORY];
            if (Array.isArray(history) && history.length > 0) {
                setBitacoraHistory(history);
                return;
            }
        } catch { /* ignore */ }

        // Fallback to localStorage
        try {
            const localKey = `flyhigh_escuadron_bitacora_${journeyId || 'local'}`;
            const local = JSON.parse(localStorage.getItem(localKey) || '[]');
            if (Array.isArray(local)) setBitacoraHistory(local);
        } catch { /* ignore */ }
    }, [missionInfo?.meta, journeyId]);

    // Timer logic
    useEffect(() => {
        if (!timerRunning) return;
        timerRef.current = setInterval(() => {
            setTimerSeconds(prev => {
                if (prev <= 1) {
                    setTimerRunning(false);
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [timerRunning]);

    // MASTER FLOW: Start
    const handleStartMasterFlow = useCallback(() => {
        // Reset old data
        setNombreClave('');
        setDestinos('');
        setDestinoPersonalizado('');
        setRuta(null);
        setSaved(false);
        setUploadedUrl(null);

        // Go to tanda prep first (timer & mic start AFTER this step)
        setMasterStep('prep_tanda');
    }, []);

    // Called when teacher confirms tanda is ready
    const handleTandaReady = useCallback(async () => {
        // NOW start Timer & Audio
        setTimerSeconds(PREFLIGHT_TIMER_SECONDS);
        setTimerRunning(true);
        if (micSupported && !micRecording) {
            try { await startRecording(); } catch (err) { console.warn('⚠️ Mic auto-start failed:', err); }
        }
        setMasterStep('intro_scanner');
    }, [micSupported, micRecording, startRecording]);

    // MASTER FLOW: End & Save
    const handleSaveBitacora = useCallback(async () => {
        if (!nombreClave.trim() || isSaving) return;
        setIsSaving(true);

        const flightNumber = bitacoraHistory.length + 1;
        const bitacoraEntry = {
            flightNumber,
            nombreClave: nombreClave.trim(),
            destinos: destinos.trim() || null,
            destinoPersonalizado: destinoPersonalizado.trim() || null,
            ruta: ruta || null,
            timestamp: new Date().toISOString()
        };

        try {
            if (journeyId) {
                await atomicMetaUpdate(journeyId, {
                    [META_KEYS.BITACORA_CURRENT]: bitacoraEntry,
                    [META_KEYS.BITACORA_HISTORY]: [...bitacoraHistory, bitacoraEntry]
                });
            }

            // Save locally
            try {
                const localKey = `flyhigh_escuadron_bitacora_${journeyId || 'local'}`;
                const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
                existing.push(bitacoraEntry);
                localStorage.setItem(localKey, JSON.stringify(existing));
            } catch { /* non-blocking */ }

            setBitacoraHistory(prev => [...prev, bitacoraEntry]);
            setSaved(true);

            // Stop Timer & Mic
            setTimerRunning(false);
            clearInterval(timerRef.current);
            if (micRecording) {
                try {
                    const blob = await stopRecording();
                    if (blob && blob.size > 0) uploadTelemetry(blob);
                } catch (err) { console.warn('⚠️ Mic stop failed:', err); }
            }

            // Return to IDLE
            setTimeout(() => {
                setMasterStep('idle');
                setNombreClave('');
                setDestinos('');
                setDestinoPersonalizado('');
                setRuta(null);
                setSaved(false);
                setTimerSeconds(PREFLIGHT_TIMER_SECONDS);
            }, 1500);

        } catch (err) {
            console.warn('⚠️ Bitácora save failed:', err);
            alert('No se pudo guardar. Comunica los datos verbalmente al Piloto.');
        } finally {
            setIsSaving(false);
        }
    }, [nombreClave, destinos, destinoPersonalizado, ruta, journeyId, bitacoraHistory, isSaving, micRecording, stopRecording]);

    // Upload telemetry audio to server
    const uploadTelemetry = useCallback(async (blob) => {
        if (!blob || !journeyId) return;
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('audio', blob, 'telemetry.webm');
            formData.append('journeyId', journeyId);
            formData.append('flightNumber', String(bitacoraHistory.length + 1));
            formData.append('userId', userId || '');
            formData.append('durationSeconds', String(recDuration));
            formData.append('source', 'bitacora');

            const res = await fetch('/api/staff/upload-telemetry', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.ok && data.url) {
                setUploadedUrl(data.url);

                const currentFlightNumber = bitacoraHistory.length + 1;

                // 📎 Link audioUrl back into the bitácora history entry (non-blocking)
                try {
                    if (journeyId) {
                        const supabaseClient = (await import('@/utils/supabase/client')).createClient();
                        const { data: journeyRow } = await supabaseClient
                            .from('staff_journeys')
                            .select('meta')
                            .eq('id', journeyId)
                            .single();
                        
                        let currentMeta = {};
                        try {
                            currentMeta = typeof journeyRow?.meta === 'string'
                                ? JSON.parse(journeyRow.meta)
                                : (journeyRow?.meta || {});
                        } catch { currentMeta = {}; }

                        const history = Array.isArray(currentMeta.escuadron_bitacora_history)
                            ? [...currentMeta.escuadron_bitacora_history]
                            : [];
                        
                        const idx = history.findIndex(h => h.flightNumber === currentFlightNumber);
                        if (idx >= 0) {
                            history[idx] = {
                                ...history[idx],
                                audioUrl: data.url,
                                audioDurationSeconds: recDuration,
                                audioSizeKB: data.fileSizeKB || 0
                            };
                            await atomicMetaUpdate(journeyId, {
                                escuadron_bitacora_history: history
                            });
                        }
                    }
                } catch (err) {
                    console.warn('⚠️ Failed to link audioUrl to bitácora entry (non-blocking):', err);
                }

                // 🧠 AI Quality Audit — fire-and-forget (never blocks ISA)
                triggerAudioAudit({
                    audioUrl: data.url,
                    journeyId,
                    flightNumber: currentFlightNumber,
                    source: 'bitacora',
                    userId,
                    durationSeconds: recDuration,
                    onFeedback: ({ score, feedback, strikes }) => {
                        setQaFeedback({ score, feedback, strikes });
                        
                        // Save results to local history for averages
                        setBitacoraHistory(prev => {
                            const updated = prev.map(entry => {
                                if (entry.flightNumber === currentFlightNumber) {
                                    return { ...entry, score, strikes };
                                }
                                return entry;
                            });
                            try {
                                const localKey = `flyhigh_escuadron_bitacora_${journeyId || 'local'}`;
                                localStorage.setItem(localKey, JSON.stringify(updated));
                            } catch {}
                            return updated;
                        });
                    }
                });
            }
        } catch (err) {
            console.warn('⚠️ Telemetry upload error:', err);
        } finally {
            setIsUploading(false);
        }
    }, [journeyId, bitacoraHistory.length, userId, recDuration]);

    // ── WIZARD STEP DEFINITIONS ──
    const WIZARD_STEPS = ['idle', 'prep_tanda', 'intro_scanner', 'scanner', 'calculator', 'briefing_final'];
    const WIZARD_LABELS = {
        'idle': 'Inicio',
        'prep_tanda': '👥 Prepara Tanda',
        'intro_scanner': 'Intro Dinámica',
        'scanner': '✋ Votación de Nombre',
        'calculator': '🗺️ Destinos + Lugar Especial',
        'briefing_final': '📣 Briefing'
    };
    const currentStepIndex = WIZARD_STEPS.indexOf(masterStep);

    // ── Navigate to a specific step ──
    const goToStep = useCallback((step) => {
        // First: close all overlays
        setScannerOpen(false);
        setCalcOpen(false);
        setMasterStep(step);
        
        // Then: open the correct overlay after a tick so React processes the close
        if (step === 'scanner') {
            setTimeout(() => setScannerOpen(true), 50);
        } else if (step === 'calculator') {
            setTimeout(() => setCalcOpen(true), 50);
        }
        
        // If going into wizard from idle, start timer & mic
        if (step !== 'idle' && !timerRunning) {
            setTimerSeconds(PREFLIGHT_TIMER_SECONDS);
            setTimerRunning(true);
            if (micSupported && !micRecording) {
                try { startRecording(); } catch { /* non-blocking */ }
            }
        }
    }, [timerRunning, micSupported, micRecording, startRecording]);

    const goNext = useCallback(() => {
        const nextIdx = Math.min(currentStepIndex + 1, WIZARD_STEPS.length - 1);
        goToStep(WIZARD_STEPS[nextIdx]);
    }, [currentStepIndex, goToStep]);

    const goPrev = useCallback(() => {
        const prevIdx = Math.max(currentStepIndex - 1, 0);
        goToStep(WIZARD_STEPS[prevIdx]);
    }, [currentStepIndex, goToStep]);

    // ── ABORT & RESTART: Salida rápida del wizard ──
    const resetWizard = useCallback(() => {
        setTimerRunning(false);
        clearInterval(timerRef.current);
        setTimerSeconds(PREFLIGHT_TIMER_SECONDS);
        if (micRecording) {
            try { stopRecording(); } catch { /* non-blocking */ }
        }
        setScannerOpen(false);
        setCalcOpen(false);
        setNavExpanded(false);
        setNombreClave('');
        setDestinos('');
        setDestinoPersonalizado('');
        setRuta(null);
        setSaved(false);
        setUploadedUrl(null);
        setMasterStep('idle');
    }, [micRecording, stopRecording]);

    const formatTimer = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };
    const timerProgress = ((PREFLIGHT_TIMER_SECONDS - timerSeconds) / PREFLIGHT_TIMER_SECONDS) * 100;
    const showTimerSection = masterStep !== 'idle';

    const activeFlightNumber = missionState?.active_flight_number || 1;
    const equipoEnVuelo = bitacoraHistory.find(b => Number(b.flightNumber) === Number(activeFlightNumber));
    const equipoEnVueloName = equipoEnVuelo ? equipoEnVuelo.nombreClave : 'el equipo anterior';

    return (
        <div className="min-h-screen bg-slate-50 pb-4 flex flex-col">
            {/* Sync Header */}
            <ContingencyBypassMenu
                journeyId={journeyId}
                userId={userId}
                profile={profile}
                missionState={missionState}
                onRefresh={onRefresh}
            >
                <SyncHeader
                    avatarConfig={profile?.avatar_config}
                    firstName={firstName}
                    roleName={roleName}
                    role={profile?.role}
                    journeyId={journeyId}
                    userId={userId}
                    missionInfo={missionInfo}
                    missionState={missionState}
                    onDemoStart={onRefresh}
                />
            </ContingencyBypassMenu>

            <div className="px-4 py-4 flex-1 flex flex-col max-w-lg mx-auto w-full">
                {/* ── COLLAPSIBLE FLOATING NAV FAB (above ALL overlays) ── */}
                {masterStep !== 'idle' && (
                    <div style={{
                        position: 'fixed', bottom: 20, right: 16,
                        zIndex: 100000,
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                        {/* Expanded panel */}
                        {navExpanded && (
                            <div style={{
                                background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: 20, padding: '12px',
                                boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                                display: 'flex', flexDirection: 'column', gap: 8,
                                minWidth: 200,
                                animation: 'navSlideUp 0.2s ease-out'
                            }}>
                                {/* Step label */}
                                <div style={{ textAlign: 'center', padding: '2px 0 6px' }}>
                                    <p style={{ fontSize: 9, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
                                        Paso {currentStepIndex} de {WIZARD_STEPS.length - 1}
                                    </p>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0', margin: '2px 0 0' }}>
                                        {WIZARD_LABELS[masterStep]}
                                    </p>
                                </div>

                                {/* Navigation arrows row */}
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                        onClick={() => { goPrev(); }}
                                        disabled={currentStepIndex <= 1}
                                        style={{
                                            flex: 1, height: 44, borderRadius: 12,
                                            border: 'none', background: currentStepIndex <= 1 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)',
                                            color: currentStepIndex <= 1 ? '#475569' : '#fff',
                                            fontSize: 16, fontWeight: 900,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: currentStepIndex <= 1 ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.15s'
                                        }}
                                    >← Atrás</button>
                                    <button
                                        onClick={() => { goNext(); }}
                                        disabled={currentStepIndex >= WIZARD_STEPS.length - 1}
                                        style={{
                                            flex: 1, height: 44, borderRadius: 12,
                                            border: 'none', background: currentStepIndex >= WIZARD_STEPS.length - 1 ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.3)',
                                            color: currentStepIndex >= WIZARD_STEPS.length - 1 ? '#475569' : '#A5B4FC',
                                            fontSize: 16, fontWeight: 900,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: currentStepIndex >= WIZARD_STEPS.length - 1 ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.15s'
                                        }}
                                    >Sig →</button>
                                </div>

                                {/* Exit button */}
                                <button
                                    onClick={resetWizard}
                                    style={{
                                        width: '100%', height: 40, borderRadius: 12,
                                        border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239, 68, 68, 0.12)',
                                        color: '#FCA5A5', fontSize: 12, fontWeight: 800,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        cursor: 'pointer', transition: 'all 0.15s',
                                        textTransform: 'uppercase', letterSpacing: '0.05em'
                                    }}
                                >✕ Salir al Inicio</button>
                            </div>
                        )}

                        {/* FAB toggle button (always visible) */}
                        <button
                            onClick={() => setNavExpanded(prev => !prev)}
                            style={{
                                width: 52, height: 52, borderRadius: 16,
                                border: '2px solid rgba(255,255,255,0.2)',
                                background: navExpanded 
                                    ? 'linear-gradient(135deg, #4F46E5, #7C3AED)' 
                                    : 'linear-gradient(135deg, #1E293B, #0F172A)',
                                color: 'white',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                                cursor: 'pointer',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                transition: 'all 0.2s',
                                position: 'relative'
                            }}
                        >
                            <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1 }}>
                                {navExpanded ? '▼' : `${currentStepIndex}`}
                            </span>
                            {!navExpanded && (
                                <span style={{ fontSize: 7, fontWeight: 800, color: '#94A3B8', lineHeight: 1 }}>
                                    /{WIZARD_STEPS.length - 1}
                                </span>
                            )}
                        </button>
                    </div>
                )}
                {/* Timer Section (Solo visible durante el wizard) */}
                {showTimerSection && (
                    <section style={{
                        position: 'absolute', top: 16, right: 16, zIndex: 50,
                        background: timerSeconds === 0 ? '#DCFCE7' : timerSeconds <= 30 ? '#FEE2E2' : '#FEF3C7',
                        border: `2px solid ${timerSeconds === 0 ? '#22C55E' : timerSeconds <= 30 ? '#EF4444' : '#FCD34D'}`,
                        borderRadius: 100, padding: '8px 16px',
                        transition: 'all 0.3s ease',
                        animation: 'fadeIn 0.3s ease-out',
                        display: 'flex', alignItems: 'center', gap: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                        <span style={{ fontSize: 16 }}>{timerSeconds === 0 ? '🏁' : '⏱️'}</span>
                        <span style={{
                            fontSize: 16, fontWeight: 900,
                            color: timerSeconds === 0 ? '#16A34A' : timerSeconds <= 30 ? '#DC2626' : '#92400E',
                            fontVariantNumeric: 'tabular-nums'
                        }}>
                            {formatTimer(timerSeconds)}
                        </span>
                        {(micRecording || isUploading || uploadedUrl) && (
                            <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4, paddingLeft: 8, borderLeft: '1px solid rgba(0,0,0,0.1)' }}>
                                {isUploading ? <span style={{fontSize: 14}}>📤</span> : uploadedUrl ? <span style={{fontSize: 14}}>✅</span> : <span style={{width: 8, height: 8, borderRadius: '50%', background: '#EF4444', animation: 'recPulse 1.2s infinite'}}></span>}
                            </div>
                        )}
                    </section>
                )}

                {/* IDLE STATE: INICIAR Y REPASO DE HISTORIAL */}
                {masterStep === 'idle' && (
                    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                        <div style={{ marginBottom: 32 }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EDE9FE', padding: '5px 12px', borderRadius: 100, marginBottom: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    ⚡ Supervisor · El Activador
                                </span>
                            </div>
                            <h1 style={{ fontSize: 32, fontWeight: 900, color: '#0F172A', margin: '0 0 8px', lineHeight: 1.1 }}>
                                Central de<br/>Operaciones
                            </h1>
                            <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
                                Presiona el botón para iniciar con un grupo nuevo. Te guiaremos paso a paso automáticamente.
                            </p>
                        </div>

                        <button
                            onClick={handleStartMasterFlow}
                            style={{
                                width: '100%', padding: '24px', borderRadius: 24, border: 'none',
                                background: 'linear-gradient(135deg, #7C3AED, #5B21B6)', color: 'white',
                                fontSize: 20, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                                cursor: 'pointer', boxShadow: '0 20px 40px -10px rgba(124,58,237,0.5)',
                                transition: 'transform 0.2s'
                            }}
                            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <Rocket size={48} style={{ marginBottom: 8 }} />
                            INICIAR CON GRUPO
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#DDD6FE', textTransform: 'none', letterSpacing: '0' }}>
                                Inicia Timer · Activa Audio · Crea Plan
                            </span>
                        </button>

                        {/* AI Stats Summary */}
                        {(() => {
                            const entriesWithScore = bitacoraHistory.filter(e => e.score !== undefined);
                            if (entriesWithScore.length === 0) return null;
                            const avgScore = Math.round(entriesWithScore.reduce((sum, e) => sum + e.score, 0) / entriesWithScore.length);
                            const allStrikes = entriesWithScore.flatMap(e => e.strikes || []);
                            
                            return (
                                <div style={{ 
                                    background: 'linear-gradient(135deg, #1E293B, #0F172A)', 
                                    borderRadius: 24, padding: 20, marginTop: 32,
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    display: 'flex', gap: 20, alignItems: 'center',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                                }}>
                                    <div style={{
                                        width: 64, height: 64, borderRadius: '50%',
                                        background: avgScore >= 80 ? 'rgba(16, 185, 129, 0.1)' : avgScore >= 60 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                        border: `2px solid ${avgScore >= 80 ? '#10B981' : avgScore >= 60 ? '#FBBF24' : '#F87171'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <span style={{ fontSize: 24, fontWeight: 900, color: avgScore >= 80 ? '#10B981' : avgScore >= 60 ? '#FBBF24' : '#F87171' }}>
                                            {avgScore}
                                        </span>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 13, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px' }}>
                                            Score Promedio
                                        </p>
                                        <p style={{ fontSize: 14, color: '#E2E8F0', margin: 0, lineHeight: 1.4 }}>
                                            {allStrikes.length === 0 
                                                ? '¡Excelente dinámica! Sigue así.' 
                                                : `Has acumulado ${allStrikes.length} área${allStrikes.length === 1 ? '' : 's'} de mejora hoy.`}
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* History */}
                        {bitacoraHistory.length > 0 && (
                            <section style={{ marginTop: 40 }}>
                                <p style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
                                    Grupos Atendidos Hoy ({bitacoraHistory.length})
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {[...bitacoraHistory].reverse().map((entry, idx) => (
                                        <div key={idx} style={{ background: 'white', borderRadius: 16, border: '2px solid #E2E8F0', padding: '16px', display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F8FAFC', border: '2px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span style={{ fontSize: 16, fontWeight: 900, color: '#64748B' }}>#{entry.flightNumber}</span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    "{entry.nombreClave}"
                                                </p>
                                                {entry.destinoPersonalizado && (
                                                    <p style={{ fontSize: 13, color: '#7C3AED', fontWeight: 700, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        📍 {entry.destinoPersonalizado}
                                                    </p>
                                                )}
                                                {entry.destinos && (
                                                    <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        🗺️ {entry.destinos}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}

                {/* PREP TANDA: Separar a los niños */}
                {masterStep === 'prep_tanda' && (
                    <div style={{ animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 24px' }}>
                            {/* Big emoji icon */}
                            <div style={{
                                width: 88, height: 88, borderRadius: 28,
                                background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
                                border: '2px solid #FBBF24',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 44, marginBottom: 28,
                                boxShadow: '0 16px 32px rgba(251, 191, 36, 0.15)'
                            }}>
                                👥
                            </div>

                            {/* Badge */}
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#FFFBEB', padding: '6px 14px', borderRadius: 100, marginBottom: 16 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                    Antes de iniciar
                                </span>
                            </div>

                            <h2 style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', margin: '0 0 12px', lineHeight: 1.15 }}>
                                Separa a tu<br/>próxima tanda
                            </h2>

                            <p style={{ fontSize: 15, color: '#64748B', margin: '0 0 28px', lineHeight: 1.5, maxWidth: 320 }}>
                                Solo los niños que vayan a volar ahora deben tomar la dinámica.
                            </p>

                            {/* Visual hint cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 340 }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    background: '#F8FAFC', borderRadius: 16, padding: '14px 16px',
                                    border: '1px solid #E2E8F0'
                                }}>
                                    <span style={{ fontSize: 22 }}>🥽</span>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#334155', margin: 0, lineHeight: 1.4, textAlign: 'left' }}>
                                        Cuenta las gafas disponibles y separa a ese número de niños
                                    </p>
                                </div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    background: '#F8FAFC', borderRadius: 16, padding: '14px 16px',
                                    border: '1px solid #E2E8F0'
                                }}>
                                    <span style={{ fontSize: 22 }}>✋</span>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: '#334155', margin: 0, lineHeight: 1.4, textAlign: 'left' }}>
                                        Los demás esperan su turno aparte
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        {/* CTA Bottom */}
                        <div style={{ marginTop: 'auto', padding: '0 16px 24px' }}>
                            <button
                                onClick={handleTandaReady}
                                style={{
                                    width: '100%', padding: '20px', borderRadius: 20, border: 'none',
                                    background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'white',
                                    fontSize: 17, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                    cursor: 'pointer', boxShadow: '0 14px 28px rgba(245, 158, 11, 0.3)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                ¡Tanda lista para emocionar! 🚀
                            </button>
                            <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#94A3B8', marginTop: 10 }}>
                                El timer y la grabación iniciarán al continuar
                            </p>
                        </div>
                    </div>
                )}

                {/* INTRO: ESCÁNER DE IDENTIDAD */}
                {masterStep === 'intro_scanner' && (
                    <div style={{ animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 16px' }}>
                            {/* Icon Wrapper */}
                            <div style={{
                                width: 80, height: 80, borderRadius: 24,
                                background: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)',
                                border: '2px solid #BAE6FD',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 40, marginBottom: 24,
                                boxShadow: '0 12px 24px rgba(2, 132, 199, 0.1)'
                            }}>
                                📡
                            </div>
                            
                            {/* Title */}
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EFF6FF', padding: '6px 14px', borderRadius: 100, marginBottom: 16 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                    Fase Operativa 1
                                </span>
                            </div>
                            <h2 style={{ fontSize: 28, fontWeight: 900, color: '#0F172A', margin: '0 0 16px', lineHeight: 1.1 }}>
                                Escáner de<br/>Identidad
                            </h2>
                            
                            {/* Text / Briefing */}
                            <div style={{
                                background: '#F8FAFC', borderRadius: 20, padding: 20,
                                border: '1px solid #E2E8F0', width: '100%',
                                textAlign: 'left', marginBottom: 24
                            }}>
                                <p style={{ fontSize: 15, color: '#334155', lineHeight: 1.5, margin: '0 0 16px' }}>
                                    Es hora de darle un nombre al grupo. Para hacerlo, usaremos la <strong style={{color:'#0F172A'}}>Votación a Mano Alzada</strong>.
                                </p>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                                        <span style={{ fontSize: 12, color: '#2563EB', fontWeight: 800 }}>i</span>
                                    </div>
                                    <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.5, margin: 0 }}>
                                        Diles las dos opciones en pantalla y pídeles que levanten la mano para votar. Luego mantén presionado el nombre ganador durante 1 segundo.
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        {/* CTA Bottom */}
                        <div style={{ marginTop: 'auto', padding: '0 16px 24px' }}>
                            <button
                                onClick={() => {
                                    setMasterStep('scanner');
                                    setScannerOpen(true);
                                }}
                                style={{
                                    width: '100%', padding: '18px', borderRadius: 20, border: 'none',
                                    background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: 'white',
                                    fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                    cursor: 'pointer', boxShadow: '0 12px 24px rgba(37, 99, 235, 0.25)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                Iniciar Dinámica <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                )}



                {/* BRIEFING FINAL — MISIÓN ESPECIAL: ¡SUBE, SUBE! */}
                {masterStep === 'briefing_final' && (
                    <div style={{ animation: 'fadeIn 0.4s ease-out', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', backgroundColor: '#020617' }}>
                        
                        {/* ── ARCADE HERO HEADER ── */}
                        <div style={{
                            background: 'radial-gradient(circle at top, #312E81 0%, #020617 80%)',
                            borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
                            padding: '40px 20px 32px',
                            textAlign: 'center',
                            position: 'relative',
                            overflow: 'hidden',
                            boxShadow: '0 10px 40px rgba(79, 70, 229, 0.15)'
                        }}>
                            {/* Grid overlay for cyberpunk feel */}
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                backgroundImage: 'linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)',
                                backgroundSize: '20px 20px',
                                opacity: 0.3,
                                pointerEvents: 'none'
                            }} />

                            <div style={{ 
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 80, height: 80, 
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #4F46E5, #EC4899)',
                                marginBottom: 16, 
                                animation: 'heroFloat 3s ease-in-out infinite',
                                boxShadow: '0 0 30px rgba(236, 72, 153, 0.6)',
                                border: '3px solid rgba(255,255,255,0.2)'
                            }}>
                                <Zap size={40} color="white" fill="white" style={{ animation: 'pulseGlow 2s infinite' }} />
                            </div>

                            <p style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#F472B6', marginBottom: 8 }}>
                                Misión de Emergencia
                            </p>
                            <h2 style={{ fontSize: 32, fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-0.02em', textShadow: '0 4px 20px rgba(236, 72, 153, 0.8)' }}>
                                ¡ENERGÍA SÓNICA!
                            </h2>
                            <div style={{ marginTop: 12, display: 'inline-block', background: 'rgba(255,255,255,0.1)', padding: '6px 16px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.1)' }}>
                                <p style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 700, margin: 0 }}>
                                    Explica esto al <strong style={{ color: '#60A5FA' }}>Escuadrón {nombreClave}</strong>{destinoPersonalizado ? ` · 📍 ${destinoPersonalizado}` : ''}
                                </p>
                            </div>
                        </div>

                        {/* ── THE TELEPROMPTER (READ ALOUD) ── */}
                        <div style={{ padding: '24px 16px 0', position: 'relative', zIndex: 10 }}>
                            <div style={{
                                background: 'linear-gradient(180deg, #1E293B, #0F172A)',
                                border: '2px solid #3B82F6',
                                borderRadius: 24,
                                padding: '24px',
                                position: 'relative',
                                boxShadow: '0 10px 30px rgba(59, 130, 246, 0.2)'
                            }}>
                                <div style={{
                                    position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                                    background: 'linear-gradient(90deg, #2563EB, #3B82F6)', color: 'white',
                                    fontSize: 11, fontWeight: 900, padding: '8px 16px', borderRadius: 100,
                                    textTransform: 'uppercase', letterSpacing: '0.2em',
                                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.5)',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    whiteSpace: 'nowrap'
                                }}>
                                    <Mic size={14} /> LÉELES ESTO
                                </div>

                                <p style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC', lineHeight: 1.6, margin: '8px 0 0', textAlign: 'center' }}>
                                    "¡<span style={{ color: '#60A5FA', fontWeight: 900, textShadow: '0 0 10px rgba(96,165,250,0.5)' }}>Escuadrón {nombreClave}</span>!
                                </p>
                                <p style={{ fontSize: 18, fontWeight: 700, color: '#CBD5E1', lineHeight: 1.6, margin: '12px 0 0', textAlign: 'center' }}>
                                    El dron necesita de <strong style={{ color: '#F472B6', textShadow: '0 0 10px rgba(244,114,182,0.5)' }}>SU VOZ</strong> para volar.
                                </p>
                                <p style={{ fontSize: 18, fontWeight: 700, color: '#CBD5E1', lineHeight: 1.6, margin: '12px 0 0', textAlign: 'center' }}>
                                    ¡Si no lo ayudan, se va a caer!"
                                </p>
                            </div>
                        </div>

                        {/* ── GAME MECHANICS (TUTORIAL STEPS) ── */}
                        <div style={{ padding: '32px 16px 0' }}>
                            <p style={{ fontSize: 12, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 16, textAlign: 'center' }}>
                                Las Reglas del Juego
                            </p>

                            {/* Step 1: Trigger */}
                            <div style={{
                                background: 'rgba(30, 41, 59, 0.5)', borderRadius: 24, padding: '24px',
                                border: '1px solid rgba(255,255,255,0.05)', marginBottom: 16,
                                display: 'flex', gap: 20, alignItems: 'center'
                            }}>
                                <div style={{
                                    width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                                    background: 'rgba(59, 130, 246, 0.2)',
                                    border: '1px solid rgba(59, 130, 246, 0.5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#60A5FA'
                                }}>
                                    <Radio size={32} />
                                </div>
                                <div>
                                    <p style={{ fontSize: 15, fontWeight: 700, color: '#94A3B8', margin: 0 }}>Cuando escuchen:</p>
                                    <p style={{ fontSize: 22, fontWeight: 900, color: '#60A5FA', margin: '4px 0 0' }}>
                                        "¡SUBE, SUBE, SUBE!"
                                    </p>
                                </div>
                            </div>

                            {/* Step 2: Action */}
                            <div style={{
                                background: 'rgba(30, 41, 59, 0.5)', borderRadius: 24, padding: '24px',
                                border: '1px solid rgba(255,255,255,0.05)', marginBottom: 16,
                                display: 'flex', gap: 20, alignItems: 'center'
                            }}>
                                <div style={{
                                    width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                                    background: 'rgba(245, 158, 11, 0.2)',
                                    border: '1px solid rgba(245, 158, 11, 0.5)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#FBBF24',
                                    animation: 'pulseGlow 2s infinite'
                                }}>
                                    <Zap size={32} fill="#FBBF24" />
                                </div>
                                <div>
                                    <p style={{ fontSize: 15, fontWeight: 700, color: '#94A3B8', margin: 0 }}>Tienen que gritar:</p>
                                    <p style={{ fontSize: 26, fontWeight: 900, color: '#FBBF24', margin: '4px 0 0', textShadow: '0 0 12px rgba(245,158,11,0.5)' }}>
                                        "¡HASTA LAS NUBES!"
                                    </p>
                                </div>
                            </div>

                            {/* Step 3: Consequence */}
                            <div style={{
                                background: 'rgba(30, 41, 59, 0.5)', borderRadius: 24, padding: '24px',
                                border: '1px solid rgba(255,255,255,0.05)', marginBottom: 32,
                                display: 'flex', gap: 20, alignItems: 'center'
                            }}>
                                <div style={{
                                    width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#F87171'
                                }}>
                                    <AlertTriangle size={32} />
                                </div>
                                <div>
                                    <p style={{ fontSize: 15, fontWeight: 700, color: '#94A3B8', margin: 0 }}>Si no gritan duro...</p>
                                    <p style={{ fontSize: 20, fontWeight: 800, color: '#F87171', margin: '4px 0 0' }}>
                                        ¡El dron se apaga!
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ── CTA ── */}
                        <div style={{ marginTop: 'auto', padding: '0 16px 24px', position: 'relative', zIndex: 20 }}>
                            <button
                                onClick={handleSaveBitacora}
                                disabled={isSaving || saved}
                                style={{
                                    width: '100%', padding: '20px', borderRadius: 20, border: 'none',
                                    background: saved ? '#10B981' : 'linear-gradient(90deg, #4F46E5, #EC4899)',
                                    color: 'white', fontSize: 16, fontWeight: 900, textTransform: 'uppercase',
                                    letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                    cursor: isSaving || saved ? 'not-allowed' : 'pointer',
                                    boxShadow: saved ? '0 10px 25px rgba(16,185,129,0.4)' : '0 10px 30px rgba(236, 72, 153, 0.4)',
                                    transition: 'all 0.3s transform 0.1s',
                                    transform: isSaving ? 'scale(0.98)' : 'scale(1)'
                                }}
                            >
                                {isSaving ? 'Guardando...' : saved ? '✅ ¡Misión Iniciada!' : <><Send size={22} /> INICIAR MISIÓN</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* OVERLAYS DEL WIZARD */}

            {/* Fase 1: Identity Scanner Overlay */}
            <IdentityScanner
                isOpen={scannerOpen}
                timerSeconds={timerSeconds}
                usedNames={bitacoraHistory.map(h => h.nombreClave)}
                onResult={(name) => { 
                    setNombreClave(name); 
                    setScannerOpen(false); 
                    // Bypass Phase 2 Intro, jump straight into the Calculator dynamic
                    setMasterStep('calculator');
                    setCalcOpen(true);
                }}
                onClose={() => {
                    resetWizard();
                }}
            />

            {/* Fase 2: Squadron Calculator Overlay */}
            <SquadronCalculator
                isOpen={calcOpen}
                squadronName={nombreClave}
                timerSeconds={timerSeconds}
                onClose={() => {
                    resetWizard();
                }}
                onComplete={(plan) => {
                    setDestinos(plan.destinos || '');
                    setDestinoPersonalizado(plan.destinoPersonalizado || '');
                    setRuta(plan.routeId || null);
                    setCalcOpen(false);
                    setMasterStep('briefing_final');
                }}
            />

            {/* 🧠 AI Quality Modal — Premium presentation for Score, Strikes & Feedback */}
            {qaFeedback && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 20,
                    animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    <div style={{
                        background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 32,
                        width: '100%',
                        maxWidth: 400,
                        padding: 32,
                        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        <div style={{
                            width: 80, height: 80, borderRadius: '50%',
                            background: qaFeedback.score >= 80 ? 'rgba(16, 185, 129, 0.1)' : qaFeedback.score >= 60 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            border: `2px solid ${qaFeedback.score >= 80 ? '#10B981' : qaFeedback.score >= 60 ? '#FBBF24' : '#F87171'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: 20,
                            boxShadow: `0 0 30px ${qaFeedback.score >= 80 ? 'rgba(16, 185, 129, 0.3)' : qaFeedback.score >= 60 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                            <span style={{ fontSize: 32, fontWeight: 900, color: qaFeedback.score >= 80 ? '#10B981' : qaFeedback.score >= 60 ? '#FBBF24' : '#F87171' }}>
                                {qaFeedback.score}
                            </span>
                        </div>
                        
                        <h3 style={{ color: '#F8FAFC', fontSize: 24, fontWeight: 900, margin: '0 0 8px', textAlign: 'center' }}>
                            Reporte de IA
                        </h3>
                        <p style={{ color: '#94A3B8', fontSize: 15, margin: '0 0 24px', textAlign: 'center', lineHeight: 1.5 }}>
                            {qaFeedback.feedback}
                        </p>

                        {qaFeedback.strikes && qaFeedback.strikes.length > 0 && (
                            <div style={{ width: '100%', background: 'rgba(0,0,0,0.2)', borderRadius: 16, padding: 16, marginBottom: 24 }}>
                                <p style={{ color: '#F87171', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>
                                    Áreas de oportunidad ({qaFeedback.strikes.length})
                                </p>
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {qaFeedback.strikes.map((strike, i) => (
                                        <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                            <span style={{ color: '#F87171', fontSize: 16, lineHeight: 1 }}>✖</span>
                                            <span style={{ color: '#E2E8F0', fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{strike}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <button 
                            onClick={() => setQaFeedback(null)}
                            style={{
                                width: '100%', padding: '16px', borderRadius: 16, border: 'none',
                                background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
                                color: 'white', fontSize: 16, fontWeight: 800, textTransform: 'uppercase',
                                cursor: 'pointer', boxShadow: '0 8px 20px rgba(124, 58, 237, 0.4)'
                            }}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes recPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes navSlideUp {
                    from { opacity: 0; transform: translateY(12px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes heroFloat {
                    0%, 100% { transform: translateY(0) scale(1); }
                    50% { transform: translateY(-8px) scale(1.05); }
                }
                @keyframes pulseGlow {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.8; transform: scale(1.03); }
                }
                @keyframes barBounce {
                    0%, 100% { transform: scaleY(1); opacity: 0.85; }
                    50% { transform: scaleY(1.25); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
