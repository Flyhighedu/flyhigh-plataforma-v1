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

function useAudioAnalyser() {
    const ctxRef = useRef(null);
    const analyserRef = useRef(null);
    const streamRef = useRef(null);
    const rafRef = useRef(null);
    const levelRef = useRef(0);
    const [level, setLevel] = useState(0);
    const [active, setActive] = useState(false);

    const start = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            ctxRef.current = ctx;
            const src = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.3;
            src.connect(analyser);
            analyserRef.current = analyser;
            setActive(true);

            const buf = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
                analyser.getByteFrequencyData(buf);
                let sum = 0;
                for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
                const rms = Math.sqrt(sum / buf.length);
                // Hacer que sea mucho más difícil llegar al 100% (escala no lineal cúbica)
                // RMS máximo real ronda los 230-250.
                const normalized = Math.min(100, Math.max(0, Math.round(Math.pow(rms / 230, 3) * 100)));
                levelRef.current = normalized;
                setLevel(normalized);
                rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
        } catch (e) {
            console.warn('Mic access failed:', e);
        }
    }, []);

    const stop = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
        ctxRef.current?.close().catch(() => {});
        streamRef.current = null; ctxRef.current = null; analyserRef.current = null;
        setActive(false); setLevel(0); levelRef.current = 0;
    }, []);

    useEffect(() => () => { cancelAnimationFrame(rafRef.current); stop(); }, [stop]);

    return { level, levelRef, active, start, stop };
}

export default function IdentityScanner({ isOpen, onResult, onClose, usedNames = [], timerSeconds }) {
    const [phase, setPhase] = useState('radar');
    const [isTie, setIsTie] = useState(false);
    const [nameA, setNameA] = useState('');
    const [nameB, setNameB] = useState('');
    const [peakA, setPeakA] = useState(0);
    const [peakB, setPeakB] = useState(0);
    const [capturing, setCapturing] = useState(null);
    const [winner, setWinner] = useState('');
    const [showVictory, setShowVictory] = useState(false);
    const [showName, setShowName] = useState(false);
    const [countdown, setCountdown] = useState(null);
    const timerRef = useRef(null);
    const capturingRef = useRef(null);
    const peakARef = useRef(0);
    const peakBRef = useRef(0);
    const { level, levelRef, active: micActive, start: startMic, stop: stopMic } = useAudioAnalyser();
    const [isPortrait, setIsPortrait] = useState(true);

    useEffect(() => {
        const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Track peaks in RAF
    useEffect(() => {
        if (!micActive) return;
        let raf;
        const track = () => {
            const cur = levelRef.current;
            if (capturingRef.current === 'A' && cur > peakARef.current) {
                peakARef.current = cur; setPeakA(cur);
            }
            if (capturingRef.current === 'B' && cur > peakBRef.current) {
                peakBRef.current = cur; setPeakB(cur);
            }
            raf = requestAnimationFrame(track);
        };
        raf = requestAnimationFrame(track);
        return () => cancelAnimationFrame(raf);
    }, [micActive, levelRef]);

    const pickRandomNames = useCallback(() => {
        const availableNames = SQUADRON_NAMES.filter(n => !usedNames.includes(n));
        const pool = availableNames.length >= 2 ? availableNames : SQUADRON_NAMES;
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        setNameA(shuffled[0]);
        setNameB(shuffled[1]);
    }, [usedNames]);

    const reset = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setCountdown(null);
        setPhase('radar'); 
        setIsTie(false);
        pickRandomNames();
        setPeakA(0); setPeakB(0); peakARef.current = 0; peakBRef.current = 0;
        setCapturing(null); capturingRef.current = null;
        setWinner(''); setShowVictory(false); setShowName(false);
        stopMic();
    }, [stopMic, pickRandomNames]);

    useEffect(() => { if (!isOpen) reset(); }, [isOpen, reset]);

    const startBattle = useCallback(async () => {
        if (!nameA || !nameB || nameA === nameB) return;
        setPeakA(0); setPeakB(0); peakARef.current = 0; peakBRef.current = 0;
        await startMic();
        setPhase('battle');
    }, [nameA, nameB, startMic]);

    const startCapture = useCallback((team) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setCapturing(team); 
        capturingRef.current = team;
        setCountdown(8);
        timerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    setCapturing(null);
                    capturingRef.current = null;
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    const declareWinner = useCallback(() => {
        const w = peakARef.current >= peakBRef.current ? nameA : nameB;
        if (Math.abs(peakARef.current - peakBRef.current) < 3) {
            setIsTie(true);
            setTimeout(() => {
                peakARef.current = 0; peakBRef.current = 0; setPeakA(0); setPeakB(0);
                setIsTie(false);
            }, 2500);
            return;
        }
        setWinner(w); stopMic(); setPhase('victory');
        setTimeout(() => setShowVictory(true), 50);
        setTimeout(() => {
            setShowName(true);
            try { navigator.vibrate?.([100, 50, 200]); } catch {}
        }, 300);
    }, [nameA, nameB, stopMic]);

    const confirmWinner = useCallback(() => {
        onResult?.(winner); reset();
    }, [winner, onResult, reset]);

    if (!isOpen) return null;

    const liveA = capturing === 'A' ? level : 0;
    const liveB = capturing === 'B' ? level : 0;
    const barA = Math.max(peakA, liveA);
    const barB = Math.max(peakB, liveB);
    const bothCaptured = peakA > 0 && peakB > 0 && !capturing;
    const winColor = winner === nameA ? TEAM_A_COLOR : TEAM_B_COLOR;

    return (
        <div style={{
            position:'fixed',inset:0,zIndex:9999,background:'#0A0A0F',
            display:'flex',flexDirection:'column',overflow:'hidden'
        }}>
            {/* ═══ RADAR ═══ */}
            {phase === 'radar' && (
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:24,gap:24}}>
                    {/* Radar animation */}
                    <div style={{position:'relative',width:180,height:180}}>
                        <div style={{
                            position:'absolute',inset:0,borderRadius:'50%',
                            border:`2px solid ${NEON_GREEN}33`,
                            boxShadow:`0 0 30px ${NEON_GREEN}22, inset 0 0 30px ${NEON_GREEN}11`
                        }}/>
                        <div style={{
                            position:'absolute',inset:'15%',borderRadius:'50%',
                            border:`1px solid ${NEON_GREEN}22`
                        }}/>
                        <div style={{
                            position:'absolute',inset:'35%',borderRadius:'50%',
                            border:`1px solid ${NEON_GREEN}22`
                        }}/>
                        <div style={{
                            position:'absolute',inset:0,borderRadius:'50%',
                            background:`conic-gradient(from 0deg, transparent 0deg, ${NEON_GREEN}44 30deg, transparent 60deg)`,
                            animation:'radarSpin 2s linear infinite'
                        }}/>
                        <div style={{
                            position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
                            width:12,height:12,borderRadius:'50%',background:NEON_GREEN,
                            boxShadow:`0 0 20px ${NEON_GREEN}, 0 0 40px ${NEON_GREEN}88`,
                            animation:'corePulse 1.5s ease-in-out infinite'
                        }}/>
                    </div>

                    <div style={{textAlign:'center'}}>
                        <p style={{
                            fontFamily:'monospace',fontSize:14,fontWeight:900,
                            color:NEON_GREEN,textTransform:'uppercase',letterSpacing:'0.25em',
                            animation:'blink 1s step-end infinite'
                        }}>Se Requiere Identidad</p>
                        <p style={{fontSize:11,color:'#64748B',marginTop:6}}>
                            Selecciona dos nombres para la batalla de gritos
                        </p>
                    </div>

                    {/* Name selectors (Randomized) */}
                    <div style={{width:'100%',maxWidth:340,display:'flex',flexDirection:'column',gap:12}}>
                        <div style={{
                            width:'100%',padding:'14px',borderRadius:12,textAlign:'center',
                            background:'#111827',border:`2px solid ${TEAM_A_COLOR}`,
                            color:'white',fontSize:16,fontWeight:800,
                            boxShadow:`0 0 15px ${TEAM_A_COLOR}22`
                        }}>
                            <span style={{fontSize:10,color:TEAM_A_COLOR,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.1em'}}>⚡ Equipo A</span>
                            {nameA}
                        </div>
                        
                        <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap: 12}}>
                            <div style={{height:1, flex:1, background:'#334155'}}/>
                            <div style={{color:'#64748B',fontWeight:900,fontSize:12}}>VS</div>
                            <div style={{height:1, flex:1, background:'#334155'}}/>
                        </div>
                        
                        <div style={{
                            width:'100%',padding:'14px',borderRadius:12,textAlign:'center',
                            background:'#111827',border:`2px solid ${TEAM_B_COLOR}`,
                            color:'white',fontSize:16,fontWeight:800,
                            boxShadow:`0 0 15px ${TEAM_B_COLOR}22`
                        }}>
                            <span style={{fontSize:10,color:TEAM_B_COLOR,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.1em'}}>🔥 Equipo B</span>
                            {nameB}
                        </div>
                    </div>

                    <div style={{display:'flex', flexDirection:'column', gap: 12, width:'100%', maxWidth:340}}>
                        <button onClick={pickRandomNames} style={{
                            padding:'12px',borderRadius:12,border:'1px solid #334155',
                            background:'transparent',color:'#94A3B8',fontSize:12,fontWeight:700,
                            cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8
                        }}>
                            🎲 Re-sortear Nombres
                        </button>
                        
                        <button onClick={startBattle} disabled={!nameA||!nameB||nameA===nameB} style={{
                            padding:'16px 32px',borderRadius:14,border:'none',
                            background:`linear-gradient(135deg,${TEAM_A_COLOR},${TEAM_B_COLOR})`,
                            color:'white',fontSize:14,fontWeight:900,textTransform:'uppercase',
                            letterSpacing:'0.1em',cursor:'pointer',
                            boxShadow:`0 0 30px ${TEAM_A_COLOR}44, 0 0 30px ${TEAM_B_COLOR}44`,
                            transition:'all 0.3s'
                        }}>
                            Iniciar Batalla
                        </button>
                    </div>

                    <button onClick={()=>{reset();onClose?.();}} style={{
                        background:'none',border:'none',color:'#475569',fontSize:12,fontWeight:600,
                        cursor:'pointer',marginTop:8
                    }}>Cancelar</button>

                    {timerSeconds !== undefined && (
                        <div style={{
                            position:'absolute',top:20,right:20,
                            background:'rgba(255,255,255,0.1)',borderRadius:100,
                            padding:'6px 14px',display:'flex',alignItems:'center',gap:8,
                            color:'white',fontWeight:800,fontSize:14
                        }}>
                            ⏱️ {Math.floor(timerSeconds/60)}:{(timerSeconds%60).toString().padStart(2,'0')}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ BATTLE ═══ */}
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
                    {/* HUD BATTLE INFO */}
                    {timerSeconds !== undefined && (
                        <div style={{
                            position:'absolute',top:20,left:'50%',transform:'translateX(-50%)',
                            background:'rgba(255,255,255,0.1)',borderRadius:100,zIndex:100,
                            padding:'6px 14px',display:'flex',alignItems:'center',gap:8,
                            color:'white',fontWeight:800,fontSize:14
                        }}>
                            ⏱️ {Math.floor(timerSeconds/60)}:{(timerSeconds%60).toString().padStart(2,'0')}
                        </div>
                    )}

                    {/* TIE BREAKER HUD */}
                    {isTie && (
                        <div style={{
                            position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
                            background:'rgba(220, 38, 38, 0.95)',color:'white',padding:'24px 40px',
                            borderRadius:24,fontSize:32,fontWeight:900,textTransform:'uppercase',
                            letterSpacing:'0.1em',zIndex:100,boxShadow:'0 0 50px rgba(220,38,38,0.6)',
                            animation:'corePulse 0.5s ease-in-out infinite',textAlign:'center'
                        }}>
                            ¡EMPATE!<br/>
                            <span style={{fontSize:16,fontWeight:700,letterSpacing:'normal'}}>Reiniciando energía...</span>
                        </div>
                    )}

                    {/* Team A */}
                    {(!capturing || capturing === 'A') && (
                        <div style={{
                            flex:1,display:'flex',flexDirection:'column',alignItems:'center',
                            justifyContent:'space-between',padding: capturing ? '32px 16px' : '24px 12px',
                            background:`linear-gradient(180deg, ${TEAM_A_COLOR}11 0%, ${TEAM_A_COLOR}05 100%)`,
                            borderRight: capturing ? 'none' : '1px solid #1E293B'
                        }}>
                            <p style={{fontSize: capturing ? 48 : 13,fontWeight:900,color:TEAM_A_COLOR,textAlign:'center',
                                textTransform:'uppercase',letterSpacing:'0.05em',lineHeight:1.3}}>
                                {nameA}
                            </p>
                            {/* Energy bar */}
                            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',
                                justifyContent:'flex-end',width:'100%',maxWidth: capturing ? 160 : 80,margin:'12px 0'}}>
                                <p style={{fontSize: capturing ? 64 : 28,fontWeight:900,color:TEAM_A_COLOR,marginBottom:8,
                                    textShadow:`0 0 15px ${TEAM_A_COLOR}88`}}>{peakA}</p>
                                <div style={{width:'100%',height: capturing ? '80%' : '60%',borderRadius:12,
                                    background:'#0F172A',border:`2px solid ${TEAM_A_COLOR}33`,
                                    position:'relative',overflow:'hidden'}}>
                                    <div style={{
                                        position:'absolute',bottom:0,left:0,right:0,
                                        height:`${barA}%`,borderRadius:10,
                                        background:`linear-gradient(0deg, ${TEAM_A_COLOR}, ${TEAM_A_COLOR}88)`,
                                        boxShadow:`0 0 20px ${TEAM_A_COLOR}66, inset 0 0 15px ${TEAM_A_COLOR}44`,
                                        transition: capturing==='A' ? 'height 0.05s linear' : 'height 0.3s ease-out'
                                    }}/>
                                </div>
                            </div>
                            
                            {!capturing ? (
                                <button
                                    onClick={() => startCapture('A')}
                                    style={{
                                        width:'100%',maxWidth:140,padding:'16px 0',borderRadius:16,
                                        border:`2px solid ${TEAM_A_COLOR}`,
                                        background:'transparent',
                                        color:TEAM_A_COLOR,
                                        fontSize:11,fontWeight:900,textTransform:'uppercase',
                                        letterSpacing:'0.1em',cursor:'pointer',
                                        transition:'all 0.15s',userSelect:'none',WebkitUserSelect:'none'
                                    }}
                                >Capturar</button>
                            ) : (
                                <div style={{
                                    fontSize: 80, fontWeight: 900, color: '#fff',
                                    textShadow:`0 0 20px ${TEAM_A_COLOR}, 0 0 40px ${TEAM_A_COLOR}`,
                                    animation: 'pulseBtn 1s ease-in-out infinite'
                                }}>{countdown}</div>
                            )}
                        </div>
                    )}

                    {/* Team B */}
                    {(!capturing || capturing === 'B') && (
                        <div style={{
                            flex:1,display:'flex',flexDirection:'column',alignItems:'center',
                            justifyContent:'space-between',padding: capturing ? '32px 16px' : '24px 12px',
                            background:`linear-gradient(180deg, ${TEAM_B_COLOR}11 0%, ${TEAM_B_COLOR}05 100%)`
                        }}>
                            <p style={{fontSize: capturing ? 48 : 13,fontWeight:900,color:TEAM_B_COLOR,textAlign:'center',
                                textTransform:'uppercase',letterSpacing:'0.05em',lineHeight:1.3}}>
                                {nameB}
                            </p>
                            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',
                                justifyContent:'flex-end',width:'100%',maxWidth: capturing ? 160 : 80,margin:'12px 0'}}>
                                <p style={{fontSize: capturing ? 64 : 28,fontWeight:900,color:TEAM_B_COLOR,marginBottom:8,
                                    textShadow:`0 0 15px ${TEAM_B_COLOR}88`}}>{peakB}</p>
                                <div style={{width:'100%',height: capturing ? '80%' : '60%',borderRadius:12,
                                    background:'#0F172A',border:`2px solid ${TEAM_B_COLOR}33`,
                                    position:'relative',overflow:'hidden'}}>
                                    <div style={{
                                        position:'absolute',bottom:0,left:0,right:0,
                                        height:`${barB}%`,borderRadius:10,
                                        background:`linear-gradient(0deg, ${TEAM_B_COLOR}, ${TEAM_B_COLOR}88)`,
                                        boxShadow:`0 0 20px ${TEAM_B_COLOR}66, inset 0 0 15px ${TEAM_B_COLOR}44`,
                                        transition: capturing==='B' ? 'height 0.05s linear' : 'height 0.3s ease-out'
                                    }}/>
                                </div>
                            </div>
                            
                            {!capturing ? (
                                <button
                                    onClick={() => startCapture('B')}
                                    style={{
                                        width:'100%',maxWidth:140,padding:'16px 0',borderRadius:16,
                                        border:`2px solid ${TEAM_B_COLOR}`,
                                        background:'transparent',
                                        color:TEAM_B_COLOR,
                                        fontSize:11,fontWeight:900,textTransform:'uppercase',
                                        letterSpacing:'0.1em',cursor:'pointer',
                                        transition:'all 0.15s',userSelect:'none',WebkitUserSelect:'none'
                                    }}
                                >Capturar</button>
                            ) : (
                                <div style={{
                                    fontSize: 80, fontWeight: 900, color: '#fff',
                                    textShadow:`0 0 20px ${TEAM_B_COLOR}, 0 0 40px ${TEAM_B_COLOR}`,
                                    animation: 'pulseBtn 1s ease-in-out infinite'
                                }}>{countdown}</div>
                            )}
                        </div>
                    )}

                    {/* Declare winner overlay */}
                    {bothCaptured && (
                        <div style={{
                            position:'absolute',bottom:24,left:'50%',transform:'translateX(-50%)',zIndex:10
                        }}>
                            <button onClick={declareWinner} style={{
                                padding:'14px 28px',borderRadius:16,border:'none',
                                background:'linear-gradient(135deg, #FBBF24, #F59E0B)',
                                color:'#000',fontSize:13,fontWeight:900,textTransform:'uppercase',
                                letterSpacing:'0.1em',cursor:'pointer',
                                boxShadow:'0 0 30px #FBBF2444',animation:'pulseBtn 1.5s ease-in-out infinite'
                            }}>⚡ Declarar Ganador</button>
                        </div>
                    )}
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
                            }}>⚡ Escuadrón Confirmado</p>

                            <h1 style={{
                                fontSize: winner.length > 18 ? 36 : winner.length > 12 ? 48 : 60,
                                fontWeight:900,color:'#fff',textAlign:'center',
                                textTransform:'uppercase',lineHeight:1.1,
                                textShadow:`0 0 20px ${winColor}, 0 0 40px ${winColor}88, 0 0 80px ${winColor}44`,
                                animation:'victoryPulse 2s ease-in-out infinite, fadeInScale 0.6s ease-out'
                            }}>{winner}</h1>

                            <p style={{
                                fontSize:14,color:'#94A3B8',marginTop:16,fontWeight:700,
                                animation:'fadeInUp 0.8s ease-out'
                            }}>
                                Energía: <span style={{color:TEAM_A_COLOR,fontWeight:900}}>{peakA}</span>
                                {' vs '}
                                <span style={{color:TEAM_B_COLOR,fontWeight:900}}>{peakB}</span>
                            </p>

                            <button onClick={confirmWinner} style={{
                                marginTop:32,padding:'16px 36px',borderRadius:16,
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
            `}</style>
        </div>
    );
}
