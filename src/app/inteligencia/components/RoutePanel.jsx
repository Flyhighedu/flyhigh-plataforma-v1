'use client';

import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { Route, X, Save, FileBarChart, GripVertical, Trash2, MapPin, Users, DollarSign, Star } from 'lucide-react';
import { calculateRouteMetrics, formatMXN, formatNumber, getTurnoStyles } from '../lib/filters';

export default function RoutePanel({
  schools,          // all parsed schools (for lookup)
  routeCCTs,        // ordered array of CCTs in route
  prices,
  onRemoveFromRoute,
  onClearRoute,
  onReorderRoute,
  onSaveProject,
  onViewReport,
  campusMap,
  collapsed,
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    if (confirmDeleteId !== null) {
      const timer = setTimeout(() => setConfirmDeleteId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirmDeleteId]);

  // Build the ordered route schools from CCTs
  const routeSchools = useMemo(() => {
    const schoolMap = new Map();
    schools.forEach(s => schoolMap.set(s.cct, s));
    return routeCCTs.map(cct => schoolMap.get(cct)).filter(Boolean);
  }, [schools, routeCCTs]);

  const routeGroups = useMemo(() => {
    const groups = [];
    const campusHandled = new Set();
    
    routeSchools.forEach((school) => {
      const coordKey = `${school.latitud},${school.longitud}`;
      const campusGroup = campusMap?.get(coordKey);
      
      if (campusGroup && campusGroup.length >= 2) {
        const campusKey = `${coordKey}_cmp`;
        if (campusHandled.has(campusKey)) return;
        
        // Find all schools in this campus that are currently in the route
        const campusSchoolsInRoute = campusGroup.filter(s => routeCCTs.includes(s.cct));
        
        groups.push({
          type: 'campus',
          id: campusKey,
          schools: campusSchoolsInRoute,
          ccts: campusSchoolsInRoute.map(s => s.cct),
        });
        
        campusHandled.add(campusKey);
      } else {
        groups.push({
          type: 'school',
          id: school.cct,
          schools: [school],
          ccts: [school.cct],
        });
      }
    });
    return groups;
  }, [routeSchools, campusMap, routeCCTs]);

  const metrics = useMemo(
    () => calculateRouteMetrics(routeSchools, prices),
    [routeSchools, prices]
  );

  // Calculate per-school revenue
  const getSchoolValue = useCallback((school) => {
    const pricePerStudent = school.isPrivada ? (prices.premium || 0) : (prices.base || 0);
    return school.alumnos * pricePerStudent;
  }, [prices]);

  // Simple reorder by dragging (HTML5 DnD)
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const newGroups = [...routeGroups];
    const [moved] = newGroups.splice(sourceIndex, 1);
    newGroups.splice(targetIndex, 0, moved);
    
    // Reconstruct flat array
    const newRouteCCTs = newGroups.flatMap(g => g.ccts);
    onReorderRoute(newRouteCCTs);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--intel-surface)] shrink-0 overflow-hidden relative">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/15">
              <Route size={16} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Mi Ruta</h2>
              <p className="text-[10px] text-gray-500">
                {routeGroups.length} {routeGroups.length === 1 ? 'ubicación seleccionada' : 'ubicaciones seleccionadas'}
              </p>
            </div>
          </div>
          {routeSchools.length > 0 && (
            <button
              onClick={() => {
                if (confirmDeleteId === 'ALL') {
                  onClearRoute();
                  setConfirmDeleteId(null);
                } else {
                  setConfirmDeleteId('ALL');
                }
              }}
              className={`text-[10px] font-bold transition-colors flex items-center gap-1 uppercase tracking-wider ${
                confirmDeleteId === 'ALL' ? 'text-red-500 bg-red-500/10 px-2 py-1 rounded' : 'text-gray-500 hover:text-red-400'
              }`}
              title="Limpiar ruta completa"
            >
              <Trash2 size={11} />
              {confirmDeleteId === 'ALL' ? '¿Confirmar?' : 'Limpiar'}
            </button>
          )}
        </div>
      </div>

      {/* Route list */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">
        {routeGroups.length === 0 ? (
          <div className="intel-empty-state py-16">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/[0.03] mb-4">
              <MapPin size={28} className="text-gray-600" />
            </div>
            <p className="text-sm font-semibold text-gray-500">Sin escuelas en la ruta</p>
            <p className="text-xs text-gray-600 mt-1 max-w-[200px]">
              Haz clic en los pines del mapa para agregar escuelas a tu ruta de visitas
            </p>
          </div>
        ) : (
          routeGroups.map((group, index) => {
            if (group.type === 'campus') {
              const totalValue = group.schools.reduce((sum, s) => sum + getSchoolValue(s), 0);
              const totalStudents = group.schools.reduce((sum, s) => sum + (s.alumnos || 0), 0);
              const municipios = [...new Set(group.schools.map(s => s.municipio).filter(Boolean))];
              const municipioLabel = municipios.length === 1 ? municipios[0] : municipios.length > 1 ? `${municipios.length} municipios` : '';
              
              return (
                <div
                  key={group.id}
                  className="intel-route-item animate-intel-drop-in bg-[#A855F7]/10 border-[#A855F7]/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                  style={{ animationDelay: `${index * 30}ms` }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <div className="text-gray-600 cursor-grab active:cursor-grabbing shrink-0">
                    <GripVertical size={14} />
                  </div>
                  
                  <div className="w-6 h-6 rounded-md flex items-center justify-center bg-purple-500/20 text-purple-400 text-[10px] font-black shrink-0">
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                      <Star fill="currentColor" size={12} className="text-[#A855F7]" />
                      CAMPUS
                      {municipioLabel && (
                        <span className="intel-municipio-chip-sm normal-case" title={municipioLabel}>
                          <MapPin size={8} /> {municipioLabel}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {group.schools.map((s, i) => {
                        const st = s.turno ? getTurnoStyles(s.turno) : null;
                        const Icon = st ? st.IconComponent : null;
                        return (
                          <div key={i} className="flex items-center gap-1">
                            {st && (
                              <span className={`inline-flex items-center gap-1 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded border ${st.gradientClass} ${st.textClass} ${st.borderClass} ${st.shadowClass}`} style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.2)' }}>
                                <Icon size={8} strokeWidth={2.5} />
                                {st.short}
                              </span>
                            )}
                            <span className="px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-white/5 text-gray-400">
                              {s.nivelEducativo?.substring(0,3)} ({s.alumnos})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-purple-400">
                      {formatMXN(totalValue)}
                    </p>
                    <p className="text-[9px] text-gray-600">{formatNumber(totalStudents)} alumnos</p>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirmDeleteId === `group-${index}`) {
                        const newRoute = routeCCTs.filter(c => !group.ccts.includes(c));
                        onReorderRoute(newRoute);
                        setConfirmDeleteId(null);
                      } else {
                        setConfirmDeleteId(`group-${index}`);
                      }
                    }}
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-all shrink-0 ${
                      confirmDeleteId === `group-${index}` ? 'bg-red-500 text-white shadow-lg' : 'text-gray-600 hover:text-red-400 hover:bg-red-500/10'
                    }`}
                    title="Eliminar grupo"
                  >
                    {confirmDeleteId === `group-${index}` ? <Trash2 size={12} /> : <X size={12} />}
                  </button>
                </div>
              );
            }

            // Single school
            const school = group.schools[0];
            const schoolValue = getSchoolValue(school);
            return (
              <div
                key={school.cct}
                className="intel-route-item animate-intel-drop-in"
                style={{ animationDelay: `${index * 30}ms` }}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
              >
                {/* Drag handle */}
                <div className="text-gray-600 cursor-grab active:cursor-grabbing shrink-0">
                  <GripVertical size={14} />
                </div>

                {/* Order number */}
                <div className="w-6 h-6 rounded-md flex items-center justify-center bg-emerald-500/15 text-emerald-400 text-[10px] font-black shrink-0">
                  {index + 1}
                </div>
                {/* School info */}
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-[13px] font-bold text-white leading-tight mb-1">{school.nombre || 'Sin nombre'}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    {(() => {
                      if (!school.turno) return null;
                      const st = getTurnoStyles(school.turno);
                      const Icon = st.IconComponent;
                      return (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded border ${st.gradientClass} ${st.textClass} ${st.borderClass} ${st.shadowClass}`} style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.2)' }}>
                          <Icon size={9} strokeWidth={2.5} />
                          {st.short}
                        </span>
                      );
                    })()}
                    {school.municipio && (
                      <span className="intel-municipio-chip-sm bg-white/5 border-white/10" title={school.municipio}>
                        <MapPin size={9} /> {school.municipio}
                      </span>
                    )}
                    <span className="text-[9px] text-gray-400 font-mono tracking-wider bg-black/20 px-1.5 py-0.5 rounded">{school.cct}</span>
                    <span className={`px-1.5 py-0.5 text-[8px] font-black tracking-widest rounded uppercase ${school.isPrivada ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                      {school.isPrivada ? 'PRIV' : 'PUB'}
                    </span>
                  </div>
                </div>

                {/* Value & Students */}
                <div className="text-right shrink-0 flex flex-col items-end justify-center pl-2 border-l border-white/5">
                  <p className={`text-xs font-black ${school.isPrivada ? 'text-amber-400' : 'text-blue-400'}`}>
                    {formatMXN(schoolValue)}
                  </p>
                  <p className="text-[9px] text-gray-600">{formatNumber(school.alumnos)} alumnos</p>
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirmDeleteId === `school-${index}`) {
                      onRemoveFromRoute(school.cct);
                      setConfirmDeleteId(null);
                    } else {
                      setConfirmDeleteId(`school-${index}`);
                    }
                  }}
                  className={`w-6 h-6 rounded-md flex items-center justify-center transition-all shrink-0 ${
                    confirmDeleteId === `school-${index}` ? 'bg-red-500 text-white shadow-lg' : 'text-gray-600 hover:text-red-400 hover:bg-red-500/10'
                  }`}
                  title="Eliminar ubicación"
                >
                  {confirmDeleteId === `school-${index}` ? <Trash2 size={12} /> : <X size={12} />}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer with metrics + actions */}
      {routeSchools.length > 0 && (
        <div className="px-4 pb-4 pt-2 border-t border-[var(--intel-border)] space-y-3 shrink-0">
          {/* Route metrics */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/[0.03] rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <MapPin size={10} className="text-emerald-400" />
              </div>
              <p className="text-sm font-black text-white">{routeGroups.length}</p>
              <p className="text-[9px] text-gray-500">{routeGroups.length === 1 ? 'Ubicación' : 'Ubicaciones'}</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Users size={10} className="text-blue-400" />
              </div>
              <p className="text-sm font-black text-white">{formatNumber(metrics.totalStudents)}</p>
              <p className="text-[9px] text-gray-500">Alumnos</p>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <DollarSign size={10} className="text-amber-400" />
              </div>
              <p className="text-sm font-black text-amber-400">{formatMXN(metrics.totalValue)}</p>
              <p className="text-[9px] text-gray-500">Valor Bruto</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={onSaveProject}
              className="intel-btn intel-btn-emerald flex-1 py-2.5"
            >
              <Save size={14} />
              Guardar
            </button>
            <button
              onClick={onViewReport}
              className="intel-btn intel-btn-primary flex-1 py-2.5"
            >
              <FileBarChart size={14} />
              Reporte
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
