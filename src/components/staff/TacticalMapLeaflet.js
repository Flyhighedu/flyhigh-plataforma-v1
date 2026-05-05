'use client';

// =====================================================
// TacticalMapLeaflet.js — v2 (Refactored)
// Pure Leaflet map. Tap pin = modal. Long-press = new pin.
// No popups. Clean interaction model.
// =====================================================

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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

function makeIcon(category, name) {
    const color = CAT_COLORS[category] || CAT_COLORS.general;
    const emoji = CAT_EMOJI[category] || CAT_EMOJI.general;
    const shortName = name && name.length > 20 ? name.substring(0, 20) + '...' : (name || '');
    return L.divIcon({
        className: 'poi-marker-container',
        html: `<div style="
            width:32px;height:32px;border-radius:8px;
            background:${color};border:2px solid white;
            display:flex;align-items:center;justify-content:center;
            font-size:16px;
            cursor:pointer;
        ">${emoji}</div>
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
    pois = [], suggestedPois = [], userLocation,
    onMarkerClick, onBoundsChange, onSuggestedPoiClick, onLongPress
}) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const suggestedMarkersRef = useRef([]);
    const userMarkerRef = useRef(null);
    const [showLabels, setShowLabels] = useState(false);

    // Initialize map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const center = userLocation ? [userLocation.lat, userLocation.lng] : [19.4326, -99.1332];
        const map = L.map(containerRef.current, {
            center, zoom: 14, zoomControl: false,
            attributionControl: false
        });

        L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19, subdomains: 'abc' }).addTo(map);
        L.control.zoom({ position: 'topright' }).addTo(map);
        L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

        // ═══ LONG-PRESS DETECTION ═══
        let pressTimer = null;
        let startPos = null;

        const startPress = (e) => {
            const latlng = e.latlng;
            startPos = e.containerPoint ? { x: e.containerPoint.x, y: e.containerPoint.y } : null;
            pressTimer = setTimeout(() => {
                onLongPress?.(latlng.lat, latlng.lng);
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
        setTimeout(() => onBoundsChange?.(map.getBounds()), 100);

        return () => {
            map.remove();
            mapRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync user location marker
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !userLocation) return;

        if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
        } else {
            userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, interactive: false }).addTo(map);
            map.setView([userLocation.lat, userLocation.lng], 14);
        }
    }, [userLocation]);

    // Sync saved POI markers — tap opens modal directly
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        markersRef.current.forEach(m => map.removeLayer(m));
        markersRef.current = [];

        pois.forEach(poi => {
            const marker = L.marker([poi.latitude, poi.longitude], {
                icon: makeIcon(poi.category, showLabels ? poi.name : null)
            }).addTo(map);

            marker.on('click', () => {
                onMarkerClick?.(poi);
            });

            markersRef.current.push(marker);
        });
    }, [pois, onMarkerClick, showLabels]);

    // Sync Suggested POI markers — tap opens modal directly
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        suggestedMarkersRef.current.forEach(m => map.removeLayer(m));
        suggestedMarkersRef.current = [];

        suggestedPois.forEach(poi => {
            const marker = L.marker([poi.latitude, poi.longitude], {
                icon: makeSuggestedIcon(showLabels ? poi.name : null, poi.category),
                zIndexOffset: poi.category === 'city' ? 2000 : 1000
            }).addTo(map);

            marker.on('click', () => {
                onSuggestedPoiClick?.(poi);
            });

            suggestedMarkersRef.current.push(marker);
        });
    }, [suggestedPois, onSuggestedPoiClick, showLabels]);

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
            `}</style>
        </>
    );
}
