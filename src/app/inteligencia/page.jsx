'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { FolderOpen, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Rocket, Plus, BarChart3, MapPin, X, Eye, EyeOff, ArrowLeftRight, Undo2 } from 'lucide-react';

import WelcomeModal from './components/WelcomeModal';
import CommandPanel from './components/CommandPanel';
import DistribucionPanel from './components/DistribucionPanel';
import RightSidebar from './components/RightSidebar';
import AnimatedCounter from './components/AnimatedCounter';
import { supabase } from '@/utils/supabase/client';
import RouteReportModal from './components/RouteReportModal';
import ProjectSwitcher from './components/ProjectSwitcher';
import MunicipioRanking from './components/MunicipioRanking';
import AddConcentradoModal from './components/AddConcentradoModal';
import MissingSchoolsPanel from './components/MissingSchoolsPanel';
import { applyFilters, getStudentRange, getStudentRangeByType, getUniqueNiveles, CAPACITY_DEFAULTS, calculateCapacity, buildProfitabilityColors, formatNumber } from './lib/filters';
import { saveProject, saveProjectMeta, loadProject, getLastProjectId, setLastProjectId, addSchoolsToProject } from './lib/storage';

// Dynamic import for map (Leaflet requires window)
const IntelMap = dynamic(() => import('./components/IntelMap'), { ssr: false });

export default function InteligenciaPage() {
  // ─── Core state ───
  const [schools, setSchools] = useState([]);
  const [projectMeta, setProjectMeta] = useState({ id: null, name: '', fileName: '' });
  const [filters, _setFilters] = useState({
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
    revenueMinPubVesp: null,
    revenueMinPrivVesp: null,
  });
  const [prices, _setPrices] = useState({ premium: 200, base: 80 });
  const [routes, _setRoutes] = useState([{ id: 'r1', name: 'Ruta 1', color: '#10B981', visible: true, ccts: [] }]);
  const [activeRouteId, setActiveRouteId] = useState('r1');

  // ─── Undo System (Ctrl+Z) ───
  const [capacityConfig, _setCapacityConfig] = useState(CAPACITY_DEFAULTS);
  const historyRef = useRef([]);
  const isUndoingRef = useRef(false);
  const currentStateRef = useRef({ filters, prices, capacityConfig, routes });

  useEffect(() => {
    currentStateRef.current = { filters, prices, capacityConfig, routes };
  }, [filters, prices, capacityConfig, routes]);

  const saveHistoryState = useCallback(() => {
    if (isUndoingRef.current) return;
    historyRef.current.push(JSON.parse(JSON.stringify(currentStateRef.current)));
    if (historyRef.current.length > 50) historyRef.current.shift();
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    isUndoingRef.current = true;
    const prevState = historyRef.current.pop();
    _setFilters(prevState.filters);
    _setPrices(prevState.prices);
    _setCapacityConfig(prevState.capacityConfig);
    _setRoutes(prevState.routes);
    
    // Unlock history saving shortly after state settles
    setTimeout(() => { isUndoingRef.current = false; }, 100);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  // Wrapper setters
  const setFilters = useCallback((val) => { saveHistoryState(); _setFilters(val); }, [saveHistoryState]);
  const setPrices = useCallback((val) => { saveHistoryState(); _setPrices(val); }, [saveHistoryState]);
  const setCapacityConfig = useCallback((val) => { saveHistoryState(); _setCapacityConfig(val); }, [saveHistoryState]);
  const setRoutes = useCallback((val) => { saveHistoryState(); _setRoutes(val); }, [saveHistoryState]);

  const routeCCTs = useMemo(() => {
    const active = routes.find(r => r.id === activeRouteId);
    return active ? active.ccts : [];
  }, [routes, activeRouteId]);

  const setRouteCCTs = useCallback((updater) => {
    setRoutes(prev => prev.map(r => {
      if (r.id !== activeRouteId) return r;
      const nextCCTs = typeof updater === 'function' ? updater(r.ccts) : updater;
      return { ...r, ccts: nextCCTs };
    }));
  }, [activeRouteId]);

  // ─── UI state ───
  const [showWelcome, setShowWelcome] = useState(false);
  const [showProjectSwitcher, setShowProjectSwitcher] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showAddConcentrado, setShowAddConcentrado] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [metaPorDia, setMetaPorDia] = useState(0);
  const [focusedSchoolKey, setFocusedSchoolKey] = useState(null);
  const [showMissingSchools, setShowMissingSchools] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [distributionCollapsed, setDistributionCollapsed] = useState(true);
  const [swappedWidgets, setSwappedWidgets] = useState(false);
  
  // Height Logic & Memory
  const [distributionHeight, setDistributionHeight] = useState(360);
  const [distUserResized, setDistUserResized] = useState(false);
  const distributionResizeRef = useRef({ active: false, startY: 0, startHeight: 360 });
  const [pulseDrawer, setPulseDrawer] = useState(false);
  const prevFilteredCountRef = useRef(0);
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

  useEffect(() => {
    if (hasLoadedRef.current && distributionCollapsed && prevFilteredCountRef.current !== filteredSchools.length) {
      setPulseDrawer(true);
      const t = setTimeout(() => setPulseDrawer(false), 2000);
      prevFilteredCountRef.current = filteredSchools.length;
      return () => clearTimeout(t);
    }
    prevFilteredCountRef.current = filteredSchools.length;
  }, [filteredSchools.length, distributionCollapsed]);

  // ─── Double-shift detection ───
  // Same coordinates + 2+ distinct turnos = one physical site, several shifts.
  // We use ALL schools (not filtered) so the tooltip can "confess" shifts that
  // don't pass the filters. Campus coords are excluded (campus is by levels).
  const turnoMap = useMemo(() => {
    const byCoord = new Map();
    for (const s of schools) {
      if (s.latitud == null || s.longitud == null) continue;
      const key = `${s.latitud},${s.longitud}`;
      if (campusMap.has(key)) continue; // campus handled separately
      if (!byCoord.has(key)) byCoord.set(key, []);
      byCoord.get(key).push(s);
    }
    const result = new Map();
    for (const [key, group] of byCoord) {
      if (group.length < 2) continue;
      const turnos = new Set(group.map(s => (s.turno || '').toUpperCase()).filter(Boolean));
      if (turnos.size >= 2) result.set(key, group);
    }
    return result;
  }, [schools, campusMap]);

  const routeSet = useMemo(() => new Set(routeCCTs), [routeCCTs]);

  // Profitability view: calculates metrics (ops/days) based on capacity config
  const profitColors = useMemo(() => {
    const capacity = calculateCapacity(capacityConfig);
    return buildProfitabilityColors(filteredSchools, capacity, prices, campusCCTs, campusTotals);
  }, [capacityConfig, filteredSchools, prices, campusCCTs, campusTotals]);

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
    const loadedRoutes = project.routes || [{ id: 'r1', name: 'Ruta 1', color: '#10B981', visible: true, ccts: project.route || [] }];
    setRoutes(loadedRoutes);
    setActiveRouteId(loadedRoutes[0]?.id || 'r1');
    if (project.filters) setFilters(project.filters);
    if (project.prices) setPrices(project.prices);

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
    
    // Restore metaPorDia
    if (project.filters?.metaPorDia !== undefined) {
      setMetaPorDia(project.filters.metaPorDia);
    }
  }, []);

  // ─── Handle new project from WelcomeModal ───
  const handleProjectReady = useCallback(async ({ name, owner, pin, stats, schools: parsedSchools, meta }) => {
    const ranges = getStudentRangeByType(parsedSchools);
    setSchools(parsedSchools);
    setProjectMeta({ id: null, name, fileName: meta.fileName, owner, pin, stats });
    setRoutes([{ id: 'r1', name: 'Ruta 1', color: '#10B981', visible: true, ccts: [] }]);
    setActiveRouteId('r1');
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
        routes: [{ id: 'r1', name: 'Ruta 1', color: '#10B981', visible: true, ccts: [] }],
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
          metaPorDia: 0,
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
          filters: { ...filters, metaPorDia },
          prices,
          somPercent: 30,
          route: routeCCTs,
          routes: routes,
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
          routes: routes,
          filters: { ...filters, metaPorDia },
          prices,
          somPercent: 30,
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
  }, [projectMeta, schools, routes, routeCCTs, filters, prices, metaPorDia]);

  // ─── Auto-save debounced effect ───
  useEffect(() => {
    if (!hasLoadedRef.current || !projectMeta.id || isReadOnly) return;
    
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      if (hasLoadedRef.current && prevFilteredCountRef.current > 0) {
        saveProjectMeta(projectMeta.id, {
          filters: { ...filters, metaPorDia },
          prices,
          somPercent: 30,
          route: routeCCTs,
          routes
        }).catch(err => {
          console.error('[Intel] Auto-save meta failed:', err);
        });
      }
    }, 2000);

    return () => clearTimeout(autoSaveTimerRef.current);
  }, [filters, prices, routes, projectMeta.id, metaPorDia]);

  // ─── Route operations ───
  const handleSchoolClick = useCallback((school, isCampus, markerKey) => {
    setFocusedSchoolKey(prev => prev === (markerKey || school.cct) ? null : (markerKey || school.cct));
  }, []);

  const handleFocusSchoolKey = useCallback((key) => {
    setFocusedSchoolKey(key);
  }, []);

  const handleFocusCity = useCallback((city) => {
    if (leafletMapRef.current && city?.lats?.length) {
      const p = 0.01;
      leafletMapRef.current.flyToBounds(
        [
          [Math.min(...city.lats) - p, Math.min(...city.lngs) - p],
          [Math.max(...city.lats) + p, Math.max(...city.lngs) + p],
        ],
        { paddingTopLeft: [50, 50], paddingBottomRight: [50, distributionCollapsed ? 70 : distributionHeight + 80], duration: 0.8 }
      );
    }
  }, [distributionCollapsed, distributionHeight]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!distributionResizeRef.current.active) return;
      const delta = distributionResizeRef.current.startY - e.clientY;
      const newHeight = Math.min(window.innerHeight - 100, Math.max(150, distributionResizeRef.current.startHeight + delta));
      setDistributionHeight(newHeight);
      setDistUserResized(true);
    };
    const onUp = () => {
      distributionResizeRef.current.active = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleAddToRoute = useCallback((cctsToAdd) => {
    setRouteCCTs(prev => {
      const newSet = new Set(prev);
      cctsToAdd.forEach(cct => newSet.add(cct));
      return Array.from(newSet);
    });
  }, [setRouteCCTs]);

  const handleRemoveFromRoute = useCallback((cct) => {
    setRouteCCTs(prev => prev.filter(c => c !== cct));
  }, [setRouteCCTs]);

  const handleClearRoute = useCallback(() => {
    setRouteCCTs([]);
  }, [setRouteCCTs]);

  const handleReorderRoute = useCallback((newOrder) => {
    setRouteCCTs(newOrder);
  }, [setRouteCCTs]);

  // ─── Project switching ───
  const handleSelectProject = useCallback(async (id, readOnly = false, enteredPin = null) => {
    hasLoadedRef.current = false; // Pause auto-save during switch
    setLoading(true);
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
    setShowWelcome(false);
    setLoading(false);
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
          onSelectProject={handleSelectProject}
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
          <div className="flex items-center min-w-0">
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="truncate">{projectMeta.name || 'Proyecto sin título'}</span>
                {isReadOnly && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-400 text-[10px] font-bold uppercase tracking-wider border border-slate-500/30">
                    Solo Lectura
                  </span>
                )}
              </h1>
              <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2 truncate">
                {schools.length} escuelas en total
                {projectMeta.owner && (
                  <span className="flex items-center gap-1 before:content-['·'] before:text-gray-600">
                    <span className="text-gray-500 truncate">Por {projectMeta.owner}</span>
                  </span>
                )}
              </p>
            </div>
            {/* Nivel educativo badges */}
            <div className="hidden lg:flex items-center gap-1 ml-4">
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
      </div>

        <div className="flex items-center gap-2">
          {/* Save toast */}
          {saveToast && (
            <span className="text-[10px] font-bold text-emerald-400 animate-intel-fade-in">
              ✓ Guardado
            </span>
          )}

          {/* Undo Button */}
          <button
            onClick={undo}
            className="intel-btn intel-btn-ghost text-xs flex items-center gap-1.5 mr-2"
            title="Deshacer último cambio (Ctrl+Z)"
          >
            <Undo2 size={13} />
            Deshacer
          </button>

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
          collapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed(!leftCollapsed)}
          campusCount={campusMap.size}
          onOpenMissingSchools={() => setShowMissingSchools(true)}
          capacityConfig={capacityConfig}
          onConfigChange={setCapacityConfig}
          metaPorDia={metaPorDia}
          onMetaChange={setMetaPorDia}
        />

        {/* Center: Map + floating distribution drawer */}
        <div className="flex-1 min-w-0 relative">
          <IntelMap
            schools={filteredSchools}
            routes={routes}
            activeRouteId={activeRouteId}
            onRouteSelect={setActiveRouteId}
            onRoutesChange={setRoutes}
            routeCCTs={routeCCTs}
            onSchoolClick={handleSchoolClick}
            mapInstanceRef={leafletMapRef}
            campusMap={campusMap}
            focusedSchoolKey={focusedSchoolKey}
            onClearFocus={() => setFocusedSchoolKey(null)}
            onAddToRoute={handleAddToRoute}
            profitColors={profitColors}
            turnoMap={turnoMap}
            prices={prices}
            metaPorDia={metaPorDia}
            capacityConfig={capacityConfig}
            bottomInset={distributionCollapsed ? 56 : distributionHeight + 24}
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

          {/* Distribución: drawer inferior premium, sobre el mapa */}
          <div
            className={`intel-distribution-drawer ${distributionCollapsed ? 'is-collapsed cursor-pointer' : ''} ${pulseDrawer && distributionCollapsed ? 'animate-intel-pulse-glow' : ''}`}
            style={{ 
              height: distributionCollapsed ? 56 : (distUserResized ? distributionHeight : 'calc(100% - 32px)'), 
              right: swappedWidgets 
                ? 'var(--intel-widget-margin)' 
                : 'calc(var(--intel-widget-margin) + var(--intel-widget-width) + var(--intel-widget-gap))' 
            }}
          >
            <div
              className="intel-distribution-drawer-handle"
              onMouseDown={(e) => {
                e.preventDefault();
                distributionResizeRef.current = { 
                  active: true, 
                  startY: e.clientY, 
                  startHeight: e.currentTarget.parentElement.clientHeight 
                };
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <div 
              className={`intel-distribution-drawer-header cursor-pointer ${distributionCollapsed ? 'hover:bg-white/5 transition-colors' : ''}`}
              onClick={() => setDistributionCollapsed(!distributionCollapsed)}
            >
              <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                <MapPin size={16} className="text-purple-400 shrink-0" />
                <span className="font-black text-white text-sm truncate">Distribución</span>
                <span className="text-[11px] text-gray-400 ml-2">
                  <AnimatedCounter value={filteredSchools.length} /> escuelas
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDistributionCollapsed(v => !v);
                  }}
                  className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-white transition-colors"
                  title={distributionCollapsed ? 'Abrir distribución' : 'Minimizar distribución'}
                >
                  {distributionCollapsed ? 'Abrir' : 'Minimizar'}
                </button>
              </div>
            </div>
            {!distributionCollapsed && (
              <div className="intel-distribution-drawer-body">
                <DistribucionPanel
                  variant="drawer"
                  filteredSchools={filteredSchools}
                  prices={prices}
                  campusMap={campusMap}
                  turnoMap={turnoMap}
                  capacityConfig={capacityConfig}
                  metaPorDia={metaPorDia}
                  onFocusCity={handleFocusCity}
                  onFocusSchoolKey={handleFocusSchoolKey}
                />
              </div>
            )}
          </div>

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

          {/* ═══ CENTRAL SWAP BUTTON (FAB) ═══ */}
          <button
            onClick={() => setSwappedWidgets(v => !v)}
            className="absolute z-[1200] bottom-5 w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white flex items-center justify-center transition-all shadow-lg hover:scale-110 active:scale-95"
            style={{ 
              right: 'calc(var(--intel-widget-margin) + var(--intel-widget-width) + (var(--intel-widget-gap) / 2))', 
              transform: 'translateX(50%)' 
            }}
            title="Intercambiar Paneles"
          >
            <ArrowLeftRight size={18} strokeWidth={2.5} />
          </button>

          {/* Right Sidebar Widget (now floating over map) */}
          <RightSidebar
            collapsed={rightCollapsed}
            onToggleCollapse={() => setRightCollapsed(!rightCollapsed)}
            isSwapped={swappedWidgets}
            onSwap={() => setSwappedWidgets(v => !v)}
            schools={schools}
            routes={routes}
            activeRouteId={activeRouteId}
            onRouteSelect={setActiveRouteId}
            onRoutesChange={setRoutes}
            routeCCTs={routeCCTs}
            prices={prices}
            campusMap={campusMap}
            onRemoveFromRoute={handleRemoveFromRoute}
            onClearRoute={handleClearRoute}
            onReorderRoute={handleReorderRoute}
            onSaveProject={handleSave}
            onViewReport={() => setShowReport(true)}
          />
        </div>
      </div>

      {/* ═══ MODALS ═══ */}
      {showProjectSwitcher && (
        <ProjectSwitcher
          onSelectProject={handleSelectProject}
          onNewProject={handleNewProject}
          onClose={() => setShowProjectSwitcher(false)}
        />
      )}

      {showReport && routes.some(r => r.ccts.length > 0) && (
        <RouteReportModal
          projectName={projectMeta.name}
          schools={schools}
          routes={routes}
          activeRouteId={activeRouteId}
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
