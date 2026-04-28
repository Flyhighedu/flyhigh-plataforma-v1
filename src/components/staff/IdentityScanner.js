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
    const [micError, setMicError] = useState(null);

    const start = useCallback(async () => {
        // Clean up any previous session first
        try {
            cancelAnimationFrame(rafRef.current);
            streamRef.current?.getTracks().forEach(t => t.stop());
            if (ctxRef.current && ctxRef.current.state !== 'closed') {
                await ctxRef.current.close().catch(() => {});
            }
        } catch {}
        streamRef.current = null; ctxRef.current = null; analyserRef.current = null;
        setMicError(null);

        try {
            // Check for secure context first
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("El navegador bloqueó el micrófono porque la conexión no es segura (HTTPS). Si estás probando en red local, usa un túnel HTTPS.");
            }

            // Step 1: Get microphone stream — try without filters first, fallback to basic
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { 
                        autoGainControl: { ideal: false }, 
                        echoCancellation: { ideal: false }, 
                        noiseSuppression: { ideal: false },
                        channelCount: 1,
                        sampleRate: { ideal: 44100 }
                    } 
                });
            } catch (constraintErr) {
                console.warn('IdentityScanner: Constraint mic failed, trying basic audio:', constraintErr);
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            streamRef.current = stream;
            console.log('IdentityScanner: Mic stream obtained, tracks:', stream.getAudioTracks().length);

            // Step 2: Create AudioContext — MUST happen during user gesture on iOS
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();
            ctxRef.current = ctx;
            console.log('IdentityScanner: AudioContext state:', ctx.state);

            // Step 3: Force resume — critical for iOS Safari
            if (ctx.state === 'suspended') {
                await ctx.resume();
                console.log('IdentityScanner: AudioContext resumed, state:', ctx.state);
            }

            // Step 4: Connect nodes
            const src = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.4;
            src.connect(analyser);
            analyserRef.current = analyser;
            setActive(true);

            // Step 5: Start analysis loop with DUAL strategy
            // iOS Safari sometimes returns all-zero for getByteFrequencyData
            // but getByteTimeDomainData (waveform) always works
            const freqBuf = new Uint8Array(analyser.frequencyBinCount);
            const timeBuf = new Uint8Array(analyser.frequencyBinCount);
            let zeroFrames = 0;
            let useTimeDomain = false;

            const tick = () => {
                if (!analyserRef.current) return;

                let rms = 0;

                if (!useTimeDomain) {
                    // Try frequency data first (more accurate for volume)
                    analyser.getByteFrequencyData(freqBuf);
                    let sum = 0;
                    for (let i = 0; i < freqBuf.length; i++) sum += freqBuf[i] * freqBuf[i];
                    rms = Math.sqrt(sum / freqBuf.length);

                    // If we get 30+ consecutive zero frames, iOS isn't giving us freq data
                    if (rms < 0.1) {
                        zeroFrames++;
                        if (zeroFrames > 30) {
                            useTimeDomain = true;
                            console.warn('IdentityScanner: Frequency data empty, switching to waveform mode');
                        }
                    } else {
                        zeroFrames = 0;
                    }
                }

                if (useTimeDomain) {
                    // Fallback: compute RMS from time-domain waveform (128 = silence center)
                    analyser.getByteTimeDomainData(timeBuf);
                    let sum = 0;
                    for (let i = 0; i < timeBuf.length; i++) {
                        const v = (timeBuf[i] - 128) / 128;
                        sum += v * v;
                    }
                    rms = Math.sqrt(sum / timeBuf.length) * 255; // scale to match freq range
                }
                
                // Linear scale: RMS of 80+ = 100%
                const normalized = Math.min(100, Math.max(0, Math.round((rms / 80) * 100)));
                levelRef.current = normalized;
                setLevel(normalized);
                rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
            console.log('IdentityScanner: Audio analysis loop started');
        } catch (e) {
            console.error('IdentityScanner: Mic access failed:', e);
            setMicError(e.message || 'No se pudo acceder al micrófono');
        }
    }, []);

    const stop = useCallback(() => {
        cancelAnimationFrame(rafRef.current);
        streamRef.current?.getTracks().forEach(t => t.stop());
        if (ctxRef.current && ctxRef.current.state !== 'closed') {
            ctxRef.current.close().catch(() => {});
        }
        streamRef.current = null; ctxRef.current = null; analyserRef.current = null;
        setActive(false); setLevel(0); levelRef.current = 0;
    }, []);

    useEffect(() => () => { cancelAnimationFrame(rafRef.current); stop(); }, [stop]);

    return { level, levelRef, active, start, stop, micError };
}

export default function IdentityScanner({ isOpen, onResult, onClose, usedNames = [], timerSeconds }) {
    const [phase, setPhase] = useState('prompt_intro');

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
    const { level, levelRef, active: micActive, start: startMic, stop: stopMic, micError } = useAudioAnalyser();
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
        setPhase('prompt_intro'); 

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
        setPhase('prompt_A');
        try { navigator.vibrate?.([200, 100, 200, 100, 200]); } catch {}
    }, [nameA, nameB, startMic]);

    const declareWinner = useCallback(() => {
        let w;
        const diff = Math.abs(peakARef.current - peakBRef.current);
        
        if (diff < 3) {
            w = Math.random() < 0.5 ? nameA : nameB;
        } else {
            w = peakARef.current >= peakBRef.current ? nameA : nameB;
        }
        
        setWinner(w); stopMic(); setPhase('victory');
        setTimeout(() => setShowVictory(true), 50);
        setTimeout(() => {
            setShowName(true);
            try { navigator.vibrate?.([100, 50, 200]); } catch {}
        }, 300);
        
    }, [nameA, nameB, stopMic]);

    const startCapture = useCallback((team) => {
        setPhase('battle');
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
                    
                    if (team === 'A') {
                        setPhase('prompt_B');
                        try { navigator.vibrate?.([200, 100, 200, 100, 200]); } catch {}
                    } else if (team === 'B') {
                        declareWinner();
                    }
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    }, [declareWinner]);

    const confirmWinner = useCallback(() => {
        if (winner) {
            onResult?.(winner);
        }
        reset();
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
                            <span style={{fontSize:20}}>🛑</span>
                            <span style={{fontSize:13,color:'#94A3B8',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.1em'}}>
                                Pausa: Deja que los niños griten
                            </span>
                        </div>

                        <p style={{fontSize:22,color:'white',fontWeight:800,lineHeight:1.4,margin:0}}>
                            "Bueno chicos, ¡vamos a elegirlo con un grito!"
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
                            INICIAR BATALLA
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
                            position:'absolute',top:20,right:20,
                            background:'rgba(255,255,255,0.1)',borderRadius:100,
                            padding:'6px 14px',display:'flex',alignItems:'center',gap:8,
                            color:'white',fontWeight:800,fontSize:14
                        }}>
                            ⏱️ {Math.floor(timerSeconds/60)}:{(timerSeconds%60).toString().padStart(2,'0')}
                        </div>
                    )}

            {/* ═══ PROMPT A ═══ */}
            {phase === 'prompt_A' && (
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,gap:32,textAlign:'center'}}>
                    <div style={{width:80,height:80,borderRadius:'50%',background:`${TEAM_A_COLOR}22`,display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid ${TEAM_A_COLOR}`}}>
                        <span style={{fontSize:40}}>📢</span>
                    </div>
                    <div>
                        <p style={{fontSize:12,color:TEAM_A_COLOR,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.15em',marginBottom:16}}>Instrucción para Supervisor</p>
                        <p style={{fontSize:24,color:'white',fontWeight:800,lineHeight:1.4}}>
                            "Niños, los que quieran llamarse <span style={{color:TEAM_A_COLOR,textShadow:`0 0 15px ${TEAM_A_COLOR}88`}}>{nameA}</span>, ¡necesito que griten tan fuerte como puedan a la cuenta de 3!"
                        </p>
                    </div>
                    <button onClick={() => startCapture('A')} style={{
                        marginTop:24,padding:'20px 48px',borderRadius:20,border:'none',
                        background:TEAM_A_COLOR,color:'#0A0A0F',fontSize:20,fontWeight:900,
                        textTransform:'uppercase',cursor:'pointer',boxShadow:`0 0 40px ${TEAM_A_COLOR}66`,
                        animation:'pulseBtn 1.5s infinite'
                    }}>
                        ¡A GRITAR!
                    </button>
                </div>
            )}

            {/* ═══ PROMPT B ═══ */}
            {phase === 'prompt_B' && (
                <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,gap:32,textAlign:'center'}}>
                    <div style={{width:80,height:80,borderRadius:'50%',background:`${TEAM_B_COLOR}22`,display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid ${TEAM_B_COLOR}`}}>
                        <span style={{fontSize:40}}>📢</span>
                    </div>
                    <div>
                        <p style={{fontSize:12,color:TEAM_B_COLOR,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.15em',marginBottom:16}}>Instrucción para Supervisor</p>
                        <p style={{fontSize:24,color:'white',fontWeight:800,lineHeight:1.4}}>
                            "¡Muy bien! Ahora, los que quieran ser <span style={{color:TEAM_B_COLOR,textShadow:`0 0 15px ${TEAM_B_COLOR}88`}}>{nameB}</span>... ¡Es su turno! ¡Griten con toda su fuerza!"
                        </p>
                    </div>
                    <button onClick={() => startCapture('B')} style={{
                        marginTop:24,padding:'20px 48px',borderRadius:20,border:'none',
                        background:TEAM_B_COLOR,color:'white',fontSize:20,fontWeight:900,
                        textTransform:'uppercase',cursor:'pointer',boxShadow:`0 0 40px ${TEAM_B_COLOR}66`,
                        animation:'pulseBtn 1.5s infinite'
                    }}>
                        ¡A GRITAR!
                    </button>
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

                    {/* Mic status indicator */}
                    {micError && (
                        <div style={{
                            position:'absolute',bottom:20,left:'50%',transform:'translateX(-50%)',
                            background:'rgba(255,50,50,0.9)',borderRadius:12,zIndex:100,
                            padding:'8px 16px',color:'white',fontWeight:700,fontSize:12,
                            maxWidth:'80%',textAlign:'center'
                        }}>
                            🎤 Error: {micError}
                        </div>
                    )}
                    {!micError && capturing && (
                        <div style={{
                            position:'absolute',bottom:20,left:'50%',transform:'translateX(-50%)',
                            background:'rgba(0,255,136,0.15)',borderRadius:100,zIndex:100,
                            padding:'6px 14px',display:'flex',alignItems:'center',gap:8,
                            color:NEON_GREEN,fontWeight:800,fontSize:12
                        }}>
                            <div style={{width:8,height:8,borderRadius:'50%',background:NEON_GREEN,animation:'corePulse 1s infinite'}}/>
                            🎤 Nivel: {level}
                        </div>
                    )}                    {/* Team A */}
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

                    {/* No need for the bothCaptured declare winner overlay anymore, it is handled by prompt_eval */}
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
