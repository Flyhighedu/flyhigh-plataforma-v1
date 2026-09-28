'use client';

// =====================================================
// TacticalMapLeaflet.js — v2 (Refactored)
// Pure Leaflet map. Tap pin = modal. Long-press = new pin.
// No popups. Clean interaction model.
// =====================================================

import { narrationOrigin } from '@/components/shared/useNarrationEntrance';
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { coordinates } from '@/lib/narration-preparation.mjs';
import usePreparationLayers from './preparation/usePreparationLayers';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const hasCoordinates = poi => Boolean(coordinates(poi?.latitude, poi?.longitude));

const CAT_COLORS = {
    school: '#3B82F6', parking: '#8B5CF6', hazard: '#EF4444',
    landmark: '#10B981', refuel: '#F59E0B', general: '#64748B'
};
const CAT_EMOJI = {
    school: '🏫', parking: '🅿️', hazard: '⚠️',
    landmark: '📍', refuel: '⛽', general: '📌'
};

function makeSuggestedIcon(name, category) {
    const isCity = category === 'city';
    const shortName = name && name.length > 20 ? name.substring(0, 20) + '...' : (name || '');

    const size = isCity ? 44 : 32;
    const emoji = isCity ? '🏙️' : '⭐';
    const bg = isCity
        ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)'
        : 'linear-gradient(135deg, #F59E0B, #D97706)';
    const border = isCity ? '#BFDBFE' : '#FEF08A';
    const fontSize = isCity ? '22px' : '16px';
    const radius = isCity ? '14px' : '50%';

    return L.divIcon({
        className: 'poi-marker-container',
        html: `<div style="
            width:${size}px;height:${size}px;border-radius:${radius};
            background:${bg};border:3px solid ${border};
            display:flex;align-items:center;justify-content:center;
            font-size:${fontSize};
            box-shadow:0 4px 12px rgba(0,0,0,0.25);
            cursor:pointer;
            z-index:${isCity ? '2000' : '1000'};
            transition:transform 0.15s ease;
        ">${emoji}</div>
        ${shortName ? `<div class="poi-marker-label" ${isCity ? 'style="font-size:12px;padding:4px 8px;background:#1E3A8A;border-color:#3B82F6;"' : ''}>${shortName}</div>` : ''}`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
    });
}

function makeIcon(poi, showLabels) {
    const isOfficial = poi.is_official;
    const category = poi.category || 'general';
    const name = showLabels ? poi.name : null;
    const shortName = name && name.length > 20 ? name.substring(0, 20) + '...' : (name || '');

    if (poi._reference) {
        return L.divIcon({
            className: 'poi-marker-container',
            html: `<div class="poi-pin poi-pin--school">🏫</div><div class="poi-marker-label poi-marker-label--school">ESCUELA</div>`,
            iconSize: [44, 54],
            iconAnchor: [22, 44]
        });
    }

    if (isOfficial) {
        return L.divIcon({
            className: 'poi-marker-container',
            html: `<div class="poi-pin poi-pin--official">✓</div>
            ${shortName ? `<div class="poi-marker-label poi-marker-label--official">${shortName}</div>` : ''}`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
    }

    const color = CAT_COLORS[category] || CAT_COLORS.general;
    const emoji = CAT_EMOJI[category] || CAT_EMOJI.general;
    return L.divIcon({
        className: 'poi-marker-container',
        html: `<div class="poi-pin" style="background:${color}">${emoji}</div>
        ${shortName ? `<div class="poi-marker-label">${shortName}</div>` : ''}`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
}

const userIcon = L.divIcon({
    className: '',
    html: `<div style="
        width:16px;height:16px;border-radius:50%;
        background:#06B6D4;border:2px solid white;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
});

export default function TacticalMapLeaflet({
    pois = [], suggestedPois = [], userLocation, mapCenter, referencePoint = null,
    onMarkerClick, onBoundsChange, onSuggestedPoiClick, onLongPress, onMapTap, preparation = null
}) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markersLayerRef = useRef(null);        // LayerGroup for saved POIs
    const suggestedLayerRef = useRef(null);       // LayerGroup for suggested POIs
    const markersRef = useRef([]);
    const latestPoisRef = useRef(pois);
    useEffect(() => { latestPoisRef.current = pois; }, [pois]);
    const suggestedMarkersRef = useRef([]);
    const userMarkerRef = useRef(null);
    const referenceMarkerRef = useRef(null);
    const markerClickedRef = useRef(false);
    const longPressedRef = useRef(false);
    const onMapTapRef = useRef(onMapTap);
    const [showLabels, setShowLabels] = useState(false);

    // Keep ref in sync so the map.on('click') closure always has the latest callback
    useEffect(() => { onMapTapRef.current = onMapTap; }, [onMapTap]);

    useEffect(() => {
        if (mapRef.current && coordinates(mapCenter?.lat, mapCenter?.lng)) mapRef.current.flyTo([Number(mapCenter.lat), Number(mapCenter.lng)], mapCenter.zoom || 14, { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, duration: .4 });
    }, [mapCenter]);

    // Initialize map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const center = coordinates(mapCenter?.lat, mapCenter?.lng) || coordinates(userLocation?.lat, userLocation?.lng) || [19.4326, -99.1332];
        const map = L.map(containerRef.current, {
            center, zoom: mapCenter?.zoom || 14, zoomControl: false,
            attributionControl: false
        });

        // ═══ RESIZE OBSERVER ═══
        // Fixes broken grey tiles when the flex layout shifts width/height
        const resizeObserver = new ResizeObserver(() => {
            if (map) map.invalidateSize();
        });
        resizeObserver.observe(containerRef.current);

        L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19, subdomains: 'abc' }).addTo(map);
        L.control.zoom({ position: 'topright' }).addTo(map);
        L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

        // Initialize LayerGroups for batch marker management
        markersLayerRef.current = L.layerGroup().addTo(map);
        suggestedLayerRef.current = L.layerGroup().addTo(map);

        // ═══ LONG-PRESS DETECTION ═══
        let pressTimer = null;
        let startPos = null;

        const startPress = (e) => {
            const latlng = e.latlng;
            startPos = e.containerPoint ? { x: e.containerPoint.x, y: e.containerPoint.y } : null;
            pressTimer = setTimeout(() => {
                longPressedRef.current = true; // Flag: suppress the click that fires on release
                const rect = containerRef.current.getBoundingClientRect();
                const point = map.latLngToContainerPoint(latlng);
                onLongPress?.(latlng.lat, latlng.lng, { x: rect.x + point.x, y: rect.y + point.y });
                pressTimer = null;
            }, 600);
        };

        const cancelPress = (e) => {
            if (pressTimer) {
                // Cancel if finger moved more than 10px
                if (e.containerPoint && startPos) {
                    const dx = e.containerPoint.x - startPos.x;
                    const dy = e.containerPoint.y - startPos.y;
                    if (Math.sqrt(dx * dx + dy * dy) > 10) {
                        clearTimeout(pressTimer);
                        pressTimer = null;
                    }
                }
            }
        };

        const endPress = () => {
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        };

        map.on('mousedown', startPress);
        map.on('touchstart', startPress);
        map.on('mousemove', cancelPress);
        map.on('touchmove', (e) => { endPress(); }); // Always cancel on touch move (dragging)
        map.on('mouseup', endPress);
        map.on('touchend', endPress);
        map.on('contextmenu', (e) => {
            const rect = containerRef.current.getBoundingClientRect();
            onLongPress?.(e.latlng.lat, e.latlng.lng, { x: rect.x + e.containerPoint.x, y: rect.y + e.containerPoint.y });
        });

        // ═══ TAP-TO-DISCOVER: Detect taps on base map (not on markers) ═══
        map.on('click', (e) => {
            if (markerClickedRef.current) {
                markerClickedRef.current = false;
                return; // Was a marker click — suppress
            }
            if (longPressedRef.current) {
                longPressedRef.current = false;
                return; // Was a long-press — suppress (already handled)
            }
            const rect = containerRef.current.getBoundingClientRect();
            onMapTapRef.current?.(e.latlng.lat, e.latlng.lng, { x: rect.x + e.containerPoint.x, y: rect.y + e.containerPoint.y });
        });

        map.on('moveend', () => {
            onBoundsChange?.(map.getBounds());
        });

        // ═══ ZOOM-BASED RENDER VISIBILITY ═══
        map.on('zoomend', () => {
            const isZoomedIn = map.getZoom() >= 16;
            setShowLabels(prev => {
                if (prev !== isZoomedIn) return isZoomedIn;
                return prev;
            });
        });

        mapRef.current = map;
        if (hasCoordinates(referencePoint)) {
            referenceMarkerRef.current = L.marker([Number(referencePoint.latitude), Number(referencePoint.longitude)], {
                icon: makeIcon({ ...referencePoint, _reference: true }, true),
                interactive: false,
                keyboard: false,
                zIndexOffset: 5000,
            }).addTo(map);
        }
        const initialBoundsTimeout = setTimeout(() => {
            if (mapRef.current) {
                try {
                    onBoundsChange?.(map.getBounds());
                } catch (e) {
                    console.warn('Map not fully initialized for getBounds:', e);
                }
            }
        }, 100);

        // Staggered invalidateSize to handle overlay/flex layout settling
        const sizeFixA = setTimeout(() => { if (mapRef.current) map.invalidateSize(); }, 150);
        const sizeFixB = setTimeout(() => { if (mapRef.current) map.invalidateSize(); }, 400);

        return () => {
            clearTimeout(initialBoundsTimeout);
            clearTimeout(sizeFixA);
            clearTimeout(sizeFixB);
            resizeObserver.disconnect();
            markersLayerRef.current = null;
            suggestedLayerRef.current = null;
            referenceMarkerRef.current = null;
            map.remove();
            mapRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync user location marker
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !coordinates(userLocation?.lat, userLocation?.lng)) return;

        if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
            map.flyTo([userLocation.lat, userLocation.lng], map.getZoom(), { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, duration: 0.5 });
        } else {
            userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, interactive: false }).addTo(map);
            map.flyTo([userLocation.lat, userLocation.lng], 14, { animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, duration: 0.5 });
        }
    }, [userLocation]);

    // Keep the confirmed school visible independently from the POI catalog.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (!hasCoordinates(referencePoint)) {
            referenceMarkerRef.current?.remove();
            referenceMarkerRef.current = null;
            return;
        }
        const point = [Number(referencePoint.latitude), Number(referencePoint.longitude)];
        if (referenceMarkerRef.current) {
            referenceMarkerRef.current.setLatLng(point);
            referenceMarkerRef.current.setIcon(makeIcon({ ...referencePoint, _reference: true }, true));
        } else {
            referenceMarkerRef.current = L.marker(point, {
                icon: makeIcon({ ...referencePoint, _reference: true }, true),
                interactive: false,
                keyboard: false,
                zIndexOffset: 5000,
            }).addTo(map);
        }
    }, [referencePoint]);

    // Sync saved POI markers — optimized: update icons in-place when only labels change
    const poisKeyRef = useRef('');
    useEffect(() => {
        const map = mapRef.current;
        const layer = markersLayerRef.current;
        if (!map || !layer || preparation) return;

        // Build a key representing the POI data (not label state)
        const dataKey = pois.filter(hasCoordinates)
            .map(p => `${p.id || p.name}:${Number(p.latitude)}:${Number(p.longitude)}:${p.is_official ? 1 : 0}:${p._reference ? 1 : 0}`)
            .join('|');
        
        const dataChanged = dataKey !== poisKeyRef.current;
        poisKeyRef.current = dataKey;

        if (dataChanged) {
            // Full rebuild: clear LayerGroup at once (single DOM operation)
            layer.clearLayers();
            markersRef.current = [];

            pois.filter(hasCoordinates).forEach(poi => {
                const marker = L.marker([Number(poi.latitude), Number(poi.longitude)], {
                    icon: makeIcon(poi, showLabels),
                    zIndexOffset: poi._reference ? 5000 : poi.is_official ? 3000 : 0
                });

                marker.on('click', () => {
                    markerClickedRef.current = true;
                    const element = marker.getElement();
                    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) element?.animate([{ opacity: .5 }, { opacity: 1 }], { duration: 220 });
                    onMarkerClick?.({ ...(latestPoisRef.current.find(item => item.id === poi.id) || poi), _origin: narrationOrigin(element) });
                });

                layer.addLayer(marker);
                markersRef.current.push({ marker, poi });
            });
        } else {
            // Labels-only change: swap icons in-place via rAF to batch DOM writes
            requestAnimationFrame(() => {
                markersRef.current.forEach(({ marker, poi }) => {
                    marker.setIcon(makeIcon(poi, showLabels));
                });
            });
        }
    }, [pois, onMarkerClick, showLabels, preparation]);

    // Sync Suggested POI markers — tap opens modal directly
    useEffect(() => {
        const map = mapRef.current;
        const layer = suggestedLayerRef.current;
        if (!map || !layer || preparation) return;

        // Clear all suggested markers at once
        layer.clearLayers();
        suggestedMarkersRef.current = [];

        suggestedPois.filter(hasCoordinates).forEach(poi => {
            const marker = L.marker([Number(poi.latitude), Number(poi.longitude)], {
                icon: makeSuggestedIcon(showLabels ? poi.name : null, poi.category),
                zIndexOffset: poi.category === 'city' ? 2000 : 1000
            });

            marker.on('click', () => {
                markerClickedRef.current = true;
                onSuggestedPoiClick?.({ ...poi, _origin: narrationOrigin(marker.getElement()) });
            });

            layer.addLayer(marker);
            suggestedMarkersRef.current.push(marker);
        });
    }, [suggestedPois, onSuggestedPoiClick, showLabels, preparation]);

    usePreparationLayers(mapRef, pois, suggestedPois, preparation, onMarkerClick, onSuggestedPoiClick);

    return (
        <>
            <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
            <style>{`
                .leaflet-control-zoom a {
                    background: #1E293B !important; color: #CBD5E1 !important;
                    border-color: #334155 !important; font-weight: 800 !important;
                }
                .leaflet-control-zoom a:hover { background: #334155 !important; }
                
                .poi-marker-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    overflow: visible !important;
                    will-change: transform;
                }
                .poi-pin {
                    width: 32px; height: 32px; border-radius: 8px;
                    border: 2px solid white;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 16px; cursor: pointer;
                    will-change: transform;
                }
                .poi-pin--school {
                    width: 44px; height: 44px; border-radius: 50%;
                    background: linear-gradient(135deg, #2563EB, #1D4ED8);
                    border: 4px solid white;
                    font-size: 21px;
                    box-shadow: 0 5px 18px rgba(37,99,235,.48), 0 0 0 5px rgba(37,99,235,.16);
                    cursor: default;
                }
                .poi-pin--official {
                    width: 40px; height: 40px; border-radius: 50%;
                    background: linear-gradient(135deg, #2563EB, #1D4ED8);
                    border: 3px solid #DBEAFE;
                    font-size: 22px; color: white; font-weight: 900;
                    box-shadow: 0 4px 12px rgba(37,99,235,0.4);
                    z-index: 3000;
                }
                .poi-marker-label {
                    margin-top: 4px;
                    background: #0F172A;
                    color: #F8FAFC;
                    font-size: 10px;
                    font-weight: 700;
                    border: 1px solid #334155;
                    border-radius: 4px;
                    padding: 2px 4px;
                    white-space: nowrap;
                    pointer-events: none;
                }
                .poi-marker-label--school {
                    margin-top: 3px; padding: 3px 7px; border-radius: 999px;
                    background: #1D4ED8; border-color: #93C5FD; color: white;
                    font-size: 9px; letter-spacing: .08em; font-weight: 900;
                }
                .poi-marker-label--official {
                    font-size: 12px; padding: 4px 8px;
                    background: #1E3A8A; border-color: #3B82F6;
                    color: white; font-weight: bold;
                }
            `}</style>
        </>
    );
}
