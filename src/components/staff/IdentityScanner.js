'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

const SQUADRON_NAMES = [
    'Los Halcones','Las Águilas Doradas','Dragones del Aire','Tiburones Voladores',
    'Panteras Negras','Lobos del Cielo','Tigres Alados','Los Búhos Nocturnos',
    'Halcones de Fuego','Escuadrón Galáctico','Los Astros','Patrulla Estelar',
    'Guardianes del Espacio','Los Supersónicos','Viajeros Cósmicos','Los Meteoritos',
    'Cometas Veloces','Cazadores de Aliens','Los Relámpagos','Furia Ciclón',
    'Tormenta Eléctrica','Rayos de Fuego','Viento Salvaje','Fuerza Trueno',
    'Hielo y Fuego','Avalancha','Los Titanes','Escuadrón Alfa','Los Invencibles',
    'Fuerza Delta','Los Defensores','Héroes del Aire','Escuadrón Fantasma',
    'Misión X','Los Valientes'
];

const TEAM_A_COLOR = '#00D4FF';
const TEAM_B_COLOR = '#FF3366';
const NEON_GREEN = '#00FF88';
const PARTICLE_COUNT = 18;

export default function IdentityScanner({ isOpen, onResult, onClose, usedNames = [], timerSeconds }) {
    const [phase, setPhase] = useState('prompt_intro');

    const [nameA, setNameA] = useState('');
    const [nameB, setNameB] = useState('');
    const [winner, setWinner] = useState('');
    const [showVictory, setShowVictory] = useState(false);
    const [showName, setShowName] = useState(false);
    const [isPortrait, setIsPortrait] = useState(true);
    const [pressingTeam, setPressingTeam] = useState(null);
    const pressTimer = useRef(null);

    useEffect(() => {
        const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const pickRandomNames = useCallback(() => {
        const availableNames = SQUADRON_NAMES.filter(n => !usedNames.includes(n));
        const pool = availableNames.length >= 2 ? availableNames : SQUADRON_NAMES;
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        setNameA(shuffled[0]);
        setNameB(shuffled[1]);
    }, [usedNames]);

    const reset = useCallback(() => {
        setPhase('prompt_intro'); 
        pickRandomNames();
        setWinner(''); setShowVictory(false); setShowName(false);
        setPressingTeam(null);
        if (pressTimer.current) clearTimeout(pressTimer.current);
    }, [pickRandomNames]);

    useEffect(() => { if (!isOpen) reset(); }, [isOpen, reset]);

    const startBattle = useCallback(() => {
        if (!nameA || !nameB || nameA === nameB) return;
        setPhase('battle');
        try { navigator.vibrate?.([200, 100, 200, 100, 200]); } catch {}
    }, [nameA, nameB]);

    const handleSelectWinner = useCallback((teamName) => {
        setWinner(teamName); 
        setPhase('victory');
        setTimeout(() => setShowVictory(true), 50);
        setTimeout(() => {
            setShowName(true);
            try { navigator.vibrate?.([100, 50, 200]); } catch {}
        }, 300);
    }, []);

    const handlePressStart = useCallback((teamName) => {
        setPressingTeam(teamName);
        try { navigator.vibrate?.(50); } catch {}
        
        if (pressTimer.current) clearTimeout(pressTimer.current);
        
        pressTimer.current = setTimeout(() => {
            try { navigator.vibrate?.(200); } catch {}
            handleSelectWinner(teamName);
            setPressingTeam(null);
            pressTimer.current = null;
        }, 1000);
    }, [handleSelectWinner]);

    const handlePressEnd = useCallback(() => {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
        }
        setPressingTeam(null);
    }, []);

    const confirmWinner = useCallback(() => {
        if (winner) {
            onResult?.(winner);
        }
        reset();
    }, [winner, onResult, reset]);

    if (!isOpen) return null;

    const winColor = winner === nameA ? TEAM_A_COLOR : TEAM_B_COLOR;

    return (
        <div style={{
            position:'fixed',inset:0,zIndex:9999,background:'#0A0A0F',
            display:'flex',flexDirection:'column',overflow:'hidden',
            userSelect:'none'
        }}>
            {/* ═══ PROMPT INTRO ═══ */}
            {phase === 'prompt_intro' && (
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,gap:32,textAlign:'center'}}>
                    <div style={{width:80,height:80,borderRadius:'50%',background:`${NEON_GREEN}22`,display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid ${NEON_GREEN}`}}>
                        <span style={{fontSize:40}}>👋</span>
                    </div>
                    <div>
                        <p style={{fontSize:12,color:NEON_GREEN,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.15em',marginBottom:16}}>Instrucción para Supervisor</p>
                        <p style={{fontSize:24,color:'white',fontWeight:800,lineHeight:1.4}}>
                            "¡Hola! Bienvenidos a su misión. El día de hoy ustedes ya son tripulantes oficiales de FlyHigh. ¿Están listos para volar?"
                        </p>
                    </div>
                    <button onClick={() => { setPhase('radar'); try { navigator.vibrate?.(100); } catch {} }} style={{
                        marginTop:24,padding:'20px 48px',borderRadius:20,border:'none',
                        background:NEON_GREEN,color:'#0A0A0F',fontSize:18,fontWeight:900,
                        textTransform:'uppercase',cursor:'pointer',boxShadow:`0 0 40px ${NEON_GREEN}66`,
                        animation:'pulseBtn 1.5s infinite'
                    }}>
                        CONTINUAR
                    </button>
                    <button onClick={()=>{reset();onClose?.();}} style={{
                        background:'none',border:'none',color:'#475569',fontSize:12,fontWeight:600,
                        cursor:'pointer',marginTop:8
                    }}>Cancelar Dinámica</button>
                </div>
            )}

            {/* ═══ RADAR (Teleprompter) ═══ */}
            {phase === 'radar' && (
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',gap:24,textAlign:'center',maxWidth:600,margin:'0 auto'}}>
                    <div style={{width:64,height:64,borderRadius:'50%',background:`${NEON_GREEN}22`,display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid ${NEON_GREEN}`}}>
                        <span style={{fontSize:32}}>📢</span>
                    </div>
                    
                    <div style={{display:'flex',flexDirection:'column',gap:16,width:'100%'}}>
                        <p style={{fontSize:12,color:NEON_GREEN,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.15em',margin:0}}>
                            Dí lo siguiente en voz alta:
                        </p>
                        
                        <p style={{fontSize:22,color:'white',fontWeight:800,lineHeight:1.4,margin:0}}>
                            "¡Atención tripulación! ¿Cómo quieren que se llame su equipo? Les voy a dar dos opciones:<br/><br/>
                            ¿<span style={{color:TEAM_A_COLOR,textShadow:`0 0 20px ${TEAM_A_COLOR}88`}}>{nameA}</span> o <span style={{color:TEAM_B_COLOR,textShadow:`0 0 20px ${TEAM_B_COLOR}88`}}>{nameB}</span>?"
                        </p>

                        <div style={{
                            background:'rgba(255,255,255,0.05)',border:'1px dashed rgba(255,255,255,0.3)',
                            borderRadius:16,padding:'16px 20px',margin:'8px 0',
                            display:'flex',alignItems:'center',justifyContent:'center',gap:12
                        }}>
                            <span style={{fontSize:20}}>✋</span>
                            <span style={{fontSize:13,color:'#94A3B8',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em'}}>
                                Pausa: Deja que los niños decidan
                            </span>
                        </div>

                        <p style={{fontSize:22,color:'white',fontWeight:800,lineHeight:1.4,margin:0}}>
                            "Bueno chicos, ¡vamos a elegirlo levantando la mano!"
                        </p>
                    </div>

                    <div style={{display:'flex', flexDirection:'column', gap: 16, width:'100%', maxWidth:340, marginTop:16}}>
                        <button onClick={startBattle} disabled={!nameA||!nameB||nameA===nameB} style={{
                            padding:'20px 32px',borderRadius:20,border:'none',
                            background:`linear-gradient(135deg,${TEAM_A_COLOR},${TEAM_B_COLOR})`,
                            color:'white',fontSize:18,fontWeight:900,textTransform:'uppercase',
                            letterSpacing:'0.1em',cursor:'pointer',
                            boxShadow:`0 0 30px ${TEAM_A_COLOR}44, 0 0 30px ${TEAM_B_COLOR}44`,
                            transition:'all 0.3s',
                            animation:'pulseBtn 1.5s infinite'
                        }}>
                            INICIAR VOTACIÓN
                        </button>
                        
                        <button onClick={pickRandomNames} style={{
                            padding:'16px',borderRadius:16,border:'1px solid #334155',
                            background:'transparent',color:'#94A3B8',fontSize:14,fontWeight:700,
                            cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8
                        }}>
                            🎲 Re-sortear Nombres
                        </button>
                    </div>

                    <button onClick={()=>{reset();onClose?.();}} style={{
                        background:'none',border:'none',color:'#475569',fontSize:12,fontWeight:600,
                        cursor:'pointer',marginTop:8
                    }}>Cancelar Dinámica</button>
                </div>
            )}

            {timerSeconds !== undefined && (
                <div style={{
                    position:'absolute',top:20,right:20,zIndex: 10000,
                    background:'rgba(255,255,255,0.1)',borderRadius:100,
                    padding:'6px 14px',display:'flex',alignItems:'center',gap:8,
                    color:'white',fontWeight:800,fontSize:14
                }}>
                    ⏱️ {Math.floor(timerSeconds/60)}:{(timerSeconds%60).toString().padStart(2,'0')}
                </div>
            )}

            {/* ═══ BATTLE (VOTING BY LONG PRESS) ═══ */}
            {phase === 'battle' && (
                <div style={{
                    position:'absolute',
                    top: isPortrait ? '50%' : 0,
                    left: isPortrait ? '50%' : 0,
                    width: isPortrait ? '100vh' : '100vw',
                    height: isPortrait ? '100vw' : '100vh',
                    transform: isPortrait ? 'translate(-50%, -50%) rotate(90deg)' : 'none',
                    display:'flex',flexDirection:'row',overflow:'hidden',
                    transformOrigin:'center center',
                    background:'#0A0A0F'
                }}>
                    {/* Team A */}
                    <div 
                        onMouseDown={() => handlePressStart(nameA)}
                        onMouseUp={handlePressEnd}
                        onMouseLeave={handlePressEnd}
                        onTouchStart={(e) => { e.preventDefault(); handlePressStart(nameA); }}
                        onTouchEnd={(e) => { e.preventDefault(); handlePressEnd(); }}
                        onTouchCancel={handlePressEnd}
                        style={{
                            flex:1,display:'flex',flexDirection:'column',alignItems:'center',
                            justifyContent:'center',padding:'32px 16px',
                            background:`linear-gradient(180deg, ${TEAM_A_COLOR}11 0%, ${TEAM_A_COLOR}05 100%)`,
                            borderRight: '1px solid #1E293B', position: 'relative',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            transform: pressingTeam === nameA ? 'scale(0.98)' : 'scale(1)',
                            opacity: pressingTeam && pressingTeam !== nameA ? 0.4 : 1
                        }}
                    >
                        {pressingTeam === nameA && (
                            <div style={{
                                position: 'absolute', inset: 0, 
                                background: `${TEAM_A_COLOR}22`, 
                                animation: 'fillProgress 1s linear forwards',
                                transformOrigin: 'bottom',
                            }}/>
                        )}
                        <p style={{
                            fontSize: 36,fontWeight:900,color:TEAM_A_COLOR,textAlign:'center',
                            textTransform:'uppercase',letterSpacing:'0.05em',lineHeight:1.3,
                            zIndex: 10, pointerEvents: 'none', textShadow:`0 0 20px ${TEAM_A_COLOR}66`
                        }}>
                            {nameA}
                        </p>
                        <p style={{
                            fontSize: 12, color: TEAM_A_COLOR, opacity: pressingTeam === nameA ? 1 : 0.6, marginTop: 24, zIndex: 10,
                            textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 800,
                            transition: 'opacity 0.3s'
                        }}>
                            {pressingTeam === nameA ? 'Manten presionado...' : 'Mantén presionado para elegir'}
                        </p>
                    </div>

                    {/* Team B */}
                    <div 
                        onMouseDown={() => handlePressStart(nameB)}
                        onMouseUp={handlePressEnd}
                        onMouseLeave={handlePressEnd}
                        onTouchStart={(e) => { e.preventDefault(); handlePressStart(nameB); }}
                        onTouchEnd={(e) => { e.preventDefault(); handlePressEnd(); }}
                        onTouchCancel={handlePressEnd}
                        style={{
                            flex:1,display:'flex',flexDirection:'column',alignItems:'center',
                            justifyContent:'center',padding:'32px 16px',
                            background:`linear-gradient(180deg, ${TEAM_B_COLOR}11 0%, ${TEAM_B_COLOR}05 100%)`,
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            transform: pressingTeam === nameB ? 'scale(0.98)' : 'scale(1)',
                            opacity: pressingTeam && pressingTeam !== nameB ? 0.4 : 1
                        }}
                    >
                        {pressingTeam === nameB && (
                            <div style={{
                                position: 'absolute', inset: 0, 
                                background: `${TEAM_B_COLOR}22`, 
                                animation: 'fillProgress 1s linear forwards',
                                transformOrigin: 'bottom',
                            }}/>
                        )}
                        <p style={{
                            fontSize: 36,fontWeight:900,color:TEAM_B_COLOR,textAlign:'center',
                            textTransform:'uppercase',letterSpacing:'0.05em',lineHeight:1.3,
                            zIndex: 10, pointerEvents: 'none', textShadow:`0 0 20px ${TEAM_B_COLOR}66`
                        }}>
                            {nameB}
                        </p>
                        <p style={{
                            fontSize: 12, color: TEAM_B_COLOR, opacity: pressingTeam === nameB ? 1 : 0.6, marginTop: 24, zIndex: 10,
                            textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 800,
                            transition: 'opacity 0.3s'
                        }}>
                            {pressingTeam === nameB ? 'Manten presionado...' : 'Mantén presionado para elegir'}
                        </p>
                    </div>
                </div>
            )}

            {/* ═══ VICTORY ═══ */}
            {phase === 'victory' && (
                <div style={{
                    position:'absolute',
                    top: isPortrait ? '50%' : 0,
                    left: isPortrait ? '50%' : 0,
                    width: isPortrait ? '100vh' : '100vw',
                    height: isPortrait ? '100vw' : '100vh',
                    transform: isPortrait ? 'translate(-50%, -50%) rotate(90deg)' : 'none',
                    display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                    transformOrigin:'center center',
                    background: showVictory
                        ? `radial-gradient(ellipse at center, ${winColor}22 0%, #0A0A0F 70%)`
                        : '#000',
                    transition:'background 0.5s ease',
                    padding:24,overflow:'hidden'
                }}>
                    {showName && (
                        <>
                            {/* Particles */}
                            {Array.from({length:PARTICLE_COUNT}).map((_,i)=>(
                                <span key={i} style={{
                                    position:'absolute',
                                    left:`${5+Math.random()*90}%`,
                                    bottom:'-10px',
                                    width: 4+Math.random()*4,
                                    height: 4+Math.random()*4,
                                    borderRadius:'50%',
                                    background: i%3===0 ? winColor : i%3===1 ? '#FBBF24' : '#fff',
                                    opacity: 0.6+Math.random()*0.4,
                                    animation:`particleRise ${2+Math.random()*3}s ease-out ${Math.random()*1.5}s infinite`
                                }}/>
                            ))}

                            <p style={{
                                fontSize:10,fontWeight:900,color:winColor,textTransform:'uppercase',
                                letterSpacing:'0.3em',marginBottom:12,
                                animation:'fadeInUp 0.5s ease-out'
                            }}>⚡ Equipo Confirmado</p>

                            <h1 style={{
                                fontSize: winner.length > 15 ? 'clamp(40px, 8vmax, 120px)' : 'clamp(50px, 11vmax, 150px)',
                                width: '95%',
                                margin: '0 auto',
                                wordWrap: 'break-word',
                                fontWeight:900,color:'#fff',textAlign:'center',
                                textTransform:'uppercase',lineHeight:1.1,
                                textShadow:`0 0 20px ${winColor}, 0 0 40px ${winColor}88, 0 0 80px ${winColor}44`,
                                animation:'victoryPulse 2s ease-in-out infinite, fadeInScale 0.6s ease-out'
                            }}>{winner}</h1>

                            <button onClick={confirmWinner} style={{
                                marginTop:48,padding:'16px 36px',borderRadius:16,
                                border:`2px solid ${winColor}`,background:`${winColor}22`,
                                color:'white',fontSize:14,fontWeight:900,textTransform:'uppercase',
                                letterSpacing:'0.1em',cursor:'pointer',
                                boxShadow:`0 0 30px ${winColor}33`,
                                animation:'fadeInUp 1s ease-out'
                            }}>Confirmar Identidad</button>
                        </>
                    )}
                </div>
            )}

            <style>{`
                @keyframes radarSpin { to { transform: rotate(360deg); } }
                @keyframes corePulse {
                    0%,100% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
                    50% { transform: translate(-50%,-50%) scale(1.8); opacity: 0.5; }
                }
                @keyframes blink { 50% { opacity: 0; } }
                @keyframes pulseBtn {
                    0%,100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                @keyframes particleRise {
                    0% { transform: translateY(0) scale(1); opacity: 0.8; }
                    100% { transform: translateY(-90vh) scale(0.3); opacity: 0; }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.5); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes victoryPulse {
                    0%,100% { transform: scale(1); }
                    50% { transform: scale(1.03); }
                }
                @keyframes fillProgress {
                    0% { transform: scaleY(0); }
                    100% { transform: scaleY(1); }
                }
            `}</style>
        </div>
    );
}
