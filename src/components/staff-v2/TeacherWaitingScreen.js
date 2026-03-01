'use client';

// =====================================================
// TeacherWaitingScreen.js
// Pantallas de estado dinámicas para el Docente
// 1. Apoyo en bodega (Purple) -> Initial/Default
// 2. Momento de cargar (Blue) -> Pilot Ready
// 3. Iniciar ruta (Blue + Slider) -> All Ready
// =====================================================

import { useState, useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import SyncHeader from './SyncHeader';

export default function TeacherWaitingScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    onRouteStarted,
    preview = false
}) {
    const [missionState, setMissionState] = useState('TEACHER_SUPPORTING_PILOT');
    const [startingRoute, setStartingRoute] = useState(false);
    const [dotIndex, setDotIndex] = useState(0);

    // --- Slide to confirm state ---
    const [sliderX, setSliderX] = useState(0);
    const sliderRef = useRef(null);
    const isDragging = useRef(false);

    const firstName = profile?.full_name?.split(' ')[0] || 'Docente';
    const roleName = ROLE_LABELS[profile?.role] || 'Docente';

    // Subscripción a cambios de estado en tiempo real
    useEffect(() => {
        if (!journeyId) return;
        const supabase = createClient();

        const fetchInitialState = async () => {
            const { data } = await supabase
                .from('staff_journeys')
                .select('mission_state')
                .eq('id', journeyId)
                .single();
            if (data?.mission_state) setMissionState(data.mission_state);
        };
        fetchInitialState();

        const channel = supabase
            .channel(`teacher_sync_${journeyId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'staff_journeys', filter: `id=eq.${journeyId}` },
                (payload) => {
                    const newState = payload.new?.mission_state;
                    if (newState) setMissionState(newState);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [journeyId]);

    // Animación de puntos
    useEffect(() => {
        const interval = setInterval(() => {
            setDotIndex(prev => (prev + 1) % 3);
        }, 600);
        return () => clearInterval(interval);
    }, []);

    const handleStartRoute = async () => {
        if (startingRoute || preview) {
            if (preview) onRouteStarted && onRouteStarted();
            return;
        }
        setStartingRoute(true);
        try {
            const supabase = createClient();
            // Actualizar estado global a ROUTE_IN_PROGRESS
            await supabase.from('staff_journeys')
                .update({
                    mission_state: 'ROUTE_IN_PROGRESS',
                    updated_at: new Date().toISOString()
                })
                .eq('id', journeyId);

            if (onRouteStarted) onRouteStarted();
        } catch (e) {
            console.error('Error starting route:', e);
            setStartingRoute(false);
        }
    };

    // --- Slider Logic ---
    const handleSliderStart = () => { isDragging.current = true; };
    const handleSliderMove = (e) => {
        if (!isDragging.current || !sliderRef.current) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let x = clientX - rect.left - 30; // 30 is thumb width approx
        const maxX = rect.width - 64; // 64 is button width
        x = Math.max(0, Math.min(x, maxX));
        setSliderX(x);

        if (x >= maxX * 0.95) {
            isDragging.current = false;
            setSliderX(maxX);
            handleStartRoute();
        }
    };
    const handleSliderEnd = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        if (sliderX < (sliderRef.current?.offsetWidth || 0) * 0.8) {
            setSliderX(0);
        }
    };

    // --- UI DETERMINATION ---
    let title = "";
    let subtitle = "";
    let iconName = "";
    let showSlider = false;
    let bgGradient = 'linear-gradient(180deg, #1EA1FF 0%, #007AFF 100%)'; // Default Blue
    let waitPhase = 'warehouse'; // 'warehouse' or 'load'

    // Logic to determine text/state based on missionState
    if (missionState === 'AUX_CONTAINERS_DONE' || missionState === 'ROUTE_IN_PROGRESS') {
        // FASE 3: Todo listo (Blue)
        title = "Todo listo";
        subtitle = "Carga confirmada. Inicia el recorrido a la escuela.";
        iconName = "check";
        showSlider = true;
        bgGradient = 'linear-gradient(180deg, #1EA1FF 0%, #007AFF 100%)';
        waitPhase = 'load';
    } else if (missionState === 'WAITING_AUX_VEHICLE_CHECK' || missionState === 'PILOT_READY_FOR_LOAD') {
        // FASE 2: Momento de cargar (Blue)
        title = "Momento de cargar";
        subtitle = "¡Manos a la obra! Es momento de trasladar y acomodar los contenedores en el vehículo. Sigue las indicaciones del equipo para una carga segura.";
        iconName = "local_shipping";
        bgGradient = 'linear-gradient(180deg, #1EA1FF 0%, #007AFF 100%)';
        waitPhase = 'load';
    } else {
        // FASE 1: Apoyo en bodega (Purple)
        title = "Apoyo en bodega";
        subtitle = "Mientras se termina la verificación electrónica, ayuda a acomodar contenedores y preparar la carga. Te avisaremos automáticamente.";
        iconName = "inventory_2"; // Warehouse/Boxes icon
        bgGradient = 'linear-gradient(180deg, #8B5CF6 0%, #6D28D9 100%)'; // FlyHigh Purple
        waitPhase = 'warehouse';
    }


    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            background: bgGradient, // Dynamic Gradient
            color: 'white', minHeight: '100vh',
            display: 'flex', flexDirection: 'column',
            WebkitFontSmoothing: 'antialiased',
            position: 'relative'
        }}>
            <SyncHeader
                firstName={firstName}
                roleName={roleName}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                isWaitScreen={true}
                waitPhase={waitPhase}
            />

            {/* Main Content */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', textAlign: 'center' }}>
                <div style={{ position: 'relative', marginBottom: 40 }}>
                    <div style={{ position: 'absolute', inset: -30, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '50%', filter: 'blur(60px)' }} />
                    <div style={{
                        position: 'relative', width: 200, height: 200, backgroundColor: 'white', borderRadius: 24,
                        boxShadow: '0 20px 50px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20
                    }}>
                        <span className="material-symbols-outlined" style={{
                            fontSize: 80,
                            color: bgGradient.includes('#8B5CF6') ? '#7C3AED' : '#007AFF',
                            fontVariationSettings: "'FILL' 0, 'wght' 400"
                        }}>{iconName}</span>
                        {/* Animated dots */}
                        {!showSlider && (
                            <div style={{ display: 'flex', gap: 8 }}>
                                {[0, 1, 2].map(i => (
                                    <div key={i} style={{
                                        width: 10, height: 10, borderRadius: '50%',
                                        backgroundColor: bgGradient.includes('#8B5CF6') ? '#7C3AED' : '#007AFF',
                                        opacity: dotIndex === i ? 1 : 0.2, transition: 'opacity 0.3s ease'
                                    }} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ maxWidth: 320 }}>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 14 }}>
                        {title}
                    </h1>

                    {!showSlider ? (
                        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5, fontWeight: 500 }}>
                            {subtitle}
                        </p>
                    ) : (
                        <div style={{ marginTop: 24, width: '100%' }}>
                            <div
                                ref={sliderRef}
                                onMouseMove={handleSliderMove}
                                onMouseUp={handleSliderEnd}
                                onMouseLeave={handleSliderEnd}
                                onTouchMove={handleSliderMove}
                                onTouchEnd={handleSliderEnd}
                                style={{
                                    height: 64, width: '100%', background: 'rgba(0,0,0,0.2)', borderRadius: 32,
                                    position: 'relative', display: 'flex', alignItems: 'center', padding: 4,
                                    border: '1px solid rgba(255,255,255,0.2)', overflow: 'hidden'
                                }}
                            >
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: sliderX + 64, background: 'rgba(255,255,255,0.15)', transition: isDragging.current ? 'none' : 'width 0.3s ease' }} />
                                <div style={{ position: 'absolute', width: '100%', textAlign: 'center', pointerEvents: 'none', fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>
                                    DESLIZA PARA INICIAR
                                </div>
                                <div
                                    onMouseDown={handleSliderStart}
                                    onTouchStart={handleSliderStart}
                                    style={{
                                        width: 56, height: 56, background: 'white', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transform: `translateX(${sliderX}px)`,
                                        transition: isDragging.current ? 'none' : 'transform 0.3s ease',
                                        cursor: 'grab', boxShadow: '0 10px 20px rgba(0,0,0,0.2)', zIndex: 20
                                    }}
                                >
                                    <ArrowRight color={bgGradient.includes('#8B5CF6') ? '#7C3AED' : '#007AFF'} size={24} strokeWidth={3} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer style={{ padding: '0 24px 40px', textAlign: 'center' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 20px', backgroundColor: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                    borderRadius: 999, border: '1px solid rgba(255,255,255,0.2)'
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)', fontVariationSettings: "'FILL' 1, 'wght' 400" }}>verified_user</span>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'white', margin: 0, letterSpacing: '-0.01em' }}>No cierres la app (los datos se guardan)</p>
                </div>
                <div style={{ marginTop: 32, width: 134, height: 5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 999, margin: '32px auto 0' }} />
            </footer>
        </div>
    );
}
