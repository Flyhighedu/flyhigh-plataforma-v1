'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import useNativePOITap from '@/hooks/useNativePOITap';
import {
    MapPin, Plus, Loader2, Trash2, Save, ChevronDown, ChevronUp,
    Sparkles, Crown, Search, Edit3, X, Globe, CheckCircle, Archive, Radar, Star, Mic, Play, Pause, Volume2, FileText
} from 'lucide-react';

// Leaflet map (SSR disabled) — reuses the pilot's tactical map component
const MapWithNoSSR = dynamic(() => import('../staff/TacticalMapLeaflet'), { ssr: false, loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--neu-bg)' }}>
        <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
)});

import NarrationCatalog from '@/components/shared/NarrationCatalog';
import NarrationMapSearch from '@/components/shared/NarrationMapSearch';
import MapPlacePreview from '@/components/shared/MapPlacePreview';
import { findExistingPlace } from '@/lib/narration-catalog.mjs';
import CreateNarrationDialog from '@/components/shared/CreateNarrationDialog';
import { motion, useReducedMotion } from 'framer-motion';
import libraryStyles from '@/components/shared/NarrationLibrary.module.css';
import AdminPOIModal from './AdminPOIModal';



export default function MasterRouteStudio() {
    const [routes, setRoutes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeRoute, setActiveRoute] = useState(null);
    const [pois, setPois] = useState([]);
    const [loadingPois, setLoadingPois] = useState(false);
    const [editingPoi, setEditingPoi] = useState(null);
    const [saving, setSaving] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [creating, setCreating] = useState(false);
    const [expandedContext, setExpandedContext] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [studioTab, setStudioTab] = useState('library');
    const [createOpen, setCreateOpen] = useState(false);
    const [mapCenter, setMapCenter] = useState(null);
    const reducedMotion = useReducedMotion();
    const openOfficial = poi => { setEditingPoi(poi); setStudioTab('explore'); };

    // ═══ MAP STATE ═══
    const [searchError, setSearchError] = useState('');
    const [mapBounds, setMapBounds] = useState(null);
    const [suggestedPois, setSuggestedPois] = useState([]);
    const [isSearchingPois, setIsSearchingPois] = useState(false);
    const [isAwaitingSelection, setIsAwaitingSelection] = useState(false);
    const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
    const [userLocation, setUserLocation] = useState(null);
    const [candidate, setCandidate] = useState(null);

    // ═══ INIT GLOBAL ROUTE ═══
    const initGlobalRoute = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/routes');
            if (res.ok) {
                const data = await res.json();
                let globalRoute = (data.routes || []).find(r => r.title === 'Directorio Global');

                if (!globalRoute) {
                    const createRes = await fetch('/api/admin/routes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: 'Directorio Global', emoji: '🌎' })
                    });
                    if (createRes.ok) {
                        const createData = await createRes.json();
                        globalRoute = createData.route;
                    }
                }

                if (globalRoute) {
                    setActiveRoute(globalRoute);
                    fetchPois(globalRoute.id);
                }
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { initGlobalRoute(); }, [initGlobalRoute]);

    // ═══ FETCH POIs ═══
    const fetchPois = async (routeId) => {
        setLoadingPois(true);
        try {
            const res = await fetch(`/api/admin/routes/pois?route_id=${routeId}`);
            if (res.ok) {
                const data = await res.json();
                setPois(data.pois || []);
            }
        } catch (err) { console.error(err); }
        finally { setLoadingPois(false); }
    };

    // ═══ ADD POI ═══
    function addPoi() {
        if (!activeRoute) return;
        setIsAwaitingSelection(true);
        handleSearchCulturalPois();
    }

    // ═══ UPDATE POI ═══
    const updatePoi = async (id, updates) => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/routes/pois', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se guardaron los cambios.');
            setPois(prev => prev.map(p => p.id === id ? data.poi : p));

        }
        finally { setSaving(false); }
    };

    // ═══ DELETE POI ═══
    const deletePoi = async (id, confirmed = false) => {
        if (!confirmed && !confirm('¿Eliminar este punto?')) return;
        try {
            const response = await fetch(`/api/admin/routes/pois?id=${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('No se pudo eliminar el punto. Intenta de nuevo.');
            setPois(prev => prev.filter(p => p.id !== id));
            if (editingPoi?.id === id) setEditingPoi(null);
        } catch (err) { if (confirmed) throw err; else alert(err.message); }
    };

    // ═══ AI FILL ═══
    const aiFillPoi = async () => {
        if (!editingPoi) return;
        setAiLoading(true);
        try {
            const article = editingPoi.ai_context?.article || editingPoi.description || '';
            const res = await fetch('/api/poi-fill-ficha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article, poiName: editingPoi.name })
            });
            if (res.ok) {
                const data = await res.json();
                await updatePoi(editingPoi.id, {
                    dato_clave_1: data.dato_clave_1 || editingPoi.dato_clave_1,
                    dato_clave_2: data.dato_clave_2 || editingPoi.dato_clave_2,
                    pregunta_estudio_1: data.pregunta_estudio_1 || editingPoi.pregunta_estudio_1,
                    pregunta_estudio_2: data.pregunta_estudio_2 || editingPoi.pregunta_estudio_2,
                    pregunta_interaccion: data.pregunta_interaccion || editingPoi.pregunta_interaccion,
                });
            }
        } catch (err) { console.error(err); }
        finally { setAiLoading(false); }
    };

    // ═══ ADD POI FROM MAP (MEMORY ONLY) ═══
    const addPoiFromMap = useCallback((name, lat, lng, description, origin) => {
        if (!activeRoute) return;
        setIsAwaitingSelection(false);
        setEditingPoi({
            _origin: origin,
            id: `temp-${Date.now()}`,
            name,
            description,
            latitude: lat,
            longitude: lng
        });
    }, [activeRoute]);

    // ═══ MAP: LONG-PRESS → NEW POI ═══
    const handleLongPress = useCallback(async (lat, lng, origin) => {
        if (!activeRoute) return;
        setIsReverseGeocoding(true);
        let placeName = '';
        try {
            const res = await fetch('/api/staff/map-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'nearby-name', latitude: lat, longitude: lng, radius: 150 }) });
            if (res.ok) {
                const data = await res.json();
                if (data?.elements?.length > 0) {
                    const best = data.elements.find(e => e.tags?.name) || {};
                    placeName = best.tags?.name || '';
                }
            }
        } catch (e) { console.warn('Reverse geocode failed', e); }
        finally {
            setIsReverseGeocoding(false);
            // Auto-create POI and open editor
            addPoiFromMap(placeName || 'Nuevo Punto', lat, lng, '', origin);
        }
    }, [activeRoute, addPoiFromMap]);

    // ═══ MAP: TAP-TO-DISCOVER (Native OSM POIs) ═══
    const { handleMapTap, isDiscovering } = useNativePOITap({
        onPOIFound: useCallback((poi) => {
            setCandidate(poi);
        }, []),
        enabled: !!activeRoute
    });

    // ═══ MAP: RADAR SEARCH (Overpass Cultural POIs) ═══
    const handleSearchCulturalPois = async () => {
        if (suggestedPois.length > 0) { setSuggestedPois([]); return; }
        if (!mapBounds) { setSearchError('Mueve el mapa para detectar la zona.'); return; }
        setSearchError('');
        setIsSearchingPois(true);
        try {
            const sw = mapBounds._southWest, ne = mapBounds._northEast;
            const res = await fetch('/api/staff/map-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'cultural', bounds: { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng } }) });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'No se pudo consultar el mapa.');
            const newPois = data.elements.map(el => {
                const lat = el.type === 'node' ? el.lat : el.center?.lat;
                const lon = el.type === 'node' ? el.lon : el.center?.lon;
                const name = el.tags?.name;
                const historicType = el.tags?.historic;
                const tourismType = el.tags?.tourism;
                const amenityType = el.tags?.amenity;
                const naturalType = el.tags?.natural;
                const aeroType = el.tags?.aeroway;
                const waterType = el.tags?.waterway;
                const leisureType = el.tags?.leisure;
                const manMadeType = el.tags?.man_made;
                const powerType = el.tags?.power;
                const railwayType = el.tags?.railway;
                const placeType = el.tags?.place;
                const landuseType = el.tags?.landuse;
                const shopType = el.tags?.shop;

                if (!lat || !lon || !name) return null;

                let desc = 'Punto de interés geográfico, cultural o recreativo.';
                let cat = 'landmark';

                if (placeType) {
                    if (placeType === 'city') desc = 'Ciudad Principal.';
                    else if (placeType === 'town') desc = 'Población / Villa.';
                    else if (placeType === 'village') desc = 'Pueblo.';
                    else if (placeType === 'suburb') desc = 'Colonia / Barrio.';
                    else desc = 'Localidad.';
                    cat = 'city';
                }
                else if (historicType) desc = historicType === 'monument' ? 'Monumento Histórico.' : historicType === 'archaeological_site' ? 'Sitio Arqueológico.' : 'Lugar Histórico.';
                else if (tourismType) {
                    if (tourismType === 'museum') desc = 'Museo.';
                    else if (tourismType === 'artwork') desc = 'Obra de arte pública.';
                    else if (tourismType === 'theme_park') desc = 'Parque de Atracciones.';
                    else if (tourismType === 'zoo') desc = 'Zoológico.';
                    else if (tourismType === 'aquarium') desc = 'Acuario.';
                    else if (tourismType === 'viewpoint') desc = 'Mirador.';
                    else desc = 'Atracción turística.';
                }
                else if (amenityType) {
                    if (amenityType === 'place_of_worship') desc = 'Templo / Lugar de culto.';
                    else if (amenityType === 'university' || amenityType === 'college') desc = 'Institución Educativa Superior.';
                    else if (amenityType === 'library') desc = 'Biblioteca.';
                    else if (amenityType === 'theatre') desc = 'Teatro.';
                    else if (amenityType === 'grave_yard') desc = 'Panteón / Cementerio.';
                    else if (amenityType === 'hospital') desc = 'Hospital / Clínica.';
                    else desc = 'Edificio o Espacio Público.';
                }
                else if (naturalType) {
                    if (naturalType === 'peak' || naturalType === 'volcano') desc = `Elevación Natural (${el.tags?.ele ? el.tags.ele + 'm' : 'Cerro/Montaña'}).`;
                    else if (naturalType === 'water') desc = 'Cuerpo de Agua (Lago/Laguna).';
                    else desc = 'Área Natural.';
                }
                else if (waterType) {
                    if (waterType === 'dam') desc = 'Presa / Infraestructura hidráulica.';
                    else if (waterType === 'river') desc = 'Río / Corriente de agua.';
                    else if (waterType === 'waterfall') desc = 'Cascada / Salto de agua.';
                    else desc = 'Cuerpo de Agua.';
                }
                else if (leisureType) {
                    if (leisureType === 'park' || leisureType === 'nature_reserve') desc = 'Parque o Reserva Natural.';
                    else if (leisureType === 'sports_centre' || leisureType === 'stadium') desc = 'Unidad Deportiva / Estadio.';
                    else desc = 'Espacio Recreativo.';
                }
                else if (manMadeType) {
                    if (manMadeType === 'wastewater_plant' || manMadeType === 'water_works') desc = 'Planta de Tratamiento / Infraestructura de Agua.';
                    else if (manMadeType === 'observatory') desc = 'Observatorio.';
                    else if (manMadeType === 'lighthouse') desc = 'Faro.';
                    else desc = 'Infraestructura Civil.';
                }
                else if (powerType === 'plant') desc = 'Planta de Energía / Central Eléctrica.';
                else if (railwayType === 'station') desc = 'Estación de Ferrocarril.';
                else if (aeroType === 'aerodrome') desc = 'Aeropuerto / Pista de aterrizaje.';
                else if (landuseType) {
                    if (landuseType === 'cemetery') desc = 'Panteón / Cementerio.';
                    else if (landuseType === 'commercial') desc = 'Zona Comercial.';
                    else if (landuseType === 'industrial') desc = 'Zona Industrial.';
                }
                else if (shopType === 'mall') desc = 'Centro Comercial.';

                return { id: el.id, name, description: desc, category: cat, latitude: lat, longitude: lon };
            }).filter(Boolean);
            if (newPois.length === 0) { setSearchError('No encontramos sitios aquí. Puedes mantener presionado el mapa para crear uno.'); return; }
            setSuggestedPois(newPois);
        } catch (err) { console.error(err); setSearchError(err.message || 'No se pudo consultar el mapa.'); }
        finally { setIsSearchingPois(false); }
    };

    // ═══ MAP: CLICK SUGGESTED POI → ADD TO ROUTE ═══
    const handleSuggestedPoiClick = useCallback((poi) => {
        if (!activeRoute) return;
        setCandidate(poi);
    }, [activeRoute]);

    // ═══ MAP: CLICK SAVED POI MARKER ═══
    const handleMarkerClick = useCallback((poi) => {
        setEditingPoi(poi);
    }, []);

    // ═══ RENDER ═══
    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="w-full">
            <header className={libraryStyles.header} style={{ padding: '20px 20px 0', borderRadius: '22px 22px 0 0', marginBottom: 20 }}><div className={libraryStyles.headerRow}><h1>Narraciones oficiales</h1><button disabled={!activeRoute || !!editingPoi || saving} onClick={() => setCreateOpen(true)}><Plus size={18}/>Crear narración</button></div><div className={libraryStyles.tabs} aria-label="Vistas de narraciones">{[['library','Biblioteca'],['explore','Explorar']].map(([value,label]) => <button key={value} disabled={!!editingPoi || saving} aria-pressed={studioTab === value} onClick={() => setStudioTab(value)}>{studioTab === value && <motion.i className={libraryStyles.activeTab} layoutId="official-library-tab" transition={{ duration: reducedMotion ? 0 : .24 }}/>}<span style={{ color: studioTab === value ? '#173b77' : 'white' }}>{label}</span></button>)}</div></header>
            {createOpen && <CreateNarrationDialog onClose={() => setCreateOpen(false)} onPlace={() => { setCreateOpen(false); setStudioTab('explore'); addPoi(); }} onTopic={() => { setCreateOpen(false); openOfficial({ id: 'temp-' + Date.now(), name: '', is_general_topic: true }); }}/>}
            {searchError && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950"><span className="flex-1">{searchError}</span><button type="button" disabled={isSearchingPois} onClick={handleSearchCulturalPois} className="min-h-11 px-3 font-semibold">Reintentar</button><button type="button" onClick={() => { setSearchError(''); setIsAwaitingSelection(true); }} className="min-h-11 px-3 font-semibold">Elegir punto en el mapa</button></div>}
            {/* ── MAIN SPLIT LAYOUT ── */}
            {activeRoute && (
                <>
                <div style={{ display: studioTab === 'explore' ? undefined : 'none' }} className="flex flex-col lg:flex-row gap-6 overflow-hidden">
                    {/* ═══ LEFT: Map Info ═══ */}
                    <div className={`relative flex flex-col transition-all duration-500 ease-in-out ${editingPoi?.is_general_topic ? 'w-0 opacity-0 overflow-hidden' : 'flex-1 opacity-100'}`}>
                        {/* ═══ INTERACTIVE MAP ═══ */}
                        <NarrationMapSearch onSelect={setMapCenter} onLocate={() => { if (navigator.geolocation) navigator.geolocation.getCurrentPosition(pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => setSearchError('No se pudo obtener tu ubicación. Busca una ciudad.')); }}/>
                        <div className="neu-card overflow-hidden mb-4" style={{ height: 'calc(100vh - 140px)', minHeight: 500, position: 'relative' }}>
                            <MapWithNoSSR
                                pois={pois.filter(p => (p.latitude || p.lat) && (p.longitude || p.lng)).map(p => ({ ...p, latitude: p.latitude || p.lat, longitude: p.longitude || p.lng, is_official: true }))}
                                suggestedPois={suggestedPois}
                                userLocation={userLocation}
                                mapCenter={mapCenter}
                                onMarkerClick={handleMarkerClick}
                                onBoundsChange={setMapBounds}
                                onSuggestedPoiClick={handleSuggestedPoiClick}
                                onLongPress={handleLongPress}
                                onMapTap={handleMapTap}
                            />

                            {/* Floating Controls FABs */}
                            <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <button
                                    onClick={() => {
                                        if (navigator.geolocation) {
                                            navigator.geolocation.getCurrentPosition(
                                                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                                                (err) => alert('No se pudo obtener la ubicación.')
                                            );
                                        }
                                    }}
                                    style={{ width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', color: '#3B82F6', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', fontSize: 20, transition: 'all 0.2s' }}
                                    title="Mi ubicación"
                                >
                                    📍
                                </button>
                                <div style={{ position: 'relative' }}>
                                    {isSearchingPois && (
                                        <>
                                            <div style={{ position: 'absolute', width: 48, height: 48, borderRadius: '50%', background: '#3B82F6', animation: 'radarPulse 2s ease infinite', pointerEvents: 'none', top: 0, left: 0 }} />
                                            <div style={{ position: 'absolute', width: 48, height: 48, borderRadius: '50%', background: '#3B82F6', animation: 'radarPulse 2s ease infinite', animationDelay: '1s', pointerEvents: 'none', top: 0, left: 0 }} />
                                        </>
                                    )}
                                    <button
                                        onClick={handleSearchCulturalPois}
                                        disabled={isSearchingPois}
                                        style={{ position: 'relative', width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: suggestedPois.length > 0 ? '#EF4444' : 'linear-gradient(135deg, #F43F5E, #8B5CF6)', color: '#fff', boxShadow: '0 8px 24px rgba(244,63,94,0.4)', fontSize: 24, transition: 'all 0.2s', zIndex: 10 }}
                                        title={suggestedPois.length > 0 ? 'Limpiar sugerencias' : 'Buscar sitios culturales'}
                                    >
                                        {isSearchingPois ? <Loader2 size={24} className="animate-spin" /> : suggestedPois.length > 0 ? <X size={24} /> : '📡'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Selected place and narration editor */}
                    <div className={`transition-all duration-500 ease-in-out flex flex-col bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden ${editingPoi?.is_general_topic ? 'w-full max-w-5xl mx-auto' : 'w-full lg:w-[450px] shrink-0'}`} style={{ height: 'calc(100vh - 140px)' }}>
                        {editingPoi ? (
                            <AdminPOIModal
                                poi={editingPoi}
                                onClose={() => setEditingPoi(null)}
                                onSave={async (poiData) => {
                                    if (editingPoi.id && !editingPoi.id.startsWith('temp-')) {
                                        await updatePoi(editingPoi.id, poiData);
                                    } else {
                                        // Save new POI to server
                                        setSaving(true);
                                        try {
                                            const res = await fetch('/api/admin/routes/pois', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ route_id: activeRoute.id, ...poiData })
                                            });
                                            const data = await res.json();
                                            if (!res.ok) throw new Error(data.error || 'No se pudo guardar el punto.');
                                            setPois(prev => [...prev, data.poi]);
                                        }
                                        finally { setSaving(false); }
                                    }

                                    setSaveSuccess(true);
                                    setTimeout(() => setSaveSuccess(false), 3000);
                                }}
                                onDelete={id => deletePoi(id, true)}
                                isNewPin={!editingPoi.dato_clave_1}
                                geoContext={activeRoute.name}
                                isGeneralTopic={editingPoi?.is_general_topic || false}
                            />
                        ) : isReverseGeocoding ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 relative overflow-hidden animate-in fade-in duration-300">
                                <div className="absolute top-0 inset-x-0 h-1 bg-cyan-500 animate-pulse" />
                                <div className="w-[80px] h-[80px] rounded-full flex items-center justify-center mb-6 shadow-xl" style={{ background: 'linear-gradient(135deg, #06B6D4, #0891B2)', border: '4px solid #CFFAFE', color: 'white' }}>
                                    <Loader2 size={40} className="animate-spin" />
                                </div>
                                <h4 className="font-black text-2xl mb-3 text-slate-800">Identificando ubicación...</h4>
                                <p className="text-base font-medium text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                                    Analizando las coordenadas en el mapa para encontrar el nombre del lugar seleccionado.
                                </p>
                            </div>
                        ) : isAwaitingSelection ? (
                            isSearchingPois ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 relative overflow-hidden">
                                    <div className="absolute top-0 inset-x-0 h-1 bg-purple-500 animate-pulse" />
                                    <div className="w-[64px] h-[64px] rounded-full flex items-center justify-center mb-6 shadow-xl animate-[spin_3s_linear_infinite]" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: '4px solid #FEF08A', fontSize: '32px' }}>
                                        ⭐
                                    </div>
                                    <h4 className="font-black text-2xl mb-3 text-slate-800">Escaneando puntos...</h4>
                                    <p className="text-base font-medium text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                                        Analizando la zona en busca de puntos de interés históricos, culturales y recreativos.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 relative overflow-hidden">
                                    <div className="absolute top-0 inset-x-0 h-1 bg-purple-500 animate-pulse" />
                                    <div className="w-[64px] h-[64px] rounded-full flex items-center justify-center mb-6 shadow-xl animate-bounce" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: '4px solid #FEF08A', fontSize: '32px' }}>
                                        ⭐
                                    </div>
                                    <h4 className="font-black text-2xl mb-3 text-slate-800">Selecciona un Punto</h4>
                                    <p className="text-base font-medium text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                                        {suggestedPois.length > 0 
                                            ? `Selecciona en el mapa entre los ${suggestedPois.length} puntos de interés que aparecen en ${activeRoute?.name || 'la ciudad'}.`
                                            : `Selecciona en el mapa el punto de interés que quieras agregar en ${activeRoute?.name || 'la ciudad'}.`
                                        }
                                    </p>
                                    <button onClick={() => { setIsAwaitingSelection(false); setSuggestedPois([]); }} className="mt-8 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
                                        Cancelar
                                    </button>
                                </div>
                            )
                        ) : saveSuccess ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 relative overflow-hidden animate-in fade-in duration-500">
                                <div className="absolute top-0 inset-x-0 h-1 bg-green-500 animate-pulse" />
                                <div className="w-[80px] h-[80px] rounded-full flex items-center justify-center mb-6 shadow-xl animate-bounce" style={{ background: 'linear-gradient(135deg, #10B981, #059669)', border: '4px solid #D1FAE5', fontSize: '40px' }}>
                                    ✅
                                </div>
                                <h4 className="font-black text-2xl mb-3 text-slate-800">Punto Oficial Guardado</h4>
                                <p className="text-base font-medium text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                                    El punto ha sido registrado exitosamente y sincronizado en el mapa.
                                </p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 animate-in fade-in duration-300">
                                <div className="text-6xl mb-4">✨🗺️</div>
                                <h4 className="font-black text-xl mb-2 text-slate-800">Crea un Punto Oficial</h4>
                                <p className="text-sm font-medium text-slate-500 max-w-[250px] mx-auto leading-relaxed">
                                    Inicia el proceso para descubrir y registrar ubicaciones estratégicas en el mapa.
                                </p>
                                <button onClick={addPoi} disabled={saving} className="mt-8 group relative flex items-center gap-2 px-8 py-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-xl hover:-translate-y-1 hover:shadow-2xl hover:shadow-purple-600/30 active:scale-95 transition-all">
                                    <Plus size={20} className="group-hover:rotate-90 transition-transform" /> Punto en Mapa
                                </button>
                                <button onClick={() => {
                                    setEditingPoi({
                                        id: `temp-${Date.now()}`,
                                        name: '',
                                        description: 'Tema General',
                                        latitude: null,
                                        longitude: null,
                                        is_general_topic: true
                                    });
                                }} disabled={saving} className="mt-3 group relative flex items-center gap-2 px-8 py-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black shadow-xl hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-500/30 active:scale-95 transition-all">
                                    💡 Tema General
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ BOTTOM: GRID DE PUNTOS OFICIALES GUARDADOS ═══ */}
                <div hidden={studioTab !== 'library'} className="mt-8 w-full">
                    <div className="flex items-center gap-2 mb-4 px-2 flex-wrap">
                        <Crown size={24} className="text-blue-600" />
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Narraciones oficiales</h3>
                        <span className="bg-slate-200 text-slate-600 text-sm font-bold px-3 py-1 rounded-full">{pois.length}</span>
                    </div>
                    <NarrationCatalog pois={pois.map(poi => ({ ...poi, is_official: true }))} admin onOpen={openOfficial} onDelete={deletePoi} active={!editingPoi && studioTab === 'library'}/>
                </div>
                </>
            )}

            {candidate && <MapPlacePreview poi={candidate} existing={findExistingPlace(pois, candidate)} onClose={() => setCandidate(null)} onContinue={existing => { const point = candidate; setCandidate(null); if (existing) openOfficial(existing); else addPoiFromMap(point.name, point.latitude, point.longitude, point.description, point._origin); }}/>}
            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes radarPulse {
                    0% { transform: scale(1); opacity: 0.6; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                @keyframes orbiEntrance {
                    0% { opacity: 0; transform: translateY(80px) scale(0.3); }
                    60% { opacity: 1; transform: translateY(-8px) scale(1.04); }
                    80% { transform: translateY(3px) scale(0.98); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes orbiPulseRing {
                    0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.5); }
                    70% { box-shadow: 0 0 0 20px rgba(139, 92, 246, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
                }
            `}</style>
        </div>
    );
}
