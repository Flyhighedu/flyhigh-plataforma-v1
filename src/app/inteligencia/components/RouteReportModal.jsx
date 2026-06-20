'use client';

import { useMemo } from 'react';
import { X, FileBarChart, MapPin, Users, DollarSign, School, Download } from 'lucide-react';
import { calculateRouteMetrics, formatMXN, formatNumber } from '../lib/filters';

export default function RouteReportModal({
  projectName,
  schools,
  routeCCTs,
  prices,
  onClose,
}) {
  const routeSchools = useMemo(() => {
    const schoolMap = new Map();
    schools.forEach(s => schoolMap.set(s.cct, s));
    return routeCCTs.map(cct => schoolMap.get(cct)).filter(Boolean);
  }, [schools, routeCCTs]);

  const metrics = useMemo(
    () => calculateRouteMetrics(routeSchools, prices),
    [routeSchools, prices]
  );

  // Donut chart proportions
  const publicPct = metrics.totalSchools > 0
    ? Math.round((metrics.publicSchools / metrics.totalSchools) * 100)
    : 0;

  const now = new Date().toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="intel-modal-backdrop animate-intel-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col animate-intel-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="intel-glass rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-8 py-6 border-b border-white/[0.06] shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
                <FileBarChart size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">{projectName || 'Reporte de Ruta'}</h1>
                <p className="text-xs text-gray-500 mt-0.5">Generado el {now}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="intel-metric-card intel-metric-card-emerald p-5 text-center animate-intel-slide-up stagger-1">
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center bg-emerald-500/15">
                  <MapPin size={18} className="text-emerald-400" />
                </div>
                <p className="text-3xl font-black text-white">{metrics.totalSchools}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-1">Escuelas en Ruta</p>
              </div>

              <div className="intel-metric-card intel-metric-card-blue p-5 text-center animate-intel-slide-up stagger-2">
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center bg-blue-500/15">
                  <Users size={18} className="text-blue-400" />
                </div>
                <p className="text-3xl font-black text-white">{formatNumber(metrics.totalStudents)}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-1">Alumnos Impactados</p>
              </div>

              <div className="intel-metric-card intel-metric-card-gold p-5 text-center animate-intel-slide-up stagger-3">
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center bg-amber-500/15">
                  <DollarSign size={18} className="text-amber-400" />
                </div>
                <p className="text-2xl font-black text-amber-400">{formatMXN(metrics.totalValue)}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-1">Presupuesto Bruto</p>
              </div>

              <div className="intel-metric-card p-5 text-center animate-intel-slide-up stagger-4">
                <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center bg-purple-500/15">
                  <School size={18} className="text-purple-400" />
                </div>
                {/* Mini donut via CSS conic-gradient */}
                <div className="w-16 h-16 rounded-full mx-auto mb-2 relative"
                  style={{
                    background: `conic-gradient(
                      #3B82F6 0% ${publicPct}%,
                      #F59E0B ${publicPct}% 100%
                    )`,
                  }}
                >
                  <div className="absolute inset-2 rounded-full bg-[var(--intel-surface)] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-gray-400">
                      {metrics.publicSchools}/{metrics.privateSchools}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  <span className="text-blue-400">Públicas</span> / <span className="text-amber-400">Privadas</span>
                </p>
              </div>
            </div>

            {/* Student breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Alumnos en Escuelas Públicas</p>
                <p className="text-xl font-black text-blue-400">{formatNumber(metrics.publicStudents)}</p>
              </div>
              <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Alumnos en Escuelas Privadas</p>
                <p className="text-xl font-black text-amber-400">{formatNumber(metrics.privateStudents)}</p>
              </div>
            </div>

            {/* Route table */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Cronograma de Visitas ({routeSchools.length})
              </h3>
              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white/[0.03]">
                      <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">#</th>
                      <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Escuela</th>
                      <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">CCT</th>
                      <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Municipio</th>
                      <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Turno</th>
                      <th className="text-left px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                      <th className="text-right px-4 py-3 font-bold text-gray-500 uppercase tracking-wider">Alumnos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routeSchools.map((school, i) => (
                      <tr key={school.cct} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2.5">
                          <span className="w-5 h-5 rounded-md inline-flex items-center justify-center bg-emerald-500/15 text-emerald-400 text-[10px] font-black">
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-white max-w-[200px] truncate">{school.nombre || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 font-mono">{school.cct}</td>
                        <td className="px-4 py-2.5 text-gray-400">{school.municipio || '—'}</td>
                        <td className="px-4 py-2.5 text-gray-400">{school.turno || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`intel-badge ${school.isPrivada ? 'intel-badge-gold' : 'intel-badge-blue'}`}>
                            {school.isPrivada ? 'Privada' : 'Pública'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-300">{formatNumber(school.alumnos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
