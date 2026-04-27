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
import { Rocket, Send, User, ChevronRight, CheckCircle2 } from 'lucide-react';

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
    const [capitan, setCapitan] = useState('');
    const [destinos, setDestinos] = useState('');
    const [flightPlan, setFlightPlan] = useState(null);
    
    // UI & Modal States
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [bitacoraHistory, setBitacoraHistory] = useState([]);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [calcOpen, setCalcOpen] = useState(false);
    
    // Timer & Recording States
    const [timerSeconds, setTimerSeconds] = useState(PREFLIGHT_TIMER_SECONDS);
    const [timerRunning, setTimerRunning] = useState(false);
    const timerRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState(null);

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
    const handleStartMasterFlow = useCallback(async () => {
        // Reset old data
        setNombreClave('');
        setCapitan('');
        setDestinos('');
        setFlightPlan(null);
        setSaved(false);
        setUploadedUrl(null);

        // Start Timer & Audio
        setTimerSeconds(PREFLIGHT_TIMER_SECONDS);
        setTimerRunning(true);
        if (micSupported && !micRecording) {
            try { await startRecording(); } catch (err) { console.warn('⚠️ Mic auto-start failed:', err); }
        }

        // Advance to Phase 1 Intro
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
            capitan: capitan.trim() || null,
            destinos: destinos.trim() || null,
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
                setCapitan('');
                setDestinos('');
                setFlightPlan(null);
                setSaved(false);
                setTimerSeconds(PREFLIGHT_TIMER_SECONDS);
            }, 1500);

        } catch (err) {
            console.warn('⚠️ Bitácora save failed:', err);
            alert('No se pudo guardar. Comunica los datos verbalmente al Piloto.');
        } finally {
            setIsSaving(false);
        }
    }, [nombreClave, capitan, destinos, journeyId, bitacoraHistory, isSaving, micRecording, stopRecording]);

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

            const res = await fetch('/api/staff/upload-telemetry', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.ok && data.url) setUploadedUrl(data.url);
        } catch (err) {
            console.warn('⚠️ Telemetry upload error:', err);
        } finally {
            setIsUploading(false);
        }
    }, [journeyId, bitacoraHistory.length, userId, recDuration]);

    const formatTimer = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };
    const timerProgress = ((PREFLIGHT_TIMER_SECONDS - timerSeconds) / PREFLIGHT_TIMER_SECONDS) * 100;
    const showTimerSection = masterStep !== 'idle';

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
                {/* Timer Section (Solo visible durante el wizard) */}
                {showTimerSection && (
                    <section style={{
                        background: 'linear-gradient(135deg, #FEF3C7, #FFFBEB)',
                        border: `2px solid #FCD34D`,
                        borderRadius: 20, padding: '16px 18px',
                        transition: 'all 0.3s ease',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 18 }}>⏱️</span>
                                <div>
                                    <p style={{ fontSize: 12, fontWeight: 800, color: '#92400E', margin: 0 }}>Timer Pre-Vuelo</p>
                                    <p style={{ fontSize: 10, color: '#A16207', margin: 0 }}>Grabación de Telemetría Activa</p>
                                </div>
                            </div>
                        </div>

                        {/* Recording indicator */}
                        {micRecording && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', animation: 'recPulse 1.2s infinite' }} />
                                <span style={{ fontSize: 10, fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    Grabando audio · {Math.floor(recDuration / 60)}:{(recDuration % 60).toString().padStart(2, '0')}
                                </span>
                            </div>
                        )}
                        {isUploading && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: '#2563EB' }}>📤 Subiendo audio...</span>
                            </div>
                        )}
                        {uploadedUrl && !isUploading && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: '#16A34A' }}>✅ Audio guardado</span>
                            </div>
                        )}

                        <div style={{ textAlign: 'center', marginBottom: 8 }}>
                            <span style={{
                                fontSize: timerSeconds === 0 ? 28 : 40, fontWeight: 900,
                                color: timerSeconds === 0 ? '#16A34A' : timerSeconds <= 30 ? '#DC2626' : '#92400E',
                                fontVariantNumeric: 'tabular-nums', transition: 'color 0.3s ease'
                            }}>
                                {timerSeconds === 0 ? '¡Tiempo Agotado! ⚠️' : formatTimer(timerSeconds)}
                            </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'rgba(146,64,14,0.15)', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: 3, width: `${timerProgress}%`,
                                background: timerSeconds === 0 ? '#22C55E' : timerSeconds <= 30 ? '#EF4444' : '#F59E0B',
                                transition: 'width 1s linear, background 0.5s ease'
                            }} />
                        </div>
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
                                                {entry.destinos && (
                                                    <p style={{ fontSize: 12, color: '#64748B', fontWeight: 600, margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

                {/* INTRO: ESCÁNER DE IDENTIDAD */}
                {masterStep === 'intro_scanner' && (
                    <div style={{ animation: 'fadeIn 0.3s ease-out', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: 48, marginBottom: 8 }}>📡</div>
                        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>
                            Fase 1: Escáner de Identidad
                        </h2>
                        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.4, marginBottom: 16, padding: '0 8px' }}>
                            A continuación, usarás el Radar para que los niños elijan su nombre de escuadrón.<br/><br/>
                            <strong>Instrucciones:</strong> Diles las dos opciones disponibles y haz que griten tan fuerte como puedan. El radar medirá la energía de sus gritos para decidir el ganador.
                        </p>
                        
                        <div style={{ marginTop: 'auto', marginBottom: 16 }}>
                            <button
                                onClick={() => {
                                    setMasterStep('scanner');
                                    setScannerOpen(true);
                                }}
                                style={{
                                    width: '100%', padding: '16px', borderRadius: 16, border: 'none',
                                    background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', color: 'white',
                                    fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                    cursor: 'pointer', boxShadow: '0 10px 25px rgba(59,130,246,0.3)'
                                }}
                            >
                                Comenzar Escáner <ChevronRight />
                            </button>
                        </div>
                    </div>
                )}

                {/* INTRO: CALCULADORA DE ESCUADRONES */}
                {masterStep === 'intro_calculator' && (
                    <div style={{ animation: 'fadeIn 0.3s ease-out', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: 48, marginBottom: 8 }}>🗺️</div>
                        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>
                            Fase 2: Plan de Vuelo
                        </h2>
                        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.4, marginBottom: 16, padding: '0 8px' }}>
                            El grupo ya tiene identidad. Ahora definiremos a dónde volarán.<br/><br/>
                            <strong>Instrucciones:</strong> Selecciona la ruta del día y divide a los niños en los 5 micro-escuadrones usando el sistema de asignación.
                        </p>
                        
                        <div style={{ marginTop: 'auto', marginBottom: 16 }}>
                            <button
                                onClick={() => {
                                    setMasterStep('calculator');
                                    setCalcOpen(true);
                                }}
                                style={{
                                    width: '100%', padding: '16px', borderRadius: 16, border: 'none',
                                    background: 'linear-gradient(135deg, #10B981, #047857)', color: 'white',
                                    fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                    cursor: 'pointer', boxShadow: '0 10px 25px rgba(16,185,129,0.3)'
                                }}
                            >
                                Crear Plan de Vuelo <ChevronRight />
                            </button>
                        </div>
                    </div>
                )}

                {/* BRIEFING FINAL (OUTRO) */}
                {masterStep === 'briefing_final' && (
                    <div style={{ animation: 'fadeIn 0.3s ease-out', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: 48, marginBottom: 8 }}>📣</div>
                        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginBottom: 8 }}>
                            Aviso a los Pasajeros
                        </h2>
                        <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.4, marginBottom: 16, padding: '0 8px' }}>
                            Lee este mensaje en voz alta para los niños antes de terminar la operación:
                        </p>

                        <div style={{
                            background: '#F8FAFC', border: '2px solid #E2E8F0', borderRadius: 16,
                            padding: '16px', marginBottom: 16, position: 'relative'
                        }}>
                            <span style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#3B82F6', color: 'white', fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Mensaje para leer</span>
                            <p style={{ fontSize: 16, fontWeight: 800, color: '#1E293B', fontStyle: 'italic', margin: 0, lineHeight: 1.4 }}>
                                "¡Muy bien, <span style={{ color: '#7C3AED' }}>Escuadrón {nombreClave}</span>!<br/>
                                <br/>
                                Sus lugares ya están asignados en el radar. Ahora esperen a que el Piloto los llame por su nombre para el despegue."
                            </p>
                        </div>

                        <div style={{ marginTop: 'auto', marginBottom: 16 }}>
                            <button
                                onClick={() => setMasterStep('review')}
                                style={{
                                    width: '100%', padding: '16px', borderRadius: 16, border: 'none',
                                    background: 'linear-gradient(135deg, #10B981, #047857)', color: 'white',
                                    fontSize: 16, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                    cursor: 'pointer', boxShadow: '0 10px 25px rgba(16,185,129,0.3)'
                                }}
                            >
                                Confirmar y Continuar <ChevronRight />
                            </button>
                        </div>
                    </div>
                )}

                {/* REVIEW STATE: RESUMEN Y AUTORIZACIÓN FINAL */}
                {masterStep === 'review' && (
                    <div style={{ animation: 'fadeIn 0.3s ease-out', marginTop: 24 }}>
                        <div style={{ marginBottom: 24, textAlign: 'center' }}>
                            <div style={{ width: 64, height: 64, background: '#D1FAE5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <CheckCircle2 size={32} color="#059669" />
                            </div>
                            <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', margin: '0 0 8px' }}>
                                ¡Sistemas Listos!
                            </h2>
                            <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
                                Revisa los datos y autoriza el envío al Piloto.
                            </p>
                        </div>

                        <div style={{ background: 'white', borderRadius: 24, border: '2px solid #E2E8F0', overflow: 'hidden', marginBottom: 24, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)' }}>
                            {/* Identidad */}
                            <div style={{ padding: '20px', borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nombre Clave del Grupo</span>
                                <h3 style={{ fontSize: 22, fontWeight: 900, color: '#7C3AED', margin: '4px 0 0' }}>"{nombreClave}"</h3>
                            </div>

                            {/* Plan de Vuelo */}
                            {flightPlan && (
                                <div style={{ padding: '20px', borderBottom: '2px solid #E2E8F0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Plan de Vuelo</span>
                                        <span style={{ fontSize: 11, fontWeight: 800, background: '#EDE9FE', color: '#7C3AED', padding: '4px 10px', borderRadius: 100 }}>{flightPlan.routeName}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {flightPlan.groups.map((count, idx) => count > 0 && (
                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F8FAFC', padding: '12px 16px', borderRadius: 12 }}>
                                                <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', width: 45 }}>ESC {idx+1}</span>
                                                <span style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', flex: 1 }}>{flightPlan.assignments[idx]}</span>
                                                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{count} pax</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Opcional: Capitán */}
                            <div style={{ padding: '20px' }}>
                                <label style={{ display: 'block' }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <User size={14} /> (Opcional) Capitán Seleccionado
                                    </span>
                                    <input
                                        type="text"
                                        value={capitan}
                                        onChange={(e) => setCapitan(e.target.value)}
                                        placeholder="Nombre del niño/niña..."
                                        maxLength={50}
                                        style={{
                                            width: '100%', marginTop: 8, padding: '14px 16px', borderRadius: 12,
                                            border: '2px solid #E2E8F0', background: 'white', fontSize: 16, fontWeight: 600,
                                            outline: 'none', transition: 'border-color 0.2s'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#7C3AED'}
                                        onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                                    />
                                </label>
                            </div>
                        </div>

                        <button
                            onClick={handleSaveBitacora}
                            disabled={isSaving || saved}
                            style={{
                                width: '100%', padding: '20px', borderRadius: 20, border: 'none',
                                background: saved ? '#10B981' : 'linear-gradient(135deg, #1E293B, #0F172A)', color: 'white',
                                fontSize: 18, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                cursor: isSaving || saved ? 'not-allowed' : 'pointer',
                                boxShadow: saved ? '0 10px 25px rgba(16,185,129,0.3)' : '0 10px 25px rgba(15,23,42,0.2)',
                                transition: 'all 0.3s'
                            }}
                        >
                            {isSaving ? 'Guardando...' : saved ? '✅ ENVIADO AL PILOTO' : <><Send size={24} /> GUARDAR Y ENVIAR AL PILOTO</>}
                        </button>
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
                    // Automatically trigger Phase 2 Intro
                    setMasterStep('intro_calculator');
                }}
                onClose={() => {
                    // Si el usuario cancela, volvemos a idle manualmente
                    setScannerOpen(false);
                    setMasterStep('idle');
                    resetTimer();
                }}
            />

            {/* Fase 2: Squadron Calculator Overlay */}
            <SquadronCalculator
                isOpen={calcOpen}
                timerSeconds={timerSeconds}
                onClose={() => {
                    // Si cierra a la mitad, no matamos el timer pero volvemos a idle
                    setCalcOpen(false);
                    setMasterStep('idle');
                    resetTimer();
                }}
                onComplete={(plan) => {
                    setFlightPlan(plan);
                    const places = Object.values(plan.assignments).filter(Boolean);
                    setDestinos(`Ruta ${plan.routeName}: ${places.join(', ')}`);
                    setCalcOpen(false);
                    // Automatically trigger Phase 3 Intro (Briefing Final)
                    setMasterStep('briefing_final');
                }}
            />

            <style>{`
                @keyframes recPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
