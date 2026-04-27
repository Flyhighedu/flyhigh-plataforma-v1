'use client';

// =====================================================
// TacticalMapLeaflet.js
// Pure Leaflet map component. Loaded via dynamic import
// (no SSR) from TacticalMapScreen.js.
// Uses CartoDB Dark tiles (free, no API key).
// =====================================================

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

const CAT_COLORS = {
    school: '#3B82F6', parking: '#8B5CF6', hazard: '#EF4444',
    landmark: '#10B981', refuel: '#F59E0B', general: '#64748B'
};
const CAT_EMOJI = {
    school: '🏫', parking: '🅿️', hazard: '⚠️',
    landmark: '📍', refuel: '⛽', general: '📌'
};

function makeIcon(category) {
    const color = CAT_COLORS[category] || CAT_COLORS.general;
    const emoji = CAT_EMOJI[category] || CAT_EMOJI.general;
    return L.divIcon({
        className: '',
        html: `<div style="
            width:36px;height:36px;border-radius:12px;
            background:${color};border:3px solid white;
            display:flex;align-items:center;justify-content:center;
            font-size:16px;box-shadow:0 4px 12px rgba(0,0,0,0.4);
            cursor:pointer;
        ">${emoji}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20]
    });
}

const userIcon = L.divIcon({
    className: '',
    html: `<div style="
        width:18px;height:18px;border-radius:50%;
        background:#06B6D4;border:3px solid white;
        box-shadow:0 0 12px rgba(6,182,212,0.6), 0 0 24px rgba(6,182,212,0.3);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
});

export default function TacticalMapLeaflet({ pois = [], userLocation, onMapClick, onMarkerClick }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);
    const userMarkerRef = useRef(null);

    // Initialize map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const center = userLocation ? [userLocation.lat, userLocation.lng] : [19.4326, -99.1332];
        const map = L.map(containerRef.current, {
            center, zoom: 14, zoomControl: false,
            attributionControl: false
        });

        L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19, subdomains: 'abcd' }).addTo(map);
        L.control.zoom({ position: 'topright' }).addTo(map);
        L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

        map.on('click', (e) => {
            onMapClick?.(e.latlng.lat, e.latlng.lng);
        });

        mapRef.current = map;

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

    // Sync POI markers
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Remove old
        markersRef.current.forEach(m => map.removeLayer(m));
        markersRef.current = [];

        // Add new
        pois.forEach(poi => {
            const marker = L.marker([poi.latitude, poi.longitude], {
                icon: makeIcon(poi.category)
            }).addTo(map);

            marker.bindPopup(`
                <div style="font-family:system-ui;min-width:160px;">
                    <p style="font-size:14px;font-weight:800;color:#0F172A;margin:0 0 4px;">${poi.name}</p>
                    ${poi.description ? `<p style="font-size:11px;color:#64748B;margin:0 0 6px;">${poi.description}</p>` : ''}
                    <p style="font-size:10px;color:#94A3B8;margin:0;font-family:monospace;">${poi.latitude.toFixed(5)}, ${poi.longitude.toFixed(5)}</p>
                </div>
            `, { className: 'poi-popup', closeButton: true });

            marker.on('click', () => {
                onMarkerClick?.(poi);
            });

            markersRef.current.push(marker);
        });
    }, [pois, onMarkerClick]);

    return (
        <>
            <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
            <style>{`
                .poi-popup .leaflet-popup-content-wrapper {
                    background: white; border-radius: 16px;
                    box-shadow: 0 12px 32px rgba(0,0,0,0.3);
                    padding: 4px;
                }
                .poi-popup .leaflet-popup-tip { background: white; }
                .leaflet-control-zoom a {
                    background: #1E293B !important; color: #CBD5E1 !important;
                    border-color: #334155 !important; font-weight: 800 !important;
                }
                .leaflet-control-zoom a:hover { background: #334155 !important; }
            `}</style>
        </>
    );
}
