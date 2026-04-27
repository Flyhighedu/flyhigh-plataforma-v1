'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, Plus, List, Map, Star, Trash2, Edit3, Navigation } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import POIFormModal, { CATEGORIES } from './POIFormModal';

// Leaflet must be loaded client-side only (no SSR)
const MapWithNoSSR = dynamic(() => import('./TacticalMapLeaflet'), { ssr: false, loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A' }}>
        <Loader2 size={32} style={{ color: '#06B6D4', animation: 'spin 1s linear infinite' }} />
    </div>
)});

const CATEGORY_MAP = {};
CATEGORIES.forEach(c => { CATEGORY_MAP[c.id] = c; });

export default function TacticalMapScreen({ userId, profile }) {
    const router = useRouter();
    const [pois, setPois] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('map'); // 'map' | 'list'
    const [showForm, setShowForm] = useState(false);
    const [clickedLatLng, setClickedLatLng] = useState(null);
    const [editingPoi, setEditingPoi] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [userLocation, setUserLocation] = useState(null);

    // Load POIs
    useEffect(() => {
        if (!userId) return;
        const load = async () => {
            try {
                const supabase = createClient();
                const { data } = await supabase.from('pilot_pois').select('*').eq('user_id', userId).order('created_at', { ascending: false });
                setPois(data || []);
            } catch (err) { console.warn('POI load error:', err); }
            finally { setLoading(false); }
        };
        load();
    }, [userId]);

    // GPS
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setUserLocation({ lat: 19.4326, lng: -99.1332 }), // Mexico City fallback
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, []);

    const handleMapClick = useCallback((lat, lng) => {
        setClickedLatLng({ lat, lng });
        setEditingPoi(null);
        setShowForm(true);
    }, []);

    const handleEditPoi = useCallback((poi) => {
        setEditingPoi(poi);
        setClickedLatLng(null);
        setShowForm(true);
    }, []);

    const handleSave = useCallback(async (poiData) => {
        if (!userId || isSaving) return;
        setIsSaving(true);
        try {
            const supabase = createClient();
            if (poiData.id) {
                // Update
                const { error } = await supabase.from('pilot_pois').update({
                    name: poiData.name, description: poiData.description,
                    category: poiData.category, is_favorite: poiData.is_favorite,
                    updated_at: new Date().toISOString()
                }).eq('id', poiData.id).eq('user_id', userId);
                if (error) throw error;
                setPois(prev => prev.map(p => p.id === poiData.id ? { ...p, ...poiData, updated_at: new Date().toISOString() } : p));
            } else {
                // Insert
                const { data, error } = await supabase.from('pilot_pois').insert({
                    user_id: userId, name: poiData.name, description: poiData.description,
                    latitude: poiData.latitude, longitude: poiData.longitude,
                    category: poiData.category, is_favorite: poiData.is_favorite
                }).select().single();
                if (error) throw error;
                setPois(prev => [data, ...prev]);
            }
            setShowForm(false);
            setEditingPoi(null);
        } catch (err) {
            console.error('POI save error:', err);
            alert('Error al guardar: ' + (err.message || 'Intenta de nuevo'));
        } finally { setIsSaving(false); }
    }, [userId, isSaving]);

    const handleDelete = useCallback(async (poiId) => {
        if (!confirm('¿Eliminar este punto de interés?')) return;
        setIsSaving(true);
        try {
            const supabase = createClient();
            const { error } = await supabase.from('pilot_pois').delete().eq('id', poiId).eq('user_id', userId);
            if (error) throw error;
            setPois(prev => prev.filter(p => p.id !== poiId));
            setShowForm(false);
            setEditingPoi(null);
        } catch (err) {
            console.error('POI delete error:', err);
            alert('Error al eliminar.');
        } finally { setIsSaving(false); }
    }, [userId]);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 size={32} style={{ color: '#06B6D4', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                    <p style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>Cargando mapa táctico...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0F172A' }}>
            {/* Header */}
            <div style={{
                background: 'linear-gradient(135deg, #0F172A, #1E293B)',
                padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid #334155', zIndex: 50, position: 'relative'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => router.back()} style={{
                        width: 36, height: 36, borderRadius: 12, border: '1px solid #334155',
                        background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#94A3B8'
                    }}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 800, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '0.14em', margin: 0 }}>
                            Mapeo Táctico
                        </p>
                        <p style={{ fontSize: 14, fontWeight: 900, color: '#F1F5F9', margin: 0 }}>
                            {pois.length} punto{pois.length !== 1 ? 's' : ''} guardado{pois.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                {/* View Toggle */}
                <div style={{ display: 'flex', gap: 4, background: '#1E293B', borderRadius: 12, padding: 3, border: '1px solid #334155' }}>
                    <button onClick={() => setView('map')} style={{
                        padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: view === 'map' ? '#06B6D4' : 'transparent',
                        color: view === 'map' ? 'white' : '#64748B', fontWeight: 800, fontSize: 11,
                        display: 'flex', alignItems: 'center', gap: 4
                    }}>
                        <Map size={14} /> Mapa
                    </button>
                    <button onClick={() => setView('list')} style={{
                        padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: view === 'list' ? '#06B6D4' : 'transparent',
                        color: view === 'list' ? 'white' : '#64748B', fontWeight: 800, fontSize: 11,
                        display: 'flex', alignItems: 'center', gap: 4
                    }}>
                        <List size={14} /> Lista
                    </button>
                </div>
            </div>

            {/* Content */}
            {view === 'map' ? (
                <div style={{ flex: 1, position: 'relative' }}>
                    <MapWithNoSSR
                        pois={pois}
                        userLocation={userLocation}
                        onMapClick={handleMapClick}
                        onMarkerClick={handleEditPoi}
                    />
                    {/* FAB */}
                    <button
                        onClick={() => {
                            if (userLocation) {
                                handleMapClick(userLocation.lat, userLocation.lng);
                            } else {
                                alert('Esperando ubicación GPS...');
                            }
                        }}
                        style={{
                            position: 'absolute', bottom: 24, right: 16, zIndex: 40,
                            width: 56, height: 56, borderRadius: 18,
                            background: 'linear-gradient(135deg, #06B6D4, #0891B2)',
                            border: 'none', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 12px 28px -6px rgba(6,182,212,0.5)',
                            cursor: 'pointer'
                        }}
                        title="Nuevo punto en mi ubicación"
                    >
                        <Plus size={28} strokeWidth={3} />
                    </button>
                </div>
            ) : (
                /* List View */
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    {pois.length === 0 ? (
                        <div style={{ textAlign: 'center', paddingTop: 60 }}>
                            <Navigation size={48} style={{ color: '#334155', margin: '0 auto 16px' }} />
                            <p style={{ fontSize: 15, fontWeight: 800, color: '#64748B' }}>Sin puntos guardados</p>
                            <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Toca el mapa para crear tu primer punto de interés.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {pois.map(poi => {
                                const cat = CATEGORY_MAP[poi.category] || CATEGORY_MAP.general;
                                return (
                                    <button
                                        key={poi.id}
                                        onClick={() => handleEditPoi(poi)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 14,
                                            padding: '14px 16px', borderRadius: 16,
                                            background: '#1E293B', border: '1px solid #334155',
                                            cursor: 'pointer', textAlign: 'left', width: '100%',
                                            transition: 'border-color 0.2s'
                                        }}
                                    >
                                        <div style={{
                                            width: 42, height: 42, borderRadius: 14,
                                            background: `${cat.color}20`, border: `2px solid ${cat.color}40`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 20, flexShrink: 0
                                        }}>
                                            {cat.emoji}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <p style={{ fontSize: 14, fontWeight: 800, color: '#F1F5F9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {poi.name}
                                                </p>
                                                {poi.is_favorite && <Star size={12} fill="#F59E0B" style={{ color: '#F59E0B', flexShrink: 0 }} />}
                                            </div>
                                            <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0', fontFamily: 'monospace' }}>
                                                {poi.latitude.toFixed(4)}, {poi.longitude.toFixed(4)}
                                            </p>
                                            {poi.description && (
                                                <p style={{ fontSize: 11, color: '#94A3B8', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {poi.description}
                                                </p>
                                            )}
                                        </div>
                                        <Edit3 size={16} style={{ color: '#475569', flexShrink: 0 }} />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* POI Form Modal */}
            <POIFormModal
                isOpen={showForm}
                onClose={() => { setShowForm(false); setEditingPoi(null); }}
                onSave={handleSave}
                onDelete={handleDelete}
                latitude={clickedLatLng?.lat}
                longitude={clickedLatLng?.lng}
                editingPoi={editingPoi}
                isSaving={isSaving}
            />

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
