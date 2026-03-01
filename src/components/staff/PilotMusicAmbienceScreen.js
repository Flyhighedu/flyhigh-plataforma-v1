'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';

const MUSIC_CHECK_ITEMS = [
    { id: 'speaker_on', label: 'Encender bocina' },
    { id: 'official_track', label: 'Reproducir pista oficial' },
    { id: 'immersive_volume', label: 'Ajustar volumen a nivel envolvente' }
];

const MUSIC_CHECK_KEYS = MUSIC_CHECK_ITEMS.map((item) => item.id);

function safeText(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

function normalizeChecks(rawChecks) {
    const source = rawChecks && typeof rawChecks === 'object' && !Array.isArray(rawChecks)
        ? rawChecks
        : Object.create(null);

    return {
        speaker_on: source.speaker_on === true,
        official_track: source.official_track === true,
        immersive_volume: source.immersive_volume === true
    };
}

function checksAreEqual(left, right) {
    return MUSIC_CHECK_KEYS.every((key) => Boolean(left?.[key]) === Boolean(right?.[key]));
}

function firstName(fullName, fallback = 'Piloto') {
    const normalized = safeText(fullName).trim();
    if (!normalized) return fallback;
    const [first] = normalized.split(/\s+/);
    return first || fallback;
}

function isReadyToStartOperation(meta = {}) {
    return (
        meta.pilot_music_ambience_done === true &&
        meta.teacher_operation_ready === true &&
        meta.aux_operation_ready === true &&
        Boolean(meta.aux_operation_stand_photo_url)
    );
}

function CheckCircle({ checked }) {
    return (
        <div style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: checked ? '2px solid #2563EB' : '1px solid #BFDBFE',
            backgroundColor: checked ? '#2563EB' : '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.2s ease'
        }}>
            <svg
                width="14"
                height="14"
                viewBox="0 0 20 20"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                style={{ color: '#FFFFFF', opacity: checked ? 1 : 0, transition: 'opacity 0.2s ease' }}
            >
                <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                />
            </svg>
        </div>
    );
}

export default function PilotMusicAmbienceScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const initialMeta = parseMeta(missionInfo?.meta);
    const [checks, setChecks] = useState(() => normalizeChecks(initialMeta.pilot_music_ambience_checks));
    const [taskDone, setTaskDone] = useState(initialMeta.pilot_music_ambience_done === true);
    const [doneByName, setDoneByName] = useState(() => safeText(initialMeta.pilot_music_ambience_done_by_name));
    const [isSavingCheck, setIsSavingCheck] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);

    useEffect(() => {
        const meta = parseMeta(missionInfo?.meta);
        const nextChecks = normalizeChecks(meta.pilot_music_ambience_checks);
        const nextTaskDone = meta.pilot_music_ambience_done === true;
        const nextDoneByName = safeText(meta.pilot_music_ambience_done_by_name);

        setChecks((prev) => (checksAreEqual(prev, nextChecks) ? prev : nextChecks));
        setTaskDone((prev) => (prev === nextTaskDone ? prev : nextTaskDone));
        setDoneByName((prev) => (prev === nextDoneByName ? prev : nextDoneByName));
    }, [missionInfo?.meta, missionState]);

    const pilotFirstName = firstName(profile?.full_name, 'Piloto');
    const roleName = ROLE_LABELS[profile?.role] || 'Piloto';

    const completedChecks = useMemo(() => {
        let done = 0;
        if (checks.speaker_on) done += 1;
        if (checks.official_track) done += 1;
        if (checks.immersive_volume) done += 1;
        return done;
    }, [checks.immersive_volume, checks.official_track, checks.speaker_on]);

    const allChecksDone = completedChecks === MUSIC_CHECK_KEYS.length;
    const isBusy = isSavingCheck || isFinalizing;

    const readCurrentMeta = async (supabase) => {
        const { data, error } = await supabase
            .from('staff_journeys')
            .select('meta')
            .eq('id', journeyId)
            .single();

        if (error) throw error;
        return parseMeta(data?.meta);
    };

    const writeMeta = async (supabase, nextMeta, now) => {
        const { error } = await supabase
            .from('staff_journeys')
            .update({
                meta: nextMeta,
                updated_at: now
            })
            .eq('id', journeyId);

        if (error) throw error;
    };

    const handleToggleCheck = async (checkId) => {
        if (!journeyId || taskDone || isBusy) return;

        setIsSavingCheck(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const currentMeta = await readCurrentMeta(supabase);

            if (currentMeta.pilot_music_ambience_done === true) {
                setTaskDone(true);
                setDoneByName(safeText(currentMeta.pilot_music_ambience_done_by_name));
                return;
            }

            const nextChecks = normalizeChecks(currentMeta.pilot_music_ambience_checks);
            nextChecks[checkId] = !nextChecks[checkId];

            const nextMeta = {
                ...currentMeta,
                pilot_music_ambience_checks: nextChecks
            };

            await writeMeta(supabase, nextMeta, now);
            setChecks(nextChecks);
        } catch (error) {
            console.error('Error updating pilot music ambience checklist:', error);
            alert('No se pudo guardar el checklist. Intenta de nuevo.');
        } finally {
            setIsSavingCheck(false);
        }
    };

    const handleConfirm = async () => {
        if (!journeyId || !userId || taskDone || isBusy) return;

        setIsFinalizing(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();
            const currentMeta = await readCurrentMeta(supabase);

            if (currentMeta.pilot_music_ambience_done === true) {
                setTaskDone(true);
                setDoneByName(safeText(currentMeta.pilot_music_ambience_done_by_name));
                onRefresh && onRefresh();
                return;
            }

            const latestChecks = normalizeChecks(currentMeta.pilot_music_ambience_checks);
            const latestAllDone = MUSIC_CHECK_KEYS.every((key) => latestChecks[key] === true);

            if (!latestAllDone) {
                setChecks(latestChecks);
                alert('Completa los 3 pasos para confirmar la ambientacion musical.');
                return;
            }

            const actorName = firstName(profile?.full_name, 'Piloto');
            const nextMeta = {
                ...currentMeta,
                pilot_music_ambience_checks: latestChecks,
                pilot_music_ambience_done: true,
                pilot_music_ambience_done_at: now,
                pilot_music_ambience_done_by: userId,
                pilot_music_ambience_done_by_name: actorName
            };

            if (!currentMeta.operation_start_bridge_at && isReadyToStartOperation(nextMeta)) {
                nextMeta.operation_start_bridge_at = now;
                nextMeta.operation_start_bridge_by = userId;
            }

            await writeMeta(supabase, nextMeta, now);

            setChecks(latestChecks);
            setTaskDone(true);
            setDoneByName(actorName);

            if (onRefresh) {
                await Promise.resolve(onRefresh());
            }
        } catch (error) {
            console.error('Error confirming pilot music ambience:', error);
            alert('No se pudo confirmar la ambientacion musical. Intenta de nuevo.');
        } finally {
            setIsFinalizing(false);
        }
    };

    const musicIsActive = allChecksDone || taskDone;
    const ctaDisabled = !allChecksDone || taskDone || isBusy;
    const ctaLabel = taskDone
        ? `Ambientacion lista${doneByName ? ` - ${doneByName}` : ''}`
        : 'Ambientacion lista ->';

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            backgroundColor: '#F3F4F6',
            color: '#1F2937',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            WebkitFontSmoothing: 'antialiased',
            position: 'relative'
        }}>
            <SyncHeader
                firstName={pilotFirstName}
                roleName={roleName}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                onDemoStart={onRefresh}
            />

            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '6px 20px 154px',
                overflowY: 'auto',
                msOverflowStyle: 'none',
                scrollbarWidth: 'none'
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: 272,
                    aspectRatio: '1 / 1',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '6px 0 10px'
                }}>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(180deg, #FFFFFF 0%, rgba(255,255,255,0) 100%)',
                        borderRadius: '50%',
                        opacity: 0.6,
                        transform: 'scale(0.9)'
                    }} />

                    <div style={{ position: 'relative', width: 216, height: 216, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ position: 'absolute', width: 128, height: 128, backgroundColor: 'rgba(96,165,250,0.2)', borderRadius: '50%', filter: 'blur(16px)', animation: 'music-pulse 2.8s ease-in-out infinite' }} />

                        <div style={{ position: 'absolute', left: 28, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', opacity: 0.6 }}>
                            <div style={{ width: 7, height: 24, backgroundColor: '#93C5FD', borderRadius: 999, animation: 'music-bounce 1.25s ease-in-out infinite', animationDelay: '0.08s' }} />
                            <div style={{ width: 7, height: 38, backgroundColor: '#60A5FA', borderRadius: 999, animation: 'music-bounce 1.25s ease-in-out infinite', animationDelay: '0.12s' }} />
                            <div style={{ width: 7, height: 20, backgroundColor: '#93C5FD', borderRadius: 999, animation: 'music-bounce 1.25s ease-in-out infinite', animationDelay: '0.16s' }} />
                        </div>

                        <div style={{
                            position: 'relative',
                            width: 110,
                            height: 140,
                            borderRadius: 20,
                            backgroundColor: '#FFFFFF',
                            boxShadow: '0 12px 28px rgba(15,23,42,0.14)',
                            border: '3px solid #F3F4F6',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1
                        }}>
                            <div style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                backgroundColor: '#E5E7EB',
                                border: '2px solid #D1D5DB',
                                marginBottom: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: 'inset 0 2px 5px rgba(15,23,42,0.1)'
                            }}>
                                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#9CA3AF' }} />
                            </div>

                            <div style={{
                                width: 68,
                                height: 68,
                                borderRadius: '50%',
                                backgroundColor: '#3B82F6',
                                border: '3px solid #2563EB',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                boxShadow: 'inset 0 4px 8px rgba(30,58,138,0.35)'
                            }}>
                                <div style={{
                                    width: 38,
                                    height: 38,
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(30,58,138,0.45)',
                                    animation: 'music-ping 1.8s ease-in-out infinite'
                                }} />
                                <div style={{
                                    position: 'absolute',
                                    width: 26,
                                    height: 26,
                                    borderRadius: '50%',
                                    backgroundColor: '#1D4ED8'
                                }} />
                            </div>
                        </div>

                        <div style={{ position: 'absolute', right: 28, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', opacity: 0.6 }}>
                            <div style={{ width: 7, height: 20, backgroundColor: '#93C5FD', borderRadius: 999, animation: 'music-bounce 1.25s ease-in-out infinite', animationDelay: '0.16s' }} />
                            <div style={{ width: 7, height: 38, backgroundColor: '#60A5FA', borderRadius: 999, animation: 'music-bounce 1.25s ease-in-out infinite', animationDelay: '0.12s' }} />
                            <div style={{ width: 7, height: 24, backgroundColor: '#93C5FD', borderRadius: 999, animation: 'music-bounce 1.25s ease-in-out infinite', animationDelay: '0.08s' }} />
                        </div>

                        <div style={{ position: 'absolute', top: 14, right: 52, color: '#3B82F6', animation: 'music-float 3s ease-in-out infinite' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}>music_note</span>
                        </div>
                        <div style={{ position: 'absolute', bottom: 16, left: 38, color: '#60A5FA', animation: 'music-float 4s ease-in-out infinite', animationDelay: '1s' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>music_note</span>
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 14, maxWidth: 360 }}>
                    <h2 style={{ margin: 0, marginBottom: 10, fontSize: 24, fontWeight: 700, color: '#1E3A8A', lineHeight: 1.1 }}>
                        Activar ambientacion musical
                    </h2>
                    <p style={{ margin: 0, fontSize: 14, color: '#6B7280', lineHeight: 1.55 }}>
                        Enciende la bocina y reproduce la pista oficial para ambientar el inicio de la experiencia.
                    </p>
                </div>

                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 12px',
                    borderRadius: 999,
                    backgroundColor: '#F3F4F6',
                    color: musicIsActive ? '#065F46' : '#6B7280',
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 12,
                    border: '1px solid #E5E7EB'
                }}>
                    <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: musicIsActive ? '#10B981' : '#9CA3AF',
                        marginRight: 8
                    }} />
                    {musicIsActive ? 'Musica: Activa' : 'Musica: Pendiente'}
                </div>

                <div style={{
                    width: '100%',
                    maxWidth: 380,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 22,
                    padding: 18,
                    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
                    border: '1px solid #F3F4F6',
                    marginBottom: 10
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {MUSIC_CHECK_ITEMS.map((item, index) => {
                            const checked = checks[item.id] === true;
                            const disabled = taskDone || isBusy;

                            return (
                                <div key={item.id}>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleCheck(item.id)}
                                        disabled={disabled}
                                        style={{
                                            border: 'none',
                                            background: 'transparent',
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 14,
                                            textAlign: 'left',
                                            padding: 0,
                                            cursor: disabled ? 'not-allowed' : 'pointer',
                                            opacity: disabled ? 0.85 : 1
                                        }}
                                    >
                                        <div style={{ marginTop: 2 }}>
                                            <CheckCircle checked={checked} />
                                        </div>
                                        <span style={{
                                            fontSize: 14,
                                            fontWeight: 500,
                                            color: '#374151',
                                            lineHeight: 1.35
                                        }}>
                                            {item.label}
                                        </span>
                                    </button>

                                    {index < MUSIC_CHECK_ITEMS.length - 1 && (
                                        <div style={{ height: 1, backgroundColor: '#F3F4F6', width: '100%', marginTop: 10, marginLeft: 40 }} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div style={{ marginTop: 2, textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', fontWeight: 500, letterSpacing: '0.02em' }}>
                        La experiencia comienza antes del vuelo.
                    </p>
                </div>
            </main>

            <div style={{
                position: 'fixed',
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 40,
                padding: '14px 20px calc(18px + env(safe-area-inset-bottom, 0px))',
                backgroundColor: 'rgba(243,244,246,0.92)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderTop: '1px solid #E5E7EB'
            }}>
                <div style={{ maxWidth: 380, margin: '0 auto' }}>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={ctaDisabled}
                        style={{
                            width: '100%',
                            backgroundColor: ctaDisabled ? 'rgba(37,99,235,0.5)' : '#2563EB',
                            color: '#FFFFFF',
                            fontWeight: 700,
                            fontSize: 16,
                            padding: '15px 18px',
                            borderRadius: 18,
                            border: 'none',
                            boxShadow: ctaDisabled ? 'none' : '0 12px 30px -10px rgba(37,99,235,0.45)',
                            cursor: ctaDisabled ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {isFinalizing ? <Loader2 size={18} className="animate-spin" /> : null}
                        {ctaLabel}
                    </button>

                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: 128, height: 4, backgroundColor: '#D1D5DB', borderRadius: 999 }} />
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes music-bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }

                @keyframes music-pulse {
                    0%, 100% { opacity: 0.35; }
                    50% { opacity: 0.6; }
                }

                @keyframes music-ping {
                    0%, 100% { transform: scale(1); opacity: 0.35; }
                    50% { transform: scale(1.18); opacity: 0.2; }
                }

                @keyframes music-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
            `}</style>
        </div>
    );
}
