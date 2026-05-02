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
  Users,
  CheckCircle2,
  PhoneCall,
  PhoneMissed,
} from "lucide-react";

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
    if (filterStage !== "all") result = result.filter(s => s.estado_pipeline === filterStage);
    if (searchQuery) {
      const lq = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.nombre_escuela || "").toLowerCase().includes(lq) ||
        (s.cct || "").toLowerCase().includes(lq)
      );
    }
    return result;
  }, [schools, searchQuery, filterStage]);

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
      <div className="shrink-0 z-10 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Building2 size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-tight tracking-tight">CRM Escuelas</h1>
              <p className="text-[11px] font-semibold text-slate-400">
                {filteredSchools.length} de {schools.length} registros
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all text-sm ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vista lista"
              >
                <LayoutList size={17} />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 rounded-lg transition-all text-sm ${viewMode === 'kanban' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Vista Kanban"
              >
                <Trello size={17} />
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 pb-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" size={16} />
            <input
              type="text"
              placeholder="Buscar escuela o CCT..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-100 border border-transparent rounded-xl text-sm font-medium outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Stage Filter chips */}
        <div className="px-6 pb-4 flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilterStage("all")}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${filterStage === 'all' ? 'bg-slate-800 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
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
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${filterStage === stage.id ? 'text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
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
          <div className="p-5 flex flex-col gap-2.5">
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
  const isReminderNear = school.reminder_at && new Date(school.reminder_at).getTime() < Date.now() + 86400000;
  const isReminderOverdue = school.reminder_at && new Date(school.reminder_at).getTime() < Date.now();

  return (
    <div
      onClick={onClick}
      className={`group bg-white rounded-2xl border border-slate-200/80 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer overflow-hidden flex gap-0 ${compact ? '' : ''}`}
    >
      {/* Color bar */}
      <div className="w-1 shrink-0 rounded-l-2xl" style={{ backgroundColor: stage.color }} />

      <div className={`flex-1 ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold text-slate-800 leading-snug truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              {school.nombre_escuela}
            </h3>
            {!compact && (
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {school.tipo} · {school.turno} · {school.ninos} alumnos
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {school.whatsapp_phone && (
              <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-green-600" title="Chat activo">
                <MessageCircle size={10} strokeWidth={3} />
              </span>
            )}
            {school.reminder_at && (
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center ${isReminderOverdue ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-amber-100 text-amber-600'}`}
                title="Recordatorio programado"
              >
                <Bell size={10} strokeWidth={3} />
              </span>
            )}
            <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
          </div>
        </div>

        {!compact && (
          <div className="flex items-center gap-2 mt-2.5">
            <StageChip stageId={school.estado_pipeline} />
            {school.reminder_at && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isReminderOverdue ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                {new Date(school.reminder_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
