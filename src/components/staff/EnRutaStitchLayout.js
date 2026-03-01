'use client';

import React from 'react';
import {
    MapPin,
    Navigation,
    Truck,
    Map,
    ChevronRight,
    Camera,
    Settings,
    Smartphone,
    CheckCircle2,
    Clock,
    AlertTriangle
} from 'lucide-react';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';

export default function EnRutaStitchLayout({
    role,
    missionInfo,
    missionState,
    onArrivalClick,
    onContinueClick,
    onMapClick
}) {
    const isTeacher = role === 'teacher';
    const isArrivalDone = missionState === 'ARRIVAL_PHOTO_DONE' || missionState === 'OPERATION' || missionState === 'ROUTE_IN_PROGRESS'; // Operation states

    // In our current logic, arrival photo done means mission reached arrival
    const arrivalConfirmed = missionState === 'ARRIVAL_PHOTO_DONE' || missionState === 'OPERATION';

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            padding: '0 20px 40px',
            width: '100%',
            maxWidth: 480,
            margin: '0 auto',
            zIndex: 10
        }}>
            {/* Elegant Central Card */}
            <div style={{
                backgroundColor: 'white',
                borderRadius: 40,
                boxShadow: '0 20px 50px -12px rgba(0,0,0,0.15)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Destination Section */}
                <div style={{ padding: '32px 32px 0', backgroundColor: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Truck size={14} color="#0EA5E9" />
                                <span style={{ color: '#94A3B8', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                                    En trayecto
                                </span>
                            </div>
                            <h2 style={{ color: '#0F172A', fontSize: 24, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1.1 }}>
                                {missionInfo?.school_name || 'Escuela del día'}
                            </h2>
                            <p style={{ fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: 500 }}>
                                {missionInfo?.colonia || missionInfo?.address || 'Dirección de la misión'}
                            </p>
                        </div>
                        <button
                            onClick={onMapClick}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontWeight: 800,
                                fontSize: 13,
                                padding: '8px 14px',
                                borderRadius: 12,
                                color: '#0EA5E9',
                                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                                border: 'none',
                                flexShrink: 0
                            }}
                        >
                            <Map size={14} />
                            Ver mapa
                        </button>
                    </div>

                    {/* Progress/Timeline Indicator */}
                    <div style={{ marginTop: 40, position: 'relative', display: 'flex', flexDirection: 'column', gap: 40, marginLeft: 12, paddingBottom: 32 }}>
                        {/* Vertical Line */}
                        <div style={{
                            position: 'absolute',
                            left: 10,
                            top: 8,
                            bottom: 8,
                            width: 2,
                            backgroundColor: '#F1F5F9'
                        }}>
                            <div style={{
                                height: '50%',
                                width: '100%',
                                borderRadius: 99,
                                backgroundColor: '#0EA5E9'
                            }} />
                        </div>

                        {/* Point A */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
                            <div style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                border: '4px solid white',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                backgroundColor: '#0EA5E9'
                            }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ color: '#94A3B8', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Origen</span>
                                <span style={{ color: '#475569', fontSize: 14, fontWeight: 600 }}>Centro de Distribución</span>
                            </div>
                        </div>

                        {/* Point B */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
                            <div style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                backgroundColor: arrivalConfirmed ? '#0EA5E9' : '#F1F5F9',
                                border: '4px solid white',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ color: '#94A3B8', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}>Destino</span>
                                <span style={{ color: '#0F172A', fontSize: 14, fontWeight: 700 }}>{missionInfo?.school_name}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tasks Section */}
                <div style={{ padding: '32px', borderTop: '1px solid #F8FAFC' }}>
                    <h3 style={{ color: '#94A3B8', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 12 }}>
                        Próximas Tareas
                    </h3>

                    {/* Safety Rule Note */}
                    <div style={{
                        backgroundColor: '#FFFBEB',
                        border: '1px solid #FEF3C7',
                        padding: '12px 14px',
                        borderRadius: 16,
                        marginBottom: 20,
                        display: 'flex',
                        gap: 10
                    }}>
                        <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                        <p style={{ color: '#92400E', fontSize: 12, fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
                            Importante: nada se deja en la calle.
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(() => {
                            const tasksByRole = {
                                assistant: [
                                    "Acomoda el vehículo en zona de descarga.",
                                    "Descarga equipo (primero: electrónico)."
                                ],
                                pilot: [
                                    "Descarga equipo (primero: electrónico).",
                                    "Supervisa el equipo ya dentro."
                                ],
                                teacher: [
                                    "Dirección: solicita zona de descarga.",
                                    "Descarga equipo (primero: electrónico)."
                                ]
                            };

                            const currentTasks = tasksByRole[role] || ["Preparación de equipo", "Ubicación de zona"];
                            const icons = [<Settings size={20} />, <Smartphone size={20} />];

                            return currentTasks.map((task, idx) => (
                                <div key={idx} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '16px',
                                    backgroundColor: '#F8FAFC',
                                    borderRadius: 20,
                                    border: '1px solid transparent'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div style={{ backgroundColor: 'rgba(14, 165, 233, 0.1)', padding: 10, borderRadius: 12, color: '#0EA5E9' }}>
                                            {icons[idx] || <CheckCircle2 size={20} />}
                                        </div>
                                        <span style={{ color: '#334155', fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{task}</span>
                                    </div>
                                    <ChevronRight size={18} color="#94A3B8" style={{ flexShrink: 0 }} />
                                </div>
                            ));
                        })()}
                    </div>
                </div>

                {/* Footer Action - Sticky */}
                <div style={{
                    padding: '16px 24px 24px',
                    position: 'sticky',
                    bottom: 0,
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(8px)',
                    borderTop: '1px solid #F1F5F9',
                    zIndex: 20
                }}>
                    {isTeacher ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <button
                                onClick={onArrivalClick}
                                style={{
                                    width: '100%',
                                    backgroundColor: '#0EA5E9',
                                    color: 'white',
                                    fontWeight: 900,
                                    padding: '20px',
                                    borderRadius: 20,
                                    boxShadow: '0 10px 25px -5px rgba(14, 165, 233, 0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 12,
                                    border: 'none',
                                    fontSize: 14,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em'
                                }}
                            >
                                <Camera size={20} />
                                NOTIFICAR LLEGADA
                            </button>
                            <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', fontWeight: 600 }}>
                                Tomaremos una foto como evidencia
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {arrivalConfirmed ? (
                                <button
                                    onClick={onContinueClick}
                                    style={{
                                        width: '100%',
                                        backgroundColor: '#0EA5E9',
                                        color: 'white',
                                        fontWeight: 900,
                                        padding: '20px',
                                        borderRadius: 20,
                                        boxShadow: '0 10px 25px -5px rgba(14, 165, 233, 0.5)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 12,
                                        border: 'none',
                                        fontSize: 14,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.1em'
                                    }}
                                >
                                    <Navigation size={20} />
                                    CONTINUAR
                                </button>
                            ) : (
                                <div style={{
                                    width: '100%',
                                    backgroundColor: '#F1F5F9',
                                    color: '#94A3B8',
                                    fontWeight: 700,
                                    padding: '20px',
                                    borderRadius: 20,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 12,
                                    fontSize: 13,
                                    textAlign: 'center'
                                }}>
                                    <Clock size={18} />
                                    Esperando confirmación de llegada del Docente
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
