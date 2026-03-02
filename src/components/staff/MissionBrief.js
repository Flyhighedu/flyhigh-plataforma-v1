'use client';

import { useState, useEffect, useRef } from 'react';
import { LogIn, School, Map, ChevronRight, AlertCircle, RefreshCw, MapPin } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { STAFF_CONFIG } from '@/config/staffConfig';
import { syncPendingCheckIns } from '@/utils/staff/sync';
import StartDemoFab from '@/components/staff/StartDemoFab';

// Nuevos Componentes
import CheckInFallback from '@/components/staff/CheckInFallback';
import MapPreviewModal from '@/components/staff/MapPreviewModal';
import WelcomeTransition from './WelcomeTransition';
import MissionBriefUI from '@/components/staff/MissionBriefUI';

// Utilidades de fecha
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatDateSpanish() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    return `${DAY_NAMES[now.getDay()]} ${now.getDate()} de ${MONTH_NAMES[now.getMonth()]}`;
}

function getFirstName(fullName) {
    return fullName ? fullName.split(' ')[0] : '';
}

// Distancia
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat1)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

function isUuid(value) {
    const normalized = String(value || '').trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);
}

function getErrorMessage(error) {
    if (!error) return 'Error desconocido.';
    if (typeof error === 'string') return error;
    if (typeof error.message === 'string' && error.message.trim()) return error.message.trim();
    if (typeof error.error_description === 'string' && error.error_description.trim()) return error.error_description.trim();
    if (typeof error.details === 'string' && error.details.trim()) return error.details.trim();
    if (typeof error.code === 'string' && error.code.trim()) return error.code.trim();
    return 'Error inesperado.';
}

function isNetworkLikeError(error) {
    const text = String(
        error?.message || error?.details || error?.error_description || ''
    ).toLowerCase();

    return (
        text.includes('fetch') ||
        text.includes('network') ||
        text.includes('failed to fetch') ||
        text.includes('offline')
    );
}

export default function MissionBrief({
    profile,
    school,
    journeyId,
    userId,
    onCheckedIn,
    onLogout,
    onRefresh,
    preview = false,
    existingCheckIn = null
}) {
    // --- ESTADOS ---
    const [checking, setChecking] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showMapModal, setShowMapModal] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    // Geolocalización
    const [locationStatus, setLocationStatus] = useState('idle'); // idle, locating, success, error, denied
    const [distance, setDistance] = useState(null);
    const [accuracy, setAccuracy] = useState(null);
    const watchId = useRef(null);

    // Estado del Equipo
    const [teamStatus, setTeamStatus] = useState({
        pilot: 'pending',
        teacher: 'pending',
        assistant: 'pending'
    });

    // Estado para datos de escuela enriquecidos dinámicamente (nombres descubiertos)
    const [dynamicSchool, setDynamicSchool] = useState(school);

    // Sync prop -> state
    useEffect(() => {
        setDynamicSchool(prev => ({ ...prev, ...school }));
    }, [school]);

    const isWithinRange = distance !== null && distance <= STAFF_CONFIG.GEOFENCE_RADIUS_METERS;

    // --- EFECTOS ---

    // 1. Monitor de Conexión y Sync
    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            syncPendingCheckIns(); // Try to sync when back online
        };
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check on mount
        if (navigator.onLine) {
            syncPendingCheckIns();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // 2. Iniciar Rastreo GPS
    useEffect(() => {
        if (!existingCheckIn && school) {
            startWatchingLocation();
        }
        return () => stopWatchingLocation();
    }, [existingCheckIn, school]);

    // 3. Monitor de Estado del Equipo (Real-time)
    // 3. Monitor de Estado del Equipo (Real-time y Descubrimiento)
    useEffect(() => {
        if (!journeyId) return;

        const supabase = createClient();

        // Inicializar estado local con lo que ya sabemos de props
        // Esto permite que si page.js ya nos dio nombres, los usemos.
        const initialMap = {
            pilot: { id: school?.pilot_id, status: 'pending', name: school?.pilot_name },
            teacher: { id: school?.teacher_id, status: 'pending', name: school?.teacher_name },
            assistant: { id: school?.aux_id || school?.assistant_id, status: 'pending', name: school?.aux_name }
        };

        // Mapeo interno para búsqueda rápida por ID
        let idToRoleMap = {};
        if (initialMap.pilot.id) idToRoleMap[initialMap.pilot.id] = 'pilot';
        if (initialMap.teacher.id) idToRoleMap[initialMap.teacher.id] = 'teacher';
        if (initialMap.assistant.id) idToRoleMap[initialMap.assistant.id] = 'assistant';

        // Función para actualizar estado (y descubrir usuario si es necesario)
        const handleCheckInEvent = async (event) => {
            const userId = event.user_id;
            let role = idToRoleMap[userId];

            // Si el usuario es desconocido, buscarlo en DB
            if (!role) {
                console.log('🕵️ Descubriendo usuario activo:', userId);
                const { data: userProfile } = await supabase
                    .from('staff_profiles')
                    .select('role, full_name')
                    .eq('user_id', userId)
                    .single();

                if (userProfile) {
                    role = userProfile.role;
                    // Mapeo de rol 'assistant' a key internal si es necesario
                    if (role === 'assistant') role = 'assistant'; // Ya coincide

                    // Actualizar mapa local
                    idToRoleMap[userId] = role;

                    // Actualizar info en el padre (opcional, pero actualizamos estado local aqui)
                    setTeamStatus(prev => ({
                        ...prev,
                        [role]: 'en_sitio',
                        // Hack: MissionBriefUI lee 'teamStatus' solo para status, 
                        // pero necesitamos pasarle el NOMBRE actualizado también.
                        // Modificaremos el estado para incluir metadatos si es posible, 
                        // o forzamos un refresh del padre.
                    }));

                    // Disparamos un evento custom o callback para avisar al padre que hay nuevos datos?
                    // Mejor: Actualizamos el objeto `school` localmente? No se puede (prop).
                    // Pero `MissionBriefUI` usa `school` para mostrar nombres.
                    // Necesitamos inyectar los nombres nuevos a MissionBriefUI.
                    // SOLUCIÓN: Usar un estado local `dynamicSchool` que mezcle props + discovery.
                    setDynamicSchool(prev => ({
                        ...prev,
                        [`${role}_name`]: userProfile.full_name,
                        [`${role}_id`]: userId
                    }));
                }
            }

            if (role) {
                setTeamStatus(prev => ({ ...prev, [role]: 'en_sitio' }));
            }
        };

        // Función para manejar evento de presencia (Nuevo compañero conectado)
        const handlePresenceEvent = async (event) => {
            if (!event || !event.user_id) return;
            const userId = event.user_id;
            let role = idToRoleMap[userId] || event.role; // Si el evento trae rol, usémoslo

            if (!role || !dynamicSchool[`${role}_name`] || dynamicSchool[`${role}_name`] === 'Por asignar') {
                console.log('👋 Nuevo compañero detectado (Presencia):', userId);
                // Fetch profile si no tenemos el nombre
                const { data: userProfile } = await supabase
                    .from('staff_profiles')
                    .select('role, full_name')
                    .eq('user_id', userId)
                    .single();

                if (userProfile) {
                    role = userProfile.role;
                    if (role === 'assistant') role = 'assistant';
                    idToRoleMap[userId] = role;

                    setDynamicSchool(prev => ({
                        ...prev,
                        [`${role}_name`]: userProfile.full_name,
                        [`${role}_id`]: userId
                    }));
                }
            }
        };

        // Procesar eventos iniciales y futuros de check-in
        const processEvents = (events) => {
            // ... existing logic ...
            events.forEach(event => {
                if (event.event_type === 'checkin') {
                    handleCheckInEvent(event);
                }
            });
        };

        // Fetch inicial de eventos (Checkins) + Presencia
        const fetchInitialEvents = async () => {
            // Checkins
            const { data: checkins } = await supabase
                .from('staff_prep_events')
                .select('*')
                .eq('journey_id', journeyId)
                .eq('event_type', 'checkin');

            if (checkins) processEvents(checkins);

            // Fetch Presence State (para nombres pendientes)
            const { data: presence } = await supabase
                .from('staff_presence')
                .select('*')
                .eq('journey_id', journeyId);

            if (presence) {
                presence.forEach(p => handlePresenceEvent(p));
            }
        };

        fetchInitialEvents();

        // Suscripción Real-time Checkins
        const channel = supabase
            .channel(`mission-brief-${journeyId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'staff_prep_events',
                filter: `journey_id=eq.${journeyId}`
            }, (payload) => {
                processEvents([payload.new]);
            })
            // Suscripción Real-time Presencia
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'staff_presence',
                filter: `journey_id=eq.${journeyId}`
            }, (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    handlePresenceEvent(payload.new);
                }
            })
            .subscribe();

        const interval = setInterval(fetchInitialEvents, 4000); // Polling cada 4s como fallback robusto

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [journeyId, school]);


    // --- LÓGICA GPS ---

    const startWatchingLocation = () => {
        if (!navigator.geolocation) {
            setLocationStatus('error');
            return;
        }

        setLocationStatus('locating');

        // Usar watchPosition para rastreo continuo y mejor precisión
        watchId.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy: acc } = position.coords;
                // Coordenadas objetivo (Escuela o Default Office)
                const targetLat = school?.lat || STAFF_CONFIG.OFFICE_LOCATION.lat;
                const targetLng = school?.lng || STAFF_CONFIG.OFFICE_LOCATION.lng;

                const dist = getDistanceFromLatLonInM(latitude, longitude, targetLat, targetLng);

                setDistance(Math.round(dist));
                setAccuracy(acc);
                setLocationStatus('success');
            },
            (error) => {
                console.warn('GPS Error:', error);
                if (error.code === error.PERMISSION_DENIED) {
                    setLocationStatus('denied');
                } else {
                    setLocationStatus('error');
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 5000
            }
        );
    };

    const stopWatchingLocation = () => {
        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
        }
    };

    // --- LÓGICA CHECK-IN ---

    const handleCheckIn = async (fallbackData = null) => {
        if (preview) {
            setShowWelcome(true);
            return;
        }

        // Si es click normal y no hay rango ni error, prevenir (aunque el botón debería estar deshabilitado)
        if (!fallbackData && locationStatus === 'success' && !isWithinRange) {
            alert(`Estás a ${distance}m. Acércate más.`);
            return;
        }

        if (!journeyId) {
            alert('No encontramos una jornada activa. Actualiza la pantalla e intenta de nuevo.');
            return;
        }

        setChecking(true);
        const nowIso = new Date().toISOString();
        const payload = {
            timestamp: nowIso,
            location: {
                distance: distance,
                radius: STAFF_CONFIG.GEOFENCE_RADIUS_METERS,
                accuracy: accuracy,
                is_fallback: !!fallbackData
            },
            fallback_evidence: fallbackData
        };

        let resolvedUserId = isUuid(userId) ? String(userId).trim() : '';

        if (!resolvedUserId && isUuid(profile?.user_id)) {
            resolvedUserId = String(profile.user_id).trim();
        }

        try {
            const supabase = createClient();

            if (!resolvedUserId) {
                const { data: authData } = await supabase.auth.getUser();
                if (isUuid(authData?.user?.id)) {
                    resolvedUserId = String(authData.user.id).trim();
                }
            }

            if (!resolvedUserId) {
                throw new Error('No fue posible validar tu sesión para registrar el check-in.');
            }

            // Intento de guardado en DB
            const { error } = await supabase.from('staff_prep_events').insert({
                journey_id: journeyId,
                user_id: resolvedUserId,
                event_type: 'checkin',
                payload: payload
            });

            if (error) throw error;

            // Éxito
            stopWatchingLocation();
            setShowWelcome(true);

        } catch (e) {
            const details = getErrorMessage(e);
            console.warn('Check-in failed (handled):', details);

            // Plan B: Guardar offline si es error de red
            if (isOffline || isNetworkLikeError(e)) {
                saveOfflineCheckIn(journeyId, resolvedUserId || userId, payload);
                alert('Sin conexión. Check-in guardado localmente. Se sincronizará cuando recuperes internet.');
                stopWatchingLocation();
                setShowWelcome(true);
            } else {
                alert(`Error al registrar check-in. ${details}`);
                setChecking(false);
            }
        }
    };

    const saveOfflineCheckIn = (jid, uid, payload) => {
        const pending = JSON.parse(localStorage.getItem('pending_checkins') || '[]');
        pending.push({ journeyId: jid, userId: uid, payload, timestamp: Date.now() });
        localStorage.setItem('pending_checkins', JSON.stringify(pending));
    };

    // --- RENDER ---

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

    // Estado vacío (Sin misión)
    if (!school) {
        return (
            <div className="bg-[#f8f9fb] min-h-screen flex flex-col font-display text-slate-900">
                <Header profile={profile} onLogout={() => setShowLogoutConfirm(true)} />
                <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-sm w-full">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <School className="text-slate-400" size={32} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 mb-2">Sin misión asignada</h2>
                        <p className="text-slate-500 text-sm mb-6">No tienes una escuela programada para hoy.</p>
                        <button onClick={onRefresh} className="text-blue-600 font-bold text-sm flex items-center justify-center gap-2">
                            <RefreshCw size={14} /> Actualizar
                        </button>
                    </div>
                </main>
                <StartDemoFab onDemoStarted={onRefresh} />
                <LogoutModal isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} onLogout={onLogout} />
            </div>
        );
    }

    // --- UI STITCH ---
    return (
        <>
            <MissionBriefUI
                profile={profile}
                school={dynamicSchool}
                teamStatus={teamStatus}
                distance={distance}
                locationStatus={locationStatus}
                isWithinRange={isWithinRange}
                checking={checking}
                onCheckIn={handleCheckIn}
                onViewMap={() => setShowMapModal(true)}
                onLogout={() => setShowLogoutConfirm(true)}
                journeyId={journeyId} // [NEW]
                onDemoStart={onRefresh} // [NEW] (Uses refresh logic)
            >
                {/* Fallback Content como Children */}
                {(locationStatus === 'error' || locationStatus === 'denied' || isOffline) && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pt-4">
                        <CheckInFallback
                            isOffline={isOffline}
                            onFallbackCheckIn={(data) => handleCheckIn(data)}
                        />
                    </div>
                )}
            </MissionBriefUI>

            {/* Modales y Extras */}
            <MapPreviewModal
                isOpen={showMapModal}
                onClose={() => setShowMapModal(false)}
                school={school}
            />

            <LogoutModal
                isOpen={showLogoutConfirm}
                onClose={() => setShowLogoutConfirm(false)}
                onLogout={onLogout}
            />
            {/* StartDemoFab has been moved into the menu inside MissionBriefUI */}
        </>
    );
}

function Header({ profile, onLogout }) {
    return (
        <header className="px-5 py-4 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-30 border-b border-transparent">
            <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">Hola,</p>
                <h2 className="text-lg font-black text-slate-900 leading-none">
                    {getFirstName(profile?.full_name)}
                </h2>
            </div>
            <div className="flex items-center gap-3">
                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full">
                    {ROLE_LABELS[profile?.role] || profile?.role}
                </span>
                <button
                    onClick={onLogout}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm text-slate-400 hover:text-red-500 transition-colors"
                >
                    <LogIn size={16} className="rotate-180" />
                </button>
            </div>
        </header>
    );
}

function LogoutModal({ isOpen, onClose, onLogout }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <AlertCircle className="text-red-500" size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2 text-center">¿Cerrar Sesión?</h3>
                <p className="text-slate-500 text-sm mb-6 text-center">
                    Tendrás que volver a ingresar tus credenciales para acceder.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={() => { onClose(); onLogout(); }}
                        className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors text-sm shadow-lg shadow-red-200"
                    >
                        Salir
                    </button>
                </div>
            </div>
        </div>
    );
}
