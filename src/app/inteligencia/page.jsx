'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { FolderOpen, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Rocket, Plus, BarChart3, MapPin, X } from 'lucide-react';

import WelcomeModal from './components/WelcomeModal';
import CommandPanel from './components/CommandPanel';
import RoutePanel from './components/RoutePanel';
import RouteReportModal from './components/RouteReportModal';
import ProjectSwitcher from './components/ProjectSwitcher';
import MunicipioRanking from './components/MunicipioRanking';
import AddConcentradoModal from './components/AddConcentradoModal';
import MissingSchoolsPanel from './components/MissingSchoolsPanel';
import { applyFilters, getStudentRange, getStudentRangeByType, getUniqueNiveles } from './lib/filters';
import { saveProject, saveProjectMeta, loadProject, getLastProjectId, setLastProjectId, addSchoolsToProject } from './lib/storage';

// Dynamic import for map (Leaflet requires window)
const IntelMap = dynamic(() => import('./components/IntelMap'), { ssr: false });

export default function InteligenciaPage() {
  // ─── Core state ───
  const [schools, setSchools] = useState([]);
  const [projectMeta, setProjectMeta] = useState({ id: null, name: '', fileName: '' });
  const [filters, setFilters] = useState({
    municipio: '__all__',
    sostenimiento: 'todas',
    turno: '__all__',
    nivelEducativo: '__all__',
    alumnosMinPriv: null,
    alumnosMaxPriv: null,
    revenueMinPub: null,
    revenueMaxPub: null,
    revenueMinPriv: null,
    revenueMaxPriv: null,
  });
  const [prices, setPrices] = useState({ premium: 200, base: 80 });
  const [somPercent, setSomPercent] = useState(30);
  const [routeCCTs, setRouteCCTs] = useState([]);

  // ─── UI state ───
  const [showWelcome, setShowWelcome] = useState(false);
  const [showProjectSwitcher, setShowProjectSwitcher] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAddConcentrado, setShowAddConcentrado] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [showMissingSchools, setShowMissingSchools] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const autoSaveTimerRef = useRef(null);
  const hasLoadedRef = useRef(false);
  const leafletMapRef = useRef(null);

  // ─── Derived state ───
  
  const missingSchools = useMemo(() => {
    return schools.filter(s => s.latitud == null || s.longitud == null);
  }, [schools]);

  // Campus detection — 3-tier validation:
  // 1. Same name (fuzzy) + same coords + 2+ levels → CAMPUS (certain)
  // 2. Different name + same sostenimiento + same coords + 2 levels → CAMPUS (probable)
  // 3. Different name + different sostenimiento → NOT campus
  // 4. 3+ distinct names at same coords → NOT campus (rounded GPS)
  const campusMap = useMemo(() => {
    // Normalize name: lowercase, strip accents, articles, non-alphanumeric
    const normalize = (name) => {
      if (!name) return '';
      return name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(de|del|la|las|los|el|en|y|a|e|instituto|colegio|centro|educativo)\b/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
    };

    // Check if two normalized names are similar
    const namesSimilar = (a, b) => {
      if (!a || !b) return false;
      return a === b || a.includes(b) || b.includes(a);
    };

    // Sostenimiento check: both public or both private
    const sameSostenimiento = (groupSchools) => {
      const types = new Set(groupSchools.map(s => !!s.isPrivada));
      return types.size === 1; // all private or all public
    };

    // Step 1: group by exact coordinates
    const coordMap = new Map();
    for (const s of schools) {
      if (s.latitud == null || s.longitud == null) continue;
      const key = `${s.latitud},${s.longitud}`;
      if (!coordMap.has(key)) coordMap.set(key, []);
      coordMap.get(key).push(s);
    }

    // Step 2: validate each coordinate group
    const campus = new Map();
    for (const [coordKey, group] of coordMap) {
      if (group.length < 2) continue;

      // Must have 2+ distinct educational levels
      const niveles = new Set(group.map(s => (s.nivelEducativo || '').toUpperCase()).filter(Boolean));
      if (niveles.size < 2) continue;

      // Count distinct normalized names
      const uniqueNames = new Set(group.map(s => normalize(s.nombre)));

      // RULE 4: 3+ completely distinct names → false positive (rounded coordinates)
      if (uniqueNames.size >= 3) {
        // Still check for name-matched sub-groups within
        const nameGroups = new Map();
        for (const s of group) {
          const norm = normalize(s.nombre);
          let matched = false;
          for (const [existing, members] of nameGroups) {
            if (namesSimilar(norm, existing)) {
              members.push(s);
              matched = true;
              break;
            }
          }
          if (!matched) nameGroups.set(norm, [s]);
        }
        // Only keep sub-groups with 2+ levels
        for (const [, members] of nameGroups) {
          if (members.length < 2) continue;
          const subNiveles = new Set(members.map(s => (s.nivelEducativo || '').toUpperCase()).filter(Boolean));
          if (subNiveles.size >= 2) {
            campus.set(coordKey, [...members]);
            break; // one campus per coordinate
          }
        }
        continue;
      }

      // RULE 1: All same name (or similar) → definite campus
      const namesArr = [...uniqueNames];
      if (uniqueNames.size === 1 || (namesArr.length === 2 && namesSimilar(namesArr[0], namesArr[1]))) {
        campus.set(coordKey, [...group]);
        continue;
      }

      // RULE 2 & 3: Different names — check sostenimiento
      if (sameSostenimiento(group)) {
        // Same sostenimiento (all public or all private) → probable campus
        campus.set(coordKey, [...group]);
      }
      // else: different sostenimiento → NOT campus (Rule 3)
    }

    return campus;
  }, [schools]);

  // Set of CCTs that belong to a campus
  const campusCCTs = useMemo(() => {
    const set = new Set();
    for (const group of campusMap.values()) {
      for (const s of group) set.add(s.cct);
    }
    return set;
  }, [campusMap]);

  // Campus total enrollment per campus location
  const campusTotals = useMemo(() => {
    const totals = new Map();
    for (const [key, group] of campusMap) {
      totals.set(key, group.reduce((sum, s) => sum + (s.alumnos || 0), 0));
    }
    return totals;
  }, [campusMap]);

  const filteredSchools = useMemo(() => {
    return applyFilters(schools, filters, prices, campusCCTs, campusTotals);
  }, [schools, filters, prices, campusCCTs, campusTotals]);

  const routeSet = useMemo(() => new Set(routeCCTs), [routeCCTs]);

  // ─── Initialization: load last project or show welcome ───
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const lastId = getLastProjectId();
      if (lastId) {
        const project = await loadProject(lastId);
        if (project && project.schools?.length > 0) {
          restoreProject(project);
          hasLoadedRef.current = true;
          setLoading(false);
          return;
        }
      }
      // No saved project — show welcome
      setShowWelcome(true);
      setLoading(false);
    };
    init();
  }, []);

  // ─── Restore a project from storage ───
  const restoreProject = useCallback((project) => {
    setSchools(project.schools || []);
    setProjectMeta({
      id: project.id,
      name: project.name || 'Sin nombre',
      fileName: project.fileName || '',
      owner: project.owner || 'Anónimo',
      pin: project.pin || null,
      stats: project.stats || null,
    });
    setRouteCCTs(project.route || []);
    if (project.filters) setFilters(project.filters);
    if (project.prices) setPrices(project.prices);
    if (project.somPercent) setSomPercent(project.somPercent);

    // Set min/max for alumnos if not set
    if (!project.filters?.alumnosMinPub) {
      const ranges = getStudentRangeByType(project.schools || []);
      setFilters(prev => ({
        ...prev,
        ...(project.filters || {}),
        alumnosMinPub: project.filters?.alumnosMinPub ?? ranges.pub.min,
        alumnosMaxPub: project.filters?.alumnosMaxPub ?? ranges.pub.max,
        alumnosMinPriv: project.filters?.alumnosMinPriv ?? ranges.priv.min,
        alumnosMaxPriv: project.filters?.alumnosMaxPriv ?? ranges.priv.max,
      }));
    }
  }, []);

  // ─── Handle new project from WelcomeModal ───
  const handleProjectReady = useCallback(async ({ name, owner, pin, stats, schools: parsedSchools, meta }) => {
    const ranges = getStudentRangeByType(parsedSchools);
    setSchools(parsedSchools);
    setProjectMeta({ id: null, name, fileName: meta.fileName, owner, pin, stats });
    setRouteCCTs([]);
    setFilters({
      municipio: '__all__',
      sostenimiento: 'todas',
      turno: '__all__',
      alumnosMinPub: ranges.pub.min,
      alumnosMaxPub: ranges.pub.max,
      alumnosMinPriv: ranges.priv.min,
      alumnosMaxPriv: ranges.priv.max,
      revenueMinPub: null,
      revenueMaxPub: null,
      revenueMinPriv: null,
      revenueMaxPriv: null,
    });
    setPrices({ premium: 200, base: 80 });
    setSomPercent(30);
    setShowWelcome(false);

    // Auto-save initial state
    try {
      const id = await saveProject({
        name,
        fileName: meta.fileName,
        owner,
        pin,
        stats,
        schools: parsedSchools,
        route: [],
        filters: {
          municipio: '__all__',
          sostenimiento: 'todas',
          turno: '__all__',
          alumnosMinPub: ranges.pub.min,
          alumnosMaxPub: ranges.pub.max,
          alumnosMinPriv: ranges.priv.min,
          alumnosMaxPriv: ranges.priv.max,
          revenueMinPub: null,
          revenueMaxPub: null,
          revenueMinPriv: null,
          revenueMaxPriv: null,
        },
        prices: { premium: 200, base: 80 },
        somPercent: 30,
      });
      setProjectMeta(prev => ({ ...prev, id }));
    } catch (err) {
      console.error('[Intel] Initial save error:', err);
      // Even if save failed, the project may have been partially created
      // and lastProjectId was set in storage.js — check for it
      const fallbackId = getLastProjectId();
      if (fallbackId) {
        setProjectMeta(prev => ({ ...prev, id: fallbackId }));
      }
    }
    hasLoadedRef.current = true;
  }, []);

  // ─── Save project (manual) ───
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (projectMeta.id) {
        // Existing project — save metadata only (lightweight)
        await saveProjectMeta(projectMeta.id, {
          filters,
          prices,
          somPercent,
          route: routeCCTs,
        });
      } else {
        // New project — full save with schools
        const id = await saveProject({
          name: projectMeta.name,
          fileName: projectMeta.fileName,
          owner: projectMeta.owner,
          pin: projectMeta.pin,
          stats: projectMeta.stats,
          schools,
          route: routeCCTs,
          filters,
          prices,
          somPercent,
        });
        setProjectMeta(prev => ({ ...prev, id }));
      }
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2000);
    } catch (err) {
      console.error('[Intel] Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [projectMeta, schools, routeCCTs, filters, prices, somPercent]);

  // ─── Auto-save debounced effect ───
  useEffect(() => {
    if (!hasLoadedRef.current || !projectMeta.id || isReadOnly) return;
    
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveProjectMeta(projectMeta.id, {
          filters,
          prices,
          somPercent,
          route: routeCCTs,
        });
        console.log('[Intel] Auto-saved');
      } catch (err) {
        console.error('[Intel] Auto-save error:', err);
      }
    }, 2000);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [filters, prices, somPercent, routeCCTs, projectMeta.id]);

  // ─── Route operations ───
  const handleSchoolClick = useCallback((school) => {
    setRouteCCTs(prev => {
      if (prev.includes(school.cct)) {
        // Remove from route
        return prev.filter(c => c !== school.cct);
      }
      // Add to route
      return [...prev, school.cct];
    });
  }, []);

  const handleRemoveFromRoute = useCallback((cct) => {
    setRouteCCTs(prev => prev.filter(c => c !== cct));
  }, []);

  const handleClearRoute = useCallback(() => {
    setRouteCCTs([]);
  }, []);

  const handleReorderRoute = useCallback((newOrder) => {
    setRouteCCTs(newOrder);
  }, []);

  // ─── Project switching ───
  const handleSelectProject = useCallback(async (id, readOnly = false, enteredPin = null) => {
    hasLoadedRef.current = false; // Pause auto-save during switch
    const project = await loadProject(id);
    if (project) {
      // PIN verification
      let finalReadOnly = readOnly;
      if (project.pin && !readOnly) {
        if (enteredPin !== project.pin) {
          alert('PIN incorrecto. Se cargará en modo de solo lectura.');
          finalReadOnly = true;
        }
      }

      restoreProject(project);
      setIsReadOnly(finalReadOnly);
      setLastProjectId(id);
      hasLoadedRef.current = !finalReadOnly; // Resume auto-save ONLY if not read-only
    }
    setShowProjectSwitcher(false);
  }, [restoreProject]);

  const handleNewProject = useCallback(() => {
    setShowProjectSwitcher(false);
    setShowWelcome(true);
  }, []);

  // ─── Add concentrado (merge schools from another Excel) ───
  const handleAddConcentrado = useCallback(async (newSchools, meta) => {
    if (isReadOnly) return;
    const merged = [...schools, ...newSchools];
    setSchools(merged);

    // Persist to Supabase
    if (projectMeta.id) {
      try {
        await addSchoolsToProject(projectMeta.id, newSchools, merged.length);
        console.log(`[Intel] Added ${newSchools.length} schools from ${meta.fileName}`);
        setSaveToast(true);
        setTimeout(() => setSaveToast(false), 2000);
      } catch (err) {
        console.error('[Intel] Error adding schools:', err);
      }
    }
  }, [schools, projectMeta.id, isReadOnly]);

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--intel-bg)]">
        <div className="flex flex-col items-center gap-4 animate-intel-fade-in">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
            <Rocket size={24} className="text-white" />
          </div>
          <div className="w-10 h-10 border-2 border-gray-700 border-t-blue-500 rounded-full animate-intel-spin" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Cargando Inteligencia...</p>
        </div>
      </div>
    );
  }

  // ─── No data — show welcome ───
  if (showWelcome || schools.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--intel-bg)]">
        <WelcomeModal
          onProjectReady={handleProjectReady}
          onClose={schools.length > 0 ? () => setShowWelcome(false) : null}
        />
      </div>
    );
  }

  // ─── Main layout ───
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ═══ HEADER ═══ */}
      <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-[var(--intel-border)] bg-[var(--intel-surface)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
            <Rocket size={14} className="text-white" />
          </div>
          <div className="flex items-center">
            <div>
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                {projectMeta.name || 'Proyecto sin título'}
                {isReadOnly && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 text-[10px] font-bold uppercase tracking-wider border border-slate-500/30">
                    Solo Lectura
                  </span>
                )}
              </h1>
              <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
                {schools.length} escuelas en total
                {projectMeta.owner && (
                  <span className="flex items-center gap-1 before:content-['·'] before:text-gray-600">
                    <span className="text-gray-500">Por {projectMeta.owner}</span>
                  </span>
                )}
              </p>
            </div>
            {/* Nivel educativo badges */}
            {getUniqueNiveles(schools).map(nivel => (
              <span
                key={nivel}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  nivel === 'PRIMARIA' ? 'bg-blue-500/15 text-blue-400' :
                  nivel === 'PREESCOLAR' ? 'bg-pink-500/15 text-pink-400' :
                  nivel === 'SECUNDARIA' ? 'bg-purple-500/15 text-purple-400' :
                  nivel === 'MEDIA SUPERIOR' ? 'bg-orange-500/15 text-orange-400' :
                  'bg-gray-500/15 text-gray-400'
                }`}
              >
                {nivel}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save toast */}
          {saveToast && (
            <span className="text-[10px] font-bold text-emerald-400 animate-intel-fade-in">
              ✓ Guardado
            </span>
          )}

          {/* Panel toggles */}
          <button
            onClick={() => setLeftCollapsed(!leftCollapsed)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
            title={leftCollapsed ? 'Mostrar filtros' : 'Ocultar filtros'}
          >
            {leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
          <button
            onClick={() => setRightCollapsed(!rightCollapsed)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
            title={rightCollapsed ? 'Mostrar ruta' : 'Ocultar ruta'}
          >
            {rightCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
          </button>

          <div className="w-px h-5 bg-[var(--intel-border)] mx-1" />

          {/* Project switcher */}
          <button
            onClick={() => setShowProjectSwitcher(true)}
            className="intel-btn bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 shadow-sm py-1.5 px-3 text-xs"
          >
            <FolderOpen size={13} />
            Proyectos
          </button>

          {/* Add concentrado */}
          {!isReadOnly && (
            <button
              onClick={() => setShowAddConcentrado(true)}
              className="intel-btn bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 shadow-sm py-1.5 px-3 text-xs"
              title="Agregar otro concentrado Excel"
            >
              <Plus size={13} />
              Agregar BD
            </button>
          )}
        </div>
      </header>

      {/* ═══ MAIN WORKSPACE ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: Command Center */}
        <CommandPanel
          schools={schools}
          filteredSchools={filteredSchools}
          filteredCount={filteredSchools.length}
          filters={filters}
          onFilterChange={setFilters}
          prices={prices}
          onPriceChange={setPrices}
          somPercent={somPercent}
          onSomChange={setSomPercent}
          collapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed(!leftCollapsed)}
          campusCount={campusMap.size}
          onOpenMissingSchools={() => setShowMissingSchools(true)}
        />

        {/* Center: Map + floating filter chips */}
        <div className="flex-1 relative">
          <IntelMap
            schools={filteredSchools}
            routeCCTs={routeCCTs}
            onSchoolClick={handleSchoolClick}
            mapInstanceRef={leafletMapRef}
            campusMap={campusMap}
          >
            {/* Ranking trigger — just a button, modal renders at page root */}
            <button
              onClick={() => setShowRanking(true)}
              className="intel-btn intel-btn-ghost text-xs"
              title="Ranking de Municipios"
            >
              <BarChart3 size={14} />
              Ranking
            </button>
          </IntelMap>

          {/* ═══ Active filter chips — floating on top of map ═══ */}
          {(filters.municipio && filters.municipio !== '__all__') ||
           (filters.sostenimiento && filters.sostenimiento !== 'todas') ||
           (filters.turno && filters.turno !== '__all__') ||
           (filters.nivelEducativo && filters.nivelEducativo !== '__all__') ? (
            <div className="intel-active-filters">
              <span className="intel-active-filters-label">Filtros activos:</span>

              {filters.municipio && filters.municipio !== '__all__' && (
                <button
                  className="intel-active-filter-chip"
                  onClick={() => setFilters(prev => ({ ...prev, municipio: '__all__' }))}
                >
                  <MapPin size={12} />
                  {filters.municipio}
                  <X size={12} className="intel-chip-x" />
                </button>
              )}

              {filters.sostenimiento && filters.sostenimiento !== 'todas' && (
                <button
                  className="intel-active-filter-chip"
                  onClick={() => setFilters(prev => ({ ...prev, sostenimiento: 'todas' }))}
                >
                  {filters.sostenimiento === 'privadas' ? 'Privadas' : 'Públicas'}
                  <X size={12} className="intel-chip-x" />
                </button>
              )}

              {filters.turno && filters.turno !== '__all__' && (
                <button
                  className="intel-active-filter-chip"
                  onClick={() => setFilters(prev => ({ ...prev, turno: '__all__' }))}
                >
                  {filters.turno}
                  <X size={12} className="intel-chip-x" />
                </button>
              )}

              {filters.nivelEducativo && filters.nivelEducativo !== '__all__' && (
                <button
                  className="intel-active-filter-chip"
                  onClick={() => setFilters(prev => ({ ...prev, nivelEducativo: '__all__' }))}
                >
                  {filters.nivelEducativo}
                  <X size={12} className="intel-chip-x" />
                </button>
              )}

              <button
                className="intel-active-filter-clear"
                onClick={() => setFilters(prev => ({
                  ...prev,
                  municipio: '__all__',
                  sostenimiento: 'todas',
                  turno: '__all__',
                  nivelEducativo: '__all__',
                  alumnosMinPub: null,
                  alumnosMaxPub: null,
                  alumnosMinPriv: null,
                  alumnosMaxPriv: null,
                  revenueMinPub: null,
                  revenueMaxPub: null,
                  revenueMinPriv: null,
                  revenueMaxPriv: null,
                }))}
              >
                Limpiar todo
              </button>
            </div>
          ) : null}
        </div>

        {/* Right panel: Route */}
        <RoutePanel
          schools={schools}
          routeCCTs={routeCCTs}
          prices={prices}
          onRemoveFromRoute={handleRemoveFromRoute}
          onClearRoute={handleClearRoute}
          onReorderRoute={handleReorderRoute}
          onSaveProject={handleSave}
          onViewReport={() => setShowReport(true)}
          collapsed={rightCollapsed}
        />
      </div>

      {/* ═══ MODALS ═══ */}
      {showProjectSwitcher && (
        <ProjectSwitcher
          onSelectProject={handleSelectProject}
          onNewProject={handleNewProject}
          onClose={() => setShowProjectSwitcher(false)}
        />
      )}

      {showReport && routeCCTs.length > 0 && (
        <RouteReportModal
          projectName={projectMeta.name}
          schools={schools}
          routeCCTs={routeCCTs}
          prices={prices}
          onClose={() => setShowReport(false)}
        />
      )}

      {showAddConcentrado && (
        <AddConcentradoModal
          existingCCTs={schools.map(s => s.cct)}
          onAddSchools={handleAddConcentrado}
          onClose={() => setShowAddConcentrado(false)}
        />
      )}

      {showRanking && (
        <MunicipioRanking
          schools={schools}
          activeFilter={filters.municipio}
          mapInstance={leafletMapRef}
          onSelectMunicipio={(muni) => {
            setFilters(prev => ({ ...prev, municipio: muni }));
          }}
          onClose={() => setShowRanking(false)}
        />
      )}

      {showMissingSchools && (
        <MissingSchoolsPanel
          schools={missingSchools}
          onClose={() => setShowMissingSchools(false)}
        />
      )}
    </div>
  );
}
