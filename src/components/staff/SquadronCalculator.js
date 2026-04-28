'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Target, Users, Megaphone, CheckCircle2, Rocket, MapPin, Timer } from 'lucide-react';

export const RUTAS_GEOGRAFICAS = {
    poniente: {
        id: 'poniente',
        name: 'Sector Poniente',
        subtitle: 'Escuelas más allá de libramiento',
        themeColor: '#FFB300', // Amber
        themeBg: '#05080F',
        destinos: ['Centro', 'Parque', 'Fábrica', 'Cerro del Águila', 'Montañas', 'Cielo', 'Paseo Lázaro Cárdenas (McDonalds)', 'Aeropuerto (Algunas zonas)']
    },
    oriente: {
        id: 'oriente',
        name: 'Sector Oriente',
        themeColor: '#00E5FF', // Cyan
        themeBg: '#05080F',
        destinos: ['Aeropuerto', 'Planta Tratadora', 'Montañas', 'Cielo', 'Presa', 'Ágora', 'Centro (Zoom lejano)']
    }
};

const SimpleButton = ({ onClick, color, children, disabled, style = {} }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        style={{
            background: disabled ? '#0F172A' : `${color}15`,
            border: `2px solid ${disabled ? '#1E293B' : color}`,
            color: disabled ? '#475569' : '#FFFFFF',
            padding: '24px 20px',
            borderRadius: '12px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            display: 'block',
            width: '100%',
            textAlign: 'left',
            boxShadow: disabled ? 'none' : `0 4px 15px ${color}11`,
            ...style
        }}
        onMouseDown={e => { if(!disabled) e.currentTarget.style.transform = 'scale(0.98)'; }}
        onMouseUp={e => { if(!disabled) e.currentTarget.style.transform = 'scale(1)'; }}
    >
        {children}
    </button>
);

export default function SquadronCalculator({ isOpen, onClose, onComplete, timerSeconds, squadronName }) {
    const [step, setStep] = useState('total'); // 'total' | 'explanation' | 'route' | 'briefing' | 'assigning' | 'confirm'
    const [route, setRoute] = useState(null);
    const [totalKids, setTotalKids] = useState('');
    const [groups, setGroups] = useState([]);
    const [assignments, setAssignments] = useState({});
    const [assignIndex, setAssignIndex] = useState(0);
    const [briefingSeconds, setBriefingSeconds] = useState(null);
    const audioCtxRef = useRef(null);

    const reset = useCallback(() => {
        setStep('total');
        setRoute(null);
        setTotalKids('');
        setGroups([]);
        setAssignments({});
        setAssignIndex(0);
        setBriefingSeconds(null);
    }, []);

    useEffect(() => {
        if (!isOpen) reset();
    }, [isOpen, reset]);

    const vibrate = (pattern = [50]) => {
        try { navigator.vibrate?.(pattern); } catch { }
    };

    const unlockAudio = () => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }
            const osc = audioCtxRef.current.createOscillator();
            osc.connect(audioCtxRef.current.destination);
            osc.start(0);
            osc.stop(0.01);
        } catch(e) {}
    };

    const startBriefingTimer = () => {
        unlockAudio();
        setBriefingSeconds(10);
    };

    const playTick = useCallback(() => {
        try {
            if (audioCtxRef.current) {
                const ctx = audioCtxRef.current;
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'square';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                gain.gain.setValueAtTime(0.05, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
                osc.start();
                osc.stop(ctx.currentTime + 0.05);
            }
        } catch (e) {}
    }, []);

    useEffect(() => {
        if (briefingSeconds !== null && briefingSeconds > 0) {
            const t = setTimeout(() => {
                setBriefingSeconds(s => s - 1);
                playTick();
            }, 1000);
            return () => clearTimeout(t);
        } else if (briefingSeconds === 0) {
            // Play buzzer
            try {
                if (audioCtxRef.current) {
                    const ctx = audioCtxRef.current;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(150, ctx.currentTime);
                    osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 1);
                    gain.gain.setValueAtTime(0.5, ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 1);
                    osc.start();
                    osc.stop(ctx.currentTime + 1);
                }
            } catch (e) {}
            vibrate([400, 100, 400]);
            
            // Auto advance after buzzer
            const autoAdvance = setTimeout(() => {
                setStep('assigning');
                setAssignIndex(0);
            }, 1500);
            return () => clearTimeout(autoAdvance);
        }
    }, [briefingSeconds, playTick]);

    const handleSelectRoute = (r) => {
        vibrate();
        setRoute(r);
        setStep('briefing');
    };

    const handleCalculateGroups = () => {
        const total = parseInt(totalKids, 10);
        if (isNaN(total) || total <= 0) return;
        
        vibrate();
        let calcGroups = [];
        if (total < 3) {
            calcGroups = Array(total).fill(1).concat(Array(3 - total).fill(0));
        } else {
            const base = Math.floor(total / 3);
            const remainder = total % 3;
            calcGroups = Array.from({ length: 3 }, (_, i) => i < remainder ? base + 1 : base);
        }
        
        // Remove 0-count groups so we only iterate through actual groups
        const activeGroups = calcGroups.filter(count => count > 0);
        setGroups(activeGroups);
        setStep('explanation');
    };

    const handleProceedToAssign = () => {
        vibrate();
        setStep('assigning');
        setAssignIndex(0);
    };

    const handleAssignDestination = (destino) => {
        vibrate();
        const newAssignments = { ...assignments, [assignIndex]: destino };
        setAssignments(newAssignments);
        
        if (assignIndex + 1 < groups.length) {
            // Go to next group
            setAssignIndex(assignIndex + 1);
        } else {
            // All assigned
            setStep('confirm');
        }
    };

    const handleConfirm = () => {
        vibrate([100, 50, 200]);
        // Convert back to full 3-length arrays
        const fullGroups = Array(3).fill(0);
        const fullAssignments = {};
        groups.forEach((count, i) => {
            fullGroups[i] = count;
            fullAssignments[i] = assignments[i];
        });

        onComplete?.({
            routeId: route,
            routeName: RUTAS_GEOGRAFICAS[route].name,
            groups: fullGroups,
            assignments: fullAssignments
        });
    };

    if (!isOpen) return null;

    const theme = route ? RUTAS_GEOGRAFICAS[route] : { themeColor: '#FFFFFF', themeBg: '#05080F' };
    const assignedDestinations = Object.values(assignments);

    // Dynamic Title based on step
    let headerTitle = "CONSOLA DE MANDO";
    if (step === 'total') headerTitle = "PASO 1 / 6";
    if (step === 'explanation') headerTitle = "PASO 2 / 6";
    if (step === 'route') headerTitle = "PASO 3 / 6";
    if (step === 'briefing') headerTitle = "PASO 4 / 6";
    if (step === 'assigning') headerTitle = `PASO 5 / 6 (ASIGNANDO ${assignIndex + 1} DE ${groups.length})`;
    if (step === 'confirm') headerTitle = "PASO 6 / 6";

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            backgroundColor: theme.themeBg,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', fontFamily: '"Inter", sans-serif'
        }}>
            {/* Header Clean */}
            <div style={{
                padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: '#0F172A', borderBottom: `1px solid #1E293B`, zIndex: 10, position: 'relative'
            }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: theme.themeColor, letterSpacing: '0.05em' }}>
                    {headerTitle}
                </h2>
                
                {/* HUD BATTLE INFO */}
                {timerSeconds !== undefined && (
                    <div style={{
                        position:'absolute',top:'50%',left:'50%',transform:'translate(-50%, -50%)',
                        background:'rgba(255,255,255,0.1)',borderRadius:100,zIndex:100,
                        padding:'4px 12px',display:'flex',alignItems:'center',gap:6,
                        color:'white',fontWeight:800,fontSize:12
                    }}>
                        ⏱️ {Math.floor(timerSeconds/60)}:{(timerSeconds%60).toString().padStart(2,'0')}
                    </div>
                )}

                <button onClick={onClose} style={{
                    width: 32, height: 32, background: 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none',
                    color: '#94A3B8', cursor: 'pointer'
                }}>
                    <X size={24} />
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 20px', display: 'flex', flexDirection: 'column' }}>
                
                {/* ═══ PASO 1: TOTAL (Antes Ruta) ═══ */}
                {step === 'total' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 400, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        
                        {/* Briefing Card */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                            borderRadius: 24, padding: '24px 20px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            textAlign: 'center',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                        }}>
                            <div style={{width:64,height:64,borderRadius:'50%',background:`rgba(147, 51, 234, 0.2)`,display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid #9333EA`, margin: '0 auto 16px'}}>
                                <span style={{fontSize:32}}>📢</span>
                            </div>
                            <p style={{fontSize:12,color:'#A855F7',fontWeight:900,textTransform:'uppercase',letterSpacing:'0.15em',margin:'0 0 12px'}}>
                                Dile a los niños lo siguiente:
                            </p>
                            <p style={{fontSize:20,color:'white',lineHeight:1.4,margin:0,fontWeight:800}}>
                                "¡Atención equipo {squadronName || 'Ganador'}! Llegó uno de los momentos más importantes... ¡vamos a escoger hacia dónde quieren volar! Pero para hacer esto, necesitamos saber cuántos tripulantes somos en total."
                            </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                            <div style={{flex: 1, height: 1, background: 'rgba(255,255,255,0.1)'}}></div>
                            <span style={{fontSize: 12, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em'}}>
                                Cuenta a los niños y regístralos:
                            </span>
                            <div style={{flex: 1, height: 1, background: 'rgba(255,255,255,0.1)'}}></div>
                        </div>

                        <div style={{ textAlign: 'center', marginTop: 16, marginBottom: 16 }}>
                            <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={totalKids}
                                onChange={(e) => setTotalKids(e.target.value)}
                                autoFocus
                                placeholder="0"
                                style={{
                                    fontSize: 80, fontWeight: 900, textAlign: 'center',
                                    background: '#0F172A', border: `2px solid #9333EA`, borderRadius: '16px',
                                    color: '#FFFFFF', width: '100%', padding: '16px 0',
                                    outline: 'none', boxShadow: `0 8px 30px rgba(147, 51, 234, 0.2)`
                                }}
                            />
                        </div>

                        <div style={{ marginTop: 'auto' }}>
                            <button 
                                onClick={handleCalculateGroups}
                                disabled={!totalKids || parseInt(totalKids, 10) <= 0}
                                style={{ 
                                    width: '100%', padding: '24px', borderRadius: '12px', border: 'none',
                                    background: (!totalKids || parseInt(totalKids, 10) <= 0) ? '#1E293B' : '#9333EA',
                                    color: (!totalKids || parseInt(totalKids, 10) <= 0) ? '#475569' : '#FFFFFF',
                                    fontSize: 18, fontWeight: 800, cursor: (!totalKids || parseInt(totalKids, 10) <= 0) ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Users size={24} /> CALCULAR ESCUADRONES
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ PASO 3: RUTA (Antes Total) ═══ */}
                {step === 'route' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 400, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        <div style={{ textAlign: 'center', marginBottom: 16 }}>
                            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF', margin: 0, lineHeight: 1.2 }}>
                                Selecciona la zona de vuelo
                            </h3>
                            <p style={{ fontSize: 14, color: '#94A3B8', marginTop: 8 }}>
                                ¿Hacia dónde se dirige el equipo hoy?
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <SimpleButton color={RUTAS_GEOGRAFICAS.poniente.themeColor} onClick={() => handleSelectRoute('poniente')} style={{
                                borderRadius: 20, padding: 20,
                                background: `linear-gradient(135deg, ${RUTAS_GEOGRAFICAS.poniente.themeColor}15, transparent)`
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{width: 54, height: 54, borderRadius: '50%', background: `${RUTAS_GEOGRAFICAS.poniente.themeColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                                        <Target size={28} color={RUTAS_GEOGRAFICAS.poniente.themeColor} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: '#FFFFFF' }}>Poniente</h4>
                                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8', fontWeight: 600, lineHeight: 1.3 }}>{RUTAS_GEOGRAFICAS.poniente.subtitle}</p>
                                    </div>
                                </div>
                            </SimpleButton>

                            <SimpleButton color={RUTAS_GEOGRAFICAS.oriente.themeColor} onClick={() => handleSelectRoute('oriente')} style={{
                                borderRadius: 20, padding: 20,
                                background: `linear-gradient(135deg, ${RUTAS_GEOGRAFICAS.oriente.themeColor}15, transparent)`
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{width: 54, height: 54, borderRadius: '50%', background: `${RUTAS_GEOGRAFICAS.oriente.themeColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                                        <Target size={28} color={RUTAS_GEOGRAFICAS.oriente.themeColor} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: '#FFFFFF' }}>Oriente</h4>
                                        {RUTAS_GEOGRAFICAS.oriente.subtitle ? (
                                            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8', fontWeight: 600, lineHeight: 1.3 }}>{RUTAS_GEOGRAFICAS.oriente.subtitle}</p>
                                        ) : (
                                            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8', fontWeight: 600, lineHeight: 1.3 }}>Escuelas zona centro/oriente</p>
                                        )}
                                    </div>
                                </div>
                            </SimpleButton>
                        </div>
                    </div>
                )}

                {/* ═══ PASO 2: EXPLICACIÓN DE GRUPOS ═══ */}
                {step === 'explanation' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 400, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        
                        {/* Briefing Card */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                            borderRadius: 24, padding: '24px 20px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            textAlign: 'center',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                        }}>
                            <div style={{width:64,height:64,borderRadius:'50%',background:`rgba(147, 51, 234, 0.2)`,display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid #9333EA`, margin: '0 auto 16px'}}>
                                <span style={{fontSize:32}}>📢</span>
                            </div>
                            <p style={{fontSize:12,color:'#A855F7',fontWeight:900,textTransform:'uppercase',letterSpacing:'0.15em',margin:'0 0 12px'}}>
                                Dile a los niños lo siguiente:
                            </p>
                            <p style={{fontSize:20,color:'white',lineHeight:1.4,margin:0,fontWeight:800}}>
                                "¡Atención tripulantes! Necesitamos hacer equipos para escoger a dónde volar. Ayúdenme a formar estos grupos ahora:"
                            </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                            <div style={{flex: 1, height: 1, background: 'rgba(255,255,255,0.1)'}}></div>
                            <span style={{fontSize: 12, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em'}}>
                                Sepáralos de la siguiente manera:
                            </span>
                            <div style={{flex: 1, height: 1, background: 'rgba(255,255,255,0.1)'}}></div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {groups.map((size, idx) => (
                                <div key={idx} style={{ 
                                    background: 'linear-gradient(135deg, #1E293B, #0F172A)', border: `2px solid #334155`, borderRadius: '16px', 
                                    padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#9333EA22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ fontSize: 20, fontWeight: 900, color: '#A855F7' }}>{idx + 1}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Escuadrón {idx + 1}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Users size={20} color={'#FFFFFF'} opacity={0.5} />
                                        <span style={{ fontSize: 28, color: '#FFFFFF', fontWeight: 900 }}>
                                            {size}
                                        </span>
                                        <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>niños</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                            <button 
                                onClick={() => setStep('route')}
                                style={{ 
                                    width: '100%', padding: '24px', borderRadius: '12px', border: 'none',
                                    background: '#9333EA', color: '#FFFFFF',
                                    fontSize: 16, fontWeight: 900, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                    boxShadow: '0 10px 25px rgba(147, 51, 234, 0.3)'
                                }}
                            >
                                LOS GRUPOS ESTÁN LISTOS <CheckCircle2 size={24} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ PASO 4: BRIEFING ═══ */}
                {/* ═══ PASO 4: BRIEFING ═══ */}
                {step === 'briefing' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 500, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        {briefingSeconds === null ? (
                            <>
                                {/* Briefing Card */}
                                <div style={{
                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                                    borderRadius: 24, padding: '24px 20px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    textAlign: 'center',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                                }}>
                                    <div style={{width:64,height:64,borderRadius:'50%',background:`rgba(147, 51, 234, 0.2)`,display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid #9333EA`, margin: '0 auto 16px'}}>
                                        <span style={{fontSize:32}}>📢</span>
                                    </div>
                                    <p style={{fontSize:12,color:'#A855F7',fontWeight:900,textTransform:'uppercase',letterSpacing:'0.15em',margin:'0 0 12px'}}>
                                        Dile a los niños lo siguiente:
                                    </p>
                                    <p style={{fontSize:18,color:'white',lineHeight:1.4,margin:0,fontWeight:800}}>
                                        "Niños, tenemos varias opciones para volar. Les leeré los lugares, y luego tendrán 10 segundos para ponerse de acuerdo en su equipo. ¡Solo un niño por equipo me dirá la respuesta al terminar el tiempo!"
                                    </p>
                                </div>

                                <div>
                                    <h4 style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lugares disponibles:</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        {theme.destinos.map((destino) => (
                                            <div key={destino} style={{ 
                                                background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px',
                                                fontSize: 13, color: '#FFFFFF', fontWeight: 700, border: '1px solid rgba(255,255,255,0.1)',
                                                textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                {destino}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                        <div style={{flex: 1, height: 1, background: 'rgba(255,255,255,0.1)'}}></div>
                                        <span style={{fontSize: 12, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em'}}>
                                            Pregúntales: "¿Están listos?"
                                        </span>
                                        <div style={{flex: 1, height: 1, background: 'rgba(255,255,255,0.1)'}}></div>
                                    </div>
                                    <button 
                                        onClick={startBriefingTimer}
                                        style={{ 
                                            width: '100%', padding: '24px', borderRadius: '12px', border: 'none',
                                            background: '#EAB308', color: '#000000',
                                            fontSize: 16, fontWeight: 900, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                            boxShadow: '0 10px 25px rgba(234, 179, 8, 0.3)'
                                        }}
                                    >
                                        <Timer size={24} /> INICIAR 10 SEGUNDOS
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div style={{ 
                                flex: 1, display: 'flex', flexDirection: 'column', 
                                alignItems: 'center', justifyContent: 'center', 
                                animation: 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }}>
                                <h2 style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF', marginBottom: 24, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    TIEMPO RESTANTE
                                </h2>
                                <div style={{ 
                                    fontSize: 160, fontWeight: 900, color: briefingSeconds === 0 ? '#EF4444' : theme.themeColor, 
                                    lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                                    textShadow: `0 10px 60px ${briefingSeconds === 0 ? '#EF4444' : theme.themeColor}aa`,
                                    transform: `scale(${briefingSeconds === 0 ? 1.2 : 1})`,
                                    transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                }}>
                                    {briefingSeconds}
                                </div>
                                <style dangerouslySetInnerHTML={{__html: `
                                    @keyframes scaleIn {
                                        0% { opacity: 0; transform: scale(0.8); }
                                        100% { opacity: 1; transform: scale(1); }
                                    }
                                `}} />
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ PASO 4: ASIGNACIÓN INDIVIDUAL ═══ */}
                {step === 'assigning' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 500, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        <div style={{ background: `${theme.themeColor}15`, border: `2px solid ${theme.themeColor}`, borderRadius: '12px', padding: '24px' }}>
                            <p style={{ margin: 0, fontSize: 16, color: theme.themeColor, fontWeight: 800, marginBottom: 8 }}>
                                PREGÚNTALE AL ESCUADRÓN {assignIndex + 1} ({groups[assignIndex]} niños):
                            </p>
                            <h3 style={{ margin: 0, fontSize: 26, color: '#FFFFFF', fontWeight: 900 }}>
                                "¿A dónde quieren ir?"
                            </h3>
                        </div>

                        <div>
                            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', marginBottom: 16, textTransform: 'uppercase' }}>Toca su respuesta para avanzar:</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {theme.destinos.map(destino => {
                                    // Hide destinations already selected by PREVIOUS groups
                                    if (assignedDestinations.includes(destino)) return null;
                                    
                                    return (
                                        <button
                                            key={destino}
                                            onClick={() => handleAssignDestination(destino)}
                                            style={{
                                                background: '#0F172A', border: '2px solid #334155', borderRadius: '12px',
                                                padding: '20px', color: '#FFFFFF', fontSize: 20, fontWeight: 700,
                                                textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16,
                                                cursor: 'pointer', transition: 'background 0.2s'
                                            }}
                                            onMouseDown={e => { e.currentTarget.style.background = '#1E293B'; }}
                                            onMouseUp={e => { e.currentTarget.style.background = '#0F172A'; }}
                                        >
                                            <MapPin size={24} color={theme.themeColor} />
                                            {destino}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ PASO 6: CONFIRMACIÓN ═══ */}
                {step === 'confirm' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 450, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        <div style={{ textAlign: 'center', marginBottom: 8, marginTop: 12 }}>
                            <span style={{fontSize: 12, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em'}}>
                                Diles a los niños lo siguiente:
                            </span>
                            <p style={{ fontSize: 18, color: '#FFFFFF', margin: '8px 0 0', fontWeight: 800, fontStyle: 'italic' }}>
                                "¡Niños! Su pase de abordar y plan de vuelo ya está listo. Se va a mandar directo al piloto."
                            </p>
                        </div>

                        {/* PLAN DE VUELO TICKET GIGANTE */}
                        <div style={{ 
                            background: '#FFFFFF', padding: '32px 24px', borderRadius: '16px', color: '#0F172A', 
                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)', position: 'relative',
                            flex: 1, display: 'flex', flexDirection: 'column'
                        }}>
                            <div style={{ textAlign: 'center', marginBottom: 24, borderBottom: '3px dashed #CBD5E1', paddingBottom: 24 }}>
                                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#64748B', letterSpacing: '0.15em', textTransform: 'uppercase' }}>PLAN DE VUELO OFICIAL</h4>
                                <h3 style={{ margin: '8px 0 0', fontSize: 26, fontWeight: 900, color: '#0F172A', textTransform: 'uppercase' }}>
                                    {RUTAS_GEOGRAFICAS[route]?.name}
                                </h3>
                                <div style={{ display: 'inline-block', background: '#22C55E', color: 'white', padding: '6px 12px', borderRadius: 8, fontSize: 14, fontWeight: 900, marginTop: 12, letterSpacing: '0.1em' }}>
                                    ✓ AUTORIZADO
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, justifyContent: 'center' }}>
                                {groups.map((count, index) => (
                                    <div key={index} style={{ 
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                        borderBottom: index < groups.length - 1 ? '2px solid #F1F5F9' : 'none', 
                                        paddingBottom: index < groups.length - 1 ? 20 : 0 
                                    }}>
                                        <div style={{ fontSize: 18, fontWeight: 900, color: '#475569' }}>
                                            ESC {index + 1} <span style={{ fontWeight: 700, color: '#94A3B8', fontSize: 14 }}>({count} pax)</span>
                                        </div>
                                        <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', textAlign: 'right' }}>
                                            {assignments[index]}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Barcode simulation */}
                            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '3px solid #0F172A', textAlign: 'center', opacity: 0.8 }}>
                                <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 900, letterSpacing: '0.2em' }}>
                                    FH-{Math.random().toString(36).substring(2, 8).toUpperCase()}-{(new Date()).getTime().toString().slice(-4)}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                            <button
                                onClick={handleConfirm}
                                style={{
                                    width: '100%', padding: '24px', borderRadius: '12px', border: 'none',
                                    background: '#10B981', color: '#FFFFFF',
                                    fontSize: 18, fontWeight: 900, textTransform: 'uppercase',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                    boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)'
                                }}
                            >
                                <Rocket size={24} /> ENVIAR AL PILOTO
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeIn { 
                    from { opacity: 0; transform: translateY(10px); } 
                    to { opacity: 1; transform: translateY(0); } 
                }
            `}} />
        </div>
    );
}
