'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Target, Users, Megaphone, CheckCircle2, Rocket, MapPin } from 'lucide-react';

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

export default function SquadronCalculator({ isOpen, onClose, onComplete, timerSeconds }) {
    const [step, setStep] = useState('route'); // 'route' | 'total' | 'explanation' | 'briefing' | 'assigning' | 'confirm'
    const [route, setRoute] = useState(null);
    const [totalKids, setTotalKids] = useState('');
    const [groups, setGroups] = useState([]);
    const [assignments, setAssignments] = useState({});
    const [assignIndex, setAssignIndex] = useState(0);

    const reset = useCallback(() => {
        setStep('route');
        setRoute(null);
        setTotalKids('');
        setGroups([]);
        setAssignments({});
        setAssignIndex(0);
    }, []);

    useEffect(() => {
        if (!isOpen) reset();
    }, [isOpen, reset]);

    const vibrate = (pattern = [50]) => {
        try { navigator.vibrate?.(pattern); } catch { }
    };

    const handleSelectRoute = (r) => {
        vibrate();
        setRoute(r);
        setStep('total');
    };

    const handleCalculateGroups = () => {
        const total = parseInt(totalKids, 10);
        if (isNaN(total) || total <= 0) return;
        
        vibrate();
        let calcGroups = [];
        if (total < 5) {
            calcGroups = Array(total).fill(1).concat(Array(5 - total).fill(0));
        } else {
            const base = Math.floor(total / 5);
            const remainder = total % 5;
            calcGroups = Array.from({ length: 5 }, (_, i) => i < remainder ? base + 1 : base);
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
        // Convert back to full 5-length arrays to match original expected format if needed
        const fullGroups = Array(5).fill(0);
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
    if (step === 'route') headerTitle = "PASO 1 / 6";
    if (step === 'total') headerTitle = "PASO 2 / 6";
    if (step === 'explanation') headerTitle = "PASO 3 / 6";
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
                
                {/* ═══ PASO 1: RUTA ═══ */}
                {step === 'route' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 400, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        <h3 style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', margin: 0, lineHeight: 1.2 }}>
                            ¿Qué ruta vamos a volar hoy?
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <SimpleButton color={RUTAS_GEOGRAFICAS.poniente.themeColor} onClick={() => handleSelectRoute('poniente')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <Target size={32} color={RUTAS_GEOGRAFICAS.poniente.themeColor} />
                                    <div>
                                        <h4 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#FFFFFF' }}>Poniente</h4>
                                        {RUTAS_GEOGRAFICAS.poniente.subtitle && (
                                            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#94A3B8' }}>{RUTAS_GEOGRAFICAS.poniente.subtitle}</p>
                                        )}
                                    </div>
                                </div>
                            </SimpleButton>

                            <SimpleButton color={RUTAS_GEOGRAFICAS.oriente.themeColor} onClick={() => handleSelectRoute('oriente')}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <Target size={32} color={RUTAS_GEOGRAFICAS.oriente.themeColor} />
                                    <div>
                                        <h4 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: '#FFFFFF' }}>Oriente</h4>
                                        {RUTAS_GEOGRAFICAS.oriente.subtitle && (
                                            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#94A3B8' }}>{RUTAS_GEOGRAFICAS.oriente.subtitle}</p>
                                        )}
                                    </div>
                                </div>
                            </SimpleButton>
                        </div>
                    </div>
                )}

                {/* ═══ PASO 2: TOTAL ═══ */}
                {step === 'total' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 400, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        <h3 style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', margin: 0, lineHeight: 1.2 }}>
                            ¿Cuántos niños van a volar en total?
                        </h3>

                        <div style={{ textAlign: 'center', marginTop: 32, marginBottom: 32 }}>
                            <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={totalKids}
                                onChange={(e) => setTotalKids(e.target.value)}
                                autoFocus
                                placeholder="0"
                                style={{
                                    fontSize: 100, fontWeight: 900, textAlign: 'center',
                                    background: '#0F172A', border: `2px solid ${theme.themeColor}`, borderRadius: '16px',
                                    color: '#FFFFFF', width: '100%', padding: '20px 0',
                                    outline: 'none', boxShadow: `0 8px 30px ${theme.themeColor}22`
                                }}
                            />
                        </div>

                        <div style={{ marginTop: 'auto' }}>
                            <button 
                                onClick={handleCalculateGroups}
                                disabled={!totalKids || parseInt(totalKids, 10) <= 0}
                                style={{ 
                                    width: '100%', padding: '24px', borderRadius: '12px', border: 'none',
                                    background: (!totalKids || parseInt(totalKids, 10) <= 0) ? '#1E293B' : theme.themeColor,
                                    color: (!totalKids || parseInt(totalKids, 10) <= 0) ? '#475569' : '#000000',
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

                {/* ═══ PASO 3: EXPLICACIÓN DE GRUPOS (NUEVO) ═══ */}
                {step === 'explanation' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        <h3 style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF', margin: 0, lineHeight: 1.2 }}>
                            Formación de Escuadrones
                        </h3>
                        
                        <div style={{ background: '#1E293B', padding: '16px', borderRadius: '12px' }}>
                            <p style={{ margin: 0, fontSize: 15, color: '#FFFFFF', lineHeight: 1.4, fontStyle: 'italic', fontWeight: 600 }}>
                                "¡Atención tripulantes! Necesitamos hacer equipos para escoger a dónde volar. Ayúdenme a formar estos grupos ahora:"
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {groups.map((size, idx) => (
                                <div key={idx} style={{ 
                                    background: '#0F172A', border: `1px solid ${theme.themeColor}55`, borderRadius: '12px', 
                                    padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <Users size={20} color={theme.themeColor} />
                                        <span style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFF' }}>Escuadrón {idx + 1}</span>
                                    </div>
                                    <div style={{ fontSize: 16, color: theme.themeColor, fontWeight: 900 }}>
                                        {size} tripulantes
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                            <button 
                                onClick={() => setStep('briefing')}
                                style={{ 
                                    width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                                    background: theme.themeColor, color: '#000000',
                                    fontSize: 16, fontWeight: 900, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12
                                }}
                            >
                                LOS GRUPOS ESTÁN LISTOS <CheckCircle2 size={20} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ PASO 3: BRIEFING ═══ */}
                {step === 'briefing' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 500, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        <div style={{ background: '#0F172A', border: '2px solid #334155', borderRadius: '12px', padding: '24px' }}>
                            <h3 style={{ fontSize: 16, fontWeight: 800, color: theme.themeColor, margin: '0 0 16px', textTransform: 'uppercase' }}>
                                Lee esto en voz alta para los niños:
                            </h3>
                            <p style={{ margin: 0, fontSize: 22, color: '#FFFFFF', fontWeight: 500, lineHeight: 1.4 }}>
                                "Niños, vamos a tratar de volar por todo Uruapan, pero ustedes tienen la opción para escoger destinos específicos."
                            </p>
                        </div>

                        <div>
                            <h4 style={{ fontSize: 16, fontWeight: 700, color: '#94A3B8', marginBottom: 16 }}>Destinos disponibles para leerles:</h4>
                            <ul style={{ margin: 0, padding: '0 0 0 24px', color: '#FFFFFF', fontSize: 18, lineHeight: 1.8, fontWeight: 600 }}>
                                {theme.destinos.map((destino) => (
                                    <li key={destino} style={{ marginBottom: 8 }}>{destino}</li>
                                ))}
                            </ul>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: 32 }}>
                            <button 
                                onClick={handleProceedToAssign}
                                style={{ 
                                    width: '100%', padding: '24px', borderRadius: '12px', border: 'none',
                                    background: theme.themeColor, color: '#000000',
                                    fontSize: 18, fontWeight: 800, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12
                                }}
                            >
                                <Megaphone size={24} /> YA LES LEÍ EL MENSAJE
                            </button>
                        </div>
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
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 400, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        <div style={{ textAlign: 'center', marginTop: 12 }}>
                            <CheckCircle2 size={48} color={theme.themeColor} style={{ marginBottom: 8 }} />
                            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF', margin: '0 0 4px', lineHeight: 1.2 }}>
                                Todos listos
                            </h3>
                            <p style={{ fontSize: 14, color: '#94A3B8', margin: 0 }}>Muestra este documento a los niños para confirmar.</p>
                        </div>

                        {/* PLAN DE VUELO TICKET */}
                        <div style={{ 
                            background: '#FFFFFF', padding: '20px', borderRadius: '16px', color: '#0F172A', 
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)', position: 'relative' 
                        }}>
                            <div style={{ textAlign: 'center', marginBottom: 12, borderBottom: '2px dashed #CBD5E1', paddingBottom: 12 }}>
                                <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#64748B', letterSpacing: '0.1em', textTransform: 'uppercase' }}>PLAN DE VUELO OFICIAL</h4>
                                <h3 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 900, color: '#0F172A', textTransform: 'uppercase' }}>
                                    {RUTAS_GEOGRAFICAS[route]?.name}
                                </h3>
                                <div style={{ display: 'inline-block', background: '#DC2626', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 800, marginTop: 8, letterSpacing: '0.05em' }}>
                                    ✓ AUTORIZADO
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {groups.map((count, index) => (
                                    <div key={index} style={{ 
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                        borderBottom: index < groups.length - 1 ? '1px solid #F1F5F9' : 'none', 
                                        paddingBottom: index < groups.length - 1 ? 8 : 0 
                                    }}>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: '#475569' }}>
                                            ESC {index + 1} <span style={{ fontWeight: 600, color: '#94A3B8' }}>({count} pax)</span>
                                        </div>
                                        <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A', textAlign: 'right' }}>
                                            {assignments[index]}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Barcode simulation */}
                            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '2px solid #0F172A', textAlign: 'center', opacity: 0.8 }}>
                                <div style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 800, letterSpacing: '0.2em' }}>
                                    FH-{Math.random().toString(36).substring(2, 8).toUpperCase()}-{(new Date()).getTime().toString().slice(-4)}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                            <button
                                onClick={handleConfirm}
                                style={{
                                    width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                                    background: theme.themeColor, color: '#000000',
                                    fontSize: 16, fontWeight: 900, textTransform: 'uppercase',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12
                                }}
                            >
                                <Rocket size={20} /> AUTORIZAR DESPEGUE
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
