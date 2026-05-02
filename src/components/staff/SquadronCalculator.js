'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Target, MapPin, Sparkles } from 'lucide-react';

export const RUTAS_GEOGRAFICAS = {
    poniente: {
        id: 'poniente',
        name: 'Sector Poniente',
        subtitle: 'Escuelas más allá de libramiento',
        themeColor: '#FFB300', // Amber
        themeBg: '#05080F',
        destinos: [
            { name: 'Centro', emoji: '🏛️' },
            { name: 'Parque', emoji: '🌳' },
            { name: 'Fábrica', emoji: '🏭' },
            { name: 'Cerro del Águila', emoji: '🦅' },
            { name: 'Montañas', emoji: '⛰️' },
            { name: 'Cielo', emoji: '☁️' },
            { name: 'Paseo Lázaro Cárdenas', emoji: '🛣️' },
            { name: 'Aeropuerto', emoji: '✈️' }
        ]
    },
    oriente: {
        id: 'oriente',
        name: 'Sector Oriente',
        themeColor: '#00E5FF', // Cyan
        themeBg: '#05080F',
        destinos: [
            { name: 'Aeropuerto', emoji: '✈️' },
            { name: 'Planta Tratadora', emoji: '💧' },
            { name: 'Montañas', emoji: '⛰️' },
            { name: 'Cielo', emoji: '☁️' },
            { name: 'Presa', emoji: '🌊' },
            { name: 'Ágora', emoji: '🏟️' },
            { name: 'Centro', emoji: '🏛️' }
        ]
    }
};

export default function SquadronCalculator({ isOpen, onClose, onComplete, timerSeconds, squadronName }) {
    const [step, setStep] = useState('route'); // 'route' | 'narrate' | 'custom_dest'
    const [route, setRoute] = useState(null);
    const [narrated, setNarrated] = useState(new Set()); // track which destinations have been "read"
    const [destinoPersonalizado, setDestinoPersonalizado] = useState('');

    const reset = useCallback(() => {
        setStep('route');
        setRoute(null);
        setNarrated(new Set());
        setDestinoPersonalizado('');
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
        setStep('narrate');
    };

    const toggleNarrated = (destinoName) => {
        vibrate([30]);
        setNarrated(prev => {
            const next = new Set(prev);
            if (next.has(destinoName)) {
                next.delete(destinoName);
            } else {
                next.add(destinoName);
            }
            return next;
        });
    };

    const handleProceedToCustom = () => {
        vibrate();
        setStep('custom_dest');
    };

    const handleConfirm = () => {
        vibrate([100, 50, 200]);
        const routeData = RUTAS_GEOGRAFICAS[route];
        const allDestinos = routeData.destinos.map(d => d.name).join(', ');

        onComplete?.({
            routeId: route,
            routeName: routeData.name,
            destinos: allDestinos,
            destinoPersonalizado: destinoPersonalizado.trim() || null
        });
    };

    if (!isOpen) return null;

    const theme = route ? RUTAS_GEOGRAFICAS[route] : { themeColor: '#FFFFFF', themeBg: '#05080F', destinos: [] };
    const allNarrated = route && narrated.size === RUTAS_GEOGRAFICAS[route].destinos.length;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            backgroundColor: '#05080F',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', fontFamily: '"Inter", sans-serif'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: '#0F172A', borderBottom: '1px solid #1E293B', zIndex: 10, position: 'relative'
            }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: theme.themeColor || '#fff', letterSpacing: '0.05em' }}>
                    {step === 'route' && 'SELECCIONA ZONA'}
                    {step === 'narrate' && '🎤 NARRA LOS DESTINOS'}
                    {step === 'custom_dest' && '📍 DESTINO ESPECIAL'}
                </h2>
                
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

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column' }}>
                
                {/* ═══ ROUTE SELECTION ═══ */}
                {step === 'route' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 400, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        <div style={{ textAlign: 'center', marginBottom: 16 }}>
                            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF', margin: 0, lineHeight: 1.2 }}>
                                Selecciona la zona de vuelo
                            </h3>
                            <p style={{ fontSize: 14, color: '#94A3B8', marginTop: 8 }}>
                                ¿Hacia dónde se dirige el equipo <strong style={{ color: '#A855F7' }}>{squadronName || ''}</strong> hoy?
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <button onClick={() => handleSelectRoute('poniente')} style={{
                                borderRadius: 20, padding: 20, cursor: 'pointer',
                                background: `linear-gradient(135deg, ${RUTAS_GEOGRAFICAS.poniente.themeColor}15, transparent)`,
                                border: `2px solid ${RUTAS_GEOGRAFICAS.poniente.themeColor}`,
                                display: 'block', width: '100%', textAlign: 'left',
                                transition: 'all 0.2s ease'
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
                            </button>

                            <button onClick={() => handleSelectRoute('oriente')} style={{
                                borderRadius: 20, padding: 20, cursor: 'pointer',
                                background: `linear-gradient(135deg, ${RUTAS_GEOGRAFICAS.oriente.themeColor}15, transparent)`,
                                border: `2px solid ${RUTAS_GEOGRAFICAS.oriente.themeColor}`,
                                display: 'block', width: '100%', textAlign: 'left',
                                transition: 'all 0.2s ease'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{width: 54, height: 54, borderRadius: '50%', background: `${RUTAS_GEOGRAFICAS.oriente.themeColor}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                                        <Target size={28} color={RUTAS_GEOGRAFICAS.oriente.themeColor} />
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: '#FFFFFF' }}>Oriente</h4>
                                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8', fontWeight: 600, lineHeight: 1.3 }}>Escuelas zona centro/oriente</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ NARRATE DESTINATIONS ═══ */}
                {step === 'narrate' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 500, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        {/* Briefing Card */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                            borderRadius: 20, padding: '20px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            textAlign: 'center'
                        }}>
                            <p style={{fontSize:11,color: theme.themeColor,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.15em',margin:'0 0 8px'}}>
                                Lee con emoción cada destino
                            </p>
                            <p style={{fontSize:17,color:'white',lineHeight:1.4,margin:0,fontWeight:800}}>
                                "¡Escuadrón <span style={{ color: theme.themeColor }}>{squadronName || 'Ganador'}</span>, miren todos los lugares increíbles por los que vamos a volar!"
                            </p>
                        </div>

                        {/* Destination Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {theme.destinos.map((destino) => {
                                const isRead = narrated.has(destino.name);
                                return (
                                    <button
                                        key={destino.name}
                                        onClick={() => toggleNarrated(destino.name)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 16,
                                            background: isRead
                                                ? `${theme.themeColor}15`
                                                : 'rgba(255,255,255,0.03)',
                                            border: `2px solid ${isRead ? theme.themeColor : 'rgba(255,255,255,0.08)'}`,
                                            borderRadius: 16, padding: '16px 18px',
                                            cursor: 'pointer', width: '100%', textAlign: 'left',
                                            transition: 'all 0.2s ease',
                                            outline: 'none'
                                        }}
                                    >
                                        {/* Check / Emoji */}
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                            background: isRead ? theme.themeColor : 'rgba(255,255,255,0.05)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.2s ease',
                                            fontSize: isRead ? 20 : 22
                                        }}>
                                            {isRead ? '✓' : destino.emoji}
                                        </div>

                                        <span style={{
                                            fontSize: 18, fontWeight: 800,
                                            color: isRead ? theme.themeColor : '#E2E8F0',
                                            transition: 'color 0.2s ease',
                                            textDecoration: isRead ? 'none' : 'none'
                                        }}>
                                            {destino.name}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Progress */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B' }}>
                                {narrated.size} de {theme.destinos.length} narrados
                            </span>
                            <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)' }}>
                                <div style={{
                                    height: '100%', borderRadius: 2,
                                    background: allNarrated ? '#22C55E' : theme.themeColor,
                                    width: `${theme.destinos.length > 0 ? (narrated.size / theme.destinos.length) * 100 : 0}%`,
                                    transition: 'width 0.3s ease, background 0.3s ease'
                                }} />
                            </div>
                        </div>

                        {/* CTA */}
                        <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                            <button 
                                onClick={handleProceedToCustom}
                                style={{ 
                                    width: '100%', padding: '20px', borderRadius: 16, border: 'none',
                                    background: allNarrated
                                        ? `linear-gradient(135deg, ${theme.themeColor}, ${theme.themeColor}CC)`
                                        : 'rgba(255,255,255,0.08)',
                                    color: allNarrated ? '#000' : '#94A3B8',
                                    fontSize: 16, fontWeight: 900,
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                    boxShadow: allNarrated ? `0 10px 25px ${theme.themeColor}44` : 'none',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <Sparkles size={20} />
                                {allNarrated ? '¡Ya los emocioné!' : 'Continuar'}
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ CUSTOM DESTINATION ═══ */}
                {step === 'custom_dest' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 420, margin: '0 auto', width: '100%', animation: 'fadeIn 0.3s ease-out' }}>
                        {/* Briefing Card */}
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                            borderRadius: 20, padding: '24px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            textAlign: 'center'
                        }}>
                            <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(168, 85, 247, 0.2)',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #A855F7', margin: '0 auto 16px'}}>
                                <span style={{fontSize:32}}>📍</span>
                            </div>
                            <p style={{fontSize:11,color:'#A855F7',fontWeight:900,textTransform:'uppercase',letterSpacing:'0.15em',margin:'0 0 12px'}}>
                                Pregúntales lo siguiente:
                            </p>
                            <p style={{fontSize:20,color:'white',lineHeight:1.4,margin:0,fontWeight:800}}>
                                "¡Escuadrón <span style={{ color: '#A855F7' }}>{squadronName || 'Ganador'}</span>! 
                                Ahora díganme... ¿a qué lugar cercano les gustaría volar? 
                                ¡Puede ser cualquier lugar!"
                            </p>
                        </div>

                        {/* Input */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <div style={{flex: 1, height: 1, background: 'rgba(255,255,255,0.1)'}} />
                                <span style={{fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em'}}>
                                    Escribe su respuesta:
                                </span>
                                <div style={{flex: 1, height: 1, background: 'rgba(255,255,255,0.1)'}} />
                            </div>

                            <div style={{
                                background: '#0F172A',
                                border: '2px solid #A855F7',
                                borderRadius: 20,
                                padding: '4px',
                                boxShadow: '0 8px 30px rgba(168, 85, 247, 0.15)'
                            }}>
                                <input
                                    type="text"
                                    value={destinoPersonalizado}
                                    onChange={(e) => setDestinoPersonalizado(e.target.value)}
                                    autoFocus
                                    placeholder="Ej: La plaza, El parque de..."
                                    maxLength={60}
                                    style={{
                                        width: '100%', padding: '18px 20px',
                                        background: 'transparent', border: 'none',
                                        color: '#FFFFFF', fontSize: 20, fontWeight: 700,
                                        outline: 'none', boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <p style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginTop: 8, textAlign: 'center' }}>
                                {destinoPersonalizado.trim()
                                    ? `El piloto verá: "${squadronName}" → "${destinoPersonalizado.trim()}"`
                                    : 'Si no escribes nada, se enviará solo el nombre del equipo'}
                            </p>
                        </div>

                        {/* CTA */}
                        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
                            <button 
                                onClick={handleConfirm}
                                style={{ 
                                    width: '100%', padding: '22px', borderRadius: 16, border: 'none',
                                    background: 'linear-gradient(135deg, #A855F7, #7C3AED)',
                                    color: '#FFFFFF',
                                    fontSize: 17, fontWeight: 900, textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                    boxShadow: '0 10px 25px rgba(168, 85, 247, 0.3)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <MapPin size={22} /> ¡LISTO, A VOLAR! 🚀
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
