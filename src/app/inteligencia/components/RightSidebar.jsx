'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Route, Eye, EyeOff, Plus, Maximize2, ArrowLeftRight, Pencil } from 'lucide-react';
import RoutePanel from './RoutePanel';

const ROUTE_COLORS = [
  '#10B981', // Emerald
  '#8B5CF6', // Violet
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#EC4899', // Pink
];

export default function RightSidebar({
  collapsed,
  onToggleCollapse,
  isSwapped,
  onSwap,
  schools,
  routes = [],
  activeRouteId,
  onRouteSelect,
  onRoutesChange,
  routeCCTs,
  prices,
  campusMap,
  onRemoveFromRoute,
  onClearRoute,
  onReorderRoute,
  onSaveProject,
  onViewReport,
}) {
  const [panelHeight, setPanelHeight] = useState(400);
  const [routeUserResized, setRouteUserResized] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const isResizing = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(400);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    startY.current = e.clientY;
    startHeight.current = e.currentTarget.parentElement.clientHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing.current) return;
      const delta = startY.current - e.clientY;
      const newHeight = Math.min(window.innerHeight - 100, Math.max(150, startHeight.current + delta));
      setPanelHeight(newHeight);
      setRouteUserResized(true);
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

  const handleAddRoute = () => {
    const newId = `r${Date.now()}`;
    const nextColor = ROUTE_COLORS[routes.length % ROUTE_COLORS.length];
    const newRoute = { id: newId, name: `Ruta ${routes.length + 1}`, color: nextColor, visible: true, ccts: [] };
    onRoutesChange([...routes, newRoute]);
    onRouteSelect(newId);
  };

  const handleToggleVisible = (e, id) => {
    e.stopPropagation();
    onRoutesChange(routes.map(r => r.id === id ? { ...r, visible: !r.visible } : r));
  };

  return (
    <div 
      className={`intel-distribution-drawer ${collapsed ? 'is-collapsed cursor-pointer' : ''}`}
      style={{ 
        height: collapsed ? 56 : (routeUserResized ? panelHeight : 'calc(100% - 32px)'), 
        right: isSwapped 
          ? 'calc(var(--intel-widget-margin) + var(--intel-widget-width) + var(--intel-widget-gap))' 
          : 'var(--intel-widget-margin)'
      }}
      onClick={() => {
        if (collapsed) onToggleCollapse();
      }}
    >
      {/* ═══ Resize Handle ═══ */}
      <div 
        className="intel-distribution-drawer-handle"
        onMouseDown={handleResizeStart}
        onClick={(e) => e.stopPropagation()}
      />

      {/* ═══ Header ═══ */}
      <div 
        className={`intel-distribution-drawer-header cursor-pointer ${collapsed ? 'hover:bg-white/5 transition-colors' : ''}`}
        onClick={onToggleCollapse}
      >
        <div className="flex items-center gap-2 min-w-0 pointer-events-none">
          <Route size={16} className="text-emerald-400 shrink-0" />
          <span className="font-black text-white text-sm truncate">Simulador de Rutas</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse();
            }}
            className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-white transition-colors"
          >
            {collapsed ? 'Abrir' : 'Minimizar'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="intel-distribution-drawer-body flex flex-col h-full">
          {/* ═══ Route Tabs ═══ */}
          <div className="flex shrink-0 border-b border-[var(--intel-border)] bg-[#0B1120] overflow-x-auto custom-scrollbar">
            {routes.map(route => {
              const isActive = route.id === activeRouteId;
              const isEditing = editingRouteId === route.id;

              const handleRenameRoute = (newName) => {
                if (!newName.trim()) {
                  setEditingRouteId(null);
                  return;
                }
                onRoutesChange(routes.map(r => r.id === route.id ? { ...r, name: newName.trim() } : r));
                setEditingRouteId(null);
              };

              return (
                <div
                  key={route.id}
                  className={`group flex items-center justify-between gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider transition-all min-w-[175px] whitespace-nowrap cursor-pointer select-none ${
                    isActive
                      ? 'bg-white/5 border-b-2'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border-b-2 border-transparent'
                  }`}
                  style={{ 
                    borderColor: isActive ? route.color : 'transparent',
                    color: isActive ? route.color : undefined
                  }}
                  onClick={() => !isEditing && onRouteSelect(route.id)}
                  onDoubleClick={() => {
                    if (isActive && !isEditing) {
                      setEditingRouteId(route.id);
                      setEditingName(route.name);
                    }
                  }}
                  title={isActive && !isEditing ? "Doble clic para editar nombre" : undefined}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: route.color }} />
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleRenameRoute(editingName)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameRoute(editingName);
                          else if (e.key === 'Escape') setEditingRouteId(null);
                        }}
                        ref={(input) => {
                          if (input) {
                            input.focus();
                            if (input.selectionStart === 0 && input.selectionEnd === 0) {
                              input.select();
                            }
                          }
                        }}
                        className="bg-gray-950/60 border text-white text-[11px] font-bold uppercase tracking-wider rounded-md px-1.5 py-0.5 outline-none w-28 placeholder:text-gray-700"
                        style={{ borderColor: route.color }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: route.color }} />
                      <span className="truncate">{route.name}</span>
                      {isActive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRouteId(route.id);
                            setEditingName(route.name);
                          }}
                          className="p-0.5 hover:bg-white/10 rounded transition-colors text-white opacity-40 hover:opacity-100 cursor-pointer ml-0.5"
                          title="Editar nombre"
                        >
                          <Pencil size={10} />
                        </button>
                      )}
                      <span className="opacity-60 text-[9px]">({route.ccts.length})</span>
                    </div>
                  )}
                  
                  {!isEditing && (
                    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => handleToggleVisible(e, route.id)}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        title={route.visible ? "Ocultar en mapa" : "Mostrar en mapa"}
                      >
                        {route.visible ? <Eye size={14} /> : <EyeOff size={14} className="text-gray-600" />}
                      </button>
                      {isActive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewReport();
                          }}
                          className="p-1 hover:bg-white/10 rounded transition-colors text-white"
                          title="Maximizar Reporte"
                        >
                          <Maximize2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            <button
              onClick={handleAddRoute}
              className="px-4 py-3.5 text-gray-500 hover:text-white transition-colors flex items-center justify-center border-b-2 border-transparent"
              title="Crear Nueva Ruta"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* ═══ Panel Content ═══ */}
          <div className="flex-1 overflow-hidden relative">
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
          </div>
        </div>
      )}
    </div>
  );
}
