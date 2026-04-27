'use client';

// =====================================================
// SquadronBitacoraModal.js
// Floating modal for the Supervisor (Teacher) to capture
// the group's identity: Nombre Clave, Capitán, Destinos.
// Readable by the Piloto via a banner.
//
// SAFETY: Pure modal. Non-blocking. If it fails,
// the Supervisor tells the Pilot verbally.
// =====================================================

import { useState, useCallback } from 'react';
import { META_KEYS } from '@/config/escuadronConfig';
import { atomicMetaUpdate, parseMeta } from '@/utils/metaHelpers';

export default function SquadronBitacoraModal({
    isOpen,
    onClose,
    journeyId,
    flightNumber = 1,
    missionInfo
}) {
    const [nombreClave, setNombreClave] = useState('');
    const [capitan, setCapitan] = useState('');
    const [destinos, setDestinos] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = useCallback(async () => {
        if (!nombreClave.trim() || isSaving) return;
        setIsSaving(true);

        const bitacoraEntry = {
            flightNumber,
            nombreClave: nombreClave.trim(),
            capitan: capitan.trim() || null,
            destinos: destinos.trim() || null,
            timestamp: new Date().toISOString()
        };

        try {
            if (journeyId) {
                // Read current history, append, write
                const currentMeta = parseMeta(missionInfo?.meta);
                const history = Array.isArray(currentMeta[META_KEYS.BITACORA_HISTORY])
                    ? currentMeta[META_KEYS.BITACORA_HISTORY]
                    : [];

                await atomicMetaUpdate(journeyId, {
                    [META_KEYS.BITACORA_CURRENT]: bitacoraEntry,
                    [META_KEYS.BITACORA_HISTORY]: [...history, bitacoraEntry]
                });
            }

            // Also save locally for offline resilience
            try {
                const localKey = `flyhigh_escuadron_bitacora_${journeyId || 'local'}`;
                const existing = JSON.parse(localStorage.getItem(localKey) || '[]');
                existing.push(bitacoraEntry);
                localStorage.setItem(localKey, JSON.stringify(existing));
            } catch { /* non-blocking */ }

            setSaved(true);
            setTimeout(() => {
                onClose?.();
                // Reset for next use
                setSaved(false);
                setNombreClave('');
                setCapitan('');
                setDestinos('');
            }, 1200);
        } catch (err) {
            console.warn('⚠️ Bitácora save failed:', err);
            alert('No se pudo guardar la bitácora. Comunica los datos verbalmente al Piloto.');
            onClose?.();
        } finally {
            setIsSaving(false);
        }
    }, [nombreClave, capitan, destinos, flightNumber, journeyId, missionInfo, isSaving, onClose]);

    if (!isOpen) return null;

    if (saved) {
        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 85,
                background: 'rgba(15,23,42,0.7)',
                backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20
            }}>
                <div style={{
                    background: 'white', borderRadius: 24, padding: 40,
                    textAlign: 'center', maxWidth: 340, width: '100%',
                    boxShadow: '0 25px 60px -12px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: '0 0 4px' }}>
                        ¡Bitácora guardada!
                    </h3>
                    <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                        El Piloto puede ver los datos del escuadrón.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 85,
            background: 'rgba(15,23,42,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '20px 16px'
        }}>
            <div style={{
                background: 'white', borderRadius: 28, padding: '24px 22px 28px',
                width: '100%', maxWidth: 400,
                boxShadow: '0 25px 60px -12px rgba(0,0,0,0.3)',
                animation: 'slideUp 0.3s ease'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 2px' }}>
                            Bitácora Digital
                        </p>
                        <h2 style={{ fontSize: 20, fontWeight: 900, color: '#0F172A', margin: 0 }}>
                            Vuelo #{flightNumber}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 36, height: 36, borderRadius: 12,
                            border: '1px solid #E2E8F0', background: '#F8FAFC',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#94A3B8'
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                    </button>
                </div>

                {/* Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Nombre Clave */}
                    <label style={{ display: 'block' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            ✈️ Nombre Clave del Escuadrón *
                        </span>
                        <input
                            type="text"
                            value={nombreClave}
                            onChange={(e) => setNombreClave(e.target.value)}
                            placeholder="Ej. Los Halcones, Águilas Reales..."
                            maxLength={40}
                            style={{
                                width: '100%', marginTop: 6,
                                padding: '12px 14px', borderRadius: 14,
                                border: '2px solid #E2E8F0', background: '#F8FAFC',
                                fontSize: 15, fontWeight: 600, color: '#0F172A',
                                outline: 'none', boxSizing: 'border-box',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#7C3AED'}
                            onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                        />
                    </label>

                    {/* Capitán */}
                    <label style={{ display: 'block' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            🎖️ Capitán de la Misión
                        </span>
                        <input
                            type="text"
                            value={capitan}
                            onChange={(e) => setCapitan(e.target.value)}
                            placeholder="Nombre del niño/niña elegido"
                            maxLength={50}
                            style={{
                                width: '100%', marginTop: 6,
                                padding: '12px 14px', borderRadius: 14,
                                border: '2px solid #E2E8F0', background: '#F8FAFC',
                                fontSize: 15, fontWeight: 600, color: '#0F172A',
                                outline: 'none', boxSizing: 'border-box',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#7C3AED'}
                            onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                        />
                    </label>

                    {/* Destinos */}
                    <label style={{ display: 'block' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            🗺️ Destinos votados
                        </span>
                        <input
                            type="text"
                            value={destinos}
                            onChange={(e) => setDestinos(e.target.value)}
                            placeholder="Ej. París, Tokio, Marte..."
                            maxLength={100}
                            style={{
                                width: '100%', marginTop: 6,
                                padding: '12px 14px', borderRadius: 14,
                                border: '2px solid #E2E8F0', background: '#F8FAFC',
                                fontSize: 15, fontWeight: 600, color: '#0F172A',
                                outline: 'none', boxSizing: 'border-box',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#7C3AED'}
                            onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                        />
                    </label>
                </div>

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={!nombreClave.trim() || isSaving}
                    style={{
                        width: '100%', marginTop: 20,
                        padding: '14px 0', borderRadius: 16,
                        border: 'none',
                        background: nombreClave.trim()
                            ? 'linear-gradient(135deg, #7C3AED, #5B21B6)'
                            : '#E2E8F0',
                        color: nombreClave.trim() ? 'white' : '#94A3B8',
                        fontSize: 15, fontWeight: 800,
                        cursor: nombreClave.trim() ? 'pointer' : 'not-allowed',
                        boxShadow: nombreClave.trim() ? '0 10px 24px -6px rgba(124,58,237,0.5)' : 'none',
                        transition: 'all 0.3s ease'
                    }}
                >
                    {isSaving ? 'Guardando...' : 'Guardar Bitácora'}
                </button>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(40px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}

export function BitacoraPilotBanner({ missionInfo, activeFlight, nextFlightNumber }) {
    const meta = parseMeta(missionInfo?.meta);
    const history = Array.isArray(meta?.[META_KEYS.BITACORA_HISTORY]) ? meta[META_KEYS.BITACORA_HISTORY] : [];
    
    // Find the correct squad for the pilot's current context
    const currentFlightNum = activeFlight ? (activeFlight.flightNumber || nextFlightNumber) : nextFlightNumber;
    
    const activeSquad = history.find(b => Number(b.flightNumber) === Number(currentFlightNum));
    
    // Find upcoming squads (queued by the supervisor but not yet reached by the pilot)
    const upcomingSquads = history.filter(b => Number(b.flightNumber) > Number(currentFlightNum))
                                  .sort((a, b) => Number(a.flightNumber) - Number(b.flightNumber));

    // Total squads created for context
    const totalSquadsCreated = history.length;

    return (
        <div style={{ marginBottom: 16 }}>
            {/* Active Squad Card OR Warning */}
            {activeSquad ? (
                <div style={{
                    background: activeFlight ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #EDE9FE, #F5F3FF)',
                    border: `2px solid ${activeFlight ? '#34D399' : '#DDD6FE'}`,
                    borderRadius: 16,
                    padding: '14px 16px',
                    boxShadow: activeFlight ? '0 10px 25px -5px rgba(16,185,129,0.3)' : 'none',
                    color: activeFlight ? 'white' : '#0F172A',
                    transition: 'all 0.3s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 14 }}>{activeFlight ? '🚀' : '✈️'}</span>
                        <span style={{ 
                            fontSize: 10, fontWeight: 800, 
                            color: activeFlight ? '#A7F3D0' : '#7C3AED', 
                            textTransform: 'uppercase', letterSpacing: '0.1em' 
                        }}>
                            {activeFlight ? `Escuadrón en Vuelo (#${currentFlightNum})` : `Siguiente Escuadrón (#${currentFlightNum})`}
                        </span>
                    </div>
                    <p style={{ fontSize: 18, fontWeight: 900, color: activeFlight ? 'white' : '#4C1D95', margin: '0 0 4px' }}>
                        "{activeSquad.nombreClave}"
                    </p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {activeSquad.capitan && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: activeFlight ? '#D1FAE5' : '#6D28D9' }}>
                                🎖️ Capitán: {activeSquad.capitan}
                            </span>
                        )}
                        {activeSquad.destinos && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: activeFlight ? '#D1FAE5' : '#6D28D9' }}>
                                🗺️ {activeSquad.destinos}
                            </span>
                        )}
                    </div>
                </div>
            ) : (
                /* ── WARNING: No squadron for current flight ── */
                <div style={{
                    background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
                    border: '2px solid #F59E0B',
                    borderRadius: 16,
                    padding: '14px 16px',
                    boxShadow: '0 4px 12px rgba(245,158,11,0.15)',
                    animation: 'squadWarningPulse 3s ease-in-out infinite'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 12,
                            background: '#F59E0B', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <span style={{ fontSize: 18 }}>⚠️</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 12, fontWeight: 900, color: '#92400E', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Sin Escuadrón · Vuelo #{currentFlightNum}
                            </p>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#B45309', margin: 0, lineHeight: 1.4 }}>
                                El supervisor aún no ha nombrado al escuadrón para este vuelo. Confirma con tu equipo antes de despegar.
                            </p>
                        </div>
                    </div>
                    {totalSquadsCreated > 0 && (
                        <div style={{
                            marginTop: 10, paddingTop: 10,
                            borderTop: '1px solid #FCD34D',
                            display: 'flex', alignItems: 'center', gap: 6
                        }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                📋 {totalSquadsCreated} escuadrón{totalSquadsCreated !== 1 ? 'es' : ''} registrado{totalSquadsCreated !== 1 ? 's' : ''} en total
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Upcoming Squads Queue */}
            {upcomingSquads.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 2px 4px', letterSpacing: '0.05em' }}>
                        Escuadrones en Cola ({upcomingSquads.length})
                    </p>
                    {upcomingSquads.map(squad => (
                        <div key={squad.flightNumber} style={{
                            background: '#F8FAFC', borderRadius: 12, padding: '10px 14px',
                            border: '1px solid #E2E8F0',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div>
                                <p style={{ fontSize: 13, fontWeight: 800, color: '#334155', margin: 0 }}>
                                    "{squad.nombreClave}"
                                </p>
                                <p style={{ fontSize: 10, fontWeight: 700, color: '#64748B', margin: '2px 0 0' }}>
                                    {squad.capitan ? `🎖️ ${squad.capitan}` : 'Sin capitán asignado'}
                                </p>
                            </div>
                            <span style={{ 
                                fontSize: 10, fontWeight: 800, color: '#94A3B8', 
                                background: '#F1F5F9', padding: '4px 8px', borderRadius: 8,
                                border: '1px solid #E2E8F0'
                            }}>
                                Vuelo #{squad.flightNumber}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                @keyframes squadWarningPulse {
                    0%, 100% { box-shadow: 0 4px 12px rgba(245,158,11,0.15); }
                    50% { box-shadow: 0 4px 20px rgba(245,158,11,0.3); }
                }
            `}</style>
        </div>
    );
}
