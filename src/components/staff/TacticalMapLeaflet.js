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
    
    const citySvg = `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="64" height="64" rx="32" fill="url(#bg-gradient)"/><circle cx="32" cy="32" r="30" stroke="#BFDBFE" stroke-width="4"/><path d="M42 24a4 4 0 013.5-3.8 5 5 0 019 1.8 3 3 0 01-1.5 5.8 4 4 0 01-11-3.8z" fill="#F472B6" opacity="0.8"/><path d="M28 20a3 3 0 012.8-2.5 4 4 0 017 1.5 2 2 0 01-1.2 3.8 3 3 0 01-8.6-2.8z" fill="#FBCFE8" opacity="0.9"/><path d="M38 28h12v26H38z" fill="#1E3A8A"/><path d="M14 34h10v20H14z" fill="#2563EB"/><path d="M24 26h14v28H24z" fill="#3B82F6"/><rect x="28" y="30" width="2" height="2" fill="#FDE047"/><rect x="32" y="30" width="2" height="2" fill="#1E3A8A"/><rect x="28" y="36" width="2" height="2" fill="#FDE047"/><rect x="32" y="36" width="2" height="2" fill="#FDE047"/><rect x="28" y="42" width="2" height="2" fill="#1E3A8A"/><rect x="32" y="42" width="2" height="2" fill="#FDE047"/><rect x="28" y="48" width="2" height="2" fill="#FDE047"/><rect x="32" y="48" width="2" height="2" fill="#FDE047"/><rect x="16" y="38" width="2" height="2" fill="#FDE047"/><rect x="20" y="38" width="2" height="2" fill="#FDE047"/><rect x="16" y="44" width="2" height="2" fill="#FDE047"/><rect x="20" y="44" width="2" height="2" fill="#1E3A8A"/><rect x="42" y="32" width="4" height="2" fill="#FDE047"/><rect x="42" y="38" width="4" height="2" fill="#FDE047"/><defs><linearGradient id="bg-gradient" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse"><stop stop-color="#3B82F6"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs></svg>`;
    
    const starSvg = `<svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="30" fill="url(#star-bg)" stroke="#FEF08A" stroke-width="4"/><path d="M32 14l5.5 16.5H55l-14 10.5 5.5 16.5L32 47l-14 10.5 5.5-16.5-14-10.5h17.5L32 14z" fill="url(#star-gold)" filter="url(#drop-shadow)"/><defs><linearGradient id="star-bg" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse"><stop stop-color="#F59E0B"/><stop offset="1" stop-color="#D97706"/></linearGradient><linearGradient id="star-gold" x1="14" y1="14" x2="50" y2="50" gradientUnits="userSpaceOnUse"><stop stop-color="#FEF08A"/><stop offset="1" stop-color="#F59E0B"/></linearGradient><filter id="drop-shadow" x="10" y="10" width="44" height="44" filterUnits="userSpaceOnUse"><feDropShadow dx="0" dy="4" stdDeviation="2" flood-color="#000" flood-opacity="0.3"/></filter></defs></svg>`;

    return L.divIcon({
        className: 'poi-marker-container',
        html: `<div style="
            display:flex;align-items:center;justify-content:center;
            cursor:pointer;
            filter: drop-shadow(0 6px 12px rgba(0,0,0,0.3));
            z-index: ${isCity ? '2000' : '1000'};
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">${isCity ? citySvg : starSvg}</div>
        ${shortName ? `<div class="poi-marker-label" style="${isCity ? 'font-size:12px; padding:4px 8px; background:#1E3A8A; border-color:#3B82F6;' : ''}">${shortName}</div>` : ''}`,
        iconSize: [isCity ? 56 : 36, isCity ? 56 : 36],
        iconAnchor: [isCity ? 28 : 18, isCity ? 28 : 18]
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
