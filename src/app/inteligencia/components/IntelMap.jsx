'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Flame, Map as MapIcon } from 'lucide-react';
import { registerShapeMarker } from './ShapeMarker';

// @2x tiles for larger, more readable city labels
const DARK_TILE = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · <a href="https://carto.com/">CARTO</a>';

const HEAT_CDN = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';

// ─── Shape + color system ───
// Shape = nivel educativo, Fill color = sostenimiento (pública/privada)
const NIVEL_SHAPES = {
  'PREESCOLAR':     'triangle',
  'PRIMARIA':       'circle',
  'SECUNDARIA':     'square',
  'MEDIA SUPERIOR': 'diamond',
  'SUPERIOR':       'hexagon',
};

// Sostenimiento colors (fill the entire shape)
const PUBLICA_COLOR  = { fill: '#3B82F6', stroke: '#2563EB' };  // blue
const PRIVADA_COLOR  = { fill: '#F59E0B', stroke: '#D97706' };  // gold/amber
const CAMPUS_COLOR   = { fill: '#A855F7', stroke: '#9333EA' };  // purple
const ROUTE_COLOR    = { fill: '#10B981', stroke: '#059669' };  // green

function getMarkerStyle(school, isInRoute, isCampus) {
  const nivelKey = (school.nivelEducativo || '').toUpperCase();
  let shape = NIVEL_SHAPES[nivelKey] || 'circle';

  // Campus overrides shape to star
  if (isCampus) shape = 'star';

  // Color = sostenimiento (full fill)
  let colors = school.isPrivada ? PRIVADA_COLOR : PUBLICA_COLOR;
  if (isCampus) colors = CAMPUS_COLOR;

  let radius = 6;
  let weight = 1.5;
  let fillOpacity = 0.85;

  // Large schools get slightly bigger
  if (school.alumnos > 300) radius = 7;

  // Route override
  if (isInRoute) {
    colors = ROUTE_COLOR;
    weight = 2.5;
    radius = 9;
    fillOpacity = 0.95;
  }

  return {
    shape,
    color: colors.stroke,
    fillColor: colors.fill,
    radius,
    weight,
    fillOpacity,
  };
}

const NIVEL_COLOR_MAP = {
  'PREESCOLAR': '#EC4899', 'PRIMARIA': '#60A5FA', 'SECUNDARIA': '#A78BFA',
  'MEDIA SUPERIOR': '#FB923C', 'SUPERIOR': '#34D399',
};

// Street View URL builder
function streetViewUrl(lat, lng) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}
function streetViewLink(lat, lng) {
  if (!lat || !lng) return '';
  return `
    <a href="${streetViewUrl(lat, lng)}" target="_blank" rel="noopener noreferrer" class="intel-tooltip-streetview">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M12 12v8"/><path d="M8 16l4 4 4-4"/></svg>
      Ver en Street View
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>
    </a>
  `;
}

function buildSchoolTooltip(school) {
  const tipo = school.isPrivada ? 'Privada' : 'Pública';
  const tipoColor = school.isPrivada ? '#FBBF24' : '#60A5FA';
  const tipoBg = school.isPrivada ? 'rgba(251,191,36,0.12)' : 'rgba(96,165,250,0.12)';
  const nivel = school.nivelEducativo || '';
  const nivelColor = NIVEL_COLOR_MAP[nivel.toUpperCase()] || '#9CA3AF';

  return `
    <div class="intel-tooltip-card">
      <div class="intel-tooltip-name">${school.nombre || 'Sin nombre'}</div>
      <div class="intel-tooltip-badges">
        ${nivel ? `<span class="intel-tooltip-badge" style="color:${nivelColor};background:${nivelColor}18;border-color:${nivelColor}30">${nivel}</span>` : ''}
        <span class="intel-tooltip-badge" style="color:${tipoColor};background:${tipoBg};border-color:${tipoColor}30">${tipo}</span>
      </div>
      <div class="intel-tooltip-stats">
        <div class="intel-tooltip-stat">
          <span class="intel-tooltip-stat-label">Alumnos</span>
          <span class="intel-tooltip-stat-value">${(school.alumnos || 0).toLocaleString()}</span>
        </div>
        ${school.turno ? `<div class="intel-tooltip-stat"><span class="intel-tooltip-stat-label">Turno</span><span class="intel-tooltip-stat-value">${school.turno}</span></div>` : ''}
        ${school.municipio ? `<div class="intel-tooltip-stat"><span class="intel-tooltip-stat-label">Municipio</span><span class="intel-tooltip-stat-value">${school.municipio}</span></div>` : ''}
      </div>
      <div class="intel-tooltip-cct">CCT: ${school.cct || '—'}</div>
      ${streetViewLink(school.latitud, school.longitud)}
    </div>
  `;
}

function buildCampusTooltip(campusGroup) {
  // Group by nivel educativo
  const byNivel = {};
  let totalAlumnos = 0;
  const allTurnos = new Set();
  for (const s of campusGroup) {
    const nivel = (s.nivelEducativo || 'OTRO').toUpperCase();
    if (!byNivel[nivel]) byNivel[nivel] = [];
    byNivel[nivel].push(s);
    totalAlumnos += s.alumnos || 0;
    if (s.turno) allTurnos.add(s.turno);
  }

  const niveles = Object.keys(byNivel).sort();
  const municipio = campusGroup[0]?.municipio || '';

  let nivelSections = '';
  for (const nivel of niveles) {
    const schools = byNivel[nivel];
    const nivelColor = NIVEL_COLOR_MAP[nivel] || '#9CA3AF';
    const nivelAlumnos = schools.reduce((sum, s) => sum + (s.alumnos || 0), 0);

    nivelSections += `
      <div class="intel-tooltip-nivel">
        <div class="intel-tooltip-nivel-header" style="color:${nivelColor}">
          <span class="intel-tooltip-nivel-dot" style="background:${nivelColor}"></span>
          ${nivel}
          <span class="intel-tooltip-nivel-count">${nivelAlumnos.toLocaleString()} alumnos</span>
        </div>
        ${schools.map(s => {
          const turnoShort = (s.turno || '').replace('MATUTINO','Mat.').replace('VESPERTINO','Vesp.').replace('NOCTURNO','Noct.').replace('DISCONTINUO','Disc.').replace('CONTINUO','Cont.');
          return `
          <div class="intel-tooltip-nivel-school">
            <span class="intel-tooltip-nivel-name">${s.nombre || 'Sin nombre'}</span>
            <span class="intel-tooltip-nivel-meta">${(s.alumnos || 0).toLocaleString()} al. · ${turnoShort} · ${s.isPrivada ? 'Priv.' : 'Púb.'} · ${s.cct}</span>
          </div>
        `;
        }).join('')}
      </div>
    `;
  }

  return `
    <div class="intel-tooltip-card intel-tooltip-campus">
      <div class="intel-tooltip-campus-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C084FC" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/></svg>
        <span class="intel-tooltip-campus-label">CAMPUS · ${niveles.length} niveles · ${campusGroup.length} CCTs</span>
      </div>
      ${allTurnos.size > 1 ? `<div class="intel-tooltip-campus-turnos">Turnos: ${[...allTurnos].join(', ')}</div>` : ''}

      ${nivelSections}

      <div class="intel-tooltip-campus-total">
        <div class="intel-tooltip-stat">
          <span class="intel-tooltip-stat-label">Total Campus</span>
          <span class="intel-tooltip-stat-value">${totalAlumnos.toLocaleString()} alumnos</span>
        </div>
        <div class="intel-tooltip-stat">
          <span class="intel-tooltip-stat-label">Escuelas</span>
          <span class="intel-tooltip-stat-value">${campusGroup.length} CCTs</span>
        </div>
        ${municipio ? `<div class="intel-tooltip-stat"><span class="intel-tooltip-stat-label">Municipio</span><span class="intel-tooltip-stat-value">${municipio}</span></div>` : ''}
      </div>
      ${streetViewLink(campusGroup[0]?.latitud, campusGroup[0]?.longitud)}
    </div>
  `;
}

// ─── Legend shape SVG component ───
function LegendShape({ shape, fill, stroke }) {
  const s = 14; // SVG size
  const props = { width: s, height: s, viewBox: '0 0 14 14', className: 'shrink-0' };
  switch (shape) {
    case 'triangle':
      return <svg {...props}><polygon points="7,1 13,12 1,12" fill={fill} stroke={stroke} strokeWidth="1.2" /></svg>;
    case 'square':
      return <svg {...props}><rect x="2" y="2" width="10" height="10" rx="1" fill={fill} stroke={stroke} strokeWidth="1.2" /></svg>;
    case 'diamond':
      return <svg {...props}><polygon points="7,1 13,7 7,13 1,7" fill={fill} stroke={stroke} strokeWidth="1.2" /></svg>;
    case 'hexagon':
      return <svg {...props}><polygon points="7,1 12.5,4 12.5,10 7,13 1.5,10 1.5,4" fill={fill} stroke={stroke} strokeWidth="1.2" /></svg>;
    case 'star':
      return <svg {...props}><polygon points="7,1 8.8,5.2 13,5.6 9.8,8.4 10.8,13 7,10.6 3.2,13 4.2,8.4 1,5.6 5.2,5.2" fill={fill} stroke={stroke} strokeWidth="0.8" /></svg>;
    default: // circle
      return <svg {...props}><circle cx="7" cy="7" r="5.5" fill={fill} stroke={stroke} strokeWidth="1.2" /></svg>;
  }
}

export default function IntelMap({
  schools = [],
  routeCCTs = [],
  onSchoolClick,
  onMapReady,
  children,
  mapInstanceRef,
  campusMap,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersLayerRef = useRef(null);
  const polylineRef = useRef(null);
  const heatLayerRef = useRef(null);
  const tooltipRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const schoolsRef = useRef(schools);
  const isFirstLoad = useRef(true);

  const [heatmapActive, setHeatmapActive] = useState(false);
  const [heatPluginLoaded, setHeatPluginLoaded] = useState(false);

  const routeSetRef = useRef(new Set());
  useEffect(() => {
    routeSetRef.current = new Set(routeCCTs);
  }, [routeCCTs]);

  // Keep schools ref fresh for tooltip callbacks
  useEffect(() => {
    schoolsRef.current = schools;
  }, [schools]);

  // ═══ Initialize map ═══
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Patch L.Canvas to guard against null _ctx during HMR/unmount
    if (L.Canvas && L.Canvas.prototype) {
      const origClear = L.Canvas.prototype._clear;
      if (!origClear._patched) {
        L.Canvas.prototype._clear = function () {
          if (!this._ctx) return;
          origClear.call(this);
        };
        L.Canvas.prototype._clear._patched = true;
      }
      const origRedraw = L.Canvas.prototype._redraw;
      if (origRedraw && !origRedraw._patched) {
        L.Canvas.prototype._redraw = function () {
          if (!this._ctx) return;
          origRedraw.call(this);
        };
        L.Canvas.prototype._redraw._patched = true;
      }
    }

    // Register ShapeMarker on L before creating the map
    registerShapeMarker(L);

    // Canvas renderer — renders ALL markers as canvas draws, not DOM elements.
    // This is the key performance optimization for thousands of points.
    const canvasRenderer = L.canvas({ padding: 0.5 });

    const map = L.map(containerRef.current, {
      center: [19.4, -102.05],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
      renderer: canvasRenderer,
      preferCanvas: true,
    });

    L.tileLayer(DARK_TILE, {
      attribution: TILE_ATTR,
      maxZoom: 19,
      subdomains: 'abcd',
      tileSize: 512,
      zoomOffset: -1,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: false }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);

    // Expose map instance to parent via ref
    if (mapInstanceRef) mapInstanceRef.current = map;

    // Tooltip element (single reusable DOM node)
    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'intel-pin-tooltip';
    tooltipEl.style.display = 'none';
    tooltipEl.style.position = 'fixed';
    tooltipEl.style.pointerEvents = 'auto';
    tooltipEl.style.zIndex = '50000';
    document.body.appendChild(tooltipEl);
    tooltipRef.current = tooltipEl;

    // Tooltip interactivity: keep visible when cursor enters tooltip
    tooltipEl.addEventListener('mouseenter', () => {
      clearTimeout(hideTimeoutRef.current);
    });
    tooltipEl.addEventListener('mouseleave', () => {
      tooltipEl.style.display = 'none';
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    mapRef.current = map;
    onMapReady?.();

    const fix1 = setTimeout(() => map.invalidateSize(), 200);
    const fix2 = setTimeout(() => map.invalidateSize(), 500);

    return () => {
      clearTimeout(fix1);
      clearTimeout(fix2);
      resizeObserver.disconnect();
      tooltipEl.remove();
      try { map.remove(); } catch { /* canvas ctx may already be gone */ }
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══ Sync markers (using Canvas CircleMarkers for performance) ═══
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    try { layer.clearLayers(); } catch { /* canvas ctx may be gone during HMR */ }

    if (schools.length === 0) return;

    const bounds = L.latLngBounds([]);

    schools.forEach(school => {
      const isInRoute = routeSetRef.current.has(school.cct);
      const coordKey = `${school.latitud},${school.longitud}`;
      const campusGroup = campusMap?.get(coordKey);
      const isCampus = campusGroup && campusGroup.length >= 2;
      const style = getMarkerStyle(school, isInRoute, isCampus);

      // ShapeMarker renders on Canvas — zero DOM overhead per point
      const marker = L.shapeMarker([school.latitud, school.longitud], {
        shape: style.shape,
        radius: style.radius,
        color: style.color,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        weight: style.weight,
        _school: school,
      });

      marker.on('click', () => {
        onSchoolClick?.(school);
      });

      marker.on('mouseover', (e) => {
        clearTimeout(hideTimeoutRef.current);
        const tooltip = tooltipRef.current;
        if (!tooltip) return;

        // Build tooltip HTML — campus or single school
        if (isCampus) {
          tooltip.innerHTML = buildCampusTooltip(campusGroup, school);
        } else {
          tooltip.innerHTML = buildSchoolTooltip(school);
        }

        tooltip.style.display = 'block';
        tooltip.style.opacity = '0';

        // Position: offset to upper-right of cursor so it never overlaps
        const point = map.latLngToContainerPoint(e.latlng);
        const mapRect = containerRef.current.getBoundingClientRect();
        const tooltipW = tooltip.offsetWidth || 290;
        const tooltipH = tooltip.offsetHeight || 140;

        let left = mapRect.left + point.x + 20;
        let top = mapRect.top + point.y - tooltipH - 10;

        if (left + tooltipW > window.innerWidth - 16) {
          left = mapRect.left + point.x - tooltipW - 20;
        }
        if (top < 16) {
          top = mapRect.top + point.y + 20;
        }

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
        tooltip.style.transform = 'none';
        requestAnimationFrame(() => { tooltip.style.opacity = '1'; });
      });

      marker.on('mouseout', () => {
        hideTimeoutRef.current = setTimeout(() => {
          if (tooltipRef.current) {
            tooltipRef.current.style.display = 'none';
          }
        }, 300);
      });

      layer.addLayer(marker);
      bounds.extend([school.latitud, school.longitud]);
    });

    // Only fit bounds on first load
    if (isFirstLoad.current && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      isFirstLoad.current = false;
    }
  }, [schools, routeCCTs, onSchoolClick, campusMap]);

  // ═══ Route polyline ═══
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    if (routeCCTs.length < 2) return;

    const schoolMap = new Map();
    schools.forEach(s => schoolMap.set(s.cct, s));

    const latlngs = routeCCTs
      .map(cct => schoolMap.get(cct))
      .filter(s => s && s.latitud && s.longitud)
      .map(s => [s.latitud, s.longitud]);

    if (latlngs.length >= 2) {
      polylineRef.current = L.polyline(latlngs, {
        color: '#10B981',
        weight: 3,
        dashArray: '8 6',
        opacity: 0.8,
        lineCap: 'round',
      }).addTo(map);
    }
  }, [schools, routeCCTs]);

  // ═══ Heatmap layer ═══
  const toggleHeatmap = useCallback(async () => {
    if (heatmapActive) {
      if (heatLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      setHeatmapActive(false);
      return;
    }

    if (!heatPluginLoaded && !window.L?.heatLayer) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = HEAT_CDN;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      setHeatPluginLoaded(true);
    }

    if (mapRef.current && L.heatLayer) {
      const points = schools
        .filter(s => s.latitud && s.longitud)
        .map(s => [s.latitud, s.longitud, s.alumnos || 1]);

      heatLayerRef.current = L.heatLayer(points, {
        radius: 25,
        blur: 20,
        maxZoom: 15,
        max: Math.max(...schools.map(s => s.alumnos || 1)),
        gradient: {
          0.2: '#1e3a5f',
          0.4: '#3B82F6',
          0.6: '#F59E0B',
          0.8: '#EF4444',
          1.0: '#FF0000',
        },
      }).addTo(mapRef.current);

      setHeatmapActive(true);
    }
  }, [heatmapActive, heatPluginLoaded, schools]);

  return (
    <div className="relative flex-1 h-full intel-map">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Floating controls */}
      <div className="intel-float-toggle">
        <button
          onClick={toggleHeatmap}
          className={`intel-btn ${heatmapActive ? 'intel-btn-gold' : 'intel-btn-ghost'} text-xs`}
          title={heatmapActive ? 'Desactivar Heatmap' : 'Activar Heatmap'}
        >
          <Flame size={14} />
          {heatmapActive ? 'Heatmap ON' : 'Heatmap'}
        </button>
        {/* Additional controls injected via children */}
        {children}
      </div>

      {/* School count overlay */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className="intel-glass rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
          <MapIcon size={13} className="text-blue-400" />
          <span className="font-bold text-white">{schools.length}</span>
          <span className="text-gray-400">en mapa</span>
        </div>
      </div>

      {/* Map legend */}
      {schools.length > 0 && (
        <div className="absolute bottom-4 left-4 z-[1000]">
          <div className="intel-glass rounded-xl px-3 py-2.5 space-y-1">
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Leyenda</p>

            {/* Nivel shapes — only show niveles present in data */}
            {Object.entries(NIVEL_SHAPES)
              .filter(([key]) => schools.some(s => (s.nivelEducativo || '').toUpperCase() === key))
              .map(([key, shape]) => (
                <div key={key} className="space-y-0.5">
                  {/* Pública variant */}
                  <div className="flex items-center gap-2">
                    <LegendShape shape={shape} fill={PUBLICA_COLOR.fill} stroke={PUBLICA_COLOR.stroke} />
                    <span className="text-[10px] text-gray-300 font-medium">{key} <span className="text-gray-500">Púb.</span></span>
                  </div>
                  {/* Privada variant */}
                  <div className="flex items-center gap-2">
                    <LegendShape shape={shape} fill={PRIVADA_COLOR.fill} stroke={PRIVADA_COLOR.stroke} />
                    <span className="text-[10px] text-gray-300 font-medium">{key} <span className="text-gray-500">Priv.</span></span>
                  </div>
                </div>
              ))
            }

            {/* Campus */}
            {campusMap && campusMap.size > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t border-white/[0.05]">
                <LegendShape shape="star" fill={CAMPUS_COLOR.fill} stroke={CAMPUS_COLOR.stroke} />
                <span className="text-[10px] text-gray-300 font-medium">Campus <span className="text-gray-500">({campusMap.size})</span></span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
