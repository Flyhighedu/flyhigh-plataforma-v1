'use client';
import { useState, useEffect } from 'react';
import { Truck, MapPin, Navigation, Camera, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import ArrivalPhotoCapture from './ArrivalPhotoCapture';
import IncidentReporter from './IncidentReporter';
import SyncHeader from './SyncHeader';
import EnRutaStitchLayout from './EnRutaStitchLayout';
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
    const [showIncident, setShowIncident] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);
    const [photoUploadFailed, setPhotoUploadFailed] = useState(false);

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
            setPhotoUploadFailed(true);
        }
    };

    const handleManualRelease = () => {
        onStateChange('OPERATION');
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



    if (showCamera) {
        return <ArrivalPhotoCapture journeyId={journeyId} userId={userId} onComplete={handleArrivalPhotoDone} />;
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            background: '#0ea5e9', // Vibrant Sky from Stitch
            color: 'white',
            fontFamily: "'Inter', sans-serif",
            position: 'relative'
        }}>
            {/* Ambient Glows */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '10%', right: '-10%', width: '60%', height: '40%', backgroundColor: 'rgba(255, 255, 255, 0.1)', filter: 'blur(100px)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '10%', left: '-10%', width: '50%', height: '30%', backgroundColor: 'rgba(255, 255, 255, 0.05)', filter: 'blur(80px)', borderRadius: '50%' }} />
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
                onDemoStart={onRefresh}
            />

            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 40,
                zIndex: 5,
                overflowY: 'auto'
            }}>
                <EnRutaStitchLayout
                    role={role}
                    missionInfo={missionInfo}
                    missionState={missionState}
                    onArrivalClick={() => setShowCamera(true)}
                    onContinueClick={() => onStateChange('OPERATION')}
                    onMapClick={() => {
                        // Action to show map - could be another modal or redirect
                        setShowIncident(false); // Clear others
                        alert('Abriendo mapa interactivo...');
                    }}
                />

                {/* Secondary Actions (Mini) */}
                <div style={{ padding: '0 20px 40px', width: '100%', maxWidth: 480, display: 'flex', gap: 12 }}>
                    <button
                        onClick={() => setShowIncident(true)}
                        style={{
                            flex: 1,
                            padding: '12px',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: 16,
                            color: 'white',
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8
                        }}
                    >
                        <AlertTriangle size={14} />
                        REPORTE DE INCIDENTE
                    </button>
                    {photoUploadFailed && (
                        <button
                            onClick={handleManualRelease}
                            style={{
                                flex: 1,
                                padding: '12px',
                                backgroundColor: 'rgba(245,158,11,0.2)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(245,158,11,0.4)',
                                borderRadius: 16,
                                color: '#fbbf24',
                                fontSize: 12,
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8
                            }}
                        >
                            <AlertTriangle size={14} />
                            FORZAR LIBERACIÓN MANUAL
                        </button>
                    )}
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
            {showIncident && (
                <IncidentReporter
                    onClose={() => setShowIncident(false)}
                    onSave={handleIncidentSave}
                />
            )}
        </div>
    );
}
