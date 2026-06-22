'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Filter, RotateCcw, School, BookOpen, MapPinOff, Gauge, Plane, Repeat, Armchair, Sun, Building2 } from 'lucide-react';
import { formatMXN, formatNumber, calculateTAM, getUniqueMunicipios, getUniqueTurnos, getUniqueNiveles, getStudentRange, getStudentRangeByType, getRevenueRangeByType, calculateCapacity, CAPACITY_DEFAULTS, getTurnoStyles } from '../lib/filters';

export default function CommandPanel({
  schools,
  filteredSchools,
  filteredCount,
  filters,
  onFilterChange,
  prices,
  onPriceChange,
  collapsed,
  onToggleCollapse,
  onOpenMissingSchools,
  onOpenConcentration,
  capacityConfig = CAPACITY_DEFAULTS,
  onConfigChange,
  metaPorDia = 0,
  onMetaChange,
}) {
  const municipios = useMemo(() => getUniqueMunicipios(schools), [schools]);
  const turnos = useMemo(() => getUniqueTurnos(schools), [schools]);
  const niveles = useMemo(() => getUniqueNiveles(schools), [schools]);
  const studentRange = useMemo(() => getStudentRange(schools), [schools]);
  const studentRangeByType = useMemo(() => getStudentRangeByType(schools), [schools]);
  const missingSchoolsCount = useMemo(() => schools.filter(s => s.latitud == null || s.longitud == null).length, [schools]);
  const revenueRangeByType = useMemo(() => getRevenueRangeByType(schools, prices), [schools, prices]);

  // ─── Debounced slider state ───
  const [localPremium, setLocalPremium] = useState(prices.premium);
  const [localBase, setLocalBase] = useState(prices.base);
  const [localRevPubMin, setLocalRevPubMin] = useState(filters.revenueMinPub ?? 0);
  const [localRevPubMax, setLocalRevPubMax] = useState(filters.revenueMaxPub ?? revenueRangeByType.pub.max);
  const [localRevPrivMin, setLocalRevPrivMin] = useState(filters.revenueMinPriv ?? 0);
  const [localRevPrivMax, setLocalRevPrivMax] = useState(filters.revenueMaxPriv ?? revenueRangeByType.priv.max);
  const [localRevPubVesp, setLocalRevPubVesp] = useState(filters.revenueMinPubVesp ?? 0);
  const [localRevPrivVesp, setLocalRevPrivVesp] = useState(filters.revenueMinPrivVesp ?? 0);
  const [localMeta, setLocalMeta] = useState(metaPorDia);

  const debounceRef = useRef(null);

  // ─── Capacity config helpers ───
  const cfg = capacityConfig;
  const setCfg = useCallback((patch) => {
    onConfigChange?.(prev => ({ ...prev, ...patch }));
  }, [onConfigChange]);

  // Live throughput per type (niños/día)
  const capacity = useMemo(() => calculateCapacity(cfg), [cfg]);
  const ninosDiaPub = Math.floor(capacity.ninosPorDiaPub);
  const ninosDiaPriv = Math.floor(capacity.ninosPorDiaPriv);

  // ─── Resizable panel width (drag handle on the right edge) ───
  const [panelWidth, setPanelWidth] = useState(380);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(380);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  useEffect(() => {
    const onMove = (e) => {
      if (!isResizing.current) return;
      // Handle is on the right edge: dragging right = wider
      const delta = e.clientX - startX.current;
      setPanelWidth(Math.min(560, Math.max(300, startWidth.current + delta)));
    };
    const onUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Sync local state when filters change externally (e.g. reset, project load)
  useEffect(() => {
    setLocalRevPubMin(filters.revenueMinPub ?? 0);
    setLocalRevPubMax(filters.revenueMaxPub ?? revenueRangeByType.pub.max);
    setLocalRevPrivMin(filters.revenueMinPriv ?? 0);
    setLocalRevPrivMax(filters.revenueMaxPriv ?? revenueRangeByType.priv.max);
    setLocalRevPubVesp(filters.revenueMinPubVesp ?? 0);
    setLocalRevPrivVesp(filters.revenueMinPrivVesp ?? 0);
  }, [filters.revenueMinPub, filters.revenueMaxPub, filters.revenueMinPriv, filters.revenueMaxPriv, filters.revenueMinPubVesp, filters.revenueMinPrivVesp, revenueRangeByType]);

  useEffect(() => {
    setLocalPremium(prices.premium);
    setLocalBase(prices.base);
  }, [prices]);

  const debouncedFilterChange = useCallback((key, value) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFilterChange(prev => ({ ...prev, [key]: value }));
    }, 150);
  }, [onFilterChange]);

  const debouncedPriceChange = useCallback((key, value) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onPriceChange(prev => ({ ...prev, [key]: value }));
    }, 150);
  }, [onPriceChange]);

  // Use the parent's provided filteredSchools for TAM calculation
  const tam = useMemo(() => calculateTAM(filteredSchools, prices), [filteredSchools, prices]);

  const handleReset = () => {
    onFilterChange({
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
      revenueMinPubVesp: null,
      revenueMinPrivVesp: null,
    });
  };

  if (collapsed) return null;

  return (
    <div
      className="relative h-full flex flex-col bg-[var(--intel-surface)] border-r border-[var(--intel-border)] shrink-0 overflow-hidden"
      style={{ width: panelWidth }}
    >
      {/* ═══ Resize Handle (right edge) ═══ */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors z-20"
        onMouseDown={handleResizeStart}
        title="Arrastra para ajustar el ancho"
      />

      {/* Header */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-500/15">
              <Filter size={18} className="text-blue-400" />
            </div>
            <h2 className="text-base font-bold text-white">Centro de Mandos</h2>
          </div>
          <button
            onClick={handleReset}
            className="text-[11px] font-bold text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 uppercase tracking-wider"
            title="Limpiar filtros"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>

        {/* Counter badge */}
        <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <School size={16} className="text-blue-400" />
          <span className="text-sm font-bold text-white">{formatNumber(filteredCount)}</span>
          <span className="text-sm text-gray-500">de {formatNumber(schools.length)} escuelas</span>
        </div>

        {/* Missing Coordinates Warning */}
        {missingSchoolsCount > 0 && (
          <div className="mt-2 flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border bg-amber-500/10 border-amber-500/20">
            <div className="flex items-center gap-2">
              <MapPinOff size={16} className="text-amber-500" />
              <span className="text-xs font-bold leading-tight text-amber-500/90">
                {formatNumber(missingSchoolsCount)} escuelas<br/>
                <span className="text-[11px] font-medium text-amber-500/70">sin ubicación GPS</span>
              </span>
            </div>
            <button
              onClick={onOpenMissingSchools}
              className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded transition-colors bg-amber-500/20 hover:bg-amber-500/30 text-amber-400"
            >
              Ver lista
            </button>
          </div>
        )}

      </div>

      {/* Scrollable filters content */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
            {/* ═══ SECTION A: FILTERS ═══ */}
            <section className="space-y-4">
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-5">
                Filtros de Segmentación
              </h3>

          {/* Municipio */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400">Municipio</label>
            <select
              className="intel-select"
              value={filters.municipio || '__all__'}
              onChange={(e) => onFilterChange({ ...filters, municipio: e.target.value })}
            >
              <option value="__all__">Todos los municipios</option>
              {municipios.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Sostenimiento */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400">Sostenimiento</label>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              {['todas', 'publicas', 'privadas'].map(opt => (
                <button
                  key={opt}
                  onClick={() => onFilterChange({ ...filters, sostenimiento: opt })}
                  className={`py-1.5 px-2 rounded-md text-xs font-bold transition-all ${
                    filters.sostenimiento === opt
                      ? opt === 'privadas'
                        ? 'bg-amber-500/20 text-amber-400 shadow-sm'
                        : opt === 'publicas'
                          ? 'bg-blue-500/20 text-blue-400 shadow-sm'
                          : 'bg-white/10 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {opt === 'todas' ? 'Todas' : opt === 'publicas' ? 'Públicas' : 'Privadas'}
                </button>
              ))}
            </div>
          </div>

          {/* Turno */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              Turno
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-[11px] uppercase tracking-wider transition-all shadow-sm ${
                  filters.turno === '__all__' 
                    ? 'bg-white/10 text-white border-white/20 shadow-white/5' 
                    : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.08]'
                }`}
                onClick={() => onFilterChange({ ...filters, turno: '__all__' })}
              >
                Todos
              </button>
              {turnos.map(t => {
                const isActive = filters.turno === t;
                const st = getTurnoStyles(t);
                const Icon = st.IconComponent;
                return (
                  <button
                    key={t}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-[11px] uppercase tracking-wider transition-all shadow-sm ${
                      isActive 
                        ? `${st.gradientClass} ${st.textClass} border-transparent shadow-lg ${st.shadowClass}` 
                        : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.08]'
                    }`}
                    style={isActive ? { textShadow: '0px 1px 2px rgba(0,0,0,0.2)' } : {}}
                    onClick={() => onFilterChange({ ...filters, turno: isActive ? '__all__' : t })}
                  >
                    <Icon size={12} strokeWidth={isActive ? 2.5 : 2} />
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nivel Educativo */}
          {niveles.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                <BookOpen size={12} className="text-blue-400" />
                Nivel Educativo
              </label>
              <select
                className="intel-select"
                value={filters.nivelEducativo || '__all__'}
                onChange={(e) => onFilterChange({ ...filters, nivelEducativo: e.target.value })}
              >
                <option value="__all__">Todos los niveles</option>
                {niveles.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}

          {/* ═══ META DE INGRESO / DÍA ═══ */}
          <div className="space-y-2 mt-2 pt-3 border-t border-emerald-500/20">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                🎯 Meta de ingreso / día
              </label>
              <span className="text-sm font-black tabular-nums text-emerald-400">
                {localMeta > 0 ? formatMXN(localMeta) : 'Sin meta'}
              </span>
            </div>
            <input
              type="range" className="intel-range intel-range-emerald w-full"
              min={0} max={30000} step={500}
              value={localMeta}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                setLocalMeta(v);
                onMetaChange?.(v);
              }}
            />
            <div className="text-[10px] text-gray-500 leading-tight">
              Verde = escuelas que superan tu meta · Rojo = por debajo
            </div>
          </div>

          {/* ═══ ESCUELAS PÚBLICAS ═══ */}
          <div className="space-y-3 mt-2 pt-3 border-t border-blue-500/20">
            <label className="text-sm font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              🔵 Escuelas Públicas
            </label>

            {/* ⚙️ Capacidad Operativa — Públicas */}
            <div className="rounded-xl border border-blue-500/25 bg-blue-500/[0.06] p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <Gauge size={13} className="text-blue-400" /> Capacidad Operativa
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-2xl font-black tabular-nums text-blue-400">{formatNumber(ninosDiaPub)}</div>
                  <div className="text-[11px] text-gray-500">niños / día</div>
                </div>
                <div>
                  <div className="text-2xl font-black tabular-nums text-blue-400">{formatMXN(ninosDiaPub * prices.base)}</div>
                  <div className="text-[11px] text-gray-500">ingreso / día</div>
                </div>
              </div>

              <div className="pt-2 border-t border-blue-500/15 space-y-3">
                {/* Precio por Alumno - Públicas */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-gray-300 font-medium flex items-center gap-1.5">📦 Precio por alumno</span>
                    <div className="flex items-center gap-0.5">
                      <span className="text-[11px] text-blue-400/60">$</span>
                      <input
                        type="number" min={0} max={9999}
                        className="w-16 bg-transparent text-right text-blue-300 font-bold text-sm border-b border-blue-500/30 focus:border-blue-400 outline-none pb-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={localBase}
                        onChange={(e) => { setLocalBase(parseInt(e.target.value) || 0); }}
                        onBlur={(e) => {
                          const v = Math.max(0, parseInt(e.target.value) || 0);
                          setLocalBase(v);
                          onPriceChange(prev => ({ ...prev, base: v }));
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                      />
                    </div>
                  </div>
                  <input
                    type="range" className="intel-range w-full" min={0} max={300} step={5}
                    value={Math.min(localBase, 300)}
                    onChange={(e) => { const v = parseInt(e.target.value); setLocalBase(v); debouncedPriceChange('base', v); }}
                  />
                </div>

                <VarSlider icon={Armchair} accent="blue" label="Gafas" badge="⇄ equipo"
                  value={cfg.plazas} min={4} max={40} step={1} unit=""
                  onChange={(v) => setCfg({ plazas: v })} />
                <VarSlider icon={Plane} accent="blue" label="Tiempo de vuelo" badge="⇄ equipo"
                  value={cfg.tiempoVueloMin} min={3} max={15} step={0.5} unit="min"
                  onChange={(v) => setCfg({ tiempoVueloMin: v })} />
                <VarSlider icon={Repeat} accent="blue" label="Tiempo entre vuelos" badge="⇄ equipo"
                  value={cfg.tiempoCambioMin} min={1} max={10} step={0.5} unit="min"
                  onChange={(v) => setCfg({ tiempoCambioMin: v })} />
                <VarSlider icon={Sun} accent="blue" label="Horas útiles"
                  value={cfg.horasUtilPub} min={1} max={8} step={0.5} unit="h"
                  onChange={(v) => setCfg({ horasUtilPub: v })} />
              </div>
            </div>

            {/* 🔍 Filtrar Escuelas — Públicas */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <Filter size={13} className="text-blue-400" /> Filtrar Escuelas
              </div>

              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400/50">Mínimo</div>

            {/* Matrícula Mín - Públicas */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-300 font-medium">👨‍🎓 Matrícula Mín</span>
                <span className="text-[13px] font-bold text-blue-400">
                  {prices.base > 0 ? Math.ceil(localRevPubMin / prices.base) : 0} alumnos
                </span>
              </div>
              <input
                type="range" className="intel-range w-full" min={0} max={studentRangeByType.pub.max}
                value={prices.base > 0 ? Math.ceil(localRevPubMin / prices.base) : 0}
                onChange={(e) => {
                  const alumnos = parseInt(e.target.value);
                  const rev = alumnos * prices.base;
                  setLocalRevPubMin(rev);
                  debouncedFilterChange('revenueMinPub', rev <= 0 ? null : rev);
                }}
              />
            </div>
            {/* Ingreso Mín - Públicas */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-300 font-medium">💰 Ingreso Mín</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[11px] text-blue-400/60">$</span>
                  <input
                    type="number" min={0} step={100}
                    className="w-16 bg-transparent text-right text-blue-400 font-bold text-xs border-b border-blue-500/30 focus:border-blue-400 outline-none pb-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={localRevPubMin}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 0;
                      setLocalRevPubMin(v);
                      debouncedFilterChange('revenueMinPub', v <= 0 ? null : v);
                    }}
                  />
                </div>
              </div>
              <input
                type="range" className="intel-range w-full" min={0}
                max={revenueRangeByType.pub.max}
                step={1}
                value={localRevPubMin}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setLocalRevPubMin(v);
                  debouncedFilterChange('revenueMinPub', v <= 0 ? null : v);
                }}
              />
            </div>

            {/* 🌙 Mínimo vespertino - Públicas (más permisivo) */}
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/[0.05] p-2.5 space-y-2.5">
              <div className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                🌙 Mínimo turno vespertino
                <span className="text-[9px] font-medium text-gray-500 normal-case">solo vespertino</span>
              </div>
              {/* Matrícula Mín Vesp */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-300 font-medium">👨‍🎓 Matrícula Mín</span>
                  <span className="text-[12px] font-bold text-indigo-300">
                    {prices.base > 0 ? Math.ceil(localRevPubVesp / prices.base) : 0} alumnos
                  </span>
                </div>
                <input
                  type="range" className="intel-range w-full" min={0} max={studentRangeByType.pub.max}
                  value={prices.base > 0 ? Math.ceil(localRevPubVesp / prices.base) : 0}
                  onChange={(e) => {
                    const rev = parseInt(e.target.value) * prices.base;
                    setLocalRevPubVesp(rev);
                    debouncedFilterChange('revenueMinPubVesp', rev <= 0 ? null : rev);
                  }}
                />
              </div>
              {/* Ingreso Mín Vesp */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-300 font-medium">💰 Ingreso Mín</span>
                  <div className="flex items-center gap-0.5">
                    <span className="text-[11px] text-indigo-300/60">$</span>
                    <input
                      type="number" min={0} step={100}
                      className="w-16 bg-transparent text-right text-indigo-300 font-bold text-sm border-b border-indigo-500/30 focus:border-indigo-400 outline-none pb-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={localRevPubVesp}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 0;
                        setLocalRevPubVesp(v);
                        debouncedFilterChange('revenueMinPubVesp', v <= 0 ? null : v);
                      }}
                    />
                  </div>
                </div>
                <input
                  type="range" className="intel-range w-full" min={0} max={revenueRangeByType.pub.max}
                  value={localRevPubVesp}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setLocalRevPubVesp(v);
                    debouncedFilterChange('revenueMinPubVesp', v <= 0 ? null : v);
                  }}
                />
              </div>
            </div>

            <div className="border-t border-white/[0.06] my-1" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400/50">Máximo</div>

            {/* Matrícula Máx - Públicas */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-300 font-medium">👨‍🎓 Matrícula Máx</span>
                <span className="text-[13px] font-bold text-blue-400">
                  {prices.base > 0 ? Math.floor(localRevPubMax / prices.base) : studentRangeByType.pub.max} alumnos
                </span>
              </div>
              <input
                type="range" className="intel-range w-full" min={0} max={studentRangeByType.pub.max}
                value={prices.base > 0 ? Math.floor(localRevPubMax / prices.base) : studentRangeByType.pub.max}
                onChange={(e) => {
                  const alumnos = parseInt(e.target.value);
                  const rev = alumnos * prices.base;
                  setLocalRevPubMax(rev);
                  debouncedFilterChange('revenueMaxPub', rev >= revenueRangeByType.pub.max ? null : rev);
                }}
              />
            </div>
            {/* Ingreso Máx - Públicas */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-300 font-medium">💰 Ingreso Máx</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[11px] text-blue-400/60">$</span>
                  <input
                    type="number" min={0} step={100}
                    className="w-16 bg-transparent text-right text-blue-400 font-bold text-xs border-b border-blue-500/30 focus:border-blue-400 outline-none pb-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={localRevPubMax}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 0;
                      setLocalRevPubMax(v);
                      debouncedFilterChange('revenueMaxPub', v >= revenueRangeByType.pub.max ? null : v);
                    }}
                  />
                </div>
              </div>
              <input
                type="range" className="intel-range w-full" min={0} max={revenueRangeByType.pub.max}
                value={localRevPubMax}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setLocalRevPubMax(v);
                  debouncedFilterChange('revenueMaxPub', v >= revenueRangeByType.pub.max ? null : v);
                }}
              />
            </div>
            </div>{/* /Filtrar Escuelas Públicas */}
          </div>

          {/* Contextual TAM Público */}
          <div className="mt-4 p-4 bg-gradient-to-br from-blue-500/15 to-blue-500/[0.03] border border-blue-500/30 rounded-2xl space-y-1.5 shadow-lg shadow-blue-500/5">
            <div className="text-[11px] font-bold text-blue-300/80 uppercase tracking-widest flex items-center gap-1.5">
              💰 Potencial Público
            </div>
            <div className="text-3xl font-black text-blue-400 tabular-nums leading-none">
              {formatMXN(tam.publicValue)}
            </div>
            <div className="text-[12px] text-gray-400">
              <strong className="text-blue-400/90">{formatNumber(tam.publicSchools)} escuelas</strong> · {formatNumber(tam.publicStudents)} alumnos · {formatMXN(prices.base)} c/u
            </div>
          </div>

          {/* ═══ ESCUELAS PRIVADAS ═══ */}
          <div className="space-y-3 mt-2 pt-3 border-t border-amber-500/20">
            <label className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              🟡 Escuelas Privadas (incluye Campus)
            </label>

            {/* ⚙️ Capacidad Operativa — Privadas */}
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <Gauge size={13} className="text-amber-400" /> Capacidad Operativa
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-2xl font-black tabular-nums text-amber-400">{formatNumber(ninosDiaPriv)}</div>
                  <div className="text-[11px] text-gray-500">niños / día</div>
                </div>
                <div>
                  <div className="text-2xl font-black tabular-nums text-amber-400">{formatMXN(ninosDiaPriv * prices.premium)}</div>
                  <div className="text-[11px] text-gray-500">ingreso / día</div>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-500/15 space-y-3">
                {/* Precio por Alumno - Privadas */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-gray-300 font-medium flex items-center gap-1.5">📦 Precio por alumno</span>
                    <div className="flex items-center gap-0.5">
                      <span className="text-[11px] text-amber-400/60">$</span>
                      <input
                        type="number" min={0} max={9999}
                        className="w-16 bg-transparent text-right text-amber-300 font-bold text-sm border-b border-amber-500/30 focus:border-amber-400 outline-none pb-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={localPremium}
                        onChange={(e) => { setLocalPremium(parseInt(e.target.value) || 0); }}
                        onBlur={(e) => {
                          const v = Math.max(0, parseInt(e.target.value) || 0);
                          setLocalPremium(v);
                          onPriceChange(prev => ({ ...prev, premium: v }));
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                      />
                    </div>
                  </div>
                  <input
                    type="range" className="intel-range intel-range-gold w-full" min={0} max={500} step={10}
                    value={Math.min(localPremium, 500)}
                    onChange={(e) => { const v = parseInt(e.target.value); setLocalPremium(v); debouncedPriceChange('premium', v); }}
                  />
                </div>

                <VarSlider icon={Armchair} accent="gold" label="Gafas" badge="⇄ equipo"
                  value={cfg.plazas} min={4} max={40} step={1} unit=""
                  onChange={(v) => setCfg({ plazas: v })} />
                <VarSlider icon={Plane} accent="gold" label="Tiempo de vuelo" badge="⇄ equipo"
                  value={cfg.tiempoVueloMin} min={3} max={15} step={0.5} unit="min"
                  onChange={(v) => setCfg({ tiempoVueloMin: v })} />
                <VarSlider icon={Repeat} accent="gold" label="Tiempo entre vuelos" badge="⇄ equipo"
                  value={cfg.tiempoCambioMin} min={1} max={10} step={0.5} unit="min"
                  onChange={(v) => setCfg({ tiempoCambioMin: v })} />
                <VarSlider icon={Building2} accent="gold" label="Horas útiles"
                  value={cfg.horasUtilPriv} min={1} max={8} step={0.5} unit="h"
                  onChange={(v) => setCfg({ horasUtilPriv: v })} />
              </div>
            </div>

            {/* 🔍 Filtrar Escuelas — Privadas */}
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <Filter size={13} className="text-amber-400" /> Filtrar Escuelas
              </div>

              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400/50">Mínimo</div>

            {/* Matrícula Mín - Privadas */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-300 font-medium">👨‍🎓 Matrícula Mín</span>
                <span className="text-[13px] font-bold text-amber-400">
                  {prices.premium > 0 ? Math.ceil(localRevPrivMin / prices.premium) : 0} alumnos
                </span>
              </div>
              <input
                type="range" className="intel-range intel-range-gold w-full" min={0} max={studentRangeByType.priv.max}
                value={prices.premium > 0 ? Math.ceil(localRevPrivMin / prices.premium) : 0}
                onChange={(e) => {
                  const alumnos = parseInt(e.target.value);
                  const rev = alumnos * prices.premium;
                  setLocalRevPrivMin(rev);
                  debouncedFilterChange('revenueMinPriv', rev <= 0 ? null : rev);
                }}
              />
            </div>
            {/* Ingreso Mín - Privadas */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-300 font-medium">💰 Ingreso Mín</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[11px] text-amber-400/60">$</span>
                  <input
                    type="number" min={0} step={100}
                    className="w-16 bg-transparent text-right text-amber-400 font-bold text-xs border-b border-amber-500/30 focus:border-amber-400 outline-none pb-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={localRevPrivMin}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 0;
                      setLocalRevPrivMin(v);
                      debouncedFilterChange('revenueMinPriv', v <= 0 ? null : v);
                    }}
                  />
                </div>
              </div>
              <input
                type="range" className="intel-range intel-range-gold w-full" min={0}
                max={revenueRangeByType.priv.max}
                step={1}
                value={localRevPrivMin}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setLocalRevPrivMin(v);
                  debouncedFilterChange('revenueMinPriv', v <= 0 ? null : v);
                }}
              />
            </div>

            {/* 🌙 Mínimo vespertino - Privadas (más permisivo) */}
            <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/[0.05] p-2.5 space-y-2.5">
              <div className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                🌙 Mínimo turno vespertino
                <span className="text-[9px] font-medium text-gray-500 normal-case">solo vespertino</span>
              </div>
              {/* Matrícula Mín Vesp */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-300 font-medium">👨‍🎓 Matrícula Mín</span>
                  <span className="text-[12px] font-bold text-indigo-300">
                    {prices.premium > 0 ? Math.ceil(localRevPrivVesp / prices.premium) : 0} alumnos
                  </span>
                </div>
                <input
                  type="range" className="intel-range intel-range-gold w-full" min={0} max={studentRangeByType.priv.max}
                  value={prices.premium > 0 ? Math.ceil(localRevPrivVesp / prices.premium) : 0}
                  onChange={(e) => {
                    const rev = parseInt(e.target.value) * prices.premium;
                    setLocalRevPrivVesp(rev);
                    debouncedFilterChange('revenueMinPrivVesp', rev <= 0 ? null : rev);
                  }}
                />
              </div>
              {/* Ingreso Mín Vesp */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-gray-300 font-medium">💰 Ingreso Mín</span>
                  <div className="flex items-center gap-0.5">
                    <span className="text-[11px] text-indigo-300/60">$</span>
                    <input
                      type="number" min={0} step={100}
                      className="w-16 bg-transparent text-right text-indigo-300 font-bold text-sm border-b border-indigo-500/30 focus:border-indigo-400 outline-none pb-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={localRevPrivVesp}
                      onChange={(e) => {
                        const v = parseInt(e.target.value) || 0;
                        setLocalRevPrivVesp(v);
                        debouncedFilterChange('revenueMinPrivVesp', v <= 0 ? null : v);
                      }}
                    />
                  </div>
                </div>
                <input
                  type="range" className="intel-range intel-range-gold w-full" min={0} max={revenueRangeByType.priv.max}
                  value={localRevPrivVesp}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setLocalRevPrivVesp(v);
                    debouncedFilterChange('revenueMinPrivVesp', v <= 0 ? null : v);
                  }}
                />
              </div>
            </div>

            <div className="border-t border-white/[0.06] my-1" />
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400/50">Máximo</div>

            {/* Matrícula Máx - Privadas */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-300 font-medium">👨‍🎓 Matrícula Máx</span>
                <span className="text-[13px] font-bold text-amber-400">
                  {prices.premium > 0 ? Math.floor(localRevPrivMax / prices.premium) : studentRangeByType.priv.max} alumnos
                </span>
              </div>
              <input
                type="range" className="intel-range intel-range-gold w-full" min={0} max={studentRangeByType.priv.max}
                value={prices.premium > 0 ? Math.floor(localRevPrivMax / prices.premium) : studentRangeByType.priv.max}
                onChange={(e) => {
                  const alumnos = parseInt(e.target.value);
                  const rev = alumnos * prices.premium;
                  setLocalRevPrivMax(rev);
                  debouncedFilterChange('revenueMaxPriv', rev >= revenueRangeByType.priv.max ? null : rev);
                }}
              />
            </div>
            {/* Ingreso Máx - Privadas */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-300 font-medium">💰 Ingreso Máx</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[11px] text-amber-400/60">$</span>
                  <input
                    type="number" min={0} step={100}
                    className="w-16 bg-transparent text-right text-amber-400 font-bold text-xs border-b border-amber-500/30 focus:border-amber-400 outline-none pb-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={localRevPrivMax}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 0;
                      setLocalRevPrivMax(v);
                      debouncedFilterChange('revenueMaxPriv', v >= revenueRangeByType.priv.max ? null : v);
                    }}
                  />
                </div>
              </div>
              <input
                type="range" className="intel-range intel-range-gold w-full" min={0} max={revenueRangeByType.priv.max}
                value={localRevPrivMax}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setLocalRevPrivMax(v);
                  debouncedFilterChange('revenueMaxPriv', v >= revenueRangeByType.priv.max ? null : v);
                }}
              />
            </div>
            </div>{/* /Filtrar Escuelas Privadas */}
          </div>

          {/* Contextual TAM Privado */}
          <div className="mt-4 p-4 bg-gradient-to-br from-amber-500/15 to-amber-500/[0.03] border border-amber-500/30 rounded-2xl space-y-1.5 shadow-lg shadow-amber-500/5">
            <div className="text-[11px] font-bold text-amber-300/80 uppercase tracking-widest flex items-center gap-1.5">
              💰 Potencial Privado
            </div>
            <div className="text-3xl font-black text-amber-400 tabular-nums leading-none">
              {formatMXN(tam.privateValue)}
            </div>
            <div className="text-[12px] text-gray-400">
              <strong className="text-amber-400/90">{formatNumber(tam.privateSchools)} escuelas</strong> · {formatNumber(tam.privateStudents)} alumnos · {formatMXN(prices.premium)}
            </div>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}

// ─── Compact slider for operational variables ───
function VarSlider({ icon: Icon, label, value, min, max, step, unit, onChange, accent = 'emerald', badge }) {
  const accentText = accent === 'blue' ? 'text-blue-400' : accent === 'gold' ? 'text-amber-400' : 'text-emerald-400';
  const rangeClass = accent === 'gold' ? 'intel-range intel-range-gold' : accent === 'blue' ? 'intel-range' : 'intel-range intel-range-emerald';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-gray-300 font-medium flex items-center gap-1.5">
          {Icon && <Icon size={14} className={accentText} />} {label}
          {badge && (
            <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500 bg-white/[0.06] border border-white/[0.08] rounded px-1 py-0.5">
              {badge}
            </span>
          )}
        </span>
        <span className={`text-sm font-bold ${accentText}`}>
          {value}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range" className={`${rangeClass} w-full`} min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

