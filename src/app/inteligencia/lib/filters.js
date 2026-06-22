// ═══════════════════════════════════════════════════════════════
// filters.js — Pure functions for filtering and financial calcs
// ═══════════════════════════════════════════════════════════════
import { Sun, Sunset, Moon, Clock, CloudSun } from 'lucide-react';

export const TURNO_SVG = {
  SUN: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  SUNSET: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>`,
  MOON: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  CLOCK: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
};

export function getTurnoStyles(turno) {
  const u = (turno || '').toUpperCase();
  if (u === 'MATUTINO') {
    return {
      label: 'Matutino',
      short: 'Mat.',
      gradientClass: 'bg-gradient-to-b from-blue-400 to-sky-400',
      textClass: 'text-white',
      shadowClass: 'shadow-md shadow-blue-500/20',
      borderClass: 'border-blue-400/30',
      IconComponent: Sun,
      svg: TURNO_SVG.SUN
    };
  }
  if (u === 'VESPERTINO') {
    return {
      label: 'Vespertino',
      short: 'Vesp.',
      gradientClass: 'bg-gradient-to-b from-orange-400 to-rose-400',
      textClass: 'text-white',
      shadowClass: 'shadow-md shadow-orange-500/20',
      borderClass: 'border-orange-400/30',
      IconComponent: Sunset,
      svg: TURNO_SVG.SUNSET
    };
  }
  if (u === 'NOCTURNO') {
    return {
      label: 'Nocturno',
      short: 'Noct.',
      gradientClass: 'bg-gradient-to-b from-slate-800 to-slate-900',
      textClass: 'text-white',
      shadowClass: 'shadow-md shadow-slate-900/30',
      borderClass: 'border-slate-700/50',
      IconComponent: Moon,
      svg: TURNO_SVG.MOON
    };
  }
  return {
    label: u ? u.charAt(0) + u.slice(1).toLowerCase() : 'N/A',
    short: u ? u.substring(0, 4) + '.' : 'N/A',
    gradientClass: 'bg-gradient-to-b from-gray-500 to-gray-600',
    textClass: 'text-white',
    shadowClass: 'shadow-md shadow-gray-600/20',
    borderClass: 'border-gray-500/30',
    IconComponent: Clock,
    svg: TURNO_SVG.CLOCK
  };
}

export function renderTurnoPillHTML(turno, extraText = '') {
  const st = getTurnoStyles(turno);
  return `
    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded ${st.gradientClass} ${st.textClass} ${st.borderClass} ${st.shadowClass} border" style="text-shadow: 0px 1px 2px rgba(0,0,0,0.2);">
      ${st.svg} ${st.short} ${extraText}
    </span>
  `;
}

/**
 * Apply all active filters to the schools array.
 * @param {Object[]} schools
 * @param {Object} filters - { municipio, sostenimiento, turno, alumnosMinPub, alumnosMaxPub, alumnosMinPriv, alumnosMaxPriv, revenueMinPub, revenueMaxPub, revenueMinPriv, revenueMaxPriv }
 * @param {Object} [prices] - { premium, base }
 * @param {Set} [campusCCTs] - Set of CCTs that belong to a campus
 * @param {Map} [campusTotals] - Map of coordKey -> total enrollment
 * @returns {Object[]}
 */
export function applyFilters(schools, filters, prices = null, campusCCTs = new Set(), campusTotals = new Map()) {
  let result = schools;

  // Municipio filter
  if (filters.municipio && filters.municipio !== '__all__') {
    const target = filters.municipio.toUpperCase();
    result = result.filter(s => (s.municipio || '').toUpperCase() === target);
  }

  // Sostenimiento filter: 'todas' | 'publicas' | 'privadas'
  if (filters.sostenimiento && filters.sostenimiento !== 'todas') {
    if (filters.sostenimiento === 'privadas') {
      result = result.filter(s => s.isPrivada);
    } else if (filters.sostenimiento === 'publicas') {
      result = result.filter(s => !s.isPrivada);
    }
  }

  // Turno filter
  if (filters.turno && filters.turno !== '__all__') {
    const target = filters.turno.toUpperCase();
    result = result.filter(s => (s.turno || '').toUpperCase() === target);
  }

  // Matrícula range filter — independent for públicas y privadas
  result = result.filter(s => {
    if (s.isPrivada) {
      const coordKey = `${s.latitud},${s.longitud}`;
      const effectiveAlumnos = campusCCTs.has(s.cct) ? (campusTotals.get(coordKey) || s.alumnos) : s.alumnos;
      if (filters.alumnosMinPriv != null && effectiveAlumnos < filters.alumnosMinPriv) return false;
      if (filters.alumnosMaxPriv != null && effectiveAlumnos > filters.alumnosMaxPriv) return false;
    } else {
      if (filters.alumnosMinPub != null && s.alumnos < filters.alumnosMinPub) return false;
      if (filters.alumnosMaxPub != null && s.alumnos > filters.alumnosMaxPub) return false;
    }
    return true;
  });

  // Nivel educativo filter
  if (filters.nivelEducativo && filters.nivelEducativo !== '__all__') {
    const target = filters.nivelEducativo.toUpperCase();
    result = result.filter(s => (s.nivelEducativo || '').toUpperCase() === target);
  }

  // Revenue filter — independent for públicas y privadas.
  // The MÍNIMO can be more permissive for VESPERTINO shifts (own floor);
  // the MÁXIMO is shared across shifts.
  if (prices) {
    result = result.filter(s => {
      const price = s.isPrivada ? (prices.premium || 0) : (prices.base || 0);
      const coordKey = `${s.latitud},${s.longitud}`;
      const effectiveAlumnos = (s.isPrivada && campusCCTs.has(s.cct)) ? (campusTotals.get(coordKey) || s.alumnos) : s.alumnos;
      const revenue = (effectiveAlumnos || 0) * price;
      const isVesp = (s.turno || '').toUpperCase() === 'VESPERTINO';
      if (s.isPrivada) {
        const min = (isVesp && filters.revenueMinPrivVesp != null) ? filters.revenueMinPrivVesp : filters.revenueMinPriv;
        if (min != null && revenue < min) return false;
        if (filters.revenueMaxPriv != null && revenue > filters.revenueMaxPriv) return false;
      } else {
        const min = (isVesp && filters.revenueMinPubVesp != null) ? filters.revenueMinPubVesp : filters.revenueMinPub;
        if (min != null && revenue < min) return false;
        if (filters.revenueMaxPub != null && revenue > filters.revenueMaxPub) return false;
      }
      return true;
    });
  }

  return result;
}

/**
 * Calculate TAM (Total Addressable Market)
 * @param {Object[]} filteredSchools
 * @param {{ premium: number, base: number }} prices
 * @returns {{ totalStudents, totalValue, publicStudents, publicValue, privateStudents, privateValue }}
 */
export function calculateTAM(filteredSchools, prices) {
  let publicStudents = 0;
  let privateStudents = 0;
  let publicSchools = 0;
  let privateSchools = 0;

  for (const s of filteredSchools) {
    if (s.isPrivada) {
      privateStudents += s.alumnos;
      privateSchools++;
    } else {
      publicStudents += s.alumnos;
      publicSchools++;
    }
  }

  const publicValue = publicStudents * (prices.base || 0);
  const privateValue = privateStudents * (prices.premium || 0);

  return {
    totalStudents: publicStudents + privateStudents,
    totalValue: publicValue + privateValue,
    publicStudents,
    publicValue,
    publicSchools,
    privateStudents,
    privateValue,
    privateSchools,
    totalSchools: filteredSchools.length,
  };
}

/**
 * Calculate SOM (Serviceable Obtainable Market)
 * @param {{ totalStudents, totalValue }} tam
 * @param {number} percentage - e.g., 30 for 30%
 * @returns {{ students, value }}
 */
export function calculateSOM(tam, percentage = 30) {
  const factor = percentage / 100;
  return {
    students: Math.round(tam.totalStudents * factor),
    value: Math.round(tam.totalValue * factor),
  };
}

/**
 * Get sorted unique municipios from schools array.
 */
export function getUniqueMunicipios(schools) {
  const set = new Set();
  for (const s of schools) {
    if (s.municipio) set.add(s.municipio.toUpperCase());
  }
  return [...set].sort();
}

/**
 * Get sorted unique turnos from schools array.
 */
export function getUniqueTurnos(schools) {
  const set = new Set();
  for (const s of schools) {
    if (s.turno) set.add(s.turno.toUpperCase());
  }
  return [...set].sort();
}

/**
 * Get sorted unique niveles educativos from schools array.
 */
export function getUniqueNiveles(schools) {
  const set = new Set();
  for (const s of schools) {
    if (s.nivelEducativo) set.add(s.nivelEducativo.toUpperCase());
  }
  return [...set].sort();
}

/**
 * Get the min and max student count from schools.
 */
export function getStudentRange(schools) {
  if (!schools.length) return { min: 0, max: 500 };
  let min = Infinity, max = -Infinity;
  for (const s of schools) {
    if (s.alumnos < min) min = s.alumnos;
    if (s.alumnos > max) max = s.alumnos;
  }
  return { min, max };
}

/**
 * Get min/max student count split by públicas and privadas.
 */
export function getStudentRangeByType(schools, campusCCTs = new Set(), campusTotals = new Map()) {
  let pubMin = Infinity, pubMax = -Infinity;
  let privMin = Infinity, privMax = -Infinity;

  for (const s of schools) {
    if (s.isPrivada) {
      const coordKey = `${s.latitud},${s.longitud}`;
      const effectiveAlumnos = campusCCTs.has(s.cct) ? (campusTotals.get(coordKey) || s.alumnos) : s.alumnos;
      if (effectiveAlumnos < privMin) privMin = effectiveAlumnos;
      if (effectiveAlumnos > privMax) privMax = effectiveAlumnos;
    } else {
      if (s.alumnos < pubMin) pubMin = s.alumnos;
      if (s.alumnos > pubMax) pubMax = s.alumnos;
    }
  }

  return {
    pub: { min: pubMin === Infinity ? 0 : pubMin, max: pubMax === -Infinity ? 500 : pubMax },
    priv: { min: privMin === Infinity ? 0 : privMin, max: privMax === -Infinity ? 500 : privMax },
  };
}

/**
 * Get the min and max possible revenue split by públicas and privadas.
 * @param {Object[]} schools
 * @param {Object} prices
 */
export function getRevenueRangeByType(schools, prices, campusCCTs = new Set(), campusTotals = new Map()) {
  if (!schools.length || !prices) return {
    pub: { min: 0, max: 100000 },
    priv: { min: 0, max: 100000 },
  };
  let pubMin = Infinity, pubMax = -Infinity;
  let privMin = Infinity, privMax = -Infinity;
  for (const s of schools) {
    if (s.isPrivada) {
      const coordKey = `${s.latitud},${s.longitud}`;
      const effectiveAlumnos = campusCCTs.has(s.cct) ? (campusTotals.get(coordKey) || s.alumnos) : s.alumnos;
      const rev = (effectiveAlumnos || 0) * (prices.premium || 0);
      if (rev < privMin) privMin = rev;
      if (rev > privMax) privMax = rev;
    } else {
      const rev = (s.alumnos || 0) * (prices.base || 0);
      if (rev < pubMin) pubMin = rev;
      if (rev > pubMax) pubMax = rev;
    }
  }
  return {
    pub: { min: pubMin === Infinity ? 0 : pubMin, max: pubMax === -Infinity ? 100000 : pubMax },
    priv: { min: privMin === Infinity ? 0 : privMin, max: privMax === -Infinity ? 100000 : privMax },
  };
}

/**
 * Calculate route-specific metrics
 * @param {Object[]} routeSchools - Schools in the route
 * @param {{ premium: number, base: number }} prices
 * @returns {Object}
 */
export function calculateRouteMetrics(routeSchools, prices) {
  const tam = calculateTAM(routeSchools, prices);
  return {
    totalSchools: routeSchools.length,
    totalStudents: tam.totalStudents,
    publicSchools: routeSchools.filter(s => !s.isPrivada).length,
    privateSchools: routeSchools.filter(s => s.isPrivada).length,
    publicStudents: tam.publicStudents,
    privateStudents: tam.privateStudents,
    totalValue: tam.totalValue,
  };
}

// ═══════════════════════════════════════════════════════════════
// Capacity engine — operational throughput of the flight team
// Derived from real flight-log audit (1063 vuelos, ene–may 2026):
//   vuelo ~6.3min · cambio ~3.3min · ~11 plazas · ~56 niños/h reales
// ═══════════════════════════════════════════════════════════════

/** Default config seeded from the real flight-log audit. */
export const CAPACITY_DEFAULTS = {
  plazas: 11,           // gafas/asientos por tanda
  tiempoVueloMin: 6.5,  // duración de cada vuelo (min)
  tiempoCambioMin: 3.5, // cambio entre vuelos (min)
  horasUtilPub: 4,      // horas operables en pública (salen antes)
  horasUtilPriv: 5.5,   // horas operables en privada (~1.5h más)
  minPorDiaPub: 0,      // meta de ingreso mínimo por día — pública (0 = sin meta)
  minPorDiaPriv: 0,     // meta de ingreso mínimo por día — privada
  modePub: 'escuela',   // 'escuela' (filtra por ingreso total) | 'dia' (meta por día)
  modePriv: 'escuela',
};

/**
 * Compute team throughput from the config knobs.
 * @param {Object} config - { plazas, tiempoVueloMin, tiempoCambioMin, horasUtilPub, horasUtilPriv }
 * @returns {{ cicloMin, ninosPorHora, ninosPorDiaPub, ninosPorDiaPriv }}
 */
export function calculateCapacity(config = CAPACITY_DEFAULTS) {
  const plazas = Math.max(1, config.plazas || 1);
  const cicloMin = Math.max(0.5, (config.tiempoVueloMin || 0) + (config.tiempoCambioMin || 0));
  const ninosPorHora = plazas * (60 / cicloMin);
  return {
    cicloMin,
    ninosPorHora,
    ninosPorDiaPub: ninosPorHora * Math.max(0, config.horasUtilPub || 0),
    ninosPorDiaPriv: ninosPorHora * Math.max(0, config.horasUtilPriv || 0),
  };
}

/**
 * Estimate operational days, revenue and revenue-per-team-day for one school.
 * Uses campus-aggregated enrollment for privadas (mirrors applyFilters).
 * @param {Object} school
 * @param {Object} capacity - result of calculateCapacity()
 * @param {{ premium:number, base:number }} prices
 * @param {Set} [campusCCTs]
 * @param {Map} [campusTotals]
 * @returns {{ alumnos, dias, ingreso, ingresoPorDia, ninosPorDia, isPriv }}
 */
export function estimateSchoolOps(school, capacity, prices, campusCCTs = new Set(), campusTotals = new Map()) {
  const isPriv = !!school.isPrivada;
  const coordKey = `${school.latitud},${school.longitud}`;
  const alumnos = (isPriv && campusCCTs.has(school.cct))
    ? (campusTotals.get(coordKey) || school.alumnos || 0)
    : (school.alumnos || 0);

  const ninosPorDia = isPriv ? capacity.ninosPorDiaPriv : capacity.ninosPorDiaPub;
  const dias = ninosPorDia > 0 ? Math.max(1, Math.ceil(alumnos / ninosPorDia)) : Infinity;
  const precio = isPriv ? (prices.premium || 0) : (prices.base || 0);
  const ingreso = alumnos * precio;
  const ingresoPorDia = (isFinite(dias) && dias > 0) ? ingreso / dias : 0;

  return { alumnos, dias, ingreso, ingresoPorDia, ninosPorDia, isPriv };
}

/**
 * Single source of truth for the "doble turno" indicator (green ring / badge).
 * Counts DISTINCT shifts at one location among the schools that pass the
 * active filters. Used identically by the map marker and the distribution list.
 *
 * @param {Object[]} group - all schools at a coordinate (turno group or campus group)
 * @param {Set<string>} visibleCcts - CCTs that currently pass the filters
 * @returns {number} distinct qualifying shifts (2+ = double-shift opportunity)
 */
export function contarTurnosQueCalifican(group, visibleCcts) {
  if (!group || !group.length) return 0;
  const turnos = new Set(
    group
      .filter(s => visibleCcts.has(s.cct) && s.turno)
      .map(s => s.turno.toUpperCase())
  );
  return turnos.size;
}

/**
 * Build a per-CCT profitability map for the "Variables" view.
 * Colors stay as-is (source of truth); we only return an OPACITY per school
 * (rentable = bright, poco rentable = dim) plus the ops numbers for tooltips.
 * @param {Object[]} schools - already filtered schools
 * @param {Object} capacity - result of calculateCapacity()
 * @param {{ premium:number, base:number }} prices
 * @param {Set} campusCCTs
 * @param {Map} campusTotals
 * @returns {Map<string, { opacity:number, rank:number, dias:number, ingreso:number, ingresoPorDia:number, alumnos:number }>}
 */
export function buildProfitabilityColors(schools, capacity, prices, campusCCTs = new Set(), campusTotals = new Map()) {
  const map = new Map();
  const rows = schools
    .filter(s => s.cct && s.latitud != null && s.longitud != null && (s.alumnos || 0) > 0)
    .map(s => ({ cct: s.cct, ...estimateSchoolOps(s, capacity, prices, campusCCTs, campusTotals) }))
    .filter(r => isFinite(r.ingresoPorDia) && r.ingresoPorDia > 0)
    .sort((a, b) => a.ingresoPorDia - b.ingresoPorDia);

  if (rows.length === 0) return map;

  // Opacity ramp by percentile rank: poco rentable = 0.15 (atenuada),
  // muy rentable = 1.0 (nítida). Color/shape NEVER change.
  const MIN_OPACITY = 0.15;
  const MAX_OPACITY = 1.0;
  const n = rows.length;
  rows.forEach((r, i) => {
    const pct = n === 1 ? 1 : i / (n - 1); // 0..1 ascending by $/day
    const opacity = MIN_OPACITY + (MAX_OPACITY - MIN_OPACITY) * pct;
    map.set(r.cct, {
      opacity,
      rank: pct,
      dias: r.dias,
      ingreso: r.ingreso,
      ingresoPorDia: r.ingresoPorDia,
      alumnos: r.alumnos,
    });
  });
  return map;
}

/**
 * Children the team can fly per hour for a given goggle count + cadence.
 */
export function ninosPorHora(plazas, tiempoVueloMin, tiempoCambioMin) {
  const p = Math.max(1, plazas || 1);
  const ciclo = Math.max(0.5, (tiempoVueloMin || 0) + (tiempoCambioMin || 0));
  return p * (60 / ciclo);
}

/**
 * Inverse solver: how many goggles are needed to hit a daily revenue goal,
 * given the operating hours and price per child for that school type.
 * Returns null if the goal is 0/unset, Infinity-safe integer otherwise.
 * @param {number} metaPorDia - target MXN per team-day
 * @param {number} horas - useful operating hours that day
 * @param {number} precio - price per child (base or premium)
 * @param {number} tiempoVueloMin
 * @param {number} tiempoCambioMin
 * @returns {number|null}
 */
export function gafasNecesarias(metaPorDia, horas, precio, tiempoVueloMin, tiempoCambioMin) {
  if (!metaPorDia || metaPorDia <= 0 || !precio || precio <= 0 || !horas || horas <= 0) return null;
  const ciclo = Math.max(0.5, (tiempoVueloMin || 0) + (tiempoCambioMin || 0));
  // niños/día = plazas * (60/ciclo) * horas ; ingreso/día = niños/día * precio
  // => plazas = meta / (precio * (60/ciclo) * horas)
  const ninosNecesariosDia = metaPorDia / precio;
  const ninosPorPlazaDia = (60 / ciclo) * horas;
  return Math.max(1, Math.ceil(ninosNecesariosDia / ninosPorPlazaDia));
}

/**
 * Build a per-day operating plan for one school, two ways:
 *  - "aTope": fill each day to capacity; last day may be a short/low day
 *  - "parejo": spread evenly across the minimum days so every day is balanced
 * Flags whether each strategy clears the per-day minimum revenue.
 * @returns {{
 *   alumnos, ninosPorDia, precio, isPriv, dias,
 *   aTope: number[], parejo: number[],
 *   aTopeOK: boolean, parejoOK: boolean,
 *   ingresoDiaParejo: number, veredicto: 'rentable'|'al-dividir'|'no-rentable',
 *   gafasNecesarias: number|null
 * }}
 */
export function buildSchoolDayPlan(school, config, prices, minPorDia, campusCCTs = new Set(), campusTotals = new Map()) {
  const isPriv = !!school.isPrivada;
  const coordKey = `${school.latitud},${school.longitud}`;
  const alumnos = (isPriv && campusCCTs.has(school.cct))
    ? (campusTotals.get(coordKey) || school.alumnos || 0)
    : (school.alumnos || 0);

  const horas = isPriv ? config.horasUtilPriv : config.horasUtilPub;
  const precio = isPriv ? (prices.premium || 0) : (prices.base || 0);
  const capDia = Math.floor(ninosPorHora(config.plazas, config.tiempoVueloMin, config.tiempoCambioMin) * Math.max(0, horas || 0));
  const min = minPorDia || 0;

  if (capDia <= 0 || alumnos <= 0) {
    return { alumnos, ninosPorDia: capDia, precio, isPriv, dias: 0, aTope: [], parejo: [],
      aTopeOK: false, parejoOK: false, ingresoDiaParejo: 0, veredicto: 'no-rentable', gafasNecesarias: null };
  }

  const dias = Math.max(1, Math.ceil(alumnos / capDia));

  // aTope: fill capDia each day, remainder on the last
  const aTope = [];
  let rest = alumnos;
  for (let i = 0; i < dias; i++) { const d = Math.min(capDia, rest); aTope.push(d); rest -= d; }

  // parejo: spread evenly across the same number of days
  const base = Math.floor(alumnos / dias);
  let extra = alumnos - base * dias;
  const parejo = Array.from({ length: dias }, () => { const v = base + (extra > 0 ? 1 : 0); if (extra > 0) extra--; return v; });

  const ingresoDiaMin = (arr) => Math.min(...arr) * precio;
  const aTopeOK = min <= 0 ? true : ingresoDiaMin(aTope) >= min;
  const parejoOK = min <= 0 ? true : ingresoDiaMin(parejo) >= min;
  const ingresoDiaParejo = parejo.length ? parejo[parejo.length - 1] * precio : 0;

  let veredicto = 'rentable';
  if (min > 0) {
    if (aTopeOK && parejoOK) veredicto = 'rentable';
    else if (parejoOK) veredicto = 'al-dividir';
    else veredicto = 'no-rentable';
  }

  // If not rentable even balanced, how many goggles would fix it?
  let gafas = null;
  if (min > 0 && !parejoOK) {
    gafas = gafasNecesarias(min, horas, precio, config.tiempoVueloMin, config.tiempoCambioMin);
  }

  return { alumnos, ninosPorDia: capDia, precio, isPriv, dias, aTope, parejo,
    aTopeOK, parejoOK, ingresoDiaParejo, veredicto, gafasNecesarias: gafas };
}

/**
 * Format a number as MXN currency
 */
export function formatMXN(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number with commas
 */
export function formatNumber(value) {
  return new Intl.NumberFormat('es-MX').format(value);
}
