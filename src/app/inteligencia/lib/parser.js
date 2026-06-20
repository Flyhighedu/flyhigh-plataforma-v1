// ═══════════════════════════════════════════════════════════════
// parser.js — Excel/CSV Parser with 37-column SIGED auto-mapper
// 100% client-side. Zero network calls.
// ═══════════════════════════════════════════════════════════════

// NOTE: xlsx-js-style uses CJS — must be loaded via dynamic import (see parseFile)

// ─── Column mapping definitions ───
// Each mapping has: internalKey, priority keywords (must match), negative keywords (must NOT match)
const COLUMN_MAP = [
  // === PRIMARY COLUMNS (8) ===
  { key: 'cct',              must: ['clave'],      prefer: ['centro', 'trabajo'],  not: ['turno', 'entidad', 'municipio', 'localidad'] },
  { key: 'turno',            must: ['turno'],      prefer: ['nombre'],             not: ['clave'] },
  { key: 'nombre',           must: ['nombre'],     prefer: ['centro', 'trabajo'],  not: ['turno', 'control', 'entidad', 'municipio', 'localidad', 'colonia', 'sostenimiento'] },
  { key: 'sostenimiento',    must: ['control'],    prefer: ['público', 'privado', 'publico'],  not: [] },
  { key: 'municipio',        must: ['municipio'],  prefer: ['nombre'],             not: ['clave'] },
  { key: 'alumnos',          must: ['alumnos', 'total'], prefer: [],               not: ['hombres', 'mujeres'] },
  { key: 'longitud',         must: ['grados'],     prefer: ['oeste', 'meridiano', 'greenwich'], not: ['minutos', 'segundos'] },
  { key: 'latitud',          must: ['grados'],     prefer: ['norte', 'ecuador'],   not: ['minutos', 'segundos'] },

  // === SECONDARY COLUMNS (29) ===
  { key: 'claveTurno',       must: ['clave', 'turno'],  prefer: [],                not: ['centro', 'trabajo'] },
  { key: 'tipoEducativo',    must: ['tipo', 'educativo'], prefer: [],              not: ['servicio', 'sostenimiento'] },
  { key: 'nivelEducativo',   must: ['nivel', 'educativo'], prefer: [],             not: [] },
  { key: 'servicioEducativo', must: ['servicio', 'educativo'], prefer: [],          not: [] },
  { key: 'tipoSostenimiento', must: ['tipo', 'sostenimiento'], prefer: [],          not: [] },
  { key: 'claveEntidad',     must: ['clave', 'entidad'], prefer: [],               not: ['municipio'] },
  { key: 'entidad',          must: ['nombre', 'entidad'], prefer: [],              not: ['clave'] },
  { key: 'claveMunicipio',   must: ['clave', 'municipio'], prefer: [],             not: ['entidad'] },
  { key: 'claveLocalidad',   must: ['clave', 'localidad'], prefer: [],             not: [] },
  { key: 'localidad',        must: ['nombre', 'localidad'], prefer: [],            not: ['clave'] },
  { key: 'domicilio',        must: ['domicilio'], prefer: [],                       not: [] },
  { key: 'numeroExterior',   must: ['número', 'exterior'], prefer: [],             not: [] },
  { key: 'entreCalle',       must: ['entre'],     prefer: ['calle'],               not: [] },
  { key: 'yCalle',           must: ['y la calle'], prefer: [],                     not: [] },
  { key: 'callePosterior',   must: ['posterior'], prefer: ['calle'],               not: [] },
  { key: 'claveColonia',     must: ['colonia'],   prefer: [],                       not: ['nombre'] },
  { key: 'colonia',          must: ['nombre', 'colonia'], prefer: [],              not: [] },
  { key: 'codigoPostal',     must: ['código', 'postal'], prefer: [],               not: [] },
  { key: 'paginaWeb',        must: ['página', 'web'], prefer: [],                  not: [] },
  { key: 'alumnosHombres',   must: ['alumnos'],   prefer: ['hombres'],             not: ['mujeres', 'docentes'] },
  { key: 'alumnosMujeres',   must: ['alumnos'],   prefer: ['mujeres'],             not: ['hombres', 'docentes'] },
  { key: 'docentesHombres',  must: ['docentes'],  prefer: ['hombres'],             not: ['mujeres', 'alumnos'] },
  { key: 'docentesMujeres',  must: ['docentes'],  prefer: ['mujeres'],             not: ['hombres', 'alumnos'] },
  { key: 'docentes',         must: ['docentes', 'total'], prefer: [],              not: ['hombres', 'mujeres'] },
  { key: 'aulasEnUso',       must: ['aulas', 'uso'], prefer: [],                   not: ['existentes'] },
  { key: 'aulasExistentes',  must: ['aulas', 'existentes'], prefer: [],            not: ['uso'] },
  { key: 'tipoLocalidad',    must: ['tipo', 'localidad'], prefer: ['urbano', 'rural'], not: [] },
  { key: '_lonDMS',          must: ['minutos', 'segundos'], prefer: ['oeste', 'meridiano'], not: [] },
  { key: '_latDMS',          must: ['minutos', 'segundos'], prefer: ['norte', 'ecuador'],   not: [] },
];

/**
 * Normalize a header string for matching: lowercase, remove accents, trim
 */
function normalizeHeader(h) {
  return (h || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Score how well a header matches a column mapping definition.
 * Returns -1 if it doesn't match, or a positive score if it does.
 */
function scoreMatch(normalizedHeader, mapping) {
  const h = normalizedHeader;

  // Check negative keywords — if ANY match, reject
  for (const neg of mapping.not) {
    const negNorm = normalizeHeader(neg);
    if (h.includes(negNorm)) return -1;
  }

  // Check MUST keywords — ALL must be present
  let mustScore = 0;
  for (const m of mapping.must) {
    const mNorm = normalizeHeader(m);
    if (!h.includes(mNorm)) return -1;
    mustScore += 10;
  }

  // Check PREFER keywords — bonus points
  let preferScore = 0;
  for (const p of mapping.prefer) {
    const pNorm = normalizeHeader(p);
    if (h.includes(pNorm)) preferScore += 5;
  }

  return mustScore + preferScore;
}

/**
 * Auto-map Excel/CSV headers to internal field names.
 * Returns a Map<columnIndex, internalKey>
 */
function autoMapColumns(headers) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const mapping = new Map();       // colIndex → key
  const usedKeys = new Set();
  const usedCols = new Set();

  // For each mapping definition, find the best matching column
  // Process primary columns first (they have priority)
  const primaryKeys = new Set(['cct', 'turno', 'nombre', 'sostenimiento', 'municipio', 'alumnos', 'longitud', 'latitud']);

  // Sort: primaries first
  const sortedMappings = [...COLUMN_MAP].sort((a, b) => {
    const aP = primaryKeys.has(a.key) ? 0 : 1;
    const bP = primaryKeys.has(b.key) ? 0 : 1;
    return aP - bP;
  });

  for (const mapDef of sortedMappings) {
    if (usedKeys.has(mapDef.key)) continue;

    let bestIdx = -1;
    let bestScore = -1;

    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (usedCols.has(i)) continue;
      const score = scoreMatch(normalizedHeaders[i], mapDef);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0 && bestScore > 0) {
      mapping.set(bestIdx, mapDef.key);
      usedKeys.add(mapDef.key);
      usedCols.add(bestIdx);
    }
  }

  // Special fix: if 'colonia' header is just "Colonia" (single word), map it to claveColonia
  // and look for "Nombre de la colonia" for the named colonia field
  // This is handled by the keyword system above

  return mapping;
}

/**
 * Positional SIGED mapping — for files WITHOUT a header row.
 * Maps the standard 37-column SIGED format by column index.
 *
 * SIGED column order:
 * 0: CCT, 1: Clave Turno, 2: Nombre Turno, 3: Nombre Centro de Trabajo,
 * 4: Tipo Educativo, 5: Nivel Educativo, 6: Servicio Educativo,
 * 7: Control (Público/Privado), 8: Tipo Sostenimiento,
 * 9: Clave Entidad, 10: Nombre Entidad, 11: Clave Municipio, 12: Nombre Municipio,
 * 13: Clave Localidad, 14: Nombre Localidad, 15: Domicilio, 16: Número Exterior,
 * 17: Entre la calle, 18: Y la calle, 19: Calle Posterior,
 * 20: Colonia, 21: Nombre Colonia, 22: Código Postal, 23: Página Web,
 * 24: Alumnos Hombres, 25: Alumnos Mujeres, 26: Alumnos Total,
 * 27: Docentes Hombres, 28: Docentes Mujeres, 29: Docentes Total,
 * 30: Aulas en Uso, 31: Aulas Existentes, 32: Tipo Localidad (U/R),
 * 33: Longitud DMS, 34: Latitud DMS, 35: Longitud (grados), 36: Latitud (grados)
 */
function positionalSIGEDMap(numCols) {
  const SIGED_POSITIONS = [
    [0,  'cct'],
    [1,  'claveTurno'],
    [2,  'turno'],
    [3,  'nombre'],
    [4,  'tipoEducativo'],
    [5,  'nivelEducativo'],
    [6,  'servicioEducativo'],
    [7,  'sostenimiento'],
    [8,  'tipoSostenimiento'],
    [9,  'claveEntidad'],
    [10, 'entidad'],
    [11, 'claveMunicipio'],
    [12, 'municipio'],
    [13, 'claveLocalidad'],
    [14, 'localidad'],
    [15, 'domicilio'],
    [16, 'numeroExterior'],
    [17, 'entreCalle'],
    [18, 'yCalle'],
    [19, 'callePosterior'],
    [20, 'claveColonia'],
    [21, 'colonia'],
    [22, 'codigoPostal'],
    [23, 'paginaWeb'],
    [24, 'alumnosHombres'],
    [25, 'alumnosMujeres'],
    [26, 'alumnos'],
    [27, 'docentesHombres'],
    [28, 'docentesMujeres'],
    [29, 'docentes'],
    [30, 'aulasEnUso'],
    [31, 'aulasExistentes'],
    [32, 'tipoLocalidad'],
    [33, '_lonDMS'],
    [34, '_latDMS'],
    [35, 'longitud'],
    [36, 'latitud'],
  ];

  const mapping = new Map();
  for (const [idx, key] of SIGED_POSITIONS) {
    if (idx < numCols) {
      mapping.set(idx, key);
    }
  }
  return mapping;
}

/**
 * Normalize coordinate values.
 * Handles: -102,063725 → -102.063725
 */
function normalizeCoord(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') return val;
  const str = val.toString().trim().replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Parse a numeric field (alumnos, docentes, aulas, etc.)
 */
function parseNum(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return val;
  const num = parseInt(val.toString().trim(), 10);
  return isNaN(num) ? 0 : num;
}
/**
 * Normalize the educational level to a clean category.
 * SIGED uses: "EDUCACIÓN PRIMARIA", "PREESCOLAR", "EDUCACIÓN SECUNDARIA", etc.
 */
function normalizeNivel(raw) {
  const s = (raw || '').toUpperCase().trim();
  if (s.includes('PREESCOLAR') || s.includes('INICIAL')) return 'PREESCOLAR';
  if (s.includes('PRIMARIA')) return 'PRIMARIA';
  if (s.includes('SECUNDARIA')) return 'SECUNDARIA';
  if (s.includes('PREPARATORIA') || s.includes('BACHILLERATO') || s.includes('MEDIA SUPERIOR')) return 'MEDIA SUPERIOR';
  if (s.includes('SUPERIOR') || s.includes('UNIVERSIDAD')) return 'SUPERIOR';
  if (s) return s; // keep raw value if non-empty
  return 'OTRO';
}

/**
 * Parse the uploaded file (Excel or CSV) and return structured school data.
 *
 * @param {File} file - The uploaded File object
 * @returns {Promise<{ schools: Object[], meta: Object }>}
 */
export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();

  let headers = [];
  let rows = [];
  let headerRowIdx = 0;

  if (ext === 'csv') {
    const text = await file.text();
    const parsed = parseCSV(text);
    headers = parsed.headers;
    rows = parsed.rows;
  } else {
    // Excel: xlsx, xls — dynamic import (CJS module)
    const mod = await import('xlsx-js-style');
    const XLSX = mod.default || mod;

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

    if (data.length < 2) {
      throw new Error('El archivo no contiene datos suficientes.');
    }

    // ─── Smart header detection ───
    // Some SIGED Excel exports have NO header row — data starts at row 0.
    // Scan the first 15 rows to find one that looks like a header row.
    const HEADER_KEYWORDS = ['clave', 'nombre', 'turno', 'alumnos', 'municipio', 'control', 'grados', 'entidad', 'educativo', 'sostenimiento', 'localidad', 'docentes'];
    let bestHeaderScore = 0;

    for (let r = 0; r < Math.min(data.length, 15); r++) {
      const row = data[r];
      if (!Array.isArray(row) || row.length < 5) continue;

      const rowText = row.map(c => normalizeHeader(c)).join(' ');
      let score = 0;
      for (const kw of HEADER_KEYWORDS) {
        if (rowText.includes(normalizeHeader(kw))) score++;
      }

      if (score > bestHeaderScore) {
        bestHeaderScore = score;
        headerRowIdx = r;
      }
    }

    console.log(`[Intel Parser] Best header row: index ${headerRowIdx} (score: ${bestHeaderScore}/${HEADER_KEYWORDS.length})`);

    if (bestHeaderScore >= 3) {
      // File HAS a real header row — use fuzzy matching
      headers = data[headerRowIdx].map(h => (h || '').toString().trim());
      rows = data.slice(headerRowIdx + 1).filter(row =>
        row.some(cell => cell != null && cell !== '')
      );
    } else {
      // File has NO header row — all rows are data
      console.log('[Intel Parser] No header row detected — using positional SIGED mapping');
      headers = []; // will be ignored
      rows = data.filter(row => row.some(cell => cell != null && cell !== ''));
    }
  }

  // Debug: log info
  console.log('[Intel Parser] Headers:', headers.length, headers.slice(0, 6));
  console.log('[Intel Parser] Total data rows:', rows.length);

  // ─── Column mapping ───
  let columnMapping;

  if (headers.length > 0) {
    // Fuzzy auto-map from header names
    columnMapping = autoMapColumns(headers);
  } else {
    // No headers → positional SIGED mapping (standard 37-column order)
    columnMapping = positionalSIGEDMap(rows[0]?.length || 37);
  }

  // Debug: log mapping results
  const mappedEntries = [...columnMapping.entries()].map(([idx, key]) => `${key}←col[${idx}]`);
  console.log('[Intel Parser] Column mapping:', mappedEntries);

  // Check that we have the critical primary columns
  const mappedKeys = new Set([...columnMapping.values()]);
  const required = ['cct', 'nombre', 'alumnos', 'latitud', 'longitud'];
  const missing = required.filter(k => !mappedKeys.has(k));
  if (missing.length > 0) {
    const sample = (rows[0] || []).slice(0, 6).map((v, i) => `[${i}]"${v}"`).join(', ');
    throw new Error(
      `No se pudieron detectar columnas: ${missing.join(', ')}.\n` +
      `Primeros datos: ${sample}...\n` +
      `Columnas: ${rows[0]?.length || 0}`
    );
  }

  // Build school objects
  const schools = [];
  const municipiosSet = new Set();
  const nivelesSet = new Set();
  const turnosSet = new Set();

  for (const row of rows) {
    const school = {};

    // Map all detected columns
    for (const [colIdx, key] of columnMapping) {
      school[key] = row[colIdx] != null ? row[colIdx].toString().trim() : '';
    }

    // Normalize numeric fields
    school.alumnos = parseNum(school.alumnos);
    school.alumnosHombres = parseNum(school.alumnosHombres);
    school.alumnosMujeres = parseNum(school.alumnosMujeres);
    school.docentes = parseNum(school.docentes);
    school.docentesHombres = parseNum(school.docentesHombres);
    school.docentesMujeres = parseNum(school.docentesMujeres);
    school.aulasEnUso = parseNum(school.aulasEnUso);
    school.aulasExistentes = parseNum(school.aulasExistentes);

    // Normalize coordinates
    school.latitud = normalizeCoord(school.latitud);
    school.longitud = normalizeCoord(school.longitud);

    // Keep rows without valid coordinates so we don't lose data
    // If lat/lng are missing or 0,0, they will just be null.
    if ((school.latitud == null || school.longitud == null) || (school.latitud === 0 && school.longitud === 0)) {
      school.latitud = null;
      school.longitud = null;
    }

    // Normalize sostenimiento
    const sost = (school.sostenimiento || '').toUpperCase();
    school.isPrivada = sost.includes('PRIVAD');

    // Normalize nivel educativo
    school.nivelEducativo = normalizeNivel(
      school.nivelEducativo || school.tipoEducativo || ''
    );

    // Normalize turno
    if (school.turno) {
      turnosSet.add(school.turno.toUpperCase().trim());
    }

    // Track municipios & niveles
    if (school.municipio) {
      municipiosSet.add(school.municipio.toUpperCase());
    }
    nivelesSet.add(school.nivelEducativo);

    schools.push(school);
  }

  return {
    schools,
    meta: {
      fileName: file.name,
      totalRows: rows.length,
      validSchools: schools.length,
      skippedRows: rows.length - schools.length,
      municipios: [...municipiosSet].sort(),
      nivelesEducativos: [...nivelesSet].sort(),
      turnos: [...turnosSet].sort(),
      mappedColumns: Object.fromEntries(columnMapping),
      headersSample: headers.slice(0, 5),
    },
  };
}

/**
 * Parse CSV text with auto-detected separator
 */
function parseCSV(text) {
  // Detect separator by counting ; vs , in first line
  const firstLine = text.split('\n')[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const sep = semicolons > commas ? ';' : ',';

  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    throw new Error('El archivo CSV no contiene datos suficientes.');
  }

  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    return line.split(sep).map(cell => cell.trim().replace(/^"|"$/g, ''));
  });

  return { headers, rows };
}
