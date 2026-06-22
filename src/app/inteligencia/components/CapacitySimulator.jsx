'use client';

import { useMemo, useEffect } from 'react';
import { X, Gauge, RotateCcw, Plane, Repeat, Armchair, Sun, Building2, TrendingUp, Info, Eye, EyeOff } from 'lucide-react';
import {
  CAPACITY_DEFAULTS,
  calculateCapacity,
  estimateSchoolOps,
  formatMXN,
  formatNumber,
} from '../lib/filters';

// ── Single labeled knob (slider + live value + helper text) ──
function Knob({ icon: Icon, label, help, value, min, max, step, unit, onChange, accent = 'blue' }) {
  return (
    <div className="intel-card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--intel-text)' }}>
          <Icon size={15} style={{ color: `var(--intel-${accent})` }} />
          <span>{label}</span>
        </div>
        <div className="font-black text-base tabular-nums" style={{ color: `var(--intel-${accent})` }}>
          {value}<span className="text-xs font-medium opacity-70 ml-0.5">{unit}</span>
        </div>
      </div>
      <p className="text-[11px] leading-snug mb-2.5" style={{ color: 'var(--intel-text-muted)' }}>{help}</p>
      <input
        type="range"
        className={`intel-range intel-range-${accent} w-full`}
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

export default function CapacitySimulator({
  filteredSchools = [],
  prices,
  campusCCTs,
  campusTotals,
  config,
  onConfigChange,
  paintMap = true,
  onTogglePaintMap,
  onClose,
}) {
  const cfg = config;
  const set = (key) => (val) => onConfigChange({ ...cfg, [key]: val });

  const capacity = useMemo(() => calculateCapacity(cfg), [cfg]);

  // Per-school operational estimates, ranked by revenue-per-team-day.
  const ranked = useMemo(() => {
    return filteredSchools
      .filter((s) => s.latitud != null && s.longitud != null && (s.alumnos || 0) > 0)
      .map((s) => ({ school: s, ...estimateSchoolOps(s, capacity, prices, campusCCTs, campusTotals) }))
      .sort((a, b) => b.ingresoPorDia - a.ingresoPorDia);
  }, [filteredSchools, capacity, prices, campusCCTs, campusTotals]);

  // Aggregate campaign totals across the filtered set.
  const totals = useMemo(() => {
    let dias = 0, ingreso = 0;
    for (const r of ranked) { if (isFinite(r.dias)) { dias += r.dias; ingreso += r.ingreso; } }
    return { escuelas: ranked.length, dias, ingreso, ingresoPorDia: dias > 0 ? ingreso / dias : 0 };
  }, [ranked]);

  const isDefault = useMemo(
    () => Object.keys(CAPACITY_DEFAULTS).every((k) => cfg[k] === CAPACITY_DEFAULTS[k]),
    [cfg]
  );

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Non-modal sliding panel — NO backdrop, so the map and filters stay
          fully interactive while Variables is open. */}
      <aside
        className="fixed top-0 right-0 bottom-0 z-[1101] w-full max-w-[440px] flex flex-col intel-glass animate-[intel-slide-in-right_0.3s_cubic-bezier(0.16,1,0.3,1)] shadow-2xl"
        style={{ borderLeft: '1px solid var(--intel-glass-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--intel-border)' }}>
          <div className="flex items-center gap-2.5">
            <div className="grid place-items-center w-9 h-9 rounded-xl" style={{ background: 'var(--intel-blue-glow)' }}>
              <Gauge size={18} style={{ color: 'var(--intel-blue)' }} />
            </div>
            <div>
              <h2 className="text-base font-black leading-tight" style={{ color: 'var(--intel-text)' }}>Variables</h2>
              <p className="text-[11px]" style={{ color: 'var(--intel-text-muted)' }}>Ajusta tu operación y míralo en el mapa</p>
            </div>
          </div>
          <button onClick={onClose} className="intel-btn intel-btn-ghost w-8 h-8 !p-0 rounded-lg" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* ── LIVE RESULT (sticky-feel headline) ── */}
          <div className="intel-card p-4" style={{ background: 'var(--intel-blue-glow)', borderColor: 'rgba(59,130,246,0.25)' }}>
            <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--intel-text-sub)' }}>
              Con esta configuración, tu equipo mueve
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tabular-nums" style={{ color: 'var(--intel-blue)' }}>
                {Math.round(capacity.ninosPorHora)}
              </span>
              <span className="text-sm font-bold" style={{ color: 'var(--intel-text-sub)' }}>niños por hora</span>
            </div>
            <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--intel-text-sub)' }}>
              <span><strong style={{ color: 'var(--intel-blue)' }}>{Math.round(capacity.ninosPorDiaPub)}</strong> /día en pública</span>
              <span><strong style={{ color: 'var(--intel-gold)' }}>{Math.round(capacity.ninosPorDiaPriv)}</strong> /día en privada</span>
            </div>
          </div>

          {/* ── MAP PAINT TOGGLE ── */}
          <button
            onClick={onTogglePaintMap}
            className="intel-card p-3 w-full flex items-center gap-3 text-left transition-colors"
            style={{ borderColor: paintMap ? 'var(--intel-emerald)' : 'var(--intel-border)' }}
          >
            <div className="grid place-items-center w-9 h-9 rounded-lg shrink-0"
              style={{ background: paintMap ? 'var(--intel-gradient-emerald)' : 'var(--intel-surface-2)' }}>
              {paintMap ? <Eye size={16} color="white" /> : <EyeOff size={16} style={{ color: 'var(--intel-text-muted)' }} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold" style={{ color: 'var(--intel-text)' }}>
                {paintMap ? 'Viendo rentabilidad en el mapa' : 'Ver rentabilidad en el mapa'}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--intel-text-muted)' }}>
                Nítidas = más rentables · atenuadas = menos · sigue activo aunque cierres
              </div>
            </div>
            <div className="shrink-0 w-10 h-6 rounded-full p-0.5 transition-colors"
              style={{ background: paintMap ? 'var(--intel-emerald)' : 'var(--intel-surface-3)' }}>
              <div className="w-5 h-5 rounded-full bg-white transition-transform"
                style={{ transform: paintMap ? 'translateX(16px)' : 'translateX(0)' }} />
            </div>
          </button>

          {/* ── KNOBS ── */}
          <div className="space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--intel-text-muted)' }}>
              Mueve las perillas
            </div>
            <Knob icon={Armchair} label="Plazas / gafas" accent="blue"
              help="Cuántos niños vuelan a la vez. Invierte en más gafas para subir tu capacidad."
              value={cfg.plazas} min={4} max={40} step={1} unit="" onChange={set('plazas')} />
            <Knob icon={Plane} label="Tiempo de vuelo" accent="blue"
              help="Duración de cada vuelo. Tu promedio real es 6.3 min."
              value={cfg.tiempoVueloMin} min={3} max={15} step={0.5} unit="min" onChange={set('tiempoVueloMin')} />
            <Knob icon={Repeat} label="Cambio entre vuelos" accent="blue"
              help="Tiempo de bajar un grupo y subir el siguiente. Tu real es 3.3 min."
              value={cfg.tiempoCambioMin} min={1} max={10} step={0.5} unit="min" onChange={set('tiempoCambioMin')} />
            <Knob icon={Sun} label="Horas útiles · Pública" accent="blue"
              help="Horas que alcanzas a operar en una escuela pública (salen antes)."
              value={cfg.horasUtilPub} min={1} max={8} step={0.5} unit="h" onChange={set('horasUtilPub')} />
            <Knob icon={Building2} label="Horas útiles · Privada" accent="gold"
              help="Las privadas salen más tarde: normalmente tienes más tiempo de operación."
              value={cfg.horasUtilPriv} min={1} max={9} step={0.5} unit="h" onChange={set('horasUtilPriv')} />
          </div>

          {/* ── CAMPAIGN TOTALS (over current filters) ── */}
          {totals.escuelas > 0 && (
            <div className="intel-card p-4 space-y-3">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--intel-text-muted)' }}>
                <TrendingUp size={13} /> Sobre tus {formatNumber(totals.escuelas)} escuelas filtradas
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-2xl font-black tabular-nums" style={{ color: 'var(--intel-emerald)' }}>{formatNumber(totals.dias)}</div>
                  <div className="text-[11px]" style={{ color: 'var(--intel-text-muted)' }}>días-equipo para cubrirlas</div>
                </div>
                <div>
                  <div className="text-2xl font-black tabular-nums" style={{ color: 'var(--intel-emerald)' }}>{formatMXN(totals.ingresoPorDia)}</div>
                  <div className="text-[11px]" style={{ color: 'var(--intel-text-muted)' }}>ingreso por día de equipo</div>
                </div>
              </div>
            </div>
          )}

          {/* ── RANKING: best schools per team-day ── */}
          {ranked.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--intel-text-muted)' }}>
                <Info size={12} /> Las que más rinden por día de equipo
              </div>
              <div className="space-y-1.5">
                {ranked.slice(0, 8).map((r, i) => (
                  <div key={`${r.school.cct || 'sin-cct'}-${i}`} className="intel-card p-2.5 flex items-center gap-3">
                    <div className="grid place-items-center w-6 h-6 rounded-md shrink-0 text-[11px] font-black"
                      style={{ background: r.isPriv ? 'var(--intel-gold-glow)' : 'var(--intel-blue-glow)', color: r.isPriv ? 'var(--intel-gold)' : 'var(--intel-blue)' }}>
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate" style={{ color: 'var(--intel-text)' }}>{r.school.nombre || r.school.cct}</div>
                      <div className="text-[10px]" style={{ color: 'var(--intel-text-muted)' }}>
                        {formatNumber(r.alumnos)} niños · {r.dias} {r.dias === 1 ? 'día' : 'días'} · {r.isPriv ? 'Privada' : 'Pública'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black tabular-nums" style={{ color: 'var(--intel-emerald)' }}>{formatMXN(r.ingresoPorDia)}</div>
                      <div className="text-[9px]" style={{ color: 'var(--intel-text-muted)' }}>por día</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ranked.length === 0 && (
            <div className="intel-card p-6 text-center">
              <p className="text-sm" style={{ color: 'var(--intel-text-sub)' }}>No hay escuelas en el filtro actual.</p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--intel-text-muted)' }}>Ajusta tus filtros del panel izquierdo para ver resultados aquí.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 shrink-0" style={{ borderTop: '1px solid var(--intel-border)' }}>
          <button
            onClick={() => onConfigChange(CAPACITY_DEFAULTS)}
            disabled={isDefault}
            className="intel-btn intel-btn-ghost w-full gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={14} /> Restaurar valores reales
          </button>
          <p className="text-[10px] text-center mt-2" style={{ color: 'var(--intel-text-muted)' }}>
            Valores base medidos de tu bitácora real (1,063 vuelos)
          </p>
        </div>
      </aside>
    </>
  );
}
