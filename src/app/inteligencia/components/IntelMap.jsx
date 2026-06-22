'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Flame, Map as MapIcon } from 'lucide-react';
import { registerShapeMarker } from './ShapeMarker';
import { formatMXN, calculateCapacity, estimateSchoolOps, contarTurnosQueCalifican, renderTurnoPillHTML } from '../lib/filters';

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
function renderMunicipioChipHTML(municipio) {
  if (!municipio) return '';
  return `<span class="intel-tooltip-municipio-chip">📍 ${municipio}</span>`;
}

function streetViewLink(lat, lng) {
  if (!lat || !lng) return '';
  return `
    <a href="${streetViewUrl(lat, lng)}" target="_blank" rel="noopener noreferrer" class="intel-tooltip-streetview">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
      Ver en Street View
    </a>
  `;
}

function buildTurnoTooltip(turnoGroup, visibleCcts, routeSet = new Set(), capacity = null, prices = null, metaPorDia = 0, activeRouteName = 'Mi Ruta') {
  const nombre = turnoGroup[0]?.nombre || 'Locación';
  const municipio = turnoGroup[0]?.municipio || '';
  const order = { 'MATUTINO': 0, 'VESPERTINO': 1, 'NOCTURNO': 2 };
  const sorted = [...turnoGroup].sort((a, b) => (order[(a.turno||'').toUpperCase()] ?? 9) - (order[(b.turno||'').toUpperCase()] ?? 9));
  const calif = sorted.filter(s => visibleCcts.has(s.cct)).length;

  const closeBtn = `<button onclick="event.stopPropagation(); window.__intelClearFocus && window.__intelClearFocus()" class="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors z-[100] cursor-pointer" title="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;

  const turnoIcon = (t) => { const u=(t||'').toUpperCase(); return u==='MATUTINO'?'☀️':u==='VESPERTINO'?'🌙':u==='NOCTURNO'?'🌑':'🕐'; };

  // Ingreso por turno (al vuelo, así calcula también los que NO pasan el filtro)
  const ops = new Map();
  if (capacity && prices) {
    for (const s of sorted) ops.set(s.cct, estimateSchoolOps(s, capacity, prices));
  }

  // Totales: solo los turnos que pasan el filtro
  let passAlumnos = 0, passIngreso = 0, missAlumnos = 0;
  for (const s of sorted) {
    const o = ops.get(s.cct);
    if (!o) continue;
    if (visibleCcts.has(s.cct)) { passAlumnos += o.alumnos; passIngreso += o.ingreso; }
    else missAlumnos += o.alumnos;
  }

  // Días: solo los turnos que pasan el filtro (son los que vas a hacer)
  let maxDias = 0;
  const _ninosDia = capacity && sorted.find(s => visibleCcts.has(s.cct))
    ? (sorted.find(s => visibleCcts.has(s.cct)).isPrivada ? capacity.ninosPorDiaPriv : capacity.ninosPorDiaPub)
    : 0;
  if (_ninosDia > 0) {
    const byTurno = {};
    for (const s of sorted) {
      if (!visibleCcts.has(s.cct)) continue;
      const t = s.turno || 'OTRO';
      byTurno[t] = (byTurno[t] || 0) + (s.alumnos || 0);
    }
    for (const t in byTurno) maxDias = Math.max(maxDias, Math.ceil(byTurno[t] / _ninosDia));
  }
  const passDias = maxDias > 0 ? Math.max(1, maxDias) : 0;

  const rows = sorted.map(s => {
    const ok = visibleCcts.has(s.cct);
    const inRoute = routeSet.has(s.cct);
    const o = ops.get(s.cct);
    // Keep showing info but dim if it doesn't pass filters. Don't show money if it doesn't pass.
    const moneyStr = (o && o.ingreso > 0) ? formatMXN(o.ingreso) : '';
    const money = moneyStr ? (ok ? `<span style="color:#34D399">${moneyStr}</span>` : `<span style="color:#FFFFFF; opacity:0.6">${moneyStr}</span>`) : '';

    return `
      <div class="intel-tooltip-row ${ok ? '' : 'intel-tooltip-row-inactive'}">
        <div class="intel-tooltip-row-top">
          ${renderTurnoPillHTML(s.turno)}
          <div class="intel-tooltip-row-left">
            <span class="intel-tooltip-row-name">${(s.alumnos||0).toLocaleString()} alumnos ${inRoute ? '· <span style="color:#34D399">en ruta</span>' : ''}</span>
            <span class="intel-tooltip-row-meta">${s.cct}</span>
          </div>
        </div>
        <div class="intel-tooltip-row-right">
          ${money}
        </div>
      </div>`;
  }).join('');

  const headerColor = sorted.length >= 2 ? '#34D399' : (turnoGroup[0]?.isPrivada ? '#C084FC' : '#60A5FA');
  const headerLabel = sorted.length >= 2 ? 'DOBLE TURNO · 2 JORNADAS, 1 VISITA' : `${sorted.length} turno en esta locación`;

  // Resumen: solo los turnos que pasan el filtro
  let totalBlock = '';
  if (passIngreso > 0) {
    const _ingDia = passDias > 0 ? passIngreso / passDias : 0;
    const _filtroNote = missAlumnos > 0
      ? `<div style="margin-top:4px;font-size:9px;color:#94A3B8">* ${missAlumnos.toLocaleString()} alumnos en turnos que no pasan filtros</div>`
      : '';
    totalBlock = `
      <div class="intel-tooltip-summary">
        <div class="intel-tooltip-row-left">
          <span class="intel-tooltip-row-meta">ALUMNOS</span>
          <span class="intel-tooltip-row-name" style="font-size:13px">${passAlumnos.toLocaleString()}</span>
        </div>
        ${passDias > 0 ? `
        <div class="intel-tooltip-row-left">
          <span class="intel-tooltip-row-meta">DÍAS DE OP.</span>
          <span class="intel-tooltip-row-name" style="font-size:13px;color:#C084FC">${passDias}</span>
        </div>
        <div class="intel-tooltip-row-left">
          <span class="intel-tooltip-row-meta">ING. / DÍA</span>
          <span class="intel-tooltip-row-right" style="font-size:13px;color:${metaPorDia > 0 ? (_ingDia >= metaPorDia ? '#34D399' : '#f87171') : '#e5e7eb'}">${formatMXN(_ingDia)}</span>
        </div>` : ''}
        <div class="intel-tooltip-row-left">
          <span class="intel-tooltip-row-meta">TOTAL</span>
          <span class="intel-tooltip-row-right" style="font-size:14px">${formatMXN(passIngreso)}</span>
        </div>
        ${_filtroNote}
      </div>`;
  } else {
    totalBlock = `
      <div class="intel-tooltip-summary" style="border-top-color:rgba(251,191,36,0.15)">
        <span class="intel-tooltip-row-meta" style="color:#FBBF24">Ningún turno pasa el filtro</span>
      </div>`;
  }

  // Add-to-route buttons per qualifying shift
  let routeBtns = '';
  const addables = sorted.filter(s => visibleCcts.has(s.cct) && !routeSet.has(s.cct));
  if (addables.length) {
    const cctListStr = JSON.stringify(addables.map(s => s.cct)).replace(/"/g, "'");
    routeBtns = `<button onclick="event.stopPropagation(); window.__intelAddToRoute && window.__intelAddToRoute(${cctListStr}, event)" class="w-full mt-3 py-2 flex justify-center items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg> Agregar ${addables.length > 1 ? 'ambos a' : 'a'} <span class="bg-white/20 px-1.5 py-0.5 rounded text-[11px] ml-0.5">${activeRouteName}</span></button>`;
  }

  return `
    <div class="intel-tooltip-card relative">
      ${closeBtn}
      <div class="intel-tooltip-name pr-6">${nombre}</div>
      ${renderMunicipioChipHTML(municipio)}
      <div class="intel-tooltip-campus-label" style="color:${headerColor};margin-bottom:10px">${headerLabel}</div>
      ${rows}
      ${totalBlock}
      ${streetViewLink(turnoGroup[0]?.latitud, turnoGroup[0]?.longitud)}
      ${routeBtns}
    </div>
  `;
}

function buildSchoolTooltip(school, routeSet = new Set(), profit = null, metaPorDia = 0, activeRouteName = 'Mi Ruta') {
  const tipo = school.isPrivada ? 'Privada' : 'Pública';
  const nivel = school.nivelEducativo || '';

  const closeBtn = `<button onclick="event.stopPropagation(); window.__intelClearFocus && window.__intelClearFocus()" class="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors z-[100] cursor-pointer" title="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;

  const isInRoute = routeSet.has(school.cct);
  let routeBtn = '';
  if (isInRoute) {
    routeBtn = `<button disabled class="w-full mt-3 py-2 flex justify-center items-center gap-2 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase tracking-wider cursor-not-allowed border border-emerald-500/30"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> En Ruta</button>`;
  } else {
    routeBtn = `<button onclick="event.stopPropagation(); window.__intelAddToRoute && window.__intelAddToRoute(['${school.cct}'], event)" class="w-full mt-3 py-2 flex justify-center items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] cursor-pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg> Agregar a <span class="bg-white/20 px-1.5 py-0.5 rounded text-[11px] ml-0.5">${activeRouteName}</span></button>`;
  }

  let opsBlock = '';
  if (profit) {
    const pc = profit.get(school.cct);
    if (pc) {
      opsBlock = `
        <div class="intel-tooltip-summary">
          <div class="intel-tooltip-row-left">
            <span class="intel-tooltip-row-meta">ALUMNOS</span>
            <span class="intel-tooltip-row-name" style="font-size:13px">${(school.alumnos || 0).toLocaleString()}</span>
          </div>
          <div class="intel-tooltip-row-left">
            <span class="intel-tooltip-row-meta">DÍAS DE OP.</span>
            <span class="intel-tooltip-row-name" style="font-size:13px;color:#C084FC">${pc.dias}</span>
          </div>
          <div class="intel-tooltip-row-left">
            <span class="intel-tooltip-row-meta">ING. / DÍA</span>
            <span class="intel-tooltip-row-right" style="font-size:13px;color:${metaPorDia > 0 ? (pc.ingresoPorDia >= metaPorDia ? '#34D399' : '#f87171') : '#e5e7eb'}">${formatMXN(pc.ingresoPorDia)}</span>
          </div>
          <div class="intel-tooltip-row-left">
            <span class="intel-tooltip-row-meta">TOTAL</span>
            <span class="intel-tooltip-row-right" style="font-size:14px">${formatMXN(pc.ingreso)}</span>
          </div>
        </div>`;
    } else {
      opsBlock = `
        <div class="intel-tooltip-summary" style="border-top-color:rgba(148,163,184,0.15)">
          <span class="intel-tooltip-row-meta" style="color:#94A3B8">Sin matrícula para estimar operación</span>
        </div>`;
    }
  }

  return `
    <div class="intel-tooltip-card relative">
      ${closeBtn}
      <div class="intel-tooltip-campus-header pr-6">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span class="intel-tooltip-campus-label" style="color:#60A5FA">${school.nombre || 'Sin nombre'}</span>
      </div>
      ${renderMunicipioChipHTML(school.municipio)}

      <div class="intel-tooltip-row">
        <div class="intel-tooltip-row-top">
          ${renderTurnoPillHTML(school.turno)}
          <div class="intel-tooltip-row-left">
            <span class="intel-tooltip-row-name" style="max-width:140px">${nivel} · ${tipo}</span>
            <span class="intel-tooltip-row-meta">${school.cct}</span>
          </div>
        </div>
      </div>
      
      ${opsBlock}
      ${streetViewLink(school.latitud, school.longitud)}
      ${routeBtn}
    </div>
  `;
}

function buildCampusTooltip(campusGroup, visibleCcts = new Set(), routeSet = new Set(), capacity = null, prices = null, metaPorDia = 0, activeRouteName = 'Mi Ruta') {
  const byNivel = {};
  for (const s of campusGroup) {
    const nivel = (s.nivelEducativo || 'OTRO').toUpperCase();
    if (!byNivel[nivel]) byNivel[nivel] = [];
    byNivel[nivel].push(s);
  }
  const niveles = Object.keys(byNivel).sort();
  const municipio = campusGroup[0]?.municipio || '';

  // Ops per school — same approach as buildTurnoTooltip
  const ops = new Map();
  if (capacity && prices) {
    for (const s of campusGroup) ops.set(s.cct, estimateSchoolOps(s, capacity, prices));
  }

  let passAlumnos = 0, passIngreso = 0, missIngreso = 0, missAlumnos = 0;
  for (const s of campusGroup) {
    const o = ops.get(s.cct);
    if (!o) continue;
    if (visibleCcts.has(s.cct)) { passAlumnos += o.alumnos; passIngreso += o.ingreso; }
    else { missIngreso += o.ingreso; missAlumnos += o.alumnos; }
  }
  // Días reales: fotógrafos operan turnos concurrentemente el mismo día. Agrupamos por turno y sacamos el máximo de días.
  let maxDias = 0;
  const _firstPass = campusGroup.find(s => visibleCcts.has(s.cct));
  const _ninosDia = capacity && _firstPass ? (_firstPass.isPrivada ? capacity.ninosPorDiaPriv : capacity.ninosPorDiaPub) : 0;
  if (_ninosDia > 0) {
    const byTurno = {};
    for (const s of campusGroup) {
      if (!visibleCcts.has(s.cct)) continue;
      const t = s.turno || 'OTRO';
      byTurno[t] = (byTurno[t] || 0) + (s.alumnos || 0);
    }
    for (const t in byTurno) {
      const diasT = Math.ceil(byTurno[t] / _ninosDia);
      if (diasT > maxDias) maxDias = diasT;
    }
  }
  const passDias = maxDias > 0 ? Math.max(1, maxDias) : 0;

  const closeBtn = `<button onclick="event.stopPropagation(); window.__intelClearFocus && window.__intelClearFocus()" class="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors z-[100] cursor-pointer" title="Cerrar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>`;

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
          const ok = visibleCcts.has(s.cct);
          const inRoute = routeSet.has(s.cct);
          const o = ops.get(s.cct);
          const moneyStr = (o && o.ingreso > 0) ? formatMXN(o.ingreso) : '';
          const money = moneyStr ? (ok ? `<span style="color:#34D399">${moneyStr}</span>` : `<span style="color:#FFFFFF; opacity:0.6">${moneyStr}</span>`) : '';

          return `
          <div class="intel-tooltip-row ${ok ? '' : 'intel-tooltip-row-inactive'}">
            <div class="intel-tooltip-row-top">
              ${renderTurnoPillHTML(s.turno)}
              <div class="intel-tooltip-row-left">
                <span class="intel-tooltip-row-name" style="max-width:140px">${s.nombre || 'Sin nombre'} ${inRoute ? '· <span style="color:#34D399">en ruta</span>' : ''}</span>
                <span class="intel-tooltip-row-meta">${(s.alumnos || 0).toLocaleString()} al. · ${s.isPrivada ? 'Priv.' : 'Púb.'} · ${s.cct}</span>
              </div>
            </div>
            <div class="intel-tooltip-row-right">
              ${money}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }

  // Resumen Operativo Minimalista
  let totalBlock = '';
  if (passIngreso > 0) {
    totalBlock = `
      <div class="intel-tooltip-summary">
        <div class="intel-tooltip-row-left">
          <span class="intel-tooltip-row-meta">ALUMNOS</span>
          <span class="intel-tooltip-row-name" style="font-size:13px">${passAlumnos.toLocaleString()}</span>
        </div>
        ${passDias > 0 ? `
        <div class="intel-tooltip-row-left">
          <span class="intel-tooltip-row-meta">DÍAS DE OP.</span>
          <span class="intel-tooltip-row-name" style="font-size:13px;color:#C084FC">${passDias}</span>
        </div>
        <div class="intel-tooltip-row-left">
          <span class="intel-tooltip-row-meta">ING. / DÍA</span>
          <span class="intel-tooltip-row-right" style="font-size:13px;color:${metaPorDia > 0 ? (passIngreso/passDias >= metaPorDia ? '#34D399' : '#f87171') : '#e5e7eb'}">${formatMXN(passIngreso / passDias)}</span>
        </div>` : ''}
        <div class="intel-tooltip-row-left">
          <span class="intel-tooltip-row-meta">TOTAL</span>
          <span class="intel-tooltip-row-right" style="font-size:14px">${formatMXN(passIngreso)}</span>
        </div>
      </div>`;
  } else if (missIngreso > 0) {
    totalBlock = `
      <div class="intel-tooltip-summary" style="border-top-color:rgba(251,191,36,0.15)">
        <span class="intel-tooltip-row-meta" style="color:#FBBF24">Ninguna escuela pasa el filtro</span>
      </div>`;
  }

  const isInRoute = campusGroup.some(s => routeSet.has(s.cct));
  let routeBtn = '';
  if (isInRoute) {
    routeBtn = `<button disabled class="w-full mt-3 py-2 flex justify-center items-center gap-2 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase tracking-wider cursor-not-allowed border border-emerald-500/30"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> En Ruta</button>`;
  } else {
    const addables = campusGroup.filter(s => visibleCcts.has(s.cct) && !routeSet.has(s.cct));
    if (addables.length > 0) {
      const cctListStr = JSON.stringify(addables.map(s => s.cct)).replace(/"/g, "'");
      routeBtn = `<button onclick="event.stopPropagation(); window.__intelAddToRoute && window.__intelAddToRoute(${cctListStr}, event)" class="w-full mt-4 py-2.5 flex justify-center items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg> Agregar Campus a <span class="bg-white/20 px-1.5 py-0.5 rounded text-[11px] ml-0.5">${activeRouteName}</span></button>`;
    }
  }

  return `
    <div class="intel-tooltip-card intel-tooltip-campus relative">
      ${closeBtn}
      <div class="intel-tooltip-campus-header pr-6">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C084FC" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/></svg>
        <span class="intel-tooltip-campus-label">CAMPUS · ${niveles.length} nivel${niveles.length !== 1 ? 'es' : ''} · ${campusGroup.length} CCTs</span>
      </div>
      ${renderMunicipioChipHTML(municipio)}
      ${nivelSections}
      ${totalBlock}
      ${streetViewLink(campusGroup[0]?.latitud, campusGroup[0]?.longitud)}
      ${routeBtn}
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

function renderShapeToString(shape, fill, stroke) {
  const props = `width="24" height="24" viewBox="0 0 14 14" style="display:block;margin:auto;"`;
  switch (shape) {
    case 'triangle': return `<svg ${props}><polygon points="7,1 13,12 1,12" fill="${fill}" stroke="${stroke}" stroke-width="1.2" /></svg>`;
    case 'square':   return `<svg ${props}><rect x="2" y="2" width="10" height="10" rx="1" fill="${fill}" stroke="${stroke}" stroke-width="1.2" /></svg>`;
    case 'diamond':  return `<svg ${props}><polygon points="7,1 13,7 7,13 1,7" fill="${fill}" stroke="${stroke}" stroke-width="1.2" /></svg>`;
    case 'hexagon':  return `<svg ${props}><polygon points="7,1 12.5,4 12.5,10 7,13 1.5,10 1.5,4" fill="${fill}" stroke="${stroke}" stroke-width="1.2" /></svg>`;
    case 'star':     return `<svg ${props}><polygon points="7,1 8.8,5.2 13,5.6 9.8,8.4 10.8,13 7,10.6 3.2,13 4.2,8.4 1,5.6 5.2,5.2" fill="${fill}" stroke="${stroke}" stroke-width="0.8" /></svg>`;
    default:         return `<svg ${props}><circle cx="7" cy="7" r="5.5" fill="${fill}" stroke="${stroke}" stroke-width="1.2" /></svg>`;
  }
}

export default function IntelMap({
  schools = [],
  routes = [],
  activeRouteId = null,
  onRouteSelect,
  onRoutesChange,
  routeCCTs = [],
  onSchoolClick,
  onMapReady,
  children,
  mapInstanceRef,
  campusMap,
  focusedSchoolKey,
  onClearFocus,
  onAddToRoute,
  profitColors = null,
  turnoMap = null,
  prices = null,
  capacityConfig = null,
  metaPorDia = 0,
  bottomInset = 0,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const routeSetRef = useRef(new Set());
  const polylinesRef = useRef({}); // Track multiple polylines by route id
  const markersLayerRef = useRef(null);
  const tooltipRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const focusedMarkerLayerRef = useRef(null);
  const schoolsRef = useRef(schools);
  const isFirstLoad = useRef(true);

  const [heatmapActive, setHeatmapActive] = useState(false);
  const [heatPluginLoaded, setHeatPluginLoaded] = useState(false);

  const focusedSchoolKeyRef = useRef(focusedSchoolKey);
  useEffect(() => {
    focusedSchoolKeyRef.current = focusedSchoolKey;
  }, [focusedSchoolKey]);
  const profitColorsRef = useRef(profitColors);
  useEffect(() => { profitColorsRef.current = profitColors; }, [profitColors]);
  const turnoMapRef = useRef(turnoMap);
  useEffect(() => { turnoMapRef.current = turnoMap; }, [turnoMap]);
  const capacityRef = useRef(capacityConfig ? calculateCapacity(capacityConfig) : null);
  useEffect(() => { capacityRef.current = capacityConfig ? calculateCapacity(capacityConfig) : null; }, [capacityConfig]);
  const pricesRef = useRef(prices);
  useEffect(() => { pricesRef.current = prices; }, [prices]);
  const metaPorDiaRef = useRef(metaPorDia);
  useEffect(() => { metaPorDiaRef.current = metaPorDia; }, [metaPorDia]);

  useEffect(() => {
    const ccts = new Set();
    routes.forEach(r => r.ccts.forEach(cct => ccts.add(cct)));
    routeSetRef.current = ccts;
  }, [routes]);

  // Keep schools ref fresh for tooltip callbacks
  useEffect(() => {
    schoolsRef.current = schools;
  }, [schools]);

  // Configurar funciones globales de interacción para tooltips
  useEffect(() => {
    window.__intelClearFocus = onClearFocus;
    window.__intelAddToRoute = (ccts, e) => {
      // Lanzar animación visual
      if (e && typeof document !== 'undefined') {
        const target = document.getElementById('intel-mi-ruta-tab');
        if (target) {
          const rect = target.getBoundingClientRect();
          // Destino: centro del botón Mi Ruta
          const endX = rect.left + (rect.width / 2);
          const endY = rect.top + (rect.height / 2);

          const startX = e.clientX;
          const startY = e.clientY;

          const flyer = document.createElement('div');
          // Icono flotante morado/esmeralda para indicar movimiento
          flyer.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="text-white"><path d="M12 2L15 8L22 9L17 14L18.5 21L12 17.5L5.5 21L7 14L2 9L9 8L12 2Z"/></svg>`;
          flyer.className = 'fixed z-[9999] flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.8)] pointer-events-none';
          
          // Posición inicial absoluta
          flyer.style.left = '0px';
          flyer.style.top = '0px';
          // Usamos transform para mejor rendimiento
          flyer.style.transform = `translate(${startX - 16}px, ${startY - 16}px) scale(1)`;
          flyer.style.transition = 'transform 500ms cubic-bezier(0.25, 1, 0.5, 1), opacity 500ms ease-out';
          
          document.body.appendChild(flyer);
          
          // Forzar reflow
          flyer.getBoundingClientRect();
          
          // Viaje al destino
          flyer.style.transform = `translate(${endX - 16}px, ${endY - 16}px) scale(0.2) rotate(180deg)`;
          flyer.style.opacity = '0';
          
          setTimeout(() => {
            if (document.body.contains(flyer)) {
              document.body.removeChild(flyer);
            }
          }, 500);
        }
      }
      
      // Llamar al handler original
      onAddToRoute?.(ccts);
    };

    return () => {
      delete window.__intelClearFocus;
      delete window.__intelAddToRoute;
    };
  }, [onClearFocus, onAddToRoute]);

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
    const drawnCampuses = new Set();
    const drawnTurnos = new Set();

    schools.forEach(school => {
      if (school.latitud == null || school.longitud == null) return;

      const coordKey = `${school.latitud},${school.longitud}`;
      const campusGroup = campusMap?.get(coordKey);
      const isCampus = campusGroup && campusGroup.length >= 2;

      // Optimización: Dibujar la estrella de Campus una sola vez por coordenada
      if (isCampus) {
        if (drawnCampuses.has(coordKey)) return;
        drawnCampuses.add(coordKey);
      }

      // Doble turno: una locación con 2+ turnos → un solo marcador por coord.
      const turnoGroupAll = (!isCampus && turnoMapRef.current) ? turnoMapRef.current.get(coordKey) : null;
      const isTurno = !!turnoGroupAll;
      if (isTurno) {
        if (drawnTurnos.has(coordKey)) return;
        drawnTurnos.add(coordKey);
      }

      // Si es campus, está "en ruta" si alguna de sus escuelas está en ruta
      const isInRoute = isCampus
        ? campusGroup.some(s => routeSetRef.current.has(s.cct))
        : isTurno
          ? turnoGroupAll.some(s => routeSetRef.current.has(s.cct))
          : routeSetRef.current.has(school.cct);

      const style = getMarkerStyle(school, isInRoute, isCampus);

      // Anillo verde = esta ubicación tiene 2+ turnos que pasan los filtros activos.
      // Misma regla para turno Y campus (helper compartido = fuente única de verdad).
      const visibleCcts = new Set(schools.map(s => s.cct));
      if (!isInRoute) {
        const group = isTurno ? turnoGroupAll : isCampus ? campusGroup : null;
        if (contarTurnosQueCalifican(group, visibleCcts) >= 2) {
          style.weight = 3;
          style.color = '#34D399'; // borde esmeralda = doble oportunidad
          style.radius = Math.max(style.radius, 8);
        }
      }

      const markerKey = isCampus
        ? `${school.latitud},${school.longitud}_cmp`
        : isTurno
          ? `${school.latitud},${school.longitud}_trn`
          : school.cct;

      // ShapeMarker renders on Canvas — zero DOM overhead per point
      const marker = L.shapeMarker([school.latitud, school.longitud], {
        shape: style.shape,
        radius: style.radius,
        color: style.color,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
        weight: style.weight,
        _school: school,
        _markerKey: markerKey,
        _isCampus: isCampus,
        _isTurno: isTurno,
        _turnoGroup: turnoGroupAll,
      });

      marker.on('click', () => {
        onSchoolClick?.(school, isCampus, markerKey);
      });

      marker.on('mouseover', (e) => {
        // Skip hover if this marker is exactly the one currently focused
        if (focusedSchoolKeyRef.current === markerKey) return;

        clearTimeout(hideTimeoutRef.current);
        const tooltip = tooltipRef.current;
        if (!tooltip) return;

        // Build tooltip HTML
        if (isCampus) {
          tooltip.innerHTML = buildCampusTooltip(campusGroup, new Set(schools.map(s => s.cct)), routeSetRef.current, capacityRef.current, pricesRef.current, metaPorDiaRef.current);
        } else if (isTurno) {
          tooltip.innerHTML = buildTurnoTooltip(turnoGroupAll, new Set(schools.map(s => s.cct)), routeSetRef.current, capacityRef.current, pricesRef.current, metaPorDiaRef.current);
        } else {
          tooltip.innerHTML = buildSchoolTooltip(school, routeSetRef.current, profitColorsRef.current, metaPorDiaRef.current);
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
  }, [schools, onSchoolClick, campusMap, profitColors, turnoMap]);

  // ═══ Sync focused school (Pop & Elevate) ═══
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !markersLayerRef.current) return;

    if (focusedMarkerLayerRef.current) {
      map.removeLayer(focusedMarkerLayerRef.current);
      focusedMarkerLayerRef.current = null;
    }
    
    const tooltip = tooltipRef.current;
    if (tooltip && hideTimeoutRef.current) {
       tooltip.style.display = 'none';
       tooltip.style.opacity = '0';
    }

    if (!focusedSchoolKey) return;

    let targetMarker = null;
    markersLayerRef.current.eachLayer((layer) => {
      if (layer.options && layer.options._markerKey === focusedSchoolKey) {
        targetMarker = layer;
      }
    });

    if (targetMarker) {
      const school = targetMarker.options._school;
      const isCampus = targetMarker.options._isCampus;
      const isTurno = targetMarker.options._isTurno;
      const turnoGroup = targetMarker.options._turnoGroup;
      const campusGroup = isCampus ? campusMap?.get(focusedSchoolKey.replace('_cmp', '')) : null;
      const style = getMarkerStyle(school, routeSetRef.current.has(school.cct), isCampus);

      // Ocultar temporalmente el marcador original del canvas para que no se asome por debajo
      if (targetMarker && targetMarker.setStyle) {
        targetMarker.setStyle({ opacity: 0, fillOpacity: 0, weight: 0 });
      }

      const svgHtml = renderShapeToString(style.shape, style.fillColor, style.color);
      
      // Iniciamos en escala 1 para que la animación CSS se note fluidamente
      const divIcon = L.divIcon({
        className: 'intel-focused-marker',
        html: `<div class="intel-focused-marker-inner" style="filter: drop-shadow(0 10px 15px rgba(0,0,0,0.8)) drop-shadow(0 4px 6px rgba(0,0,0,0.6)); transform: scale(1) translateY(0px); transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); transform-origin: bottom center;">${svgHtml}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12] // Center the SVG over the point
      });

      focusedMarkerLayerRef.current = L.marker([school.latitud, school.longitud], { icon: divIcon, interactive: false });
      focusedMarkerLayerRef.current.addTo(map);

      // Disparamos la animación en el siguiente frame
      requestAnimationFrame(() => {
        if (focusedMarkerLayerRef.current) {
          const inner = focusedMarkerLayerRef.current.getElement()?.querySelector('.intel-focused-marker-inner');
          if (inner) {
            inner.style.transform = 'scale(1.7) translateY(-4px)';
          }
        }
      });

      // Native Leaflet Tooltip for physical anchoring
      const activeName = routes.find(r => r.id === activeRouteId)?.name || 'Mi Ruta';
      const tooltipContent = isCampus
        ? buildCampusTooltip(campusGroup || [school], new Set(schoolsRef.current.map(s => s.cct)), routeSetRef.current, capacityRef.current, pricesRef.current, metaPorDiaRef.current, activeName)
        : isTurno && turnoGroup
          ? buildTurnoTooltip(turnoGroup, new Set(schoolsRef.current.map(s => s.cct)), routeSetRef.current, capacityRef.current, pricesRef.current, metaPorDiaRef.current, activeName)
          : buildSchoolTooltip(school, routeSetRef.current, profitColorsRef.current, metaPorDiaRef.current, activeName);
      
      focusedMarkerLayerRef.current.bindTooltip(tooltipContent, {
        permanent: true,
        direction: 'top',
        className: 'intel-native-tooltip intel-native-tooltip-interactive',
        interactive: true,
        offset: [0, -32],
        opacity: 1
      });

      // Limpieza: restaurar el marcador original cuando se quita el foco
      return () => {
        if (targetMarker && targetMarker.setStyle) {
          targetMarker.setStyle({ 
            opacity: style.color === 'transparent' ? 0 : 1, 
            fillOpacity: style.fillOpacity,
            weight: style.weight
          });
        }
      };
    }
  }, [focusedSchoolKey, campusMap, profitColors, activeRouteId, routes]);

  // ═══ Route polylines ═══
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear all existing polylines
    Object.values(polylinesRef.current).forEach(line => {
      map.removeLayer(line);
    });
    polylinesRef.current = {};

    const schoolMap = new Map();
    schools.forEach(s => schoolMap.set(s.cct, s));

    // Render each visible route
    routes.forEach(route => {
      if (!route.visible || route.ccts.length < 2) return;

      const latlngs = route.ccts
        .map(cct => schoolMap.get(cct))
        .filter(s => s && s.latitud && s.longitud)
        .map(s => [s.latitud, s.longitud]);

      if (latlngs.length >= 2) {
        const isActive = route.id === activeRouteId;
        const line = L.polyline(latlngs, {
          color: route.color || '#10B981',
          weight: isActive ? 4 : 2,
          dashArray: isActive ? '8 6' : '4 8',
          opacity: isActive ? 1 : 0.4,
          lineCap: 'round',
        }).addTo(map);
        
        polylinesRef.current[route.id] = line;
      }
    });
  }, [schools, routes, activeRouteId]);

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
    <div className="relative flex-1 h-full intel-map" style={{ '--intel-map-bottom-inset': `${bottomInset}px` }}>
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
        <div className="absolute left-4 bottom-4 z-[1000]">
          <div className="intel-glass rounded-xl px-3 py-2.5 w-48 space-y-1.5">
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">Leyenda</p>

            {/* Nivel shapes — only show niveles present in data */}
            {Object.entries(NIVEL_SHAPES)
              .filter(([key]) => schools.some(s => (s.nivelEducativo || '').toUpperCase() === key))
              .map(([key, shape]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-[9px] text-gray-300 font-bold truncate flex-1" title={key}>{key}</span>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1" title="Pública">
                      <LegendShape shape={shape} fill={PUBLICA_COLOR.fill} stroke={PUBLICA_COLOR.stroke} />
                      <span className="text-[8px] text-gray-500">Púb</span>
                    </div>
                    <div className="flex items-center gap-1" title="Privada">
                      <LegendShape shape={shape} fill={PRIVADA_COLOR.fill} stroke={PRIVADA_COLOR.stroke} />
                      <span className="text-[8px] text-gray-500">Priv</span>
                    </div>
                  </div>
                </div>
              ))
            }

            {/* Campus */}
            {campusMap && campusMap.size > 0 && (
              <div className="flex items-center gap-2 pt-1.5 border-t border-white/[0.05]">
                <LegendShape shape="star" fill={CAMPUS_COLOR.fill} stroke={CAMPUS_COLOR.stroke} />
                <span className="text-[9px] text-gray-300 font-medium">Campus <span className="text-gray-500">({campusMap.size})</span></span>
              </div>
            )}

            {/* Doble turno */}
            {turnoMap && turnoMap.size > 0 && (
              <div className="flex items-start gap-2 pt-1.5 border-t border-white/[0.05]">
                <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full shrink-0 mt-0.5" style={{ border: '2px solid #34D399' }} />
                <div className="flex flex-col">
                  <span className="text-[9px] text-gray-300 font-medium">Doble turno</span>
                  <span className="text-[8px] text-gray-500 leading-tight">2+ turnos que pasan filtros en esta locación.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
