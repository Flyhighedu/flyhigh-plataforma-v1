'use client';

import { useMemo } from 'react';
import { X, FileText, MapPin, Users, DollarSign, School, Download, Calendar } from 'lucide-react';
import { calculateRouteMetrics, formatMXN, formatNumber } from '../lib/filters';

export default function RouteReportModal({
  projectName,
  schools,
  routes,
  activeRouteId,
  prices,
  onClose,
}) {
  const activeRoute = useMemo(() => {
    return routes?.find(r => r.id === activeRouteId) || routes?.[0] || {};
  }, [routes, activeRouteId]);

  const routeSchools = useMemo(() => {
    const schoolMap = new Map();
    schools.forEach(s => schoolMap.set(s.cct, s));
    return (activeRoute?.ccts || []).map(cct => schoolMap.get(cct)).filter(Boolean);
  }, [schools, activeRoute]);

  const metrics = useMemo(
    () => calculateRouteMetrics(routeSchools, prices),
    [routeSchools, prices]
  );

  const publicPct = metrics.totalSchools > 0
    ? Math.round((metrics.publicSchools / metrics.totalSchools) * 100)
    : 0;

  const now = new Date().toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8 animate-intel-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-5xl h-full max-h-[90vh] flex flex-col bg-[#F8FAFC] rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-intel-scale-in overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative Top Border */}
        <div className="h-2 w-full shrink-0" style={{ backgroundColor: activeRoute?.color || '#10B981' }} />
        
        {/* Header - White Paper Header */}
        <div className="bg-white px-6 md:px-10 py-6 md:py-8 flex items-center justify-between border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center bg-gray-50 border border-gray-200 shrink-0">
              <FileText size={28} style={{ color: activeRoute?.color || '#374151' }} />
            </div>
            <div>
              <p className="text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">{projectName || 'Proyecto sin nombre'}</p>
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 leading-none">Reporte: {activeRoute?.name || 'Ruta'}</h1>
              <p className="text-xs md:text-sm text-gray-500 mt-2 font-medium flex items-center gap-2">
                <Calendar size={14} />
                Generado el {now}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content - Paper Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-[#F8FAFC]">
          
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {/* Revenue Card */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <DollarSign size={20} className="text-amber-600" />
                  </div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Presupuesto Bruto</h3>
                </div>
                <p className="text-4xl font-black text-gray-900">{formatMXN(metrics.totalValue)}</p>
              </div>
            </div>

            {/* Students Card */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Users size={20} className="text-blue-600" />
                  </div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Alumnos Impactados</h3>
                </div>
                <p className="text-4xl font-black text-gray-900">{formatNumber(metrics.totalStudents)}</p>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs font-medium text-gray-600"><strong className="text-gray-900">{formatNumber(metrics.publicStudents)}</strong> Pub</span>
                  <span className="text-xs font-medium text-gray-600"><strong className="text-gray-900">{formatNumber(metrics.privateStudents)}</strong> Priv</span>
                </div>
              </div>
            </div>

            {/* Schools Card */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <MapPin size={20} className="text-emerald-600" />
                  </div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Paradas en Ruta</h3>
                </div>
                <p className="text-4xl font-black text-gray-900">{metrics.totalSchools}</p>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                  <span className="text-xs font-medium text-gray-600"><strong className="text-gray-900">{formatNumber(metrics.publicSchools)}</strong> Pub</span>
                  <span className="text-xs font-medium text-gray-600"><strong className="text-gray-900">{formatNumber(metrics.privateSchools)}</strong> Priv</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline / Itinerary */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Itinerario de Visitas</h3>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-gray-400 text-xs uppercase font-bold border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 font-bold tracking-wider">Orden</th>
                    <th className="px-6 py-4 font-bold tracking-wider">Institución</th>
                    <th className="px-6 py-4 font-bold tracking-wider">CCT</th>
                    <th className="px-6 py-4 font-bold tracking-wider">Municipio</th>
                    <th className="px-6 py-4 font-bold tracking-wider">Sostenimiento</th>
                    <th className="px-6 py-4 font-bold tracking-wider text-right">Alumnos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {routeSchools.map((school, i) => (
                    <tr key={school.cct} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white"
                          style={{ backgroundColor: activeRoute?.color || '#10B981' }}
                        >
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 min-w-[250px]">
                        <p className="font-bold text-gray-900 leading-tight">{school.nombre || '—'}</p>
                        <p className="text-xs text-gray-500 font-medium mt-1">{school.nivelEducativo || '—'} • {school.turno || '—'}</p>
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-500 text-xs">{school.cct}</td>
                      <td className="px-6 py-4 font-medium text-gray-700">
                        {school.municipio ? (
                          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700">
                            {school.municipio}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${school.isPrivada ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                          {school.isPrivada ? 'Privada' : 'Pública'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-gray-900">
                        {formatNumber(school.alumnos)}
                      </td>
                    </tr>
                  ))}
                  {routeSchools.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-400 font-medium">
                        Aún no has agregado escuelas a esta ruta.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
