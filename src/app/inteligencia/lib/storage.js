// ═══════════════════════════════════════════════════════════════
// storage.js — Supabase persistence layer for Inteligencia
// Stores projects and schools in PostgreSQL for shared access.
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@/utils/supabase/client';

// ─── Singleton Supabase client ───
let _supabase = null;
function getSupabase() {
  if (typeof window === 'undefined') return null;
  if (!_supabase) _supabase = createClient();
  return _supabase;
}

// ─── Primary columns stored as native columns ───
const PRIMARY_SCHOOL_KEYS = [
  'cct', 'nombre', 'municipio', 'sostenimiento', 'isPrivada',
  'alumnos', 'latitud', 'longitud', 'turno', 'nivelEducativo',
];

/**
 * Split a school object into native columns + extra_data JSONB.
 */
function splitSchoolData(school) {
  const row = {
    cct: sanitizeStr(school.cct || ''),
    nombre: sanitizeStr(school.nombre || ''),
    municipio: sanitizeStr(school.municipio || ''),
    sostenimiento: sanitizeStr(school.sostenimiento || ''),
    is_privada: !!school.isPrivada,
    alumnos: Number.isFinite(school.alumnos) ? school.alumnos : 0,
    latitud: Number.isFinite(school.latitud) ? school.latitud : null,
    longitud: Number.isFinite(school.longitud) ? school.longitud : null,
    turno: sanitizeStr(school.turno || ''),
    nivel_educativo: sanitizeStr(school.nivelEducativo || ''),
  };

  // Everything else goes into extra_data
  const extra = {};
  for (const [key, val] of Object.entries(school)) {
    if (!PRIMARY_SCHOOL_KEYS.includes(key) && val !== undefined && val !== null) {
      if (typeof val === 'string') {
        extra[key] = sanitizeStr(val);
      } else if (typeof val === 'number' && Number.isFinite(val)) {
        extra[key] = val;
      } else if (typeof val === 'boolean') {
        extra[key] = val;
      }
      // skip everything else (objects, arrays, NaN, etc.)
    }
  }

  // Roundtrip through JSON to guarantee valid JSONB
  // Deep-clean extra_data for JSONB compatibility
  try {
    const cleaned = sanitizeForJson(extra);
    row.extra_data = JSON.parse(JSON.stringify(cleaned));
  } catch {
    row.extra_data = {};
  }

  return row;
}

/**
 * Sanitize a string for PostgreSQL JSONB compatibility.
 * Strips null bytes (\x00) and control characters that PostgreSQL rejects.
 */
function sanitizeStr(str) {
  if (typeof str !== 'string') return '';
  // Remove null bytes, control chars (except \t, \n, \r), and lone surrogates
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\uFFFE\uFFFF]/g, '')
    .replace(/\uFFFD/g, ''); // replacement char
}

/**
 * Recursively sanitize an object for JSON/JSONB storage.
 */
function sanitizeForJson(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'string') return sanitizeStr(obj);
  if (typeof obj === 'number') return Number.isFinite(obj) ? obj : null;
  if (typeof obj === 'boolean') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForJson);
  if (typeof obj === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      const cv = sanitizeForJson(v);
      if (cv !== null && cv !== undefined) clean[sanitizeStr(k)] = cv;
    }
    return clean;
  }
  return null;
}

/**
 * Reconstruct a school object from a database row.
 */
function rowToSchool(row) {
  const school = {
    cct: row.cct,
    nombre: row.nombre,
    municipio: row.municipio,
    sostenimiento: row.sostenimiento,
    isPrivada: row.is_privada,
    alumnos: row.alumnos,
    latitud: row.latitud,
    longitud: row.longitud,
    turno: row.turno,
    nivelEducativo: row.nivel_educativo || '',
    ...(row.extra_data || {}),
  };
  return school;
}

// ═══════════════════════════════════════════════════════════════
// Project CRUD
// ═══════════════════════════════════════════════════════════════

/**
 * Save or create a project + its schools.
 * - If project.id exists → updates metadata only (schools already exist).
 * - If no id → creates new project + bulk inserts all schools.
 *
 * @param {Object} project
 * @returns {Promise<string>} The project ID
 */
export async function saveProject(project) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not available (SSR)');
  const isNew = !project.id;

  const projectRow = {
    name: project.name || 'Sin nombre',
    file_name: project.fileName || '',
    filters: { ...(project.filters || {}), routes: project.routes },
    prices: project.prices || { premium: 200, base: 80 },
    som_percent: project.somPercent ?? 30,
    route_ccts: project.route || [],
    school_count: project.schools?.length || project.schoolCount || 0,
    owner: project.owner || 'Anónimo',
    pin: project.pin || null,
    stats: project.stats || null,
    updated_at: new Date().toISOString(),
  };

  let projectId;

  if (isNew) {
    // INSERT new project
    projectRow.created_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('intel_projects')
      .insert(projectRow)
      .select('id')
      .single();

    if (error) throw new Error(`Error creating project: ${error.message}`);
    projectId = data.id;

    // Set lastProjectId BEFORE inserting schools — if schools fail,
    // at least we can find the project on next reload
    setLastProjectId(projectId);

    // Bulk insert schools (non-fatal — partial data is better than no data)
    if (project.schools?.length > 0) {
      try {
        await bulkInsertSchools(supabase, projectId, project.schools);
      } catch (schoolErr) {
        console.error('[Intel Storage] School insert failed (partial save):', schoolErr);
        // Don't throw — project metadata is saved, schools can be re-uploaded
      }
    }
  } else {
    // UPDATE existing project metadata
    projectId = project.id;

    const { error } = await supabase
      .from('intel_projects')
      .update(projectRow)
      .eq('id', projectId);

    if (error) throw new Error(`Error updating project: ${error.message}`);
  }

  setLastProjectId(projectId);
  return projectId;
}

/**
 * Save only project metadata (filters, prices, route, som).
 * Used by auto-save — lightweight, no schools re-upload.
 */
export async function saveProjectMeta(projectId, meta) {
  const supabase = getSupabase();
  if (!supabase) return;

  const update = {
    updated_at: new Date().toISOString(),
  };

  if (meta.filters !== undefined) {
    update.filters = { ...meta.filters };
    if (meta.routes !== undefined) update.filters.routes = meta.routes;
  } else if (meta.routes !== undefined) {
    // If filters wasn't provided but routes was, we need to merge it with existing filters via RPC or just ignore it.
    // Actually, saveProjectMeta in page.jsx always passes both filters and routes now.
  }
  if (meta.prices !== undefined) update.prices = meta.prices;
  if (meta.somPercent !== undefined) update.som_percent = meta.somPercent;
  if (meta.route !== undefined) update.route_ccts = meta.route;

  const { error } = await supabase
    .from('intel_projects')
    .update(update)
    .eq('id', projectId);

  if (error) {
    console.error('[Intel Storage] Auto-save error:', error);
    throw error;
  }
}

/**
 * Bulk insert schools in batches (Supabase has row limits per request).
 */
async function bulkInsertSchools(supabase, projectId, schools) {
  const BATCH_SIZE = 250; // smaller batches = less data lost on failure
  const rows = schools.map(s => ({
    project_id: projectId,
    ...splitSchoolData(s),
  }));

  let insertedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('intel_schools')
      .insert(batch);

    if (error) {
      console.warn(`[Intel Storage] Batch ${i}-${i + batch.length} failed: ${error.message}. Retrying row-by-row...`);

      // Retry each row individually to find and skip only the bad ones
      for (let j = 0; j < batch.length; j++) {
        const { error: rowErr } = await supabase
          .from('intel_schools')
          .insert(batch[j]);

        if (rowErr) {
          skippedCount++;
          console.warn(`[Intel Storage] Row ${i + j} skipped (CCT: ${batch[j].cct}): ${rowErr.message}`);
        } else {
          insertedCount++;
        }
      }
    } else {
      insertedCount += batch.length;
    }

    // Progress log every batch
    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= rows.length) {
      console.log(`[Intel Storage] Progress: ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} processed`);
    }
  }

  console.log(`[Intel Storage] Inserted ${insertedCount} schools, skipped ${skippedCount} for project ${projectId}`);
  return { insertedCount, skippedCount };
}

/**
 * Add schools to an existing project (for multi-concentrado merging).
 * @param {string} projectId
 * @param {Array} newSchools - array of school objects to add
 * @param {number} newTotalCount - updated total school count
 */
export async function addSchoolsToProject(projectId, newSchools, newTotalCount) {
  const supabase = getSupabase();
  if (!supabase) return;

  // Bulk insert the new schools
  await bulkInsertSchools(supabase, projectId, newSchools);

  // Update school_count on the project
  await supabase
    .from('intel_projects')
    .update({
      school_count: newTotalCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId);

  console.log(`[Intel Storage] Added ${newSchools.length} schools to project ${projectId}`);
}

/**
 * Load a complete project (metadata + all schools).
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function loadProject(id) {
  if (!id) return null;
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    // Load project metadata
    const { data: project, error: pErr } = await supabase
      .from('intel_projects')
      .select('*')
      .eq('id', id)
      .single();

    if (pErr || !project) {
      console.warn('[Intel Storage] Project not found:', id, pErr?.message);
      return null;
    }

    // Load ALL schools — Supabase defaults to 1000 rows max, so paginate
    let allSchoolRows = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: sErr } = await supabase
        .from('intel_schools')
        .select('*')
        .eq('project_id', id)
        .order('cct', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (sErr) {
        console.error('[Intel Storage] Error loading schools page:', sErr);
        break;
      }

      if (batch && batch.length > 0) {
        allSchoolRows = allSchoolRows.concat(batch);
        from += PAGE_SIZE;
        hasMore = batch.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    console.log(`[Intel Storage] Loaded project "${project.name}" with ${allSchoolRows.length} schools`);

    return {
      id: project.id,
      name: project.name,
      fileName: project.file_name,
      filters: project.filters || {},
      prices: project.prices || { premium: 200, base: 80 },
      somPercent: project.som_percent ?? 30,
      route: project.route_ccts || [],
      routes: project.filters?.routes,
      schools: allSchoolRows.map(rowToSchool),
      owner: project.owner || 'Anónimo',
      pin: project.pin,
      stats: project.stats,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };
  } catch (err) {
    console.error('[Intel Storage] Load error:', err);
    return null;
  }
}

/**
 * List all saved projects (metadata only, no schools).
 * Returns lightweight summaries for the ProjectSwitcher.
 */
export async function listProjects() {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('intel_projects')
      .select('id, name, file_name, school_count, route_ccts, created_at, updated_at, owner, pin, stats')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[Intel Storage] List error:', error);
      return [];
    }

    return (data || []).map(p => ({
      id: p.id,
      name: p.name || 'Sin nombre',
      fileName: p.file_name || '',
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      schoolCount: p.school_count || 0,
      routeCount: p.route_ccts?.length || 0,
      owner: p.owner || 'Anónimo',
      hasPin: !!p.pin, // Send boolean flag to UI, not the actual PIN
      stats: p.stats || {},
    }));
  } catch {
    return [];
  }
}

/**
 * Delete a project and all its schools (CASCADE).
 */
export async function deleteProject(id) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('intel_projects')
      .delete()
      .eq('id', id);

    if (error) console.error('[Intel Storage] Delete error:', error);

    if (getLastProjectId() === id) {
      clearLastProjectId();
    }
  } catch (err) {
    console.error('[Intel Storage] Delete error:', err);
  }
}

/**
 * Rename a project.
 */
export async function renameProject(id, newName) {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase
    .from('intel_projects')
    .update({ name: newName, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) console.error('[Intel Storage] Rename error:', error);
}

// ─── LocalStorage helpers for "last active project" ───
// Still use localStorage for this one piece — it's per-browser by design.

const LS_KEY = 'flyhigh-intel-last-project';

export function getLastProjectId() {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

export function setLastProjectId(id) {
  try {
    localStorage.setItem(LS_KEY, id);
  } catch {
    // localStorage might be full or blocked
  }
}

export function clearLastProjectId() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // noop
  }
}
