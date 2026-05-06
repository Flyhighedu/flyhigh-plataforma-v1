"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { 
  Building2, 
  Search, 
  LayoutList, 
  Trello, 
  MessageCircle, 
  Bell, 
  X, 
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  CheckCircle2,
  PhoneCall,
  PhoneMissed,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const PIPELINE_STAGES = [
  { id: 'sin_contacto',         label: 'Sin Contacto',    color: '#94a3b8', bg: 'bg-slate-100 text-slate-600' },
  { id: 'llamada_sin_respuesta',label: 'Sin Respuesta',    color: '#f59e0b', bg: 'bg-amber-100 text-amber-700' },
  { id: 'contactada',           label: 'Contactada',       color: '#3b82f6', bg: 'bg-blue-100 text-blue-700' },
  { id: 'cita_ventas',          label: 'Cita de Ventas',  color: '#6366f1', bg: 'bg-indigo-100 text-indigo-700' },
  { id: 'agendada',             label: 'Agendada',         color: '#a855f7', bg: 'bg-purple-100 text-purple-700' },
  { id: 'en_preparacion',       label: 'En Preparación',  color: '#ec4899', bg: 'bg-fuchsia-100 text-fuchsia-700' },
  { id: 'en_ruta',              label: 'En Ruta',          color: '#f97316', bg: 'bg-orange-100 text-orange-700' },
  { id: 'operando',             label: 'Operando',         color: '#10b981', bg: 'bg-emerald-100 text-emerald-700' },
  { id: 'visitada',             label: 'Visitada',         color: '#14b8a6', bg: 'bg-teal-100 text-teal-700' },
  { id: 'perdida',              label: 'Perdida',          color: '#ef4444', bg: 'bg-rose-100 text-rose-700' },
];

export default function AdminCRMPage() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filters, setFilters] = useState({
    nivel: [], // 'PRIMARIA', 'PREESCOLAR'
    tipo: 'all', // 'all', 'publico', 'privado'
    ordenAlumnos: null, // null | 'asc' | 'desc'
    turno: [], // 'MATUTINO', 'VESPERTINO'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [notifPermission, setNotifPermission] = useState("default");
  const [notasLocal, setNotasLocal] = useState("");
  const notasSaveTimer = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/crm");
      const json = await res.json();
      if (json.data) setSchools(json.data);
    } catch (err) {
      console.error("Error fetching CRM data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then(p => setNotifPermission(p));
      }
    }
  }, [fetchData]);

  // Sync notasLocal when selected school changes
  useEffect(() => {
    if (selectedSchool) setNotasLocal(selectedSchool.notas || "");
  }, [selectedSchool?.cct]);

  // Reminder checker
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      schools.forEach(school => {
        if (school.reminder_at && !school._notified) {
          const t = new Date(school.reminder_at).getTime();
          if (now >= t && now - t < 5 * 60 * 1000) {
            if (notifPermission === "granted") {
              new Notification(`Recordatorio: ${school.nombre_escuela}`, {
                body: school.reminder_note || "Tienes un evento programado.",
                icon: "/apple-icon.png"
              });
            }
            setSchools(prev => prev.map(s => s.cct === school.cct ? { ...s, _notified: true } : s));
          }
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [schools, notifPermission]);

  // Realtime subscription for pipeline changes
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crm_pipeline_log',
        },
        (payload) => {
          const { cct, nombre_escuela, estado_nuevo, cambiado_por } = payload.new;
          
          // Muestra una notificación push web de que alguien cambió el estado
          if (notifPermission === "granted") {
            new Notification(`Actualización CRM: ${nombre_escuela}`, {
              body: `${cambiado_por} movió la escuela a ${estado_nuevo.replace(/_/g, ' ').toUpperCase()}`,
              icon: "/apple-icon.png"
            });
          }

          // Actualizamos estado localmente sin refrescar todo si la escuela existe
          setSchools(prev => prev.map(s => s.cct === cct ? { ...s, estado_pipeline: estado_nuevo } : s));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [notifPermission]);

  const handleUpdateSchool = useCallback(async (cct, updates) => {
    setSchools(prev => prev.map(s => s.cct === cct ? { ...s, ...updates } : s));
    if (selectedSchool?.cct === cct) {
      setSelectedSchool(prev => ({ ...prev, ...updates }));
    }
    try {
      const res = await fetch("/api/admin/crm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cct, ...updates })
      });
      if (!res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  }, [selectedSchool, fetchData]);

  // Debounced notes save
  const handleNotasChange = (value) => {
    setNotasLocal(value);
    clearTimeout(notasSaveTimer.current);
    notasSaveTimer.current = setTimeout(() => {
      handleUpdateSchool(selectedSchool.cct, { notas: value });
    }, 800);
  };

  const filteredSchools = useMemo(() => {
    let result = schools;
    // Pipeline stage
    if (filterStage !== "all") result = result.filter(s => s.estado_pipeline === filterStage);
    
    // Nivel educativo
    if (filters.nivel.length > 0)
        result = result.filter(s => filters.nivel.includes(s.nivel_educativo));
    
    // Tipo (público = todo excepto PRIVADO)
    if (filters.tipo === 'publico')
        result = result.filter(s => s.tipo !== 'PRIVADO');
    else if (filters.tipo === 'privado')
        result = result.filter(s => s.tipo === 'PRIVADO');
    
    // Turno
    if (filters.turno.length > 0)
        result = result.filter(s => filters.turno.includes(s.turno));

    // Búsqueda text
    if (searchQuery) {
      const lq = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.nombre_escuela || "").toLowerCase().includes(lq) ||
        (s.cct || "").toLowerCase().includes(lq)
      );
    }
    
    // Orden Alumnos
    if (filters.ordenAlumnos === 'asc') {
      result = [...result].sort((a, b) => (a.ninos || 0) - (b.ninos || 0));
    } else if (filters.ordenAlumnos === 'desc') {
      result = [...result].sort((a, b) => (b.ninos || 0) - (a.ninos || 0));
    }

    return result;
  }, [schools, searchQuery, filterStage, filters]);

  const stageCounts = useMemo(() => {
    const counts = {};
    schools.forEach(s => {
      counts[s.estado_pipeline] = (counts[s.estado_pipeline] || 0) + 1;
    });
    return counts;
  }, [schools]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative" style={{ background: 'var(--crm-bg, #f8fafc)' }}>

      {/* ── HEADER ── */}
      <div className="shrink-0 z-10 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm transition-all duration-300">
        <div className="flex items-center justify-between px-4 md:px-6 pt-4 md:pt-5 pb-3 md:pb-4 gap-3 md:gap-4">
          <div className="flex items-center gap-2.5 md:gap-3">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Building2 size={18} strokeWidth={2.5} className="md:w-5 md:h-5" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-black text-slate-900 leading-tight tracking-tight">CRM Escuelas</h1>
              <p className="text-[10px] md:text-[11px] font-semibold text-slate-400">
                {filteredSchools.length} de {schools.length} registros
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 md:p-2 rounded-lg transition-all text-sm ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vista lista"
              >
                <LayoutList size={17} />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 md:p-2 rounded-lg transition-all text-sm ${viewMode === 'kanban' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vista Kanban"
              >
                <Trello size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="px-4 md:px-6 pb-3 md:pb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 md:left-4 top-1/2 -translate-y-1/2 text-blue-400" size={16} />
            <input
              type="text"
              placeholder="Buscar escuela o CCT..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 md:pl-11 pr-4 py-2.5 bg-slate-100 border border-transparent rounded-xl text-[13px] md:text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 md:px-4 flex items-center justify-center gap-2 rounded-xl text-[13px] md:text-sm font-bold transition-all active:scale-95 ${showFilters ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <SlidersHorizontal size={16} />
            <span className="hidden sm:inline">Filtros</span>
          </button>
        </div>

        {/* Collapsible Filters Panel */}
        {showFilters && (
          <div className="px-4 md:px-6 pb-4 border-b border-slate-100 mb-2 animate-in slide-in-from-top-2 duration-200">
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-lg shadow-slate-200/40 overflow-hidden flex flex-col max-h-[65vh] md:max-h-none ring-1 ring-black/5">
              <div className="p-4 md:p-6 overflow-y-auto no-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Nivel */}
                  <div className="flex flex-col gap-2.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nivel Educativo</label>
                    <div className="flex bg-slate-100/80 p-1 rounded-xl">
                      {['PREESCOLAR', 'PRIMARIA'].map(lvl => {
                        const active = filters.nivel.includes(lvl);
                        return (
                          <button
                            key={lvl}
                            onClick={() => {
                              if (active) setFilters({...filters, nivel: filters.nivel.filter(n => n !== lvl)});
                              else setFilters({...filters, nivel: [...filters.nivel, lvl]});
                            }}
                            className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 ${active ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                          >
                            {lvl}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sostenimiento */}
                  <div className="flex flex-col gap-2.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sostenimiento</label>
                    <div className="flex bg-slate-100/80 p-1 rounded-xl">
                      {[{id: 'all', label: 'Todos'}, {id: 'publico', label: 'Público'}, {id: 'privado', label: 'Privado'}].map(t => {
                        const active = filters.tipo === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => setFilters({...filters, tipo: t.id})}
                            className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 ${active ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Orden Alumnos */}
                  <div className="flex flex-col gap-2.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cant. de Alumnos</label>
                    <div className="flex bg-slate-100/80 p-1 rounded-xl">
                      <button
                        onClick={() => setFilters({...filters, ordenAlumnos: filters.ordenAlumnos === 'desc' ? null : 'desc'})}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 ${filters.ordenAlumnos === 'desc' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                      >
                        <ArrowDown size={13} strokeWidth={3} /> Mayor a Menor
                      </button>
                      <button
                        onClick={() => setFilters({...filters, ordenAlumnos: filters.ordenAlumnos === 'asc' ? null : 'asc'})}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 ${filters.ordenAlumnos === 'asc' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                      >
                        <ArrowUp size={13} strokeWidth={3} /> Menor a Mayor
                      </button>
                    </div>
                  </div>

                  {/* Turno */}
                  <div className="flex flex-col gap-2.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Turno</label>
                    <div className="flex bg-slate-100/80 p-1 rounded-xl">
                      {['MATUTINO', 'VESPERTINO'].map(t => {
                        const active = filters.turno.includes(t);
                        return (
                          <button
                            key={t}
                            onClick={() => {
                              if (active) setFilters({...filters, turno: filters.turno.filter(n => n !== t)});
                              else setFilters({...filters, turno: [...filters.turno, t]});
                            }}
                            className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 ${active ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Reset Filters */}
              {(filters.nivel.length > 0 || filters.tipo !== 'all' || filters.turno.length > 0 || filters.ordenAlumnos) && (
                <div className="px-4 md:px-6 py-3 md:py-4 border-t border-slate-100 flex justify-end bg-slate-50/50 shrink-0">
                  <button 
                    onClick={() => setFilters({ nivel: [], tipo: 'all', ordenAlumnos: null, turno: [] })}
                    className="flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 active:scale-95 transition-all w-full sm:w-auto shadow-sm"
                  >
                    <X size={14} strokeWidth={2.5} /> Restablecer Filtros
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stage Filter chips */}
        <div className="px-4 md:px-6 pb-3 md:pb-4 flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterStage("all")}
            className={`shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[11px] font-bold transition-all active:scale-95 ${filterStage === 'all' ? 'bg-slate-800 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            Todas · {schools.length}
          </button>
          {PIPELINE_STAGES.map(stage => {
            const count = stageCounts[stage.id] || 0;
            if (!count) return null;
            return (
              <button
                key={stage.id}
                onClick={() => setFilterStage(stage.id === filterStage ? 'all' : stage.id)}
                className={`shrink-0 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-[11px] font-bold transition-all active:scale-95 border ${filterStage === stage.id ? 'text-white shadow-md border-transparent' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                style={filterStage === stage.id ? { backgroundColor: stage.color } : {}}
              >
                {stage.label} · {count}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest">Cargando...</span>
          </div>
        ) : viewMode === "list" ? (
          <div className="px-4 md:px-6 py-4 md:py-5 pb-24 md:pb-8 flex flex-col gap-3 md:gap-2.5">
            {filteredSchools.map(school => (
              <SchoolCard
                key={school.cct}
                school={school}
                onClick={() => setSelectedSchool(school)}
              />
            ))}
            {filteredSchools.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                <Building2 size={40} strokeWidth={1} />
                <p className="text-sm font-medium">No se encontraron escuelas</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 flex gap-4 overflow-x-auto h-full pb-8" style={{ alignItems: 'flex-start' }}>
            {PIPELINE_STAGES.map(stage => {
              const stageSchools = filteredSchools.filter(s => s.estado_pipeline === stage.id);
              return (
                <div key={stage.id} className="min-w-[270px] w-[270px] flex flex-col rounded-2xl overflow-hidden shrink-0 border border-slate-200/70 bg-white/60 backdrop-blur-sm">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100" style={{ borderTopColor: stage.color, borderTopWidth: 3 }}>
                    <span className="font-bold text-xs text-slate-700 tracking-wide uppercase">{stage.label}</span>
                    <span className="text-xs font-black text-slate-400">{stageSchools.length}</span>
                  </div>
                  <div className="flex flex-col gap-2 p-3 overflow-y-auto max-h-[65vh]">
                    {stageSchools.map(school => (
                      <SchoolCard
                        key={school.cct}
                        school={school}
                        onClick={() => setSelectedSchool(school)}
                        compact
                      />
                    ))}
                    {stageSchools.length === 0 && (
                      <p className="text-center text-[11px] text-slate-300 py-4 font-medium">Sin escuelas</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── RIGHT DRAWER ── */}
      {selectedSchool && (
        <div
          className="absolute inset-0 z-50 flex justify-end"
          style={{ background: 'rgba(15,23,42,0.25)', backdropFilter: 'blur(3px)' }}
          onClick={() => setSelectedSchool(null)}
        >
          <div
            className="bg-white w-full sm:w-[440px] h-full shadow-[0_0_60px_rgba(0,0,0,0.15)] flex flex-col border-l border-slate-200"
            onClick={e => e.stopPropagation()}
            style={{ animation: 'slideInRight 0.28s cubic-bezier(0.34,1.2,0.64,1)' }}
          >
            {/* Drawer Header */}
            <div className="shrink-0 px-6 pt-6 pb-5 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-3">
                  <StageChip stageId={selectedSchool.estado_pipeline} />
                  <h2 className="text-lg font-black text-slate-900 leading-snug mt-1.5 truncate">
                    {selectedSchool.nombre_escuela}
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    CCT: {selectedSchool.cct} · {selectedSchool.turno} · {selectedSchool.ninos} alumnos · {selectedSchool.tipo}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSchool(null)}
                  className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600 transition-colors shrink-0"
                >
                  <X size={15} strokeWidth={2.5} />
                </button>
              </div>

              {/* WhatsApp CTA */}
              {selectedSchool.whatsapp_phone && (
                <a
                  href={`/sandbox-crm?contact=${selectedSchool.whatsapp_phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5e] active:scale-95 text-white py-2.5 rounded-xl font-bold text-sm shadow-md shadow-green-500/20 transition-all"
                >
                  <MessageCircle size={18} />
                  Abrir chat WhatsApp
                  <ExternalLink size={13} className="opacity-70 ml-auto" />
                </a>
              )}
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 flex flex-col gap-6">

                {/* Pipeline Stage */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5 block">
                    Estado del Pipeline
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PIPELINE_STAGES.map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleUpdateSchool(selectedSchool.cct, { estado_pipeline: s.id })}
                        className={`px-3 py-2 rounded-xl text-[11px] font-bold text-left transition-all border-2 flex items-center gap-2 ${
                          selectedSchool.estado_pipeline === s.id
                            ? 'text-white border-transparent shadow-md'
                            : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                        }`}
                        style={selectedSchool.estado_pipeline === s.id ? { backgroundColor: s.color, borderColor: s.color } : {}}
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        {s.label}
                        {selectedSchool.estado_pipeline === s.id && <CheckCircle2 size={13} className="ml-auto opacity-80" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recordatorio */}
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-blue-700">
                    <Bell size={16} strokeWidth={2.5} />
                    <h3 className="font-black text-xs uppercase tracking-widest">Recordatorio</h3>
                  </div>
                  <input
                    type="datetime-local"
                    className="w-full bg-white border border-blue-100 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                    value={selectedSchool.reminder_at ? selectedSchool.reminder_at.substring(0, 16) : ""}
                    onChange={e => handleUpdateSchool(selectedSchool.cct, {
                      reminder_at: e.target.value ? new Date(e.target.value).toISOString() : null
                    })}
                  />
                  <input
                    type="text"
                    placeholder="Ej: Marcar al director a las 10am"
                    className="w-full bg-white border border-blue-100 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all"
                    value={selectedSchool.reminder_note || ""}
                    onChange={e => handleUpdateSchool(selectedSchool.cct, { reminder_note: e.target.value })}
                  />
                </div>

                {/* Notas */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5 block">
                    Notas del CRM
                    {notasSaveTimer.current && <span className="ml-2 text-blue-400 normal-case font-medium">Guardando...</span>}
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Contactos clave, acuerdos, próximos pasos..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm resize-none outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all"
                    value={notasLocal}
                    onChange={e => handleNotasChange(e.target.value)}
                  />
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

// ─── StageChip ──────────────────────────────────────────────
function StageChip({ stageId }) {
  const stage = PIPELINE_STAGES.find(s => s.id === stageId) || PIPELINE_STAGES[0];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${stage.bg}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
      {stage.label}
    </span>
  );
}

// ─── SchoolCard ──────────────────────────────────────────────
function SchoolCard({ school, onClick, compact = false }) {
  const stage = PIPELINE_STAGES.find(s => s.id === school.estado_pipeline) || PIPELINE_STAGES[0];
  const isReminderOverdue = school.reminder_at && new Date(school.reminder_at).getTime() < Date.now();
  const isHighPriority = (school.ninos || 0) >= 300;

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`group bg-white rounded-2xl border ${isHighPriority ? 'border-purple-200 shadow-purple-500/5' : 'border-slate-200/80 hover:border-blue-200'} hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer overflow-hidden flex items-stretch`}
      >
        <div className="w-1.5 shrink-0" style={{ backgroundColor: stage.color }} />
        
        <div className="flex-1 p-3 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-extrabold text-slate-800 text-xs leading-snug truncate">
                {school.nombre_escuela}
              </h3>
              <p className="text-[10px] font-semibold text-slate-400 mt-1 truncate flex items-center gap-1.5">
                <span>{school.nivel_educativo === 'PREESCOLAR' ? 'Preescolar' : 'Primaria'}</span>
                <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                <span>{school.tipo === 'PRIVADO' ? 'Privado' : 'Público'}</span>
              </p>
            </div>
            
            <div className="flex flex-col items-end shrink-0 pl-2">
              <span className={`text-sm font-black leading-none ${isHighPriority ? 'text-purple-600' : 'text-slate-700'}`}>
                {school.ninos || 0}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                Alumn.
              </span>
            </div>
          </div>
          
          <div className="mt-3 flex items-center justify-between">
            <StageChip stageId={school.estado_pipeline} />
            <div className="flex items-center gap-1.5">
               {school.whatsapp_phone && (
                <MessageCircle size={12} className="text-green-500" />
               )}
               {school.reminder_at && (
                <Bell size={12} className={isReminderOverdue ? 'text-rose-500 animate-pulse' : 'text-amber-500'} />
               )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div
      onClick={onClick}
      className={`group bg-white rounded-2xl border ${isHighPriority ? 'border-purple-200 shadow-purple-500/5' : 'border-slate-200/80 hover:border-blue-200'} hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer overflow-hidden flex items-stretch`}
    >
      <div className="w-1.5 shrink-0" style={{ backgroundColor: stage.color }} />

      <div className="flex-1 p-3.5 md:p-5 flex items-center justify-between gap-2.5 md:gap-4">
        
        {/* Left content: Name, metadata, pipeline stage */}
        <div className="flex flex-col gap-1.5 md:gap-2 min-w-0 flex-1">
          <h3 className="font-extrabold text-slate-800 text-sm md:text-base leading-tight truncate pr-2 md:pr-4">
            {school.nombre_escuela}
          </h3>
          
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2 text-[10px] md:text-[11px] font-semibold text-slate-500">
            <span>{school.nivel_educativo === 'PREESCOLAR' ? 'Preescolar' : 'Primaria'}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>{school.tipo === 'PRIVADO' ? 'Privado' : 'Público'}</span>
            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
            <span>{school.turno}</span>
            {school.cct && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className="font-mono text-[9px] md:text-[10px] text-slate-400 truncate max-w-[80px] sm:max-w-none">{school.cct}</span>
              </>
            )}
          </div>
          
          <div className="mt-1 flex items-center gap-2.5 md:gap-3">
            <StageChip stageId={school.estado_pipeline} />
            
            <div className="flex items-center gap-1.5 md:gap-2">
              {school.whatsapp_phone && (
                <span className="flex items-center justify-center w-5 h-5 md:w-auto md:h-auto md:px-2 md:py-0.5 bg-green-50 rounded-full md:rounded-full text-green-600">
                  <MessageCircle size={12} strokeWidth={2.5} /> 
                  <span className="hidden md:inline ml-1 text-[10px] font-bold">Chat</span>
                </span>
              )}
              {school.reminder_at && (
                <span className={`flex items-center justify-center md:gap-1 w-5 h-5 md:w-auto md:h-auto md:px-2 md:py-0.5 rounded-full ${isReminderOverdue ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                  <Bell size={12} strokeWidth={2.5} className={isReminderOverdue ? 'animate-pulse' : ''} /> 
                  <span className="hidden md:inline text-[10px] font-bold">
                    {new Date(school.reminder_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Right content: Prominent student count & arrow */}
        <div className="flex items-center gap-3 md:gap-5 shrink-0 pl-3 md:pl-5 border-l border-slate-100">
          <div className="flex flex-col items-end">
            <span className={`text-2xl md:text-3xl font-black tracking-tighter leading-none ${isHighPriority ? 'text-purple-600' : 'text-slate-800'}`}>
              {school.ninos || 0}
            </span>
            <span className="text-[8px] md:text-[9px] font-extrabold uppercase tracking-widest text-slate-400 mt-1.5">
              Alumnos
            </span>
          </div>
          <div className="hidden sm:flex w-10 h-10 rounded-full bg-slate-50 border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 items-center justify-center transition-all">
            <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
          </div>
        </div>

      </div>
    </div>
  );
}
