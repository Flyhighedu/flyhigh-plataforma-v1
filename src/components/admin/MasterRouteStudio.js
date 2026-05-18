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

import AdminPOIModal from './AdminPOIModal';


// ═══ Auto-emoji by name ═══
function autoEmoji(name) {
    if (!name) return '📍';
    const n = name.toLowerCase();
    if (/museo/i.test(n)) return '🏛️';
    if (/templo|iglesia|capilla/i.test(n)) return '⛪';
    if (/río|lago|cascada|agua/i.test(n)) return '💧';
    if (/parque|bosque|reserva/i.test(n)) return '🌿';
    if (/cerro|volcán|montaña/i.test(n)) return '⛰️';
    if (/universidad|biblioteca|escuela/i.test(n)) return '📚';
    if (/aeropuerto/i.test(n)) return '✈️';
    if (/estadio|deportiv/i.test(n)) return '⚽';
    if (/monument|históric/i.test(n)) return '🏺';
    if (/mirador/i.test(n)) return '👁️';
    if (/zoológico|acuario/i.test(n)) return '🐾';
    return '📍';
}

const STATUS_CFG = {
    draft: { label: 'Borrador', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: Edit3 },
    published: { label: 'Publicada', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: Globe },
    archived: { label: 'Archivada', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: Archive },
};

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
    const [poiFilter, setPoiFilter] = useState('all'); // 'all' | 'map' | 'general'

    // ═══ MAP STATE ═══
    const [mapBounds, setMapBounds] = useState(null);
    const [suggestedPois, setSuggestedPois] = useState([]);
    const [isSearchingPois, setIsSearchingPois] = useState(false);
    const [isAwaitingSelection, setIsAwaitingSelection] = useState(false);
    const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
    const [userLocation, setUserLocation] = useState(null);
    const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);

    // Auto-locate on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && !localStorage.getItem('studio_onboarded_v1')) {
            setShowWelcomeOverlay(true);
        }
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.warn('GPS location failed on mount:', err)
            );
        }
    }, []);

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
            if (res.ok) {
                const { poi } = await res.json();
                setPois(prev => prev.map(p => p.id === id ? poi : p));
                setEditingPoi(poi);
            }
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    // ═══ DELETE POI ═══
    const deletePoi = async (id) => {
        if (!confirm('¿Eliminar este punto?')) return;
        try {
            await fetch(`/api/admin/routes/pois?id=${id}`, { method: 'DELETE' });
            setPois(prev => prev.filter(p => p.id !== id));
            if (editingPoi?.id === id) setEditingPoi(null);
        } catch (err) { console.error(err); }
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

    // ═══ MAP: LONG-PRESS → NEW POI ═══
    const handleLongPress = useCallback(async (lat, lng) => {
        if (!activeRoute) return;
        setIsReverseGeocoding(true);
        let placeName = '';
        try {
            const query = `[out:json][timeout:10];(node["name"](around:150,${lat},${lng});way["name"](around:150,${lat},${lng}););out center;`;
            const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
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
            addPoiFromMap(placeName || 'Nuevo Punto', lat, lng, '');
        }
    }, [activeRoute]);

    // ═══ MAP: TAP-TO-DISCOVER (Native OSM POIs) ═══
    const { handleMapTap, isDiscovering } = useNativePOITap({
        onPOIFound: useCallback((poi) => {
            addPoiFromMap(poi.name, poi.latitude, poi.longitude, poi.description);
        }, []),
        enabled: !!activeRoute
    });

    // ═══ MAP: RADAR SEARCH (Overpass Cultural POIs) ═══
    const handleSearchCulturalPois = async () => {
        if (suggestedPois.length > 0) { setSuggestedPois([]); return; }
        if (!mapBounds) { alert('Mueve el mapa para detectar la zona.'); return; }
        setIsSearchingPois(true);
        try {
            const sw = mapBounds._southWest, ne = mapBounds._northEast;
            const bbox = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
            const query = `
                [out:json][timeout:20];
                (
                  node["historic"](${bbox});
                  way["historic"](${bbox});
                  node["tourism"~"museum|artwork|attraction|theme_park|zoo|aquarium|viewpoint"](${bbox});
                  way["tourism"~"museum|artwork|attraction|theme_park|zoo|aquarium|viewpoint"](${bbox});
                  node["amenity"~"place_of_worship|university|college|school|library|theatre|townhall|public_building"](${bbox});
                  way["amenity"~"place_of_worship|university|college|school|library|theatre|townhall|public_building"](${bbox});
                  node["aeroway"="aerodrome"](${bbox});
                  way["aeroway"="aerodrome"](${bbox});
                  node["waterway"~"dam|river|waterfall"](${bbox});
                  way["waterway"~"dam|river|waterfall"](${bbox});
                  node["natural"~"peak|volcano|water|wood|forest"](${bbox});
                  way["natural"~"peak|volcano|water|wood|forest"](${bbox});
                  node["leisure"~"park|nature_reserve|sports_centre|stadium"](${bbox});
                  way["leisure"~"park|nature_reserve|sports_centre|stadium"](${bbox});
                  node["man_made"~"wastewater_plant|water_works|observatory|lighthouse|windmill|watermill|works"](${bbox});
                  way["man_made"~"wastewater_plant|water_works|observatory|lighthouse|windmill|watermill|works"](${bbox});
                  node["power"="plant"](${bbox});
                  way["power"="plant"](${bbox});
                  node["railway"="station"](${bbox});
                  way["railway"="station"](${bbox});
                  node["landuse"~"industrial|commercial|cemetery"]["name"](${bbox});
                  way["landuse"~"industrial|commercial|cemetery"]["name"](${bbox});
                  node["amenity"~"fuel|hospital|police|fire_station|grave_yard"]["name"](${bbox});
                  way["amenity"~"fuel|hospital|police|fire_station|grave_yard"]["name"](${bbox});
                  node["shop"="mall"]["name"](${bbox});
                  way["shop"="mall"]["name"](${bbox});
                  node["place"~"city|town|village|suburb|municipality"]["name"](${bbox});
                  way["place"~"city|town|village|suburb|municipality"]["name"](${bbox});
                );
                out center;
            `;
            const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
            if (!res.ok) throw new Error('Overpass failed');
            const data = await res.json();
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
            if (newPois.length === 0) { alert('No se encontraron sitios en esta zona.'); return; }
            setSuggestedPois(newPois);
        } catch (err) { console.error(err); alert('Error al buscar sitios.'); }
        finally { setIsSearchingPois(false); }
    };

    // ═══ MAP: CLICK SUGGESTED POI → ADD TO ROUTE ═══
    const handleSuggestedPoiClick = useCallback((poi) => {
        if (!activeRoute) return;
        addPoiFromMap(poi.name, poi.latitude, poi.longitude, poi.description || '');
    }, [activeRoute]);

    // ═══ MAP: CLICK SAVED POI MARKER ═══
    const handleMarkerClick = useCallback((poi) => {
        setEditingPoi(poi);
    }, []);

    // ═══ ADD POI FROM MAP (MEMORY ONLY) ═══
    const addPoiFromMap = (name, lat, lng, description) => {
        if (!activeRoute) return;
        setIsAwaitingSelection(false);
        setEditingPoi({
            id: `temp-${Date.now()}`,
            name,
            description,
            latitude: lat,
            longitude: lng
        });
    };

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
            {/* ── MAIN SPLIT LAYOUT ── */}
            {activeRoute && (
                <>
                <div className="flex flex-col lg:flex-row gap-6 overflow-hidden">
                    {/* ═══ LEFT: Map Info ═══ */}
                    <div className={`relative flex flex-col transition-all duration-500 ease-in-out ${editingPoi?.is_general_topic ? 'w-0 opacity-0 overflow-hidden' : 'flex-1 opacity-100'}`}>
                        {/* ═══ INTERACTIVE MAP ═══ */}
                        <div className="neu-card overflow-hidden mb-4" style={{ height: 'calc(100vh - 140px)', minHeight: 500, position: 'relative' }}>
                            <MapWithNoSSR
                                pois={pois.filter(p => (p.latitude || p.lat) && (p.longitude || p.lng)).map(p => ({ ...p, latitude: p.latitude || p.lat, longitude: p.longitude || p.lng, is_official: true }))}
                                suggestedPois={suggestedPois}
                                userLocation={userLocation || { lat: 19.4326, lng: -99.1332 }}
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

                    {/* ═══ RIGHT: GAMIFIED SIDEBAR FORM ═══ */}
                    <div className={`transition-all duration-500 ease-in-out flex flex-col bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden ${editingPoi?.is_general_topic ? 'w-full max-w-5xl mx-auto' : 'w-full lg:w-[450px] shrink-0'}`} style={{ height: 'calc(100vh - 140px)' }}>
                        {editingPoi ? (
                            <AdminPOIModal
                                poi={editingPoi}
                                onClose={() => setEditingPoi(null)}
                                onSave={async (poiData) => {
                                    if (editingPoi.id && !editingPoi.id.startsWith('temp-')) {
                                        await updatePoi(editingPoi.id, poiData);
                                        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
                                    } else {
                                        // Save new POI to server
                                        setSaving(true);
                                        try {
                                            const res = await fetch('/api/admin/routes/pois', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ route_id: activeRoute.id, ...poiData })
                                            });
                                            if (res.ok) {
                                                const { poi } = await res.json();
                                                setPois(prev => [...prev, poi]);
                                                setEditingPoi(null);
                                                setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
                                            }
                                        } catch (err) { console.error(err); }
                                        finally { setSaving(false); }
                                    }
                                    setEditingPoi(null);
                                    setSaveSuccess(true);
                                    setTimeout(() => setSaveSuccess(false), 3000);
                                }}
                                onDelete={(id) => {
                                    deletePoi(id);
                                    setEditingPoi(null);
                                }}
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
                <div className="mt-8 w-full">
                    <div className="flex items-center gap-2 mb-4 px-2 flex-wrap">
                        <Crown size={24} className="text-blue-600" />
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Directorio de Narrativas</h3>
                        <span className="bg-slate-200 text-slate-600 text-sm font-bold px-3 py-1 rounded-full">{pois.length}</span>
                    </div>
                    {/* Filter Chips */}
                    <div className="flex gap-2 mb-6 px-2">
                        {[{ key: 'all', label: '🏷️ Todos', count: pois.length },
                          { key: 'map', label: '📍 En Mapa', count: pois.filter(p => p.lat != null || p.latitude != null).length },
                          { key: 'general', label: '💡 Temas', count: pois.filter(p => p.is_general_topic || (p.lat == null && p.latitude == null)).length }
                        ].map(f => (
                            <button key={f.key} onClick={() => setPoiFilter(f.key)}
                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                                    poiFilter === f.key
                                        ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                }`}
                            >
                                {f.label} ({f.count})
                            </button>
                        ))}
                    </div>

                    {pois.length === 0 ? (
                        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                                <Archive size={28} />
                            </div>
                            <p className="text-slate-500 font-medium">Aún no hay puntos oficiales registrados.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2">
                            {pois.filter(poi => {
                                if (poiFilter === 'map') return (poi.lat != null || poi.latitude != null) && !poi.is_general_topic;
                                if (poiFilter === 'general') return poi.is_general_topic || (poi.lat == null && poi.latitude == null);
                                return true;
                            }).map((poi) => {
                                const hasNarrative = poi.narrative_script && poi.audio_url;
                                const isGeneral = poi.is_general_topic || (poi.lat == null && poi.latitude == null);
                                return (
                                    <div key={poi.id} onClick={() => { setEditingPoi(poi); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="neu-card cursor-pointer transition-all hover:-translate-y-2 hover:shadow-2xl group flex flex-col" style={{ overflow: 'hidden', padding: 0 }}>
                                        {/* Header / Cover */}
                                        <div style={{ height: 140, background: poi.image_url ? `url(${poi.image_url}) center/cover` : (isGeneral ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'linear-gradient(135deg, #2563EB, #1D4ED8)'), position: 'relative' }}>
                                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0.1) 100%)' }} />
                                            <div style={{ position: 'absolute', bottom: 12, left: 16, right: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <span className="text-4xl drop-shadow-lg group-hover:scale-110 transition-transform">{isGeneral ? '💡' : autoEmoji(poi.name)}</span>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="text-white font-black text-lg truncate drop-shadow-md leading-tight">{poi.name}</h4>
                                                    <div className={`inline-block mt-1 rounded-md px-2 py-0.5 text-[9px] font-black text-white tracking-widest uppercase shadow-md border ${isGeneral ? 'bg-amber-600 border-amber-500/50' : 'bg-blue-600 border-blue-500/50'}`}>
                                                        {isGeneral ? 'Tema General' : 'Oficial'}
                                                    </div>
                                                </div>
                                            </div>
                                            <button onClick={e => { e.stopPropagation(); deletePoi(poi.id); }} className="absolute top-3 right-3 p-2.5 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        
                                        {/* Content */}
                                        <div className="p-5 bg-white flex-1 flex flex-col">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${hasNarrative ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {hasNarrative ? 'Narrativa Lista' : 'Sin Guion'}
                                                </span>
                                                <span className="text-[10px] font-medium text-slate-400 font-mono">
                                                    {isGeneral ? 'Sin ubicación' : `${poi.latitude?.toFixed(4) ?? poi.lat?.toFixed(4) ?? '—'}, ${poi.longitude?.toFixed(4) ?? poi.lng?.toFixed(4) ?? '—'}`}
                                                </span>
                                            </div>
                                            
                                            {hasNarrative ? (
                                                <div className="flex-1 flex flex-col gap-3 mt-1">
                                                    <p className="text-xs text-slate-600 font-medium line-clamp-3 leading-relaxed italic border-l-2 border-purple-200 pl-2">
                                                        "{poi.narrative_script}"
                                                    </p>
                                                    <div className="mt-auto bg-slate-50 rounded-lg p-2 flex items-center gap-2 border border-slate-100" onClick={e => e.stopPropagation()}>
                                                        <Volume2 size={14} className="text-slate-400" />
                                                        <audio controls src={poi.audio_url} style={{ height: 24, width: '100%' }} className="opacity-80 hover:opacity-100 transition-opacity" />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex items-center justify-center">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                                                        <Mic size={14} /> Requiere Narrativa
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                </>
            )}

            {/* ═══ WELCOME OVERLAY ═══ */}
            {showWelcomeOverlay && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }}>
                    <div className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-md w-full relative overflow-hidden flex flex-col gap-6" style={{ border: '1px solid rgba(255,255,255,0.5)', animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-rose-500 to-violet-600" />
                        
                        <div className="flex flex-col items-center text-center gap-3 mt-4">
                            <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center text-3xl mb-2">🌍</div>
                            <h2 className="text-2xl font-black text-slate-800">Estudio de Misiones</h2>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                Aquí es donde la magia ocurre. Descubre, cura y prepara los Puntos de Interés que nuestros operativos visitarán en campo.
                            </p>
                        </div>

                        <div className="flex flex-col gap-4 mt-2 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                            <div className="flex gap-4 items-start">
                                <div className="text-xl">📡</div>
                                <div>
                                    <h4 className="font-bold text-slate-700 text-sm">Paso 1: Usa el Radar</h4>
                                    <p className="text-xs text-slate-500 font-medium">Presiona Añadir para encontrar cultura automáticamente cerca de ti.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="text-xl">📍</div>
                                <div>
                                    <h4 className="font-bold text-slate-700 text-sm">Paso 2: Toca el mapa</h4>
                                    <p className="text-xs text-slate-500 font-medium">O mantén presionado en el mapa para crear un punto exacto manualmente.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start">
                                <div className="text-xl">✨</div>
                                <div>
                                    <h4 className="font-bold text-slate-700 text-sm">Paso 3: Magia con IA</h4>
                                    <p className="text-xs text-slate-500 font-medium">Tridente AI redactará toda la historia y datos clave en segundos.</p>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => {
                                if (typeof window !== 'undefined') localStorage.setItem('studio_onboarded_v1', 'true');
                                setShowWelcomeOverlay(false);
                            }} 
                            className="w-full py-4 mt-2 rounded-2xl font-black text-white text-lg shadow-xl hover:-translate-y-1 hover:shadow-2xl active:scale-95 transition-all"
                            style={{ background: 'linear-gradient(135deg, #F43F5E, #8B5CF6)' }}
                        >
                            ¡Comenzar a Explorar!
                        </button>
                    </div>
                </div>
            )}

            {/* Radar pulse & slide animation */}
            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes radarPulse {
                    0% { transform: scale(1); opacity: 0.6; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
            `}</style>
        </div>
    );
}
