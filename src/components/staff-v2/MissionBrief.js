'use client';

// =====================================================
// MissionBrief — Pantalla inicial post-login
// Diseño: "EventSync Mobile" (Strict Match)
// Lógica: Geofence Check-in (100m)
// =====================================================

import { useState, useEffect } from 'react';
import { MapPin, ArrowRight, Loader2, Navigation, School, LogIn } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { ROLE_LABELS, ROLE_COLORS } from '@/config/prepChecklistConfig';
import { STAFF_CONFIG } from '@/config/staffConfig';
import StartDemoFab from '@/components/staff/StartDemoFab'; // [NEW]

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatDateSpanish() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    const day = DAY_NAMES[now.getDay()];
    const num = now.getDate();
    const month = MONTH_NAMES[now.getMonth()];
    return `${day} ${num} de ${month}`;
}

function getFirstName(fullName) {
    if (!fullName) return '';
    return fullName.split(' ')[0];
}

import WelcomeTransition from './WelcomeTransition';

// Haversine formula to calculate distance in meters
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat1)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d * 1000; // Distance in meters
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

export default function MissionBrief({
    profile,
    school,
    journeyId,
    userId,
    onCheckedIn,
    onLogout,
    onRefresh, // [NEW]
    preview = false,
    existingCheckIn = null
}) {
    const [checking, setChecking] = useState(false);
    const [checkedIn, setCheckedIn] = useState(!!existingCheckIn);
    const [checkinTime, setCheckinTime] = useState(existingCheckIn ? new Date(existingCheckIn).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : null);
    const [showWelcome, setShowWelcome] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    // Geolocation States
    const [locationStatus, setLocationStatus] = useState('idle'); // idle, locating, success, error, denied
    const [distance, setDistance] = useState(null);
    const [locationError, setLocationError] = useState(null);

    const colors = ROLE_COLORS[profile?.role] || ROLE_COLORS.assistant;
    const isWithinRange = distance !== null && distance <= STAFF_CONFIG.GEOFENCE_RADIUS_METERS;

    // Initial Geolocation Check
    useEffect(() => {
        if (!checkedIn && school) {
            checkLocation();
        }
    }, [checkedIn, school]);

    const checkLocation = () => {
        if (!navigator.geolocation) {
            setLocationStatus('error');
            setLocationError('Geolocalización no soportada');
            return;
        }

        setLocationStatus('locating');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const dist = getDistanceFromLatLonInM(
                    position.coords.latitude,
                    position.coords.longitude,
                    STAFF_CONFIG.OFFICE_LOCATION.lat,
                    STAFF_CONFIG.OFFICE_LOCATION.lng
                );
                setDistance(Math.round(dist));
                setLocationStatus('success');
            },
            (error) => {
                console.warn('Geolocation error:', error);
                if (error.code === error.PERMISSION_DENIED) {
                    setLocationStatus('denied');
                } else {
                    setLocationStatus('error');
                }
                setLocationError(error.message);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    };

    const handleCheckin = async () => {
        // Preview: Skip geofence and DB
        if (preview) {
            setShowWelcome(true);
            return;
        }

        if (checking) return;

        // Double check distance valid
        if (!isWithinRange && locationStatus === 'success') {
            alert(`Estás demasiado lejos (${distance}m). Acércate a la oficina.`);
            return;
        }

        setChecking(true);
        try {
            const supabase = createClient();
            const nowIso = new Date().toISOString();

            // 1. Insert Check-in Event
            await supabase.from('staff_prep_events').insert({
                journey_id: journeyId,
                user_id: userId,
                event_type: 'checkin',
                payload: {
                    timestamp: nowIso,
                    location: {
                        distance: distance,
                        radius: STAFF_CONFIG.GEOFENCE_RADIUS_METERS
                    }
                }
            });

            const timeStr = new Date().toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Mexico_City'
            });
            setCheckinTime(timeStr);
            setCheckedIn(true);
            setChecking(false);
            // Trigger Welcome Transition
            setShowWelcome(true);

        } catch (e) {
            console.warn('Error registrando check-in:', e);
            setChecking(false);
            alert('Error al registrar check-in. Intenta de nuevo.');
        }
    };

    const handleContinue = () => {
        if (onCheckedIn) onCheckedIn();
    };

    // --- Render Logic ---

    // 0. Transition Screen
    if (showWelcome) {
        return (
            <WelcomeTransition
                profile={profile}
                onComplete={() => {
                    setShowWelcome(false);
                    if (onCheckedIn) onCheckedIn();
                }}
            />
        );
    }

    // 1. Empty State (No Mission)
    if (!school) {
        return (
            <div className="bg-[#f6f7f8] min-h-screen flex flex-col font-display text-slate-900">
                {/* Header Section */}
                <header className="px-6 flex flex-col gap-1 pt-8 pb-4">
                    <div className="flex justify-between items-center mb-6">
                        <img
                            src="/img/logoFH.png"
                            alt="Fly High Ops"
                            className="h-8 w-auto object-contain"
                        />
                        <button
                            onClick={() => setShowLogoutConfirm(true)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-2"
                            title="Cerrar Sesión"
                        >
                            <LogIn size={20} className="rotate-180" />
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <h1 className="text-[28px] font-bold tracking-tight text-[#101922]">
                            Hola, {getFirstName(profile?.full_name)}
                        </h1>
                        <span className="bg-[#137fec]/10 text-[#137fec] text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                            {ROLE_LABELS[profile?.role] || profile?.role}
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">
                        {formatDateSpanish()}
                    </p>
                </header>

                <main className="flex-1 px-6 flex flex-col items-center justify-center -mt-10 pb-20">
                    <div className="w-full max-w-sm bg-white rounded-[24px] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] text-center border border-slate-50 relative overflow-hidden">
                        {/* Decorative Background Blob */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-50 rounded-full blur-2xl opacity-50"></div>
                        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-50 rounded-full blur-2xl opacity-50"></div>

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 shadow-sm rotate-3 border border-slate-100">
                                <School size={32} className="text-slate-400 -rotate-3" strokeWidth={1.5} />
                            </div>

                            <h2 className="text-lg font-bold text-[#101922] mb-2">
                                Sin misión asignada
                            </h2>

                            <p className="text-slate-500 text-sm leading-relaxed mb-4 max-w-[240px]">
                                No tienes una escuela programada para hoy.<br />
                            </p>

                            <div className="px-4 py-2 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-xs font-medium text-slate-400">
                                    Disfruta tu día o mantente atento a nuevas asignaciones.
                                </p>
                            </div>
                        </div>
                    </div>
                </main>

                <StartDemoFab onDemoStarted={onRefresh} />

                {/* Logout Confirmation Modal (Duplicated for this view) */}
                {showLogoutConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h3 className="text-lg font-bold text-slate-900 mb-2">¿Cerrar Sesión?</h3>
                            <p className="text-slate-500 text-sm mb-6">
                                Tendrás que volver a ingresar tus credenciales para continuar.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={() => {
                                        setShowLogoutConfirm(false);
                                        if (onLogout) onLogout();
                                    }}
                                    className="flex-1 py-2.5 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition-colors text-sm"
                                >
                                    Salir
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-[#f6f7f8] min-h-screen flex flex-col font-display text-slate-900">
            {/* Header Section */}
            <header className="px-6 py-4 flex flex-col gap-1 pt-8 pb-4">
                {/* Top Header: Logo + Logout */}
                <div className="flex justify-between items-center mb-6">
                    <img
                        src="/img/logoFH.png"
                        alt="Fly High Ops"
                        className="h-8 w-auto object-contain"
                    />
                    <button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-2"
                        title="Cerrar Sesión"
                    >
                        <LogIn size={20} className="rotate-180" />
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <h1 className="text-[28px] font-bold tracking-tight text-[#101922]">
                        Hola, {getFirstName(profile?.full_name)}
                    </h1>
                    <span className="bg-[#137fec]/10 text-[#137fec] text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                        {ROLE_LABELS[profile?.role] || profile?.role}
                    </span>
                </div>
                <p className="text-slate-500 text-sm font-medium">
                    {formatDateSpanish()}
                </p>
            </header>

            <main className="flex-1 px-6 pt-2 flex flex-col gap-4 overflow-y-auto">
                {/* Today's Mission Label */}
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Misión de hoy</h2>

                {/* Mission Card */}
                <div className="bg-white rounded-[16px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-slate-50">
                    <div className="flex items-start justify-between mb-4">
                        <div className="h-12 w-12 bg-[#137fec]/10 rounded-lg flex items-center justify-center">
                            <School className="text-[#137fec]" size={24} />
                        </div>
                        <div className="bg-slate-50 px-3 py-1 rounded text-xs font-semibold text-slate-500">
                            {school.fecha || new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-[#101922]">
                            {school.school_name}
                        </h3>
                        {school.colonia && (
                            <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                                <MapPin size={16} />
                                <span>{school.colonia}</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <div className="flex items-center gap-3">
                            {checkedIn ? (
                                <>
                                    <div className="relative flex h-3 w-3">
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                    </div>
                                    <span className="text-sm font-bold text-[#101922]">
                                        Check-in completado
                                    </span>
                                </>
                            ) : (
                                <>
                                    <div className="relative flex h-4 w-4">
                                        <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-400"></span>
                                    </div>
                                    <span className="text-sm font-bold text-[#101922]">Pendiente de check-in</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Proximity Info */}
                {!checkedIn && (
                    <div className="bg-[#137fec]/10 rounded-[16px] p-4 flex items-center gap-4">
                        <div className="bg-[#137fec] rounded-full p-2.5 text-white flex items-center justify-center flex-shrink-0">
                            {locationStatus === 'locating' ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <Navigation size={20} className="fill-current" />
                            )}
                        </div>
                        <div className="min-w-0">
                            {locationStatus === 'locating' && (
                                <p className="text-sm font-medium text-slate-600">Verificando ubicación...</p>
                            )}

                            {locationStatus === 'success' && isWithinRange && (
                                <>
                                    <p className="text-[15px] font-medium text-[#101922]">
                                        Estás a <span className="text-[#137fec] font-bold">{distance}m</span> de la oficina
                                    </p>
                                    <p className="text-xs text-slate-500 font-medium">Dentro del radio de cobertura</p>
                                </>
                            )}

                            {locationStatus === 'success' && !isWithinRange && (
                                <>
                                    <p className="text-[15px] font-medium text-[#101922]">
                                        Estás a <span className="text-amber-600 font-bold">{distance}m</span> de la oficina
                                    </p>
                                    <p className="text-xs text-amber-700 font-medium">Fuera de radio (100m)</p>
                                </>
                            )}

                            {(locationStatus === 'error' || locationStatus === 'denied') && (
                                <>
                                    <p className="text-[15px] font-medium text-[#101922]">Ubicación no disponible</p>
                                    <button onClick={checkLocation} className="text-xs text-[#137fec] underline font-bold">Activar Permisos</button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Map View */}
                <div className="w-full h-32 bg-slate-200 rounded-[16px] overflow-hidden relative shadow-inner">
                    <iframe
                        title="Ubicación de la misión"
                        width="100%"
                        height="100%"
                        style={{ border: 'none', filter: 'grayscale(1) opacity(0.6)', pointerEvents: 'none' }}
                        loading="lazy"
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${(school?.lng || STAFF_CONFIG.OFFICE_LOCATION.lng) - 0.005}%2C${(school?.lat || STAFF_CONFIG.OFFICE_LOCATION.lat) - 0.003}%2C${(school?.lng || STAFF_CONFIG.OFFICE_LOCATION.lng) + 0.005}%2C${(school?.lat || STAFF_CONFIG.OFFICE_LOCATION.lat) + 0.003}&layer=mapnik`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: 'none' }}>
                        <div className="relative flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#137fec] opacity-40"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-[#137fec] ring-4 ring-[#137fec]/30"></span>
                        </div>
                    </div>
                </div>

            </main>

            {/* Bottom Action Area */}
            <footer className="p-6 pb-10">
                {checkedIn ? (
                    <button
                        onClick={handleContinue}
                        className="w-full bg-[#101922] text-white font-bold py-3.5 rounded-[16px] shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 text-[15px]"
                    >
                        Continuar a Montaje
                        <ArrowRight size={18} />
                    </button>
                ) : (
                    <button
                        onClick={handleCheckin}
                        disabled={locationStatus !== 'success' || !isWithinRange || checking}
                        className={`w-full font-bold py-3.5 rounded-[16px] shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 text-[15px]
                             ${(locationStatus === 'success' && isWithinRange)
                                ? 'bg-[#137fec] text-white shadow-blue-500/20'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            }
                        `}
                    >
                        {checking ? (
                            <Loader2 size={24} className="animate-spin" />
                        ) : (
                            <>
                                <LogIn size={18} />
                                Hacer check-in (Estoy en la oficina)
                            </>
                        )}
                    </button>
                )}

                <p className="text-center text-[10px] text-slate-400 mt-6 uppercase tracking-widest font-bold">
                    Powered by FlyHigh Staff
                </p>
            </footer>

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-2">¿Cerrar Sesión?</h3>
                        <p className="text-slate-500 text-sm mb-6">
                            Tendrás que volver a ingresar tus credenciales para continuar.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    setShowLogoutConfirm(false);
                                    if (onLogout) onLogout();
                                }}
                                className="flex-1 py-2.5 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition-colors text-sm"
                            >
                                Salir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
