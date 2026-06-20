'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  Building2, School, X, ArrowUpDown, Crown, Medal, Award,
  MapPin, Users, Navigation, TrendingUp,
} from 'lucide-react';

/**
 * MunicipioRanking — Large centered modal showing ranked municipalities.
 * Rendered at page root level (NOT inside IntelMap) so it isn't clipped.
 * Parent controls open/close via onClose prop.
 */
export default function MunicipioRanking({ schools, activeFilter, onSelectMunicipio, mapInstance, onClose }) {
  const [sortBy, setSortBy] = useState('total');

  // ─── State name ───
  const stateName = useMemo(() => {
    if (!schools.length) return '';
    const counts = {};
    for (const s of schools) {
      const ent = s.entidad || s.nombreEntidad || '';
      if (ent) counts[ent] = (counts[ent] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || '';
  }, [schools]);

  // ─── Ranking data ───
  const ranking = useMemo(() => {
    const map = new Map();
    for (const s of schools) {
      const muni = (s.municipio || 'SIN MUNICIPIO').toUpperCase();
      if (!map.has(muni)) {
        map.set(muni, { name: muni, total: 0, pub: 0, priv: 0, alumnos: 0, lats: [], lngs: [] });
      }
      const entry = map.get(muni);
      entry.total++;
      if (s.isPrivada) entry.priv++;
      else entry.pub++;
      entry.alumnos += s.alumnos || 0;
      if (s.latitud && s.longitud) {
        entry.lats.push(s.latitud);
        entry.lngs.push(s.longitud);
      }
    }
    const list = [...map.values()].map(m => ({
      ...m,
      minLat: m.lats.length ? Math.min(...m.lats) : null,
      maxLat: m.lats.length ? Math.max(...m.lats) : null,
      minLng: m.lngs.length ? Math.min(...m.lngs) : null,
      maxLng: m.lngs.length ? Math.max(...m.lngs) : null,
    }));
    if (sortBy === 'privadas') list.sort((a, b) => b.priv - a.priv || b.total - a.total);
    else if (sortBy === 'publicas') list.sort((a, b) => b.pub - a.pub || b.total - a.total);
    else list.sort((a, b) => b.total - a.total);
    return list;
  }, [schools, sortBy]);

  const maxTotal = useMemo(() => Math.max(1, ...ranking.map(r => r.total)), [ranking]);
  const totals = useMemo(() => {
    let pub = 0, priv = 0, alumnos = 0;
    for (const r of ranking) { pub += r.pub; priv += r.priv; alumnos += r.alumnos; }
    return { pub, priv, total: pub + priv, alumnos };
  }, [ranking]);

  const handleRowClick = useCallback((muni) => {
    onSelectMunicipio?.(muni.name);
    if (mapInstance?.current && muni.minLat != null) {
      const p = 0.01;
      mapInstance.current.flyToBounds(
        [[muni.minLat - p, muni.minLng - p], [muni.maxLat + p, muni.maxLng + p]],
        { duration: 1.2, maxZoom: 14 }
      );
    }
    onClose();
  }, [onSelectMunicipio, mapInstance, onClose]);

  const positionBadge = (index) => {
    const icons = [Crown, Medal, Award];
    if (index < 3) {
      const Icon = icons[index];
      const gradients = [
        'linear-gradient(135deg,#fbbf24,#f59e0b)',
        'linear-gradient(135deg,#9ca3b8,#6b7280)',
        'linear-gradient(135deg,#fb923c,#ea580c)',
      ];
      return (
        <div className="intel-rank-badge" style={{ background: gradients[index] }}>
          <Icon size={14} color="white" />
        </div>
      );
    }
    return <div className="intel-rank-badge intel-rank-badge-num">{index + 1}</div>;
  };

  return (
    <div className="intel-ranking-overlay" onClick={onClose}>
      <div className="intel-ranking-modal animate-intel-scale-in" onClick={e => e.stopPropagation()}>

        {/* ── TOP BAR ── */}
        <div className="intel-ranking-topbar">
          <div className="intel-ranking-topbar-left">
            <div className="intel-ranking-topbar-icon">
              <TrendingUp size={18} color="#a78bfa" />
            </div>
            <div>
              <h2 className="intel-ranking-modal-title">Ranking de Municipios</h2>
              <p className="intel-ranking-modal-subtitle">
                <MapPin size={11} />
                {stateName || 'Todas las entidades'} — {ranking.length} municipios
              </p>
            </div>
          </div>
          <button onClick={onClose} className="intel-ranking-close-btn" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {/* ── SUMMARY STRIP ── */}
        <div className="intel-ranking-summary">
          <div className="intel-ranking-stat">
            <span className="intel-ranking-stat-num">{totals.total.toLocaleString()}</span>
            <span className="intel-ranking-stat-label">Escuelas</span>
          </div>
          <div className="intel-ranking-stat intel-ranking-stat-gold">
            <span className="intel-ranking-stat-num">{totals.priv.toLocaleString()}</span>
            <span className="intel-ranking-stat-label">Privadas</span>
          </div>
          <div className="intel-ranking-stat intel-ranking-stat-blue">
            <span className="intel-ranking-stat-num">{totals.pub.toLocaleString()}</span>
            <span className="intel-ranking-stat-label">Públicas</span>
          </div>
          <div className="intel-ranking-stat">
            <span className="intel-ranking-stat-num">{totals.alumnos.toLocaleString()}</span>
            <span className="intel-ranking-stat-label">Alumnos</span>
          </div>
        </div>

        {/* ── SORT TABS ── */}
        <div className="intel-ranking-controls">
          <div className="intel-ranking-tabs">
            {[
              { key: 'total', label: 'Total', Icon: ArrowUpDown, cls: 'purple' },
              { key: 'privadas', label: 'Privadas', Icon: Building2, cls: 'gold' },
              { key: 'publicas', label: 'Públicas', Icon: School, cls: 'blue' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setSortBy(tab.key)}
                className={`intel-ranking-tab ${sortBy === tab.key ? `intel-ranking-tab-active-${tab.cls}` : ''}`}
              >
                <tab.Icon size={12} />
                {tab.label}
              </button>
            ))}
          </div>

          {activeFilter && activeFilter !== '__all__' && (
            <button
              onClick={() => { onSelectMunicipio?.('__all__'); }}
              className="intel-ranking-active-chip"
            >
              <X size={10} />
              Filtro: {activeFilter}
            </button>
          )}
        </div>

        {/* ── TABLE HEADER ── */}
        <div className="intel-ranking-table-header">
          <span className="intel-ranking-th-pos">#</span>
          <span className="intel-ranking-th-name">Municipio</span>
          <span className="intel-ranking-th-stat">Privadas</span>
          <span className="intel-ranking-th-stat">Públicas</span>
          <span className="intel-ranking-th-stat">Alumnos</span>
          <span className="intel-ranking-th-bar">Proporción</span>
        </div>

        {/* ── SCROLLABLE LIST ── */}
        <div className="intel-ranking-list">
          {ranking.map((muni, index) => {
            const isActive = activeFilter && muni.name === activeFilter.toUpperCase();
            const barWidth = (muni.total / maxTotal) * 100;
            const privPercent = muni.total > 0 ? (muni.priv / muni.total) * 100 : 0;

            return (
              <div
                key={muni.name}
                onClick={() => handleRowClick(muni)}
                className={`intel-ranking-row ${isActive ? 'intel-ranking-row-active' : ''}`}
                style={{ animationDelay: `${Math.min(index, 20) * 15}ms` }}
              >
                <div className="intel-ranking-cell-pos">
                  {positionBadge(index)}
                </div>

                <div className="intel-ranking-cell-name">
                  <span className="intel-ranking-city-name">{muni.name}</span>
                  <span className="intel-ranking-city-count">{muni.total} escuelas</span>
                </div>

                <div className="intel-ranking-cell-stat intel-color-gold">
                  <Building2 size={12} />
                  <span>{muni.priv}</span>
                </div>

                <div className="intel-ranking-cell-stat intel-color-blue">
                  <School size={12} />
                  <span>{muni.pub}</span>
                </div>

                <div className="intel-ranking-cell-stat intel-color-gray">
                  <Users size={12} />
                  <span>{muni.alumnos.toLocaleString()}</span>
                </div>

                <div className="intel-ranking-cell-bar">
                  <div className="intel-ranking-bar-bg">
                    <div className="intel-ranking-bar-fill" style={{ width: `${barWidth}%` }}>
                      <div className="intel-ranking-bar-priv" style={{ width: `${privPercent}%` }} />
                      <div className="intel-ranking-bar-pub" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
