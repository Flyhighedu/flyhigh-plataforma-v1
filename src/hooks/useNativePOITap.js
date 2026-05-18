'use client';

// ═══════════════════════════════════════════════════════════════
// useNativePOITap — Tap-to-Discover native OSM POIs
// Queries Overpass API at 80m radius, scores results by relevance,
// caches in sessionStorage (10min TTL), and returns the best match.
// Shared between PWA (TacticalMapScreen) and Admin (MasterRouteStudio).
// ═══════════════════════════════════════════════════════════════

import { useCallback, useRef, useState } from 'react';

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const SEARCH_RADIUS = 80; // meters
const TIMEOUT_MS = 8000;

// ═══ Scoring: Prioritize interesting POIs over roads/shops ═══
function scorePOI(el, tapLat, tapLng) {
    const elLat = el.type === 'node' ? el.lat : el.center?.lat;
    const elLon = el.type === 'node' ? el.lon : el.center?.lon;
    if (!elLat || !elLon || !el.tags?.name) return null;

    const dx = elLat - tapLat;
    const dy = elLon - tapLng;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let penalty = 1.0;
    const t = el.tags;

    // Massive areas get super-gravity (they're likely what the user tapped "inside" of)
    if (t.landuse === 'cemetery' || t.leisure === 'nature_reserve' || t.natural === 'wood' || t.amenity === 'university') {
        penalty = 0.1;
    } else if (t.historic || t.tourism || t.leisure === 'park' || t.highway === 'roundabout') {
        penalty = 0.3; // Tourist/historic spots are high priority
    } else if (t.highway && t.highway !== 'pedestrian') {
        penalty = 2.0; // Roads are less interesting
    } else if (t.shop || t.office) {
        penalty = 3.0; // Shops/offices are least interesting for narrative POIs
    }

    return {
        element: el,
        lat: elLat,
        lon: elLon,
        score: distance * penalty
    };
}

// ═══ Auto-classify OSM tags into a human-readable description ═══
function classifyPOI(tags) {
    if (!tags) return '';
    if (tags.historic) return 'Lugar Histórico.';
    if (tags.tourism === 'museum') return 'Museo.';
    if (tags.tourism === 'artwork') return 'Obra de Arte / Monumento.';
    if (tags.tourism === 'viewpoint') return 'Mirador.';
    if (tags.tourism) return 'Atracción turística.';
    if (tags.amenity === 'place_of_worship') return 'Templo / Lugar de culto.';
    if (tags.amenity === 'hospital' || tags.amenity === 'clinic') return 'Hospital / Clínica.';
    if (tags.amenity === 'school' || tags.amenity === 'university' || tags.amenity === 'college') return 'Centro Educativo.';
    if (tags.amenity === 'library') return 'Biblioteca.';
    if (tags.amenity === 'theatre') return 'Teatro.';
    if (tags.amenity) return 'Edificio o Espacio Público.';
    if (tags.shop === 'mall') return 'Centro Comercial.';
    if (tags.shop) return 'Comercio / Tienda.';
    if (tags.leisure === 'park') return 'Parque.';
    if (tags.leisure === 'stadium' || tags.leisure === 'sports_centre') return 'Espacio Deportivo.';
    if (tags.leisure) return 'Espacio Recreativo.';
    if (tags.natural === 'peak' || tags.natural === 'volcano') return 'Cerro / Volcán.';
    if (tags.natural === 'water') return 'Cuerpo de Agua.';
    if (tags.natural) return 'Área Natural.';
    if (tags.railway) return 'Estación de Ferrocarril.';
    if (tags.aeroway) return 'Aeropuerto.';
    return '';
}

// ═══ Cache helpers (sessionStorage) ═══
function cacheKey(lat, lng) {
    return `tap_${lat.toFixed(4)}_${lng.toFixed(4)}`;
}

function getFromCache(lat, lng) {
    try {
        const raw = sessionStorage.getItem(cacheKey(lat, lng));
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (Date.now() - entry.ts > CACHE_TTL) {
            sessionStorage.removeItem(cacheKey(lat, lng));
            return null;
        }
        return entry;
    } catch { return null; }
}

function saveToCache(lat, lng, poi) {
    try {
        sessionStorage.setItem(cacheKey(lat, lng), JSON.stringify({ ...poi, ts: Date.now() }));
    } catch { /* quota exceeded — ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// HOOK: useNativePOITap
// ═══════════════════════════════════════════════════════════════
export default function useNativePOITap({ onPOIFound, enabled = true }) {
    const isBusyRef = useRef(false);
    const [isDiscovering, setIsDiscovering] = useState(false);

    const handleMapTap = useCallback(async (lat, lng) => {
        if (!enabled || isBusyRef.current) return;

        // ── Cache hit: instant modal ──
        const cached = getFromCache(lat, lng);
        if (cached) {
            onPOIFound?.({
                name: cached.name,
                latitude: cached.lat,
                longitude: cached.lon,
                description: cached.description
            });
            return;
        }

        // ── Cache miss: query Overpass ──
        isBusyRef.current = true;
        setIsDiscovering(true);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const query = `[out:json][timeout:8];(node["name"](around:${SEARCH_RADIUS},${lat},${lng});way["name"](around:${SEARCH_RADIUS},${lat},${lng}););out center;`;
            const res = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: query,
                signal: controller.signal
            });

            if (!res.ok) return;
            const data = await res.json();

            if (data?.elements?.length > 0) {
                // Score all elements, pick the best
                let best = null;
                for (const el of data.elements) {
                    const scored = scorePOI(el, lat, lng);
                    if (scored && (!best || scored.score < best.score)) {
                        best = scored;
                    }
                }

                if (best) {
                    const description = classifyPOI(best.element.tags);
                    const poi = {
                        name: best.element.tags.name,
                        lat: best.lat,
                        lon: best.lon,
                        description
                    };

                    // Save to cache for instant revisit
                    saveToCache(lat, lng, poi);

                    onPOIFound?.({
                        name: poi.name,
                        latitude: poi.lat,
                        longitude: poi.lon,
                        description: poi.description
                    });
                }
                // No best element → silently discard (empty area)
            }
            // No elements → silently discard
        } catch (e) {
            if (e.name !== 'AbortError') {
                console.warn('Tap-to-Discover failed:', e);
            }
        } finally {
            clearTimeout(timeout);
            setIsDiscovering(false);
            isBusyRef.current = false;
        }
    }, [onPOIFound, enabled]);

    return { handleMapTap, isDiscovering };
}
