'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, List, Map, Navigation, Landmark, Edit3, Star, Copy, ClipboardCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import POIDetailModal from './POIDetailModal';

// Leaflet must be loaded client-side only (no SSR)
const MapWithNoSSR = dynamic(() => import('./TacticalMapLeaflet'), { ssr: false, loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A' }}>
        <Loader2 size={32} style={{ color: '#06B6D4', animation: 'spin 1s linear infinite' }} />
    </div>
)});

export default function TacticalMapScreen({ userId, profile }) {
    const router = useRouter();
    const [pois, setPois] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('map'); // 'map' | 'list'
    const [isSaving, setIsSaving] = useState(false);
    const [userLocation, setUserLocation] = useState(null);

    // Overpass API states
    const [mapBounds, setMapBounds] = useState(null);
    const [suggestedPois, setSuggestedPois] = useState([]);
    const [isSearchingCulturalPois, setIsSearchingCulturalPois] = useState(false);
    const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
    const [groqQuota, setGroqQuota] = useState(null);
    const [lastGeoContext, setLastGeoContext] = useState('');
    const [copiedPrompt, setCopiedPrompt] = useState(false);

    // ═══ UNIFIED MODAL STATE ═══
    const [modalPoi, setModalPoi] = useState(null);    // null = closed
    const [isNewPin, setIsNewPin] = useState(false);

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

    // ═══ TRIGGER: Tap on saved POI marker ═══
    const handleMarkerClick = useCallback((poi) => {
        setModalPoi(poi);
        setIsNewPin(false);
    }, []);

    // ═══ TRIGGER: Tap on suggested POI marker ═══
    const handleSuggestedPoiClick = useCallback((poi) => {
        setModalPoi({
            name: poi.name,
            description: poi.description,
            latitude: poi.latitude,
            longitude: poi.longitude,
            category: 'landmark'
        });
        setIsNewPin(false);
    }, []);

    // ═══ TRIGGER: Long-press on empty map ═══
    const handleLongPress = useCallback(async (lat, lng) => {
        setIsReverseGeocoding(true);
        let placeName = '';
        try {
            const query = `
                [out:json][timeout:10];
                (
                  node["name"](around:150, ${lat}, ${lng});
                  way["name"](around:150, ${lat}, ${lng});
                  relation["name"](around:150, ${lat}, ${lng});
                );
                out center;
            `;
            const res = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query
            });
            
            if (res.ok) {
                const data = await res.json();
                if (data && data.elements && data.elements.length > 0) {
                    // Calculate distance and priority
                    let bestElement = null;
                    let bestScore = Infinity; // Lower score is better

                    data.elements.forEach(el => {
                        const elLat = el.type === 'node' ? el.lat : el.center?.lat;
                        const elLon = el.type === 'node' ? el.lon : el.center?.lon;
                        if (!elLat || !elLon || !el.tags?.name) return;

                        // Pythagorean distance approximation
                        const dx = elLat - lat;
                        const dy = elLon - lng;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        // Priority boost for interesting features
                        let penalty = 1.0;
                        const isMassiveArea = el.tags.landuse === 'cemetery' || el.tags.leisure === 'nature_reserve' || el.tags.natural === 'wood' || el.tags.amenity === 'university';
                        const isTouristArea = el.tags.highway === 'roundabout' || el.tags.historic || el.tags.tourism || el.tags.leisure === 'park';

                        if (isMassiveArea) {
                            penalty = 0.1; // Super gravity for huge polygons
                        } else if (isTouristArea) {
                            penalty = 0.3; // High gravity for tourist/historic spots
                        } else if (el.tags.highway && el.tags.highway !== 'pedestrian') {
                            penalty = 2.0; // Normal roads are less interesting
                        } else if (el.tags.shop || el.tags.office) {
                            penalty = 3.0; // Shops are least interesting for POIs
                        }

                        const score = distance * penalty;

                        if (score < bestScore) {
                            bestScore = score;
                            bestElement = el;
                        }
                    });

                    if (bestElement) {
                        placeName = bestElement.tags.name;
                    }
                }
            }
        } catch (e) {
            console.warn('Overpass proximity search failed', e);
        } finally {
            setIsReverseGeocoding(false);
            setModalPoi({
                latitude: lat,
                longitude: lng,
                name: placeName,
                description: ''
            });
            setIsNewPin(true);
        }
    }, []);

    // ═══ Overpass Cultural POI Search (unchanged) ═══
    const handleSearchCulturalPois = async () => {
        // Toggle: Si ya hay puntos, los borramos (apagar radar)
        if (suggestedPois.length > 0) {
            setSuggestedPois([]);
            return;
        }

        if (!mapBounds) {
            alert('Mueve un poco el mapa primero para detectar la zona.');
            return;
        }

        setIsSearchingCulturalPois(true);
        try {
            const sw = mapBounds._southWest;
            const ne = mapBounds._northEast;
            const bbox = `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;

            const query = `
                [out:json][timeout:20];
                (
                  node["historic"](${bbox});
                  way["historic"](${bbox});
                  node["tourism"~"museum|artwork|attraction|theme_park|zoo|aquarium|viewpoint"](${bbox});
                  way["tourism"~"museum|artwork|attraction|theme_park|zoo|aquarium|viewpoint"](${bbox});
                  node["amenity"~"place_of_worship|university|college|library|theatre|townhall|public_building"](${bbox});
                  way["amenity"~"place_of_worship|university|college|library|theatre|townhall|public_building"](${bbox});
                  node["aeroway"="aerodrome"](${bbox});
                  way["aeroway"="aerodrome"](${bbox});
                  node["waterway"~"dam|river|waterfall"](${bbox});
                  way["waterway"~"dam|river|waterfall"](${bbox});
                  node["natural"~"peak|volcano|water|wood|forest"](${bbox});
                  way["natural"~"peak|volcano|water|wood|forest"](${bbox});
                  node["leisure"~"park|nature_reserve|sports_centre|stadium"](${bbox});
                  way["leisure"~"park|nature_reserve|sports_centre|stadium"](${bbox});
                  node["man_made"~"wastewater_plant|water_works|observatory|lighthouse|windmill|watermill"](${bbox});
                  way["man_made"~"wastewater_plant|water_works|observatory|lighthouse|windmill|watermill"](${bbox});
                  node["power"="plant"](${bbox});
                  way["power"="plant"](${bbox});
                  node["railway"="station"](${bbox});
                  way["railway"="station"](${bbox});
                );
                out center;
            `;

            const res = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query
            });

            if (!res.ok) throw new Error('Failed to fetch from Overpass');
            const data = await res.json();

            let newPois = data.elements.map(el => {
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

                const wikiTag = el.tags?.wikipedia;
                const wikidataTag = el.tags?.wikidata;

                if (!lat || !lon || !name) return null;

                let desc = 'Punto de interés geográfico, cultural o recreativo.';
                if (historicType) desc = historicType === 'monument' ? 'Monumento Histórico.' : historicType === 'archaeological_site' ? 'Sitio Arqueológico.' : 'Lugar Histórico.';
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

                return {
                    id: el.id,
                    name: name,
                    description: desc,
                    latitude: lat,
                    longitude: lon,
                    wikiTag: wikiTag,
                    wikidataTag: wikidataTag
                };
            }).filter(Boolean);

            if (newPois.length === 0) {
                alert('No se encontraron sitios culturales o geográficos en esta área. Intenta alejarte un poco.');
                return;
            }

            // Obtener contexto geográfico general (Ciudad, Estado)
            let geoContext = '';
            try {
                const centerLat = (mapBounds._southWest.lat + mapBounds._northEast.lat) / 2;
                const centerLng = (mapBounds._southWest.lng + mapBounds._northEast.lng) / 2;
                const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${centerLat}&lon=${centerLng}&format=json`);
                if (nomRes.ok) {
                    const nomData = await nomRes.json();
                    if (nomData.address) {
                        const city = nomData.address.city || nomData.address.town || nomData.address.village || nomData.address.county || '';
                        const state = nomData.address.state || '';
                        geoContext = `${city} ${state}`.trim();
                        setLastGeoContext(geoContext);
                    }
                }
            } catch (e) {
                console.warn('Nominatim reverse geocode failed');
            }

            // Enriquecer con IA (Groq) + caché Supabase
            try {
                const infoRes = await fetch('/api/poi-batch-info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pois: newPois.map(p => ({
                            name: p.name,
                            lat: p.latitude,
                            lon: p.longitude,
                            type: p.description
                        })),
                        context: geoContext
                    })
                });
                
                if (infoRes.ok) {
                    const data = await infoRes.json();
                    const infoMap = data.results || data;
                    if (data.quota) setGroqQuota(data.quota);
                    
                    newPois = newPois.map(poi => {
                        const aiInfo = infoMap[poi.name];
                        if (aiInfo && typeof aiInfo === 'string' && aiInfo.length > 10) {
                            poi.description = aiInfo;
                        }
                        return poi;
                    });
                }
            } catch (e) {
                console.warn('POI info enrichment failed', e);
            }

            setSuggestedPois(newPois);
        } catch (err) {
            console.error('Overpass error:', err);
            alert('Error al buscar sitios culturales. Por favor, intenta de nuevo.');
        } finally {
            setIsSearchingCulturalPois(false);
        }
    };

    // ═══ COPY MEGA-PROMPT FOR GEMINI ULTRA ═══
    const handleCopyForResearch = useCallback(async () => {
        if (suggestedPois.length === 0) return;

        const poiList = suggestedPois.map((p, i) =>
            `${i + 1}. "${p.name}" — Coords: ${p.latitude}, ${p.longitude} — Tipo: ${p.description}`
        ).join('\n');

        const megaPrompt = `Eres un investigador enciclopédico y narrador con acceso a Google Search. Necesito que investigues ${suggestedPois.length} puntos de interés de ${lastGeoContext || 'Uruapan, Michoacán'}. Quiero artículos que cuenten la HISTORIA del lugar de forma envolvente, pero que incluyan DATOS DUROS verificables tejidos en la narrativa.

REGLAS OBLIGATORIAS DE CALIDAD:
1. USA GOOGLE SEARCH para cada punto. No respondas de memoria.
2. Cada artículo debe contar una HISTORIA RICA que incluya:
   - Contexto histórico: quién lo fundó, por qué, qué pasaba en esa época
   - Significado cultural: qué representa para la comunidad, tradiciones vinculadas
   - Anécdotas o leyendas locales si las hay
   - Conexión con personajes históricos (nombre completo y cargo)
   - Estado actual: cómo se usa hoy, quién lo visita
   Y ADEMÁS, AL MENOS 4 datos numéricos verificables tejidos DENTRO de la narrativa (no como lista), del siguiente catálogo:

PARA RÍOS, ARROYOS, CASCADAS:
- Longitud total del río en km
- Caudal promedio en litros por segundo
- Altitud del nacimiento en msnm
- Temperatura del agua en °C
- Cuenca hidrológica a la que pertenece
- Altura de la caída de agua (cascadas)

PARA CERROS, MONTAÑAS, VOLCANES:
- Altitud exacta en metros sobre el nivel del mar
- Prominencia topográfica
- Última erupción (volcanes) con fecha
- Distancia a la ciudad más cercana
- Tipo de roca o suelo predominante

PARA PARQUES, RESERVAS NATURALES, BOSQUES:
- Extensión en hectáreas o km²
- Año de decreto o fundación
- Número de especies de flora y/o fauna registradas
- Visitantes por año
- Especies endémicas destacadas
- Tipo de ecosistema (bosque templado, selva, etc.)

PARA IGLESIAS, TEMPLOS, CAPILLAS:
- Año exacto de construcción o consagración
- Estilo arquitectónico (barroco, neoclásico, etc.)
- Altura de la torre o cúpula en metros
- Fecha de la fiesta patronal (día/mes)
- Siglo de origen

PARA MUSEOS, CENTROS CULTURALES, TEATROS:
- Año de fundación
- Número de piezas o exposiciones permanentes
- Visitantes anuales
- Superficie del inmueble en m²
- Colecciones o piezas destacadas

PARA PRESAS, LAGOS, LAGUNAS, CUERPOS DE AGUA:
- Capacidad de almacenamiento en millones de m³
- Superficie del espejo de agua en hectáreas
- Profundidad máxima y promedio
- Año de construcción (presas)
- Volumen anual captado

PARA MONUMENTOS, PLAZAS, SITIOS HISTÓRICOS:
- Fecha del evento histórico conmemorado (día/mes/año)
- Año de construcción o inauguración del monumento
- Dimensiones (altura, ancho)
- Personaje histórico vinculado con nombre completo y cargo
- Decreto o acta oficial que lo protege

PARA UNIVERSIDADES, ESCUELAS, BIBLIOTECAS:
- Año de fundación
- Matrícula o número de estudiantes
- Número de carreras o programas
- Egresados notables con nombre

PARA FÁBRICAS, PLANTAS, INFRAESTRUCTURA INDUSTRIAL:
- Año de inicio de operaciones
- Capacidad de producción con unidades
- Número de empleados
- Tipo de industria

PARA ESTACIONES DE TREN, AEROPUERTOS, PUENTES:
- Año de inauguración
- Longitud de pista o puente en metros
- Pasajeros anuales o tráfico diario
- Ruta o línea que atendía

PARA MERCADOS, PLAZAS COMERCIALES:
- Año de fundación
- Número de locatarios o puestos
- Producto estrella o especialidad regional

PARA ESTADIOS, UNIDADES DEPORTIVAS:
- Aforo o capacidad
- Año de inauguración
- Equipos o eventos que alberga

PARA MIRADORES, PUNTOS PANORÁMICOS:
- Altitud del punto
- Distancia de visibilidad en km
- Qué se puede observar desde ahí

PARA EDIFICIOS NOTABLES, ARQUITECTURA CIVIL, PALACIOS DE GOBIERNO:
- Año de construcción o inauguración
- Estilo arquitectónico (art déco, colonial, neoclásico, modernista, etc.)
- Arquitecto o constructor (nombre completo)
- Superficie construida en m²
- Número de pisos o niveles
- Material de construcción (cantera, adobe, concreto, etc.)
- Uso original vs. uso actual si cambió

PARA PANTEONES, CEMENTERIOS:
- Año de fundación
- Superficie en hectáreas
- Personajes históricos sepultados (nombre y cargo)
- Estilo de las capillas o monumentos funerarios
- Si tiene declaratoria de patrimonio

PARA GLORIETAS, ROTONDAS, FUENTES:
- Año de construcción
- Diámetro o dimensiones en metros
- Escultura o monumento central (autor, altura)
- Evento o personaje que conmemora

PARA MURALES, ESCULTURAS, ARTE PÚBLICO:
- Artista (nombre completo)
- Año de creación
- Dimensiones (alto x ancho en metros)
- Técnica o material (óleo, mosaico, bronce, cantera)
- Tema o historia que representa

PARA HOSPITALES, CLÍNICAS:
- Año de fundación
- Número de camas o capacidad
- Especialidades médicas
- Población que atiende

PARA HACIENDAS, CASONAS HISTÓRICAS:
- Siglo o año de construcción
- Familia original propietaria
- Extensión original del terreno en hectáreas
- Actividad productiva histórica (café, caña, ganadería)
- Estado de conservación actual

PARA ACUEDUCTOS, FUENTES, INFRAESTRUCTURA HIDRÁULICA HISTÓRICA:
- Año o siglo de construcción
- Longitud en metros o km
- Capacidad de conducción en litros por segundo
- Material (cantera, ladrillo, piedra)
- Si sigue en funcionamiento

3. PROHIBIDO usar frases vagas como "en la época de", "hace muchos años", "una gran extensión", "es muy importante". Reemplázalas SIEMPRE con el dato exacto.
4. Si NO encuentras un dato específico verificable, escríbelo como: "[dato no verificado]" en lugar de inventarlo.
5. El "dato curioso" debe ser SORPRENDENTE y contener un número o comparación concreta ("X veces más grande que una cancha de fútbol", "uno de los N más antiguos de México", "produce X toneladas al año").
6. El tono debe ser el de un narrador apasionado que cuenta la historia del lugar a niños de 9-12 años. Que sea ENVOLVENTE e INTERESANTE, que despierte curiosidad, pero sin sacrificar precisión. Los datos numéricos deben estar integrados naturalmente en la narrativa, no como una ficha técnica fría.
7. 6-10 oraciones por artículo. Entre 500 y 1000 caracteres.
8. NO uses markdown, asteriscos, negritas, ni formato especial. Solo texto plano limpio.

FORMATO DE RESPUESTA (JSON estricto, sin explicaciones fuera del JSON):
[
  {
    "name": "Nombre exacto del POI",
    "coords": "lat, lng",
    "article": "Artículo con datos duros aquí..."
  }
]

LISTA DE ${suggestedPois.length} PUNTOS A INVESTIGAR:
${poiList}`;

        try {
            await navigator.clipboard.writeText(megaPrompt);
            setCopiedPrompt(true);
            setTimeout(() => setCopiedPrompt(false), 3000);
        } catch (e) {
            // Fallback for older browsers
            const ta = document.createElement('textarea');
            ta.value = megaPrompt;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopiedPrompt(true);
            setTimeout(() => setCopiedPrompt(false), 3000);
        }
    }, [suggestedPois, lastGeoContext]);

    // ═══ SAVE (unified — includes ficha fields) ═══
    const handleSave = useCallback(async (poiData) => {
        if (!userId || isSaving) return;
        setIsSaving(true);
        try {
            const supabase = createClient();
            const fichaFields = {
                research_article: poiData.research_article,
                dato_clave_1: poiData.dato_clave_1,
                dato_clave_2: poiData.dato_clave_2,
                pregunta_interaccion: poiData.pregunta_interaccion
            };
            const baseFields = {
                name: poiData.name,
                description: poiData.description,
                category: poiData.category,
                is_favorite: poiData.is_favorite
            };

            if (poiData.id) {
                // Update existing
                let { error } = await supabase.from('pilot_pois').update({
                    ...baseFields, ...fichaFields, updated_at: new Date().toISOString()
                }).eq('id', poiData.id).eq('user_id', userId);

                // Fallback: retry without ficha fields if columns don't exist
                if (error && error.message?.includes('column')) {
                    console.warn('Ficha columns not found, saving without them');
                    const res = await supabase.from('pilot_pois').update({
                        ...baseFields, updated_at: new Date().toISOString()
                    }).eq('id', poiData.id).eq('user_id', userId);
                    error = res.error;
                }
                if (error) throw error;
                setPois(prev => prev.map(p => p.id === poiData.id ? { ...p, ...poiData, updated_at: new Date().toISOString() } : p));
            } else {
                // Insert new
                let result = await supabase.from('pilot_pois').insert({
                    user_id: userId, ...baseFields, ...fichaFields,
                    latitude: poiData.latitude, longitude: poiData.longitude
                }).select().single();

                // Fallback
                if (result.error && result.error.message?.includes('column')) {
                    console.warn('Ficha columns not found, saving without them');
                    result = await supabase.from('pilot_pois').insert({
                        user_id: userId, ...baseFields,
                        latitude: poiData.latitude, longitude: poiData.longitude
                    }).select().single();
                }
                if (result.error) throw result.error;
                setPois(prev => [result.data, ...prev]);
            }
            setModalPoi(null);
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
            setModalPoi(null);
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
                        suggestedPois={suggestedPois}
                        userLocation={userLocation}
                        onMarkerClick={handleMarkerClick}
                        onBoundsChange={setMapBounds}
                        onSuggestedPoiClick={handleSuggestedPoiClick}
                        onLongPress={handleLongPress}
                    />
                    
                    {/* Reverse Geocoding Loading Toast */}
                    {isReverseGeocoding && (
                        <div style={{
                            position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
                            background: '#0F172A', color: '#F8FAFC', padding: '10px 20px', borderRadius: 20,
                            display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            border: '1px solid #334155', fontWeight: 600, fontSize: 13
                        }}>
                            <Loader2 size={16} className="animate-spin" style={{ color: '#06B6D4' }} />
                            Identificando ubicación...
                        </div>
                    )}

                    {/* Cultural POI Search Toggle */}
                    <button
                        onClick={handleSearchCulturalPois}
                        disabled={isSearchingCulturalPois}
                        style={{
                            position: 'absolute', bottom: 24, right: 16, zIndex: 2000,
                            width: 56, height: 56, borderRadius: 18,
                            background: suggestedPois.length > 0 ? '#F59E0B' : '#1E293B',
                            border: '1px solid #334155', 
                            color: suggestedPois.length > 0 ? '#1E293B' : '#F59E0B',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: suggestedPois.length > 0 ? '0 8px 24px -4px rgba(245,158,11,0.5)' : '0 8px 24px -4px rgba(0,0,0,0.5)',
                            cursor: isSearchingCulturalPois ? 'wait' : 'pointer',
                            transition: 'all 0.2s'
                        }}
                        title="Buscar sitios culturales e históricos"
                    >
                        {isSearchingCulturalPois ? <Loader2 size={24} className="animate-spin" /> : <Landmark size={24} strokeWidth={2.5} />}
                    </button>

                    {/* Copy for Gemini Research Button */}
                    {suggestedPois.length > 0 && (
                        <button
                            onClick={handleCopyForResearch}
                            style={{
                                position: 'absolute', bottom: 88, right: 16, zIndex: 2000,
                                height: 44, borderRadius: 14,
                                padding: '0 16px',
                                background: copiedPrompt ? '#22C55E' : '#7C3AED',
                                border: 'none',
                                color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                boxShadow: copiedPrompt
                                    ? '0 8px 24px -4px rgba(34,197,94,0.5)'
                                    : '0 8px 24px -4px rgba(124,58,237,0.5)',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                fontSize: 12, fontWeight: 700,
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {copiedPrompt ? (
                                <><ClipboardCheck size={16} /> ¡Prompt copiado!</>
                            ) : (
                                <><Copy size={16} /> Copiar {suggestedPois.length} POIs</>
                            )}
                        </button>
                    )}

                    {/* Groq AI Quota Badge */}
                    {groqQuota && (
                        <div style={{
                            position: 'absolute', bottom: 24, left: 16, zIndex: 9999,
                            background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(8px)',
                            borderRadius: 12, padding: '8px 12px',
                            border: '1px solid #334155',
                            display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: 11, fontWeight: 600, color: '#94A3B8',
                            pointerEvents: 'none'
                        }}>
                            <div style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: groqQuota.remainingRequests > 10000 ? '#22C55E' :
                                           groqQuota.remainingRequests > 5000 ? '#F59E0B' : '#EF4444',
                                boxShadow: `0 0 6px ${groqQuota.remainingRequests > 10000 ? '#22C55E' :
                                           groqQuota.remainingRequests > 5000 ? '#F59E0B' : '#EF4444'}`
                            }} />
                            <span style={{ color: '#E2E8F0' }}>
                                🤖 {groqQuota.remainingRequests.toLocaleString()}/{groqQuota.limitRequests.toLocaleString()}
                            </span>
                            <span style={{ color: '#64748B', fontSize: 10 }}>req/día</span>
                        </div>
                    )}
                </div>
            ) : (
                /* List View */
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                    {pois.length === 0 ? (
                        <div style={{ textAlign: 'center', paddingTop: 60 }}>
                            <Navigation size={48} style={{ color: '#334155', margin: '0 auto 16px' }} />
                            <p style={{ fontSize: 15, fontWeight: 800, color: '#64748B' }}>Sin puntos guardados</p>
                            <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Mantén presionado el mapa para crear tu primer punto.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {pois.map(poi => (
                                <button
                                    key={poi.id}
                                    onClick={() => handleMarkerClick(poi)}
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
                                        background: '#10B98120', border: '2px solid #10B98140',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 20, flexShrink: 0
                                    }}>
                                        📍
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
                                        {poi.dato_clave_1 && (
                                            <p style={{ fontSize: 11, color: '#F59E0B', margin: '4px 0 0' }}>
                                                ⭐ Ficha completada
                                            </p>
                                        )}
                                    </div>
                                    <Edit3 size={16} style={{ color: '#475569', flexShrink: 0 }} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ UNIFIED POI MODAL ═══ */}
            <POIDetailModal
                isOpen={!!modalPoi}
                onClose={() => setModalPoi(null)}
                onSave={handleSave}
                onDelete={handleDelete}
                poi={modalPoi}
                isNewPin={isNewPin}
                geoContext={lastGeoContext}
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
