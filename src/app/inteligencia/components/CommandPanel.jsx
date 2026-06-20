'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Filter, RotateCcw, School, TrendingUp, Target, Layers, BookOpen, MapPinOff } from 'lucide-react';
import { formatMXN, formatNumber, calculateTAM, calculateSOM, getUniqueMunicipios, getUniqueTurnos, getUniqueNiveles, getStudentRange, getStudentRangeByType, getRevenueRangeByType } from '../lib/filters';

export default function CommandPanel({
  schools,
  filteredSchools,
  filteredCount,
  filters,
  onFilterChange,
  prices,
  onPriceChange,
  somPercent,
  onSomChange,
  collapsed,
  onToggleCollapse,
  onOpenMissingSchools,
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
  const [localSom, setLocalSom] = useState(somPercent);
  const [localRevPubMin, setLocalRevPubMin] = useState(filters.revenueMinPub ?? 0);
  const [localRevPubMax, setLocalRevPubMax] = useState(filters.revenueMaxPub ?? revenueRangeByType.pub.max);
  const [localRevPrivMin, setLocalRevPrivMin] = useState(filters.revenueMinPriv ?? 0);
  const [localRevPrivMax, setLocalRevPrivMax] = useState(filters.revenueMaxPriv ?? revenueRangeByType.priv.max);

  const debounceRef = useRef(null);

  // Sync local state when filters change externally (e.g. reset, project load)
  useEffect(() => {
    setLocalRevPubMin(filters.revenueMinPub ?? 0);
    setLocalRevPubMax(filters.revenueMaxPub ?? revenueRangeByType.pub.max);
    setLocalRevPrivMin(filters.revenueMinPriv ?? 0);
    setLocalRevPrivMax(filters.revenueMaxPriv ?? revenueRangeByType.priv.max);
  }, [filters.revenueMinPub, filters.revenueMaxPub, filters.revenueMinPriv, filters.revenueMaxPriv, revenueRangeByType]);

  useEffect(() => {
    setLocalPremium(prices.premium);
    setLocalBase(prices.base);
  }, [prices]);

  useEffect(() => {
    setLocalSom(somPercent);
  }, [somPercent]);

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

  const debouncedSomChange = useCallback((value) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSomChange(value);
    }, 150);
  }, [onSomChange]);

  // Use the parent's provided filteredSchools for TAM calculation
  const tam = useMemo(() => calculateTAM(filteredSchools, prices), [filteredSchools, prices]);

  const som = useMemo(() => calculateSOM(tam, somPercent), [tam, somPercent]);

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
    });
  };

  if (collapsed) return null;

  return (
    <div className="h-full flex flex-col bg-[var(--intel-surface)] border-r border-[var(--intel-border)] w-[320px] shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/15">
              <Filter size={16} className="text-blue-400" />
            </div>
            <h2 className="text-sm font-bold text-white">Centro de Mandos</h2>
          </div>
          <button
            onClick={handleReset}
            className="text-[10px] font-bold text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 uppercase tracking-wider"
            title="Limpiar filtros"
          >
            <RotateCcw size={11} />
            Reset
          </button>
        </div>

        {/* Counter badge */}
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
          <School size={14} className="text-blue-400" />
          <span className="text-xs font-bold text-white">{formatNumber(filteredCount)}</span>
          <span className="text-xs text-gray-500">de {formatNumber(schools.length)} escuelas</span>
        </div>

        {/* Missing Coordinates Warning */}
        {missingSchoolsCount > 0 && (
          <div className="mt-2 flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border bg-amber-500/10 border-amber-500/20">
            <div className="flex items-center gap-2">
              <MapPinOff size={14} className="text-amber-500" />
              <span className="text-[11px] font-bold leading-tight text-amber-500/90">
                {formatNumber(missingSchoolsCount)} escuelas<br/>
                <span className="text-[9px] font-medium text-amber-500/70">sin ubicación GPS</span>
              </span>
            </div>
            <button
              onClick={onOpenMissingSchools}
              className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors bg-amber-500/20 hover:bg-amber-500/30 text-amber-400"
            >
              Ver lista
            </button>
          </div>
        )}

      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
        {/* ═══ SECTION A: FILTERS ═══ */}
        <section className="space-y-4">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
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
                className={`intel-turno-pill ${filters.turno === '__all__' ? 'active' : ''}`}
                onClick={() => onFilterChange({ ...filters, turno: '__all__' })}
              >
                Todos
              </button>
              {turnos.map(t => {
                const isActive = filters.turno === t;
                const icon = t === 'MATUTINO'
                  ? '☀️' : t === 'VESPERTINO'
                  ? '🌙' : t === 'NOCTURNO'
                  ? '🌑' : '🕐';
                return (
                  <button
                    key={t}
                    className={`intel-turno-pill ${isActive ? 'active' : ''}`}
                    data-turno={t.toLowerCase()}
                    onClick={() => onFilterChange({ ...filters, turno: isActive ? '__all__' : t })}
                  >
                    <span className="text-[10px]">{icon}</span>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
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

          {/* ═══ ESCUELAS PÚBLICAS ═══ */}
          <div className="space-y-3 mt-2 pt-3 border-t border-blue-500/20">
            <label className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              🔵 Escuelas Públicas
            </label>

            {/* Precio por Alumno - Públicas */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 flex items-center gap-1">📦 Precio por Alumno</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-blue-400/60">$</span>
                  <input
                    type="number"
                    min={0} max={9999}
                    className="w-14 bg-transparent text-right text-blue-300 font-bold text-xs border-b border-blue-500/30 focus:border-blue-400 outline-none pb-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setLocalBase(v);
                  debouncedPriceChange('base', v);
                }}
              />
            </div>

            {/* Matrícula Mín - Públicas */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">👨‍🎓 Matrícula Mín</span>
                <span className="text-[10px] font-bold text-blue-400">
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
                <span className="text-[10px] text-gray-500">💰 Ingreso Mín</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-blue-400/60">$</span>
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
                type="range" className="intel-range w-full" min={0} max={revenueRangeByType.pub.max}
                value={localRevPubMin}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setLocalRevPubMin(v);
                  debouncedFilterChange('revenueMinPub', v <= 0 ? null : v);
                }}
              />
            </div>

            <div className="border-t border-blue-500/10 my-1" />

            {/* Matrícula Máx - Públicas */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">👨‍🎓 Matrícula Máx</span>
                <span className="text-[10px] font-bold text-blue-400">
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
                <span className="text-[10px] text-gray-500">💰 Ingreso Máx</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-blue-400/60">$</span>
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
          </div>

          {/* ═══ ESCUELAS PRIVADAS ═══ */}
          <div className="space-y-3 mt-2 pt-3 border-t border-amber-500/20">
            <label className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              🟡 Escuelas Privadas (incluye Campus)
            </label>

            {/* Precio por Alumno - Privadas */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500 flex items-center gap-1">📦 Precio por Alumno</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-amber-400/60">$</span>
                  <input
                    type="number"
                    min={0} max={9999}
                    className="w-14 bg-transparent text-right text-amber-300 font-bold text-xs border-b border-amber-500/30 focus:border-amber-400 outline-none pb-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setLocalPremium(v);
                  debouncedPriceChange('premium', v);
                }}
              />
            </div>

            {/* Matrícula Mín - Privadas */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">👨‍🎓 Matrícula Mín</span>
                <span className="text-[10px] font-bold text-amber-400">
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
                <span className="text-[10px] text-gray-500">💰 Ingreso Mín</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-amber-400/60">$</span>
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
                type="range" className="intel-range intel-range-gold w-full" min={0} max={revenueRangeByType.priv.max}
                value={localRevPrivMin}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setLocalRevPrivMin(v);
                  debouncedFilterChange('revenueMinPriv', v <= 0 ? null : v);
                }}
              />
            </div>

            <div className="border-t border-amber-500/10 my-1" />

            {/* Matrícula Máx - Privadas */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-500">👨‍🎓 Matrícula Máx</span>
                <span className="text-[10px] font-bold text-amber-400">
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
                <span className="text-[10px] text-gray-500">💰 Ingreso Máx</span>
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-amber-400/60">$</span>
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
          </div>
        </section>

        <div className="intel-divider" />

        {/* ═══ SECTION B: RESULTADOS FINANCIEROS ═══ */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-amber-400" />
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Resultados Financieros
            </h3>
          </div>

          {/* TAM Card */}
          <div className="intel-metric-card intel-metric-card-gold space-y-3">
            <div className="flex items-center gap-2">
              <Layers size={13} className="text-amber-400" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">💰 Potencial de Venta Total</span>
            </div>
            <p className="text-2xl font-black text-amber-400">{formatMXN(tam.totalValue)}</p>
            <p className="text-[10px] text-gray-500">
              Si vendieras a <strong className="text-white">{formatNumber(tam.totalSchools)} escuelas</strong> en el mapa
            </p>

            {/* Breakdown */}
            <div className="space-y-1.5 pt-2 border-t border-gray-800">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-amber-400/80">🟡 {formatNumber(tam.privateSchools)} Privadas</span>
                <span className="text-gray-400">
                  {formatNumber(tam.privateStudents)} × {formatMXN(prices.premium)} = <strong className="text-amber-400">{formatMXN(tam.privateValue)}</strong>
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-blue-400/80">🔵 {formatNumber(tam.publicSchools)} Públicas</span>
                <span className="text-gray-400">
                  {formatNumber(tam.publicStudents)} × {formatMXN(prices.base)} = <strong className="text-blue-400">{formatMXN(tam.publicValue)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* SOM Card */}
          <div className="intel-metric-card intel-metric-card-blue space-y-3">
            <div className="flex items-center gap-2">
              <Target size={13} className="text-blue-400" />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">🎯 Meta Realista</span>
            </div>
            <p className="text-2xl font-black text-blue-400">{formatMXN(som.value)}</p>
            <p className="text-[10px] text-gray-500">
              Si alcanzas al <strong className="text-white">{localSom}%</strong> de esos alumnos ({formatNumber(som.students)} alumnos)
            </p>
            {/* SOM percentage slider */}
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                className="intel-range intel-range-emerald flex-1"
                min={5}
                max={100}
                step={5}
                value={localSom}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setLocalSom(v);
                  debouncedSomChange(v);
                }}
              />
              <span className="text-xs font-bold text-emerald-400 w-10 text-right">{localSom}%</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
