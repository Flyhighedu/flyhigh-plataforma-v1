'use client';

import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { Route, X, Save, FileBarChart, GripVertical, Trash2, MapPin, Users, DollarSign } from 'lucide-react';
import { calculateRouteMetrics, formatMXN, formatNumber } from '../lib/filters';

export default function RoutePanel({
  schools,          // all parsed schools (for lookup)
  routeCCTs,        // ordered array of CCTs in route
  prices,
  onRemoveFromRoute,
  onClearRoute,
  onReorderRoute,
  onSaveProject,
  onViewReport,
  collapsed,
}) {
  // ─── Resizable panel state ───
  const [panelWidth, setPanelWidth] = useState(340);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(340);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      // Dragging left = wider panel (resize handle is on the left edge)
      const delta = startX.current - e.clientX;
      const newWidth = Math.min(600, Math.max(260, startWidth.current + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Build the ordered route schools from CCTs
  const routeSchools = useMemo(() => {
    const schoolMap = new Map();
    schools.forEach(s => schoolMap.set(s.cct, s));
    return routeCCTs.map(cct => schoolMap.get(cct)).filter(Boolean);
  }, [schools, routeCCTs]);

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

    const newOrder = [...routeCCTs];
    const [moved] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, moved);
    onReorderRoute(newOrder);
  };

  if (collapsed) return null;

  return (
    <div
      className="h-full flex flex-col bg-[var(--intel-surface)] border-l border-[var(--intel-border)] shrink-0 overflow-hidden relative"
      style={{ width: `${panelWidth}px` }}
    >
      {/* ═══ Resize handle (left edge) ═══ */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-30 group hover:bg-blue-500/20 transition-colors"
        title="Arrastrar para redimensionar"
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 rounded-full bg-gray-700 group-hover:bg-blue-400 transition-colors" />
      </div>

      {/* Header */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/15">
              <Route size={16} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Mi Ruta</h2>
              <p className="text-[10px] text-gray-500">{routeSchools.length} escuelas seleccionadas</p>
            </div>
          </div>
          {routeSchools.length > 0 && (
            <button
              onClick={onClearRoute}
              className="text-[10px] font-bold text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1 uppercase tracking-wider"
              title="Limpiar ruta"
            >
              <Trash2 size={11} />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Route list */}
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2">
        {routeSchools.length === 0 ? (
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
          routeSchools.map((school, index) => {
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
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{school.nombre || 'Sin nombre'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-500 font-mono">{school.cct}</span>
                    <span className={`intel-badge ${school.isPrivada ? 'intel-badge-gold' : 'intel-badge-blue'}`}>
                      {school.isPrivada ? 'Priv' : 'Pub'}
                    </span>
                  </div>
                </div>

                {/* Value + student count */}
                <div className="text-right shrink-0">
                  <p className={`text-xs font-black ${school.isPrivada ? 'text-amber-400' : 'text-blue-400'}`}>
                    {formatMXN(schoolValue)}
                  </p>
                  <p className="text-[9px] text-gray-600">{formatNumber(school.alumnos)} alumnos</p>
                </div>

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromRoute(school.cct);
                  }}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                >
                  <X size={12} />
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
              <p className="text-sm font-black text-white">{metrics.totalSchools}</p>
              <p className="text-[9px] text-gray-500">Escuelas</p>
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
