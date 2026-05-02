'use client';

// =====================================================
// POIMapEditor.js — Puntos de Interés (sin dependencias externas)
// 
// Usa un iframe de OpenStreetMap como mapa de referencia
// y geolocalización nativa del navegador.
// CERO dependencias npm — compatible con Turbopack.
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';

const EMOJI_OPTIONS = [
    '📍', '🏛️', '🌳', '🏭', '⛰️', '☁️', '✈️', '💧',
    '🌊', '🏟️', '🛣️', '🏫', '⛪', '🏥', '🏪', '🦅',
    '🌅', '🏖️', '🗼', '🌉', '🎡', '🏔️', '🌋', '🗻'
];

const DEFAULT_CENTER = { lat: 20.67, lng: -103.35 };

export default function POIMapEditor({ isOpen, onClose, profile }) {
    const [pois, setPois] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [newPoiName, setNewPoiName] = useState('');
    const [newPoiEmoji, setNewPoiEmoji] = useState('📍');
    const [userLocation, setUserLocation] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const nameInputRef = useRef(null);

    // ── Geolocation ──
    useEffect(() => {
        if (!isOpen) return;
        navigator.geolocation?.getCurrentPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setUserLocation(DEFAULT_CENTER),
            { enableHighAccuracy: false, timeout: 5000 }
        );
    }, [isOpen]);

    // ── Load POIs ──
    const loadPois = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/staff/poi');
            const data = await res.json();
            if (data.ok) {
                setPois(data.pois || []);
                try { localStorage.setItem('flyhigh_poi_cache', JSON.stringify(data.pois)); } catch {}
            } else {
                throw new Error(data.error || 'Error cargando POIs');
            }
        } catch (err) {
            console.warn('⚠️ POI load error:', err);
            setError(err.message);
            try {
                const cached = localStorage.getItem('flyhigh_poi_cache');
                if (cached) setPois(JSON.parse(cached));
            } catch {}
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) loadPois();
    }, [isOpen, loadPois]);

    // ── Save POI ──
    const handleSavePoi = useCallback(async () => {
        if (!newPoiName.trim()) return;
        const loc = userLocation || DEFAULT_CENTER;
        setSaving(true);
        try {
            const res = await fetch('/api/staff/poi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newPoiName.trim(),
                    emoji: newPoiEmoji,
                    lat: loc.lat,
                    lng: loc.lng,
                    created_by: profile?.user_id || null,
                    created_by_name: profile?.full_name?.split(' ')[0] || null
                })
            });
            const data = await res.json();
            if (data.ok) {
                setPois(prev => [...prev, data.poi]);
                setShowForm(false);
                setNewPoiName('');
                try { navigator.vibrate?.(100); } catch {}
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }, [newPoiName, newPoiEmoji, userLocation, profile]);

    // ── Delete POI ──
    const handleDeletePoi = useCallback(async (id) => {
        setDeletingId(id);
        try {
            const res = await fetch('/api/staff/poi', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active: false })
            });
            const data = await res.json();
            if (data.ok) {
                setPois(prev => prev.filter(p => p.id !== id));
                try { navigator.vibrate?.(50); } catch {}
            }
        } catch (err) {
            console.warn('Delete error:', err);
        } finally {
            setDeletingId(null);
        }
    }, []);

    const mapLoc = userLocation || DEFAULT_CENTER;
    const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLoc.lng - 0.03},${mapLoc.lat - 0.02},${mapLoc.lng + 0.03},${mapLoc.lat + 0.02}&layer=mapnik&marker=${mapLoc.lat},${mapLoc.lng}`;

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: '#0F172A',
            display: 'flex', flexDirection: 'column'
        }}>
            {/* ── Header ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0
            }}>
                <button onClick={onClose} style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white', fontSize: 18,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer'
                }}>←</button>
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: 'white', margin: 0 }}>
                        📍 Puntos de Interés
                    </h2>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, fontWeight: 600 }}>
                        Lugares que emocionan a los niños
                    </p>
                </div>
                <div style={{
                    background: 'rgba(255,255,255,0.08)', borderRadius: 10,
                    padding: '6px 12px'
                }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#94A3B8' }}>
                        {pois.length}
                    </span>
                </div>
            </div>

            {/* ── Map Reference ── */}
            <div style={{ height: '30vh', flexShrink: 0, position: 'relative', background: '#1E293B' }}>
                <iframe
                    src={mapUrl}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="Mapa de referencia"
                    loading="lazy"
                />
                <div style={{
                    position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                    background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)',
                    borderRadius: 10, padding: '6px 14px',
                    fontSize: 11, color: '#94A3B8', fontWeight: 700,
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    📍 Tu zona actual
                </div>
            </div>

            {/* ── Add Button ── */}
            {!showForm && (
                <button
                    onClick={() => {
                        setShowForm(true);
                        setNewPoiName('');
                        setNewPoiEmoji('📍');
                        setTimeout(() => nameInputRef.current?.focus(), 200);
                    }}
                    style={{
                        margin: '14px 20px 0', padding: '14px', borderRadius: 14,
                        border: '2px dashed rgba(59,130,246,0.4)',
                        background: 'rgba(59,130,246,0.08)',
                        color: '#60A5FA', fontSize: 14, fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 8
                    }}
                >
                    ➕ Agregar Punto de Interés
                </button>
            )}

            {/* ── New POI Form ── */}
            {showForm && (
                <div style={{
                    margin: '14px 20px 0', padding: '18px',
                    background: '#1E293B', borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.08)'
                }}>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: 'white', margin: '0 0 12px' }}>
                        Nuevo Punto de Interés
                    </h3>
                    <input
                        ref={nameInputRef}
                        type="text"
                        value={newPoiName}
                        onChange={(e) => setNewPoiName(e.target.value)}
                        placeholder="Nombre (ej: Centro Histórico)"
                        maxLength={50}
                        style={{
                            width: '100%', padding: '12px 14px', borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.15)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'white', fontSize: 14, fontWeight: 600,
                            outline: 'none', marginBottom: 12, boxSizing: 'border-box'
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && newPoiName.trim()) handleSavePoi(); }}
                    />
                    <p style={{ fontSize: 10, fontWeight: 700, color: '#64748B', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ícono</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                        {EMOJI_OPTIONS.map(emoji => (
                            <button key={emoji} onClick={() => setNewPoiEmoji(emoji)} style={{
                                width: 36, height: 36, borderRadius: 8,
                                border: emoji === newPoiEmoji ? '2px solid #3B82F6' : '1px solid rgba(255,255,255,0.1)',
                                background: emoji === newPoiEmoji ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                                fontSize: 18, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>{emoji}</button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setShowForm(false)} style={{
                            flex: 1, padding: '12px', borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'transparent', color: '#94A3B8',
                            fontSize: 13, fontWeight: 700, cursor: 'pointer'
                        }}>Cancelar</button>
                        <button onClick={handleSavePoi} disabled={!newPoiName.trim() || saving} style={{
                            flex: 2, padding: '12px', borderRadius: 12, border: 'none',
                            background: newPoiName.trim() ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : 'rgba(255,255,255,0.05)',
                            color: newPoiName.trim() ? 'white' : '#475569',
                            fontSize: 13, fontWeight: 800,
                            cursor: newPoiName.trim() ? 'pointer' : 'default',
                            boxShadow: newPoiName.trim() ? '0 6px 16px rgba(37,99,235,0.3)' : 'none'
                        }}>{saving ? 'Guardando...' : `Guardar ${newPoiEmoji}`}</button>
                    </div>
                </div>
            )}

            {/* ── POI List ── */}
            <div style={{
                flex: 1, overflowY: 'auto', padding: '14px 20px',
                paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                WebkitOverflowScrolling: 'touch'
            }}>
                {loading ? (
                    <p style={{ textAlign: 'center', color: '#64748B', fontSize: 13, fontWeight: 600, padding: 24 }}>
                        Cargando puntos...
                    </p>
                ) : pois.length === 0 && !showForm ? (
                    <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                        <p style={{ fontSize: 40, marginBottom: 12 }}>📍</p>
                        <p style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>Aún no hay puntos</p>
                        <p style={{ fontSize: 12, color: '#64748B', fontWeight: 500, marginTop: 4 }}>
                            Agrega los lugares que emocionan a los niños
                        </p>
                    </div>
                ) : pois.length > 0 ? (
                    <>
                        <p style={{
                            fontSize: 10, fontWeight: 800, color: '#64748B',
                            textTransform: 'uppercase', letterSpacing: '0.1em',
                            margin: '0 0 10px'
                        }}>Puntos Guardados ({pois.length})</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {pois.map(poi => (
                                <div key={poi.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    background: 'rgba(255,255,255,0.03)', borderRadius: 12,
                                    padding: '12px 14px', border: '1px solid rgba(255,255,255,0.04)'
                                }}>
                                    <span style={{ fontSize: 22, flexShrink: 0 }}>{poi.emoji}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{
                                            fontSize: 14, fontWeight: 700, color: 'white',
                                            margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                        }}>{poi.name}</p>
                                        {poi.created_by_name && (
                                            <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0', fontWeight: 600 }}>
                                                por {poi.created_by_name}
                                            </p>
                                        )}
                                    </div>
                                    <button onClick={() => handleDeletePoi(poi.id)} disabled={deletingId === poi.id} style={{
                                        width: 30, height: 30, borderRadius: 8,
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        background: 'transparent', color: '#475569',
                                        fontSize: 14, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0
                                    }}>{deletingId === poi.id ? '...' : '×'}</button>
                                </div>
                            ))}
                        </div>
                    </>
                ) : null}
            </div>

            {/* Error toast */}
            {error && (
                <div style={{
                    position: 'fixed', bottom: 100, left: 20, right: 20,
                    background: '#DC2626', color: 'white', borderRadius: 12,
                    padding: '12px 16px', fontSize: 13, fontWeight: 600,
                    textAlign: 'center', zIndex: 10000
                }}>
                    {error}
                    <button onClick={() => setError(null)} style={{
                        marginLeft: 12, background: 'none', border: 'none',
                        color: 'white', fontWeight: 800, cursor: 'pointer'
                    }}>×</button>
                </div>
            )}
        </div>
    );
}
