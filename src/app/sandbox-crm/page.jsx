"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/utils/supabase/client";
import KanbanBoard from "./kanban-board";
import InboxView from "./inbox-view";
import ListView from "./list-view";
import { Mail, MessageSquare, PauseCircle, Flame, Search, CheckCircle, XCircle, LayoutDashboard, Activity, Check, DollarSign, Plus, Trash2 } from "lucide-react";

// ─── Notification sound (base64 tiny ding) ──────────────────
const DING_SOUND = typeof Audio !== "undefined"
  ? new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZeXk42GfXNqYWBkaG55hI2UmZqWkIiAd29oY2JkZ295goyVm52alI2Ge3FpYmBiZWx1gIqTmZuZlI6Hf3ZuZ2NiZGlwe4WOlZmamJONhn12b2ljYmRpcHuFjpWZmpiTjIV9dm5pY2JlaXF8hY+WmpqYk42GfnZuaGNiZGlxfIaPlpqamJONhn52bmhjYmRpcXyGj5aampiTjYZ+dm5oY2JkaXF8ho+WmpqYk42GfnZuaWNiZGlxfIaPlpqamJONhn52bmhjYg==")
  : null;

export default function SandboxCRMPage() {
  const [portalTarget, setPortalTarget] = useState(null);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  const [contacts, setContacts] = useState([]);
  const [stages, setStages] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Search & Filter state ──────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // all | paused | new | rotting
  
  // ─── Navigation State ─────────────────────────────────────
  const [viewMode, setViewMode] = useState("inbox"); // inbox | board

  // ─── Pricing Settings Modal ───────────────────────────────
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingData, setPricingData] = useState({ publica: [], privada: [] });
  const [newPrice, setNewPrice] = useState({ tipo: "pública", monto: "" });
  const [pricingLoading, setPricingLoading] = useState(false);

  // ─── Fetch Pricing ────────────────────────────────────────
  const fetchPricing = useCallback(async () => {
    setPricingLoading(true);
    try {
      const res = await fetch("/api/crm-precios");
      const json = await res.json();
      if (json.data) {
        setPricingData({
          publica: json.data.filter(p => p.tipo_escuela === "pública"),
          privada: json.data.filter(p => p.tipo_escuela === "privada")
        });
      }
    } catch (err) {
      console.error("[CRM] Fetch pricing error:", err);
    } finally {
      setPricingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showPricingModal) {
      fetchPricing();
    }
  }, [showPricingModal, fetchPricing]);

  const handleAddPrice = async () => {
    if (!newPrice.monto) return;
    try {
      const res = await fetch("/api/crm-precios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo_escuela: newPrice.tipo, precio: newPrice.monto })
      });
      if (res.ok) {
        setNewPrice({ ...newPrice, monto: "" });
        fetchPricing();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePrice = async (id) => {
    try {
      const res = await fetch(`/api/crm-precios?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchPricing();
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Notifications ──────────────────────────────────────
  const notifPermRef = useRef("default");

  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        notifPermRef.current = perm;
      });
    } else if (typeof Notification !== "undefined") {
      notifPermRef.current = Notification.permission;
    }
  }, []);

  const fireNotification = useCallback((title, body) => {
    // Sound
    try { DING_SOUND?.play(); } catch {}
    // Browser notification
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, icon: "💬" });
    }
  }, []);

  // ─── Fetch initial data ───────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [contactsRes, stagesRes] = await Promise.all([
        fetch("/api/crm-contacts"),
        fetch("/api/crm-pipeline"),
      ]);
      const contactsJson = await contactsRes.json();
      const stagesJson = await stagesRes.json();

      if (contactsJson.data) setContacts(contactsJson.data);
      if (stagesJson.data) setStages(stagesJson.data);
    } catch (err) {
      console.error("[CRM] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Supabase Realtime ────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    const contactsChannel = supabase
      .channel("crm-contacts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_contacts" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setContacts((prev) => {
              if (prev.find((c) => c.id === payload.new.id)) return prev;
              return [payload.new, ...prev];
            });
          } else if (payload.eventType === "UPDATE") {
            setContacts((prev) =>
              prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c))
            );
            setSelectedContact((prev) =>
              prev?.id === payload.new.id ? { ...prev, ...payload.new } : prev
            );
          } else if (payload.eventType === "DELETE") {
            setContacts((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel("crm-messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          const msg = payload.new;
          setContacts((prev) =>
            prev.map((c) => {
              if (c.phone_number !== msg.phone_number) return c;

              // 🔔 Fire notification if message is from user AND bot is paused (human should see it)
              if (msg.direction === "inbound" && c.bot_paused) {
                fireNotification(
                  `💬 ${c.contact_name || c.phone_number}`,
                  msg.content?.substring(0, 80) || "Nuevo mensaje"
                );
              }

              return {
                ...c,
                last_message_at: msg.created_at,
                _hasNewMessage: true,
                ...(msg.direction === 'inbound'
                  ? { last_user_message: msg.content }
                  : msg.sender_type === 'bot'
                    ? { last_bot_message: msg.content }
                    : {}),
              };
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(contactsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [fireNotification]);

  // ─── Filtered contacts (search + quick filters) ───────────
  const filteredContacts = useMemo(() => {
    let result = contacts;

    // Filter by viewMode FIRST
    if (viewMode === 'board') {
      result = result.filter(c => c.lead_status === 'open' || !c.lead_status);
    } else if (viewMode === 'won') {
      result = result.filter(c => c.lead_status === 'won');
    } else if (viewMode === 'lost') {
      result = result.filter(c => c.lead_status === 'lost');
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) =>
        (c.contact_name || "").toLowerCase().includes(q) ||
        (c.phone_number || "").includes(q) ||
        (c.cct || "").toLowerCase().includes(q) ||
        (c.school_name || "").toLowerCase().includes(q)
      );
    }

    // Quick filter
    if (activeFilter === "mine") {
      result = result.filter((c) => c.assigned_to === "yo"); // For sandbox, 'yo' is the current user
    } else if (activeFilter === "paused") {
      result = result.filter((c) => c.bot_paused);
    } else if (activeFilter === "new") {
      result = result.filter((c) => c._hasNewMessage);
    } else if (activeFilter === "rotting") {
      const ROTTING_MS = 24 * 60 * 60 * 1000; // 24 hours
      result = result.filter((c) => {
        if (!c.last_message_at) return false;
        return (Date.now() - new Date(c.last_message_at).getTime()) > ROTTING_MS;
      });
    }

    return result;
  }, [contacts, searchQuery, activeFilter]);

  // ─── Quick filter counts ──────────────────────────────────
  const filterCounts = useMemo(() => {
    const ROTTING_MS = 24 * 60 * 60 * 1000;
    return {
      all: contacts.length,
      mine: contacts.filter(c => c.assigned_to === "yo").length,
      paused: contacts.filter(c => c.bot_paused).length,
      new: contacts.filter(c => c._hasNewMessage).length,
      rotting: contacts.filter(c => c.last_message_at && (Date.now() - new Date(c.last_message_at).getTime()) > ROTTING_MS).length,
      attention: contacts.filter(c => {
          // Rule 1: Bot paused — human must respond
          if (c.bot_paused) return true;
          // Rule 2: Brand new / exploring lead
          if (c.pipeline_stage === '1_nuevo' || c.pipeline_stage === '1_explorando') return true;
          // Rule 3: Has recent activity (message in last 24h)
          if (c.last_message_at) {
              const hoursSinceMsg = (Date.now() - new Date(c.last_message_at).getTime()) / (1000 * 60 * 60);
              if (hoursSinceMsg <= 24) return true;
          }
          return false;
      }).length,
    };
  }, [contacts]);

  // ─── Metrics / KPIs (Module 3) ────────────────────────────
  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const wonCount = contacts.filter(c => c.lead_status === 'won').length;
    const lostCount = contacts.filter(c => c.lead_status === 'lost').length;
    const closedCount = wonCount + lostCount;
    const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

    const newToday = contacts.filter(c => {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      return d >= today;
    }).length;

    return { wonCount, lostCount, winRate, newToday };
  }, [contacts]);

  // ─── Handlers ─────────────────────────────────────────────
  const handleMoveContact = useCallback(async (contactId, newStage) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, pipeline_stage: newStage } : c))
    );

    try {
      const res = await fetch("/api/crm-contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contactId, pipeline_stage: newStage }),
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch (err) {
      console.error("[CRM] Move error:", err);
      fetchData();
    }
  }, [fetchData]);

  const handleToggleBotPause = useCallback(async (contactId, paused) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, bot_paused: paused } : c))
    );

    try {
      await fetch("/api/crm-contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contactId, bot_paused: paused }),
      });
    } catch (err) {
      console.error("[CRM] Toggle bot pause error:", err);
      fetchData();
    }
  }, [fetchData]);

  const handleChangeStatus = useCallback(async (contactId, newStatus) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, lead_status: newStatus } : c))
    );

    try {
      await fetch("/api/crm-contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contactId, lead_status: newStatus }),
      });
      if (newStatus !== 'open') {
         setSelectedContact(null); // Close panel if archived
      }
    } catch (err) {
      console.error("[CRM] Change status error:", err);
      fetchData();
    }
  }, [fetchData]);

  const handleSaveNotes = useCallback(async (contactId, notes) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, notes } : c))
    );
    setSelectedContact((prev) => 
      prev?.id === contactId ? { ...prev, notes } : prev
    );

    try {
      await fetch("/api/crm-contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contactId, notes }),
      });
    } catch (err) {
      console.error("[CRM] Save notes error:", err);
      fetchData();
    }
  }, [fetchData]);

  const handleSaveReminder = useCallback(async (contactId, reminder_at, reminder_note) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, reminder_at, reminder_note } : c))
    );
    setSelectedContact((prev) => 
      prev?.id === contactId ? { ...prev, reminder_at, reminder_note } : prev
    );

    try {
      await fetch("/api/crm-contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contactId, reminder_at, reminder_note }),
      });
    } catch (err) {
      console.error("[CRM] Save reminder error:", err);
      fetchData();
    }
  }, [fetchData]);

  const handleAssignToMe = useCallback(async (contactId) => {
    // Sandbox default username
    const username = "yo";
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, assigned_to: c.assigned_to === username ? null : username } : c))
    );
    setSelectedContact((prev) => 
      prev?.id === contactId ? { ...prev, assigned_to: prev.assigned_to === username ? null : username } : prev
    );

    try {
      await fetch("/api/crm-contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Toggle assignment
        body: JSON.stringify({ id: contactId, assigned_to: selectedContact?.assigned_to === username ? null : username }),
      });
    } catch (err) {
      console.error("[CRM] Assignment error:", err);
      fetchData();
    }
  }, [fetchData, selectedContact]);

  const handleSelectContact = useCallback((contact) => {
    setSelectedContact(contact);
    setContacts((prev) =>
      prev.map((c) => (c.id === contact.id ? { ...c, _hasNewMessage: false } : c))
    );
  }, []);

  // ─── Layout ───────────────────────────────────────────────
  const FILTERS = [
    { id: "all", label: "Vista General", icon: <LayoutDashboard size={20} strokeWidth={2.5} />, activeColor: "bg-blue-500 text-white shadow-lg shadow-blue-500/40", activeBg: "bg-white text-blue-700" },
    { id: "paused", label: "Bots Pausados", icon: <PauseCircle size={20} strokeWidth={2.5} />, activeColor: "bg-amber-500 text-white shadow-lg shadow-amber-500/40", activeBg: "bg-white text-amber-700" },
    { id: "rotting", label: "Leads en Riesgo", icon: <Flame size={20} strokeWidth={2.5} />, activeColor: "bg-rose-500 text-white shadow-lg shadow-rose-500/40", activeBg: "bg-white text-rose-700" },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes hypnotic-enter {
          0% { opacity: 0; transform: translateY(15px) scale(0.98); filter: blur(5px); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        .animate-hypnotic {
          animation: hypnotic-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .stagger-1 { animation-delay: 0.1s; }
        .stagger-2 { animation-delay: 0.2s; }
        .stagger-3 { animation-delay: 0.3s; }
      `}} />
      <div className="w-full h-full flex flex-col overflow-hidden animate-hypnotic z-10 px-4 md:px-6 lg:px-8 pt-6">
        {/* ─── BARRA DE CONTROL PRINCIPAL NEUMÓRFICA ─── */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between pb-6 gap-6 shrink-0 relative z-20 w-full animate-hypnotic stagger-1">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-[1.25rem] flex items-center justify-center bg-blue-600 shadow-lg shadow-blue-500/30 text-white shrink-0">
            <Mail size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
              Leads
              <span className="px-2.5 py-0.5 rounded-md text-[10px] uppercase tracking-widest font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                En Línea
              </span>
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
              Buzón inteligente de recepción y asignación
            </p>
          </div>
        </div>

        {/* MÓDULO DE CONSOLAS KPI NEUMÓRFICAS */}
        <div className="flex items-center gap-4 lg:gap-6 self-start xl:self-center">
          <div className="neu-card flex flex-col items-center justify-center px-6 py-3 rounded-[1.25rem] min-w-[110px]">
             <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Conversión</span>
             <span className="text-xl font-black text-emerald-500">{kpis.winRate}%</span>
          </div>
          <div className="neu-card flex flex-col items-center justify-center px-6 py-3 rounded-[1.25rem] min-w-[110px]">
             <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Nuevos Hoy</span>
             <span className="text-xl font-black text-blue-500">+{kpis.newToday}</span>
          </div>
          <div className="neu-card flex flex-col items-center justify-center px-6 py-3 rounded-[1.25rem] min-w-[110px]">
             <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Requiere Atención</span>
             <span className="text-xl font-black text-rose-500 animate-pulse">{filterCounts.attention}</span>
          </div>
          <button 
            onClick={() => setShowPricingModal(true)}
            className="flex items-center gap-2 h-[68px] px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-[1.25rem] font-black shadow-lg shadow-emerald-500/30 transition-all active:scale-95"
          >
             <DollarSign size={24} strokeWidth={3} />
             <div className="flex flex-col items-start translate-y-0.5">
               <span className="text-[10px] uppercase tracking-widest text-emerald-100 mb-0.5">Gestión de</span>
               <span className="text-sm leading-none">PRECIOS</span>
             </div>
          </button>
        </div>
      </div>

      {/* ─── BARRA DE ACCIÓN Y BUSCADOR (INSET) ─── */}
      <div className="pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 relative z-20 animate-hypnotic stagger-2">
        
        {/* TABS Neumórficas Elevadas */}
        <div className="flex items-center gap-3 p-1.5 rounded-2xl neu-input-inset overflow-x-auto">
          <button 
            onClick={() => setViewMode('inbox')}
            className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${viewMode === 'inbox' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/40' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <MessageSquare size={16} />
            Bandeja WhatsApp
          </button>
          <button 
            onClick={() => setViewMode('board')}
            className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${viewMode === 'board' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/40' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Tablero Kanban
            <span className={`px-2 py-0.5 rounded-full text-xs font-black ${viewMode === 'board' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>{contacts.filter(c => c.lead_status === 'open' || !c.lead_status).length}</span>
          </button>
        </div>

        {/* Buscador & Filtros Hundidos */}
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={16} strokeWidth={2.5} />
            </span>
            <input
              type="text"
              placeholder="Buscar contacto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-11 pr-4 text-sm font-medium neu-input-inset"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold w-6 h-6 rounded-full flex items-center justify-center neu-list-item">
                <XCircle size={14} />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {FILTERS.map((f) => {
              const isActive = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(isActive ? "all" : f.id)}
                  className={`group relative h-11 w-12 md:w-auto md:px-5 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${
                    isActive
                      ? `${f.activeColor} scale-105 z-10`
                      : "neu-input-inset text-slate-400 hover:text-slate-600 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:scale-[1.02]"
                  }`}
                >
                  <span className={isActive ? "" : "opacity-80 group-hover:text-blue-500 group-hover:opacity-100 transition-colors"}>{f.icon}</span>
                  
                  {/* Tooltip Flotante Instantáneo */}
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 px-3 py-2 bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest rounded-xl opacity-0 invisible group-hover:visible group-hover:opacity-100 transition-all duration-200 shadow-xl whitespace-nowrap pointer-events-none z-50 flex items-center justify-center">
                    {f.label}
                    <div className="absolute -bottom-1.5 w-3 h-3 bg-slate-800 rotate-45 rounded-sm" />
                  </div>

                  {filterCounts[f.id] > 0 && f.id !== "all" && (
                    <span className={`absolute -top-2 -right-2 md:static w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black border-2 border-[#f0f4f8] dark:border-[#0f172a] ${
                      isActive ? f.activeBg : "bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                    }`}>
                      {filterCounts[f.id]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

    {/* ─── ESPACIO DE TRABAJO (Inbox / Kanban) ─── */}
      <div className="flex-1 overflow-hidden relative pb-6 animate-hypnotic stagger-3">
        {viewMode === "inbox" ? (
          <div className="w-full h-full rounded-[2.5rem] flex flex-col overflow-hidden">
             {loading ? (
                <div className="flex items-center justify-center h-full flex-col gap-4">
                  <div className="w-12 h-12 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin shadow-lg" />
                  <p className="font-bold neu-text-sub uppercase tracking-widest text-xs">Cargando Inbox...</p>
                </div>
             ) : (
                <InboxView 
                  contacts={filteredContacts}
                  stages={stages}
                  selectedContactId={selectedContact?.id}
                  onSelectContact={handleSelectContact}
                  onToggleBotPause={handleToggleBotPause}
                  onChangeStatus={handleChangeStatus}
                  onMoveContact={handleMoveContact}
                  onSaveNotes={handleSaveNotes}
                  onSaveReminder={handleSaveReminder}
                />
             )}
          </div>
        ) : (
          <div className="w-full h-full rounded-[2.5rem] p-4 md:p-6 flex flex-col neu-input-inset overflow-x-auto overflow-y-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full flex-col gap-4">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin shadow-lg" />
                <p className="font-bold neu-text-sub uppercase tracking-widest text-xs">Cargando Kanban...</p>
              </div>
            ) : (
              <KanbanBoard
                contacts={filteredContacts}
                stages={stages}
                onMoveContact={handleMoveContact}
                onSelectContact={(c) => {
                   handleSelectContact(c);
                   setViewMode('inbox'); // Jump into inbox mode when clicking a card
                }}
                selectedContactId={selectedContact?.id}
              />
            )}
          </div>
        )}
      </div>
      {portalTarget && showPricingModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md px-4 pointer-events-auto">
          <div className="neu-card rounded-[2rem] w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-premium-in shadow-2xl">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center">
                  <DollarSign size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 dark:text-white">Configuración de Precios</h2>
                  <p className="text-xs font-semibold text-slate-500">Variables dinámicas para el bot de WhatsApp</p>
                </div>
              </div>
              <button onClick={() => setShowPricingModal(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition-colors">
                <XCircle size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50">
              {pricingLoading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Publica */}
                  <div className="flex flex-col gap-4">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Escuelas Públicas
                    </h3>
                    <div className="neu-input-inset p-4 rounded-[1.5rem] flex flex-col gap-3 min-h-[200px]">
                      {pricingData.publica.map(p => (
                        <div key={p.id} className="neu-list-item rounded-xl p-3 flex items-center justify-between group">
                          <span className="font-black text-lg text-slate-700 dark:text-slate-200">${p.precio} MXN</span>
                          <button onClick={() => handleDeletePrice(p.id)} className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {pricingData.publica.length === 0 && (
                        <div className="flex-1 flex items-center justify-center text-sm font-semibold text-slate-400">Sin precios configurados</div>
                      )}
                    </div>
                  </div>
                  {/* Privada */}
                  <div className="flex flex-col gap-4">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                      Escuelas Privadas
                    </h3>
                    <div className="neu-input-inset p-4 rounded-[1.5rem] flex flex-col gap-3 min-h-[200px]">
                      {pricingData.privada.map(p => (
                        <div key={p.id} className="neu-list-item rounded-xl p-3 flex items-center justify-between group">
                          <span className="font-black text-lg text-slate-700 dark:text-slate-200">${p.precio} MXN</span>
                          <button onClick={() => handleDeletePrice(p.id)} className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                      {pricingData.privada.length === 0 && (
                        <div className="flex-1 flex items-center justify-center text-sm font-semibold text-slate-400">Sin precios configurados</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Agregar Nuevo */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center gap-4">
              <select
                value={newPrice.tipo}
                onChange={(e) => setNewPrice({ ...newPrice, tipo: e.target.value })}
                className="neu-input-inset h-12 px-4 rounded-xl font-bold text-slate-700 w-full sm:w-auto outline-none"
              >
                <option value="pública">E. Pública</option>
                <option value="privada">E. Privada</option>
              </select>
              <div className="flex-1 relative w-full">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                <input 
                  type="number"
                  placeholder="Monto de recuperación"
                  value={newPrice.monto}
                  onChange={(e) => setNewPrice({ ...newPrice, monto: e.target.value })}
                  className="neu-input-inset w-full h-12 pl-8 pr-4 rounded-xl font-bold outline-none"
                />
              </div>
              <button 
                onClick={handleAddPrice}
                disabled={!newPrice.monto || pricingLoading}
                className="h-12 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/30 flex items-center gap-2 w-full sm:w-auto justify-center transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={18} strokeWidth={3} />
                Agregar
              </button>
            </div>
          </div>
        </div>,
        portalTarget
      )}
      </div>
    </>
  );
}
