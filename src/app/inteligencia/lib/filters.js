// ═══════════════════════════════════════════════════════════════
// filters.js — Pure functions for filtering and financial calcs
// ═══════════════════════════════════════════════════════════════

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

  // Revenue filter — independent for públicas y privadas
  if (prices) {
    result = result.filter(s => {
      const price = s.isPrivada ? (prices.premium || 0) : (prices.base || 0);
      const coordKey = `${s.latitud},${s.longitud}`;
      const effectiveAlumnos = (s.isPrivada && campusCCTs.has(s.cct)) ? (campusTotals.get(coordKey) || s.alumnos) : s.alumnos;
      const revenue = (effectiveAlumnos || 0) * price;
      if (s.isPrivada) {
        if (filters.revenueMinPriv != null && revenue < filters.revenueMinPriv) return false;
        if (filters.revenueMaxPriv != null && revenue > filters.revenueMaxPriv) return false;
      } else {
        if (filters.revenueMinPub != null && revenue < filters.revenueMinPub) return false;
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
