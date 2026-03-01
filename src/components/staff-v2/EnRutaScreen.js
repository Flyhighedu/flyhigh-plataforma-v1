'use client';
import { useState, useEffect } from 'react';
import { Truck, MapPin, Navigation, Camera, QrCode, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import ArrivalPhotoCapture from './ArrivalPhotoCapture';
import { QrGenerator, QrScanner } from './QrSyncScanner';
import IncidentReporter from './IncidentReporter';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';

export default function EnRutaScreen({
    journeyId,
    userId,
    role,
    profile,
    missionInfo,
    missionState,
    onStateChange,
    onRefresh
}) {
    const [showCamera, setShowCamera] = useState(false);
    const [showQrGen, setShowQrGen] = useState(false);
    const [showQrScan, setShowQrScan] = useState(false);
    const [showIncident, setShowIncident] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);

    // Animation state
    const [dotIndex, setDotIndex] = useState(0);

    const firstName = profile?.full_name?.split(' ')[0] || 'Operativo';
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';

    useEffect(() => {
        const interval = setInterval(() => {
            setDotIndex(prev => (prev + 1) % 4);
        }, 500);
        return () => clearInterval(interval);
    }, []);

    const handleStartRoute = async () => {
        setLoadingAction(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();

            await supabase.from('staff_journeys')
                .update({
                    mission_state: 'IN_ROUTE',
                    route_started_at: now,
                    route_started_by: userId
                })
                .eq('id', journeyId);

            await supabase.from('staff_events')
                .insert({
                    journey_id: journeyId,
                    type: 'ROUTE_STARTED',
                    actor_user_id: userId,
                    payload: { role }
                });

        } catch (e) {
            console.error(e);
            alert('Error al iniciar ruta.');
        } finally {
            setLoadingAction(false);
        }
    };

    const handleArrivalPhotoDone = async (offline = false) => {
        setShowCamera(false);
        if (offline) {
            setShowQrGen(true);
        }
    };

    const handleQrScanSuccess = async (data) => {
        setShowQrScan(false);
        if (data.type === 'ARRIVAL_FACADE_PHOTO_TAKEN') {
            window.location.reload();
        }
    };

    const handleIncidentSave = async (incidentData) => {
        try {
            const supabase = createClient();
            await supabase.from('staff_events').insert({
                journey_id: journeyId,
                type: 'ISSUE_REPORTED',
                actor_user_id: userId,
                payload: {
                    issue_type: incidentData.type,
                    description: incidentData.description,
                    timestamp: incidentData.timestamp
                }
            });
            alert('Reporte registrado con éxito.');
            setShowIncident(false);
        } catch (e) {
            console.error('Error saving incident', e);
        }
    };

    // --- Role specific subcopy ---
    const getSubcopy = () => {
        if (missionState === 'ROUTE_READY') {
            if (role === 'assistant') return 'Asegúrate de que todo el equipo esté a bordo y los contenedores asegurados.';
            return 'Esperando a que el Auxiliar autorice la partida e inicie la ruta.';
        }

        switch (role) {
            case 'teacher': return 'Ya vamos en camino. Al llegar, toma la foto de la fachada para confirmar.';
            case 'assistant': return 'En camino a la escuela. La Docente confirmará la llegada con una foto.';
            case 'pilot': return 'Ruta activa. Al llegar, prepárate para ubicar la zona de despegue.';
            default: return 'En camino a la escuela.';
        }
    };


    if (showCamera) {
        return <ArrivalPhotoCapture journeyId={journeyId} userId={userId} onComplete={handleArrivalPhotoDone} />;
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg, #3B82F6 0%, #7C3AED 100%)', // Blue to Purple Gradient
            color: 'white',
            fontFamily: "'Inter', sans-serif",
            position: 'relative'
        }}>
            {/* Ambient Glows */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '10%', right: '-10%', width: '60%', height: '40%', backgroundColor: 'rgba(34, 211, 238, 0.15)', filter: 'blur(100px)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '10%', left: '-10%', width: '50%', height: '30%', backgroundColor: 'rgba(124, 58, 237, 0.2)', filter: 'blur(80px)', borderRadius: '50%' }} />
            </div>

            {/* Premium Synchronizable Header */}
            <SyncHeader
                firstName={firstName}
                roleName={roleName}
                role={role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                isWaitScreen={true}
                waitPhase="load" // Matches the blue/purple vibe of current wait screens
            />

            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 32px',
                textAlign: 'center',
                zIndex: 5
            }}>
                {/* Animated Truck Section */}
                <div style={{
                    position: 'relative',
                    marginBottom: 40,
                    animation: 'floatTruck 3s ease-in-out infinite'
                }}>
                    <style>{`
                        @keyframes floatTruck {
                            0%, 100% { transform: translateX(-8px) translateY(0); }
                            50% { transform: translateX(8px) translateY(-4px); }
                        }
                        @keyframes pointMove {
                            0% { transform: translateX(40px); opacity: 0; }
                            50% { opacity: 0.5; }
                            100% { transform: translateX(-40px); opacity: 0; }
                        }
                    `}</style>

                    <Truck size={120} strokeWidth={1} style={{ filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.2))' }} />

                    {/* Road points animation */}
                    <div style={{
                        display: 'flex',
                        gap: 12,
                        marginTop: 10,
                        justifyContent: 'center'
                    }}>
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                backgroundColor: 'white',
                                animation: `pointMove 2s linear infinite`,
                                animationDelay: `${i * 0.5}s`
                            }} />
                        ))}
                    </div>
                </div>

                {/* Status & Info */}
                <div style={{ maxWidth: 360 }}>
                    <h1 style={{
                        fontSize: 32,
                        fontWeight: 900,
                        letterSpacing: '-0.04em',
                        marginBottom: 16,
                        textTransform: 'uppercase'
                    }}>
                        {missionState === 'ROUTE_READY' ? 'LISTOS PARA SALIR' : 'EN RUTA'}
                    </h1>

                    <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 18, fontWeight: 700 }}>
                            <MapPin size={20} />
                            {missionInfo?.school_name}
                        </div>
                        <p style={{ fontSize: 13, opacity: 0.9, fontWeight: 500 }}>
                            {missionInfo?.colonia || missionInfo?.address || 'Dirección de la misión'}
                        </p>
                    </div>

                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        padding: '6px 14px',
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 800,
                        marginBottom: 32
                    }}>
                        <Navigation size={14} />
                        SALIDA: {missionState === 'IN_ROUTE' ? (
                            new Date(missionInfo?.route_started_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        ) : 'Pte. Autorización'}
                    </div>

                    <p style={{
                        fontSize: 16,
                        lineHeight: 1.5,
                        fontWeight: 600,
                        color: 'rgba(255,255,255,0.95)',
                        marginBottom: 40
                    }}>
                        {getSubcopy()}
                    </p>

                    {/* Actions */}
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {missionState === 'ROUTE_READY' && role === 'assistant' && (
                            <button
                                onClick={handleStartRoute}
                                disabled={loadingAction}
                                style={{
                                    width: '100%',
                                    padding: '18px',
                                    backgroundColor: 'white',
                                    color: '#3B82F6',
                                    borderRadius: 16,
                                    fontWeight: 900,
                                    fontSize: 16,
                                    border: 'none',
                                    boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 10
                                }}
                            >
                                {loadingAction ? <Loader2 className="animate-spin" /> : <Navigation size={20} />}
                                INICIAR RUTA
                            </button>
                        )}

                        {missionState === 'IN_ROUTE' && role === 'teacher' && (
                            <button
                                onClick={() => setShowCamera(true)}
                                style={{
                                    width: '100%',
                                    padding: '18px',
                                    backgroundColor: 'white',
                                    color: '#3B82F6',
                                    borderRadius: 16,
                                    fontWeight: 900,
                                    fontSize: 16,
                                    border: 'none',
                                    boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 10
                                }}
                            >
                                <Camera size={22} />
                                TOMAR FOTO DE LLEGADA
                            </button>
                        )}
                    </div>
                </div>
            </main>

            <footer style={{
                padding: '0 24px 48px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 24,
                zIndex: 10
            }}>
                {/* Secondary tools (QR / Incidents) */}
                <div style={{ display: 'flex', gap: 12 }}>
                    {missionState === 'IN_ROUTE' && (role === 'pilot' || role === 'assistant') && (
                        <button
                            onClick={() => setShowQrScan(true)}
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.3)',
                                padding: '8px 16px',
                                borderRadius: 12,
                                color: 'white',
                                fontSize: 12,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                        >
                            <QrCode size={16} />
                            Sincronizar (QR)
                        </button>
                    )}

                    <button
                        onClick={() => setShowIncident(true)}
                        style={{
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            padding: '8px 16px',
                            borderRadius: 12,
                            color: 'white',
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                        }}
                    >
                        <AlertTriangle size={16} />
                        Reportar imprevisto
                    </button>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: 0.8
                }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22C55E' }} />
                    <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                        No cierres la app (los datos se guardan)
                    </p>
                </div>
            </footer>

            {/* Modals & Overlays */}
            {showQrScan && (
                <QrScanner
                    onScanSuccess={handleQrScanSuccess}
                    onClose={() => setShowQrScan(false)}
                />
            )}

            {showIncident && (
                <IncidentReporter
                    onClose={() => setShowIncident(false)}
                    onSave={handleIncidentSave}
                />
            )}

            {showQrGen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.8)', padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ backgroundColor: 'white', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 }}>
                        <div style={{ flex: 1 }}>
                            <QrGenerator journeyId={journeyId} userId={userId} payload={{ type: 'ARRIVAL_FACADE_PHOTO_TAKEN' }} />
                        </div>
                        <button
                            onClick={() => setShowQrGen(false)}
                            style={{ width: '100%', padding: '16px', backgroundColor: '#3B82F6', color: 'white', borderRadius: 12, fontWeight: 800, border: 'none', marginTop: 16 }}
                        >
                            CERRAR
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
