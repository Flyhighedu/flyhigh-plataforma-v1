'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MapPin, Route, ChevronRight, ChevronLeft } from 'lucide-react';
import RoutePanel from './RoutePanel';
import DistribucionPanel from './DistribucionPanel';

export default function RightSidebar({
  collapsed,
  onToggleCollapse,
  
  // Route Panel Props
  schools,
  routeCCTs,
  prices,
  onRemoveFromRoute,
  onClearRoute,
  onReorderRoute,
  onSaveProject,
  onViewReport,

  // Distribucion Panel Props
  filteredSchools,
  campusMap,
  onFocusCity,
  onFocusSchoolKey
}) {
  const [activeTab, setActiveTab] = useState('distribucion'); // 'distribucion' | 'ruta'
  const [panelWidth, setPanelWidth] = useState(380);
  const [routeAnimating, setRouteAnimating] = useState(false);
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

  const routeGroupCount = useMemo(() => {
    let count = 0;
    const campusHandled = new Set();
    const schoolMap = new Map(schools.map(s => [s.cct, s]));
    
    routeCCTs.forEach(cct => {
      const school = schoolMap.get(cct);
      if (!school) return;
      
      const coordKey = `${school.latitud},${school.longitud}`;
      const campusGroup = campusMap?.get(coordKey);
      
      if (campusGroup && campusGroup.length >= 2) {
        const campusKey = `${coordKey}_cmp`;
        if (!campusHandled.has(campusKey)) {
          count++;
          campusHandled.add(campusKey);
        }
      } else {
        count++;
      }
    });
    return count;
  }, [schools, routeCCTs, campusMap]);

  const prevRouteCount = useRef(routeGroupCount);

  // ═══ Route Animation Effect ═══
  useEffect(() => {
    if (routeGroupCount > prevRouteCount.current) {
      setRouteAnimating(true);
      const timer = setTimeout(() => setRouteAnimating(false), 600);
      prevRouteCount.current = routeGroupCount;
      return () => clearTimeout(timer);
    }
    prevRouteCount.current = routeGroupCount;
  }, [routeGroupCount]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      // Dragging left = wider panel (resize handle is on the left edge)
      const delta = startX.current - e.clientX;
      const newWidth = Math.min(600, Math.max(280, startWidth.current + delta));
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

  if (collapsed) return null;

  return (
    <div 
      className="relative shrink-0 bg-[#0a0f16] border-l border-[var(--intel-border)] flex flex-col h-full z-[1000] shadow-[-10px_0_30px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out translate-x-0"
      style={{ width: panelWidth }}
    >
      {/* ═══ Resize Handle ═══ */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors z-10"
        onMouseDown={handleResizeStart}
      />

      {/* ═══ Tabs Header ═══ */}
      <div className="flex shrink-0 border-b border-[var(--intel-border)] bg-[#0B1120]">
        <button
          onClick={() => setActiveTab('distribucion')}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'distribucion'
              ? 'text-blue-400 bg-blue-500/10 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border-b-2 border-transparent'
          }`}
        >
          <MapPin size={14} />
          Distribución
        </button>
        <button
          id="intel-mi-ruta-tab"
          onClick={() => setActiveTab('ruta')}
          className={`relative flex-1 flex items-center justify-center gap-2 py-3.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
            activeTab === 'ruta'
              ? 'text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-500'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border-b-2 border-transparent'
          } ${routeAnimating ? 'bg-emerald-500/20 text-emerald-300 shadow-[inset_0_0_20px_rgba(16,185,129,0.3)]' : ''}`}
        >
          <Route size={14} className={`transition-transform duration-300 ${routeAnimating ? 'scale-125 text-emerald-300' : ''}`} />
          <span>Mi Ruta</span>
          {routeGroupCount > 0 && (
            <span className={`bg-emerald-500 text-gray-900 px-1.5 py-0.5 rounded-full text-[9px] transition-all duration-300 ${routeAnimating ? 'scale-125 bg-emerald-400 font-black shadow-[0_0_10px_rgba(16,185,129,0.8)]' : ''}`}>
              {routeGroupCount}
            </span>
          )}
        </button>
      </div>

      {/* ═══ Panel Content ═══ */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'distribucion' && (
          <DistribucionPanel
            filteredSchools={filteredSchools}
            prices={prices}
            campusMap={campusMap}
            onFocusCity={onFocusCity}
            onFocusSchoolKey={onFocusSchoolKey}
          />
        )}
        
        {activeTab === 'ruta' && (
          <RoutePanel
            schools={schools}
            routeCCTs={routeCCTs}
            prices={prices}
            campusMap={campusMap}
            onRemoveFromRoute={onRemoveFromRoute}
            onClearRoute={onClearRoute}
            onReorderRoute={onReorderRoute}
            onSaveProject={onSaveProject}
            onViewReport={onViewReport}
            isEmbedded={true}
          />
        )}
      </div>
    </div>
  );
}
