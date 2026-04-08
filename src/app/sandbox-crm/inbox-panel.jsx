"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

import { MessageCircle, FileText, Info, History, Sparkles, Pause, User, Check, Trash2, Send, Building, Bot } from "lucide-react";

const TABS = [
  { id: "chat", label: "Chat", icon: <MessageCircle size={16} strokeWidth={2.5} /> },
  { id: "notes", label: "Notas", icon: <FileText size={16} strokeWidth={2.5} /> },
  { id: "ficha", label: "Info", icon: <Info size={16} strokeWidth={2.5} /> },
  { id: "history", label: "Historial", icon: <History size={16} strokeWidth={2.5} /> },
];

export default function InboxPanel({ contact, onToggleBotPause, onChangeStatus, onAssignToMe, onClose }) {
  const [activeTab, setActiveTab] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  // ─── Notes state ──────────────────────────────────────────
  const [notes, setNotes] = useState("");
  const [notesOriginal, setNotesOriginal] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Reset tab when contact changes
  useEffect(() => {
    setActiveTab("chat");
  }, [contact?.id]);

  // Load notes from contact
  useEffect(() => {
    if (contact) {
      setNotes(contact.notes || "");
      setNotesOriginal(contact.notes || "");
      setNotesSaved(false);
    }
  }, [contact?.id, contact?.notes]);

  // Fetch messages when contact changes
  useEffect(() => {
    if (!contact) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);

    fetch(`/api/crm-messages?phone=${encodeURIComponent(contact.phone_number)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.data) {
          setMessages(json.data);
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });

    return () => { cancelled = true; };
  }, [contact?.phone_number]);

  // Realtime: listen for new messages for THIS contact
  useEffect(() => {
    if (!contact?.phone_number) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`inbox-${contact.phone_number}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `phone_number=eq.${contact.phone_number}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contact?.phone_number]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current && activeTab === "chat") {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  // Send human message
  const handleSend = useCallback(async () => {
    if (!messageText.trim() || !contact || sending) return;
    setSending(true);

    try {
      const res = await fetch("/api/crm-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: contact.phone_number,
          content: messageText.trim(),
          conversation_id: null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error enviando mensaje");
      }

      setMessageText("");
    } catch (err) {
      console.error("[Inbox] Send error:", err);
    } finally {
      setSending(false);
    }
  }, [messageText, contact, sending]);

  // Save notes
  const handleSaveNotes = useCallback(async () => {
    if (!contact || savingNotes) return;
    setSavingNotes(true);
    try {
      await fetch("/api/crm-contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contact.id, notes }),
      });
      setNotesOriginal(notes);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (err) {
      console.error("[Inbox] Notes save error:", err);
    } finally {
      setSavingNotes(false);
    }
  }, [contact, notes, savingNotes]);

  const notesChanged = notes !== notesOriginal;

  // ─── Timeline Generation ─────────────────────────────────
  const getTimeline = useCallback(() => {
    if (!contact) return [];
    const events = [];

    // 1. Created At
    if (contact.created_at) {
      events.push({
        id: "created",
        date: new Date(contact.created_at),
        icon: <Sparkles size={12} strokeWidth={2.5} />,
        title: "Prospecto registrado",
        desc: "Ingresó al sistema vía WhatsApp",
        color: "bg-blue-500",
      });
    }

    // 2. First Message
    if (messages.length > 0 && messages[0].created_at) {
      events.push({
        id: "first_msg",
        date: new Date(messages[0].created_at),
        icon: <MessageCircle size={12} strokeWidth={2.5} />,
        title: "Inició conversación",
        desc: "Primer mensaje detectado",
        color: "bg-slate-500",
      });
    }

    // 3. Paused / Human Escapement (Estimate based on current flag)
    if (contact.bot_paused && messages.length > 0) {
      // Just put it near the last message for now
      const lastMsgDate = new Date(messages[messages.length - 1].created_at);
      events.push({
        id: "paused",
        date: new Date(lastMsgDate.getTime() + 1000), // slightly after last msg
        icon: <Pause size={12} strokeWidth={2.5} />,
        title: "Bot Pausado",
        desc: "Requiere atención humana",
        color: "bg-amber-500",
      });
    }

    // 4. Assigned To
    if (contact.assigned_to) {
      events.push({
        id: "assigned",
        date: new Date(Date.now() - 60000), // Fake past event since we don't track assign time yet
        icon: <User size={12} strokeWidth={2.5} />,
        title: `Asignado a ${contact.assigned_to}`,
        desc: "El asesor tomó propiedad",
        color: "bg-indigo-500",
      });
    }

    // 5. Deal Closed
    if (contact.lead_status === 'won') {
      events.push({
        id: "won",
        date: new Date(Date.now() - 30000), // Simulated near present
        icon: <Check size={12} strokeWidth={2.5} />,
        title: "Marcado como Agendado",
        desc: "Venta cerrada exitosamente",
        color: "bg-green-500",
      });
    } else if (contact.lead_status === 'lost') {
      events.push({
        id: "lost",
        date: new Date(Date.now() - 30000),
        icon: <Trash2 size={12} strokeWidth={2.5} />,
        title: "Descartado",
        desc: "El lead fue desechado",
        color: "bg-red-500",
      });
    }

    // Sort by date ascending
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    return events;
  }, [contact, messages]);

  const timelineEvents = getTimeline();

  // ─── Empty state ──────────────────────────────────────────
  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <span className="text-slate-300 dark:text-slate-700 mb-4"><MessageCircle size={48} strokeWidth={1} /></span>
        <h3 className="text-sm font-bold text-foreground mb-1">
          Selecciona un Contacto
        </h3>
        <p className="text-xs text-muted-foreground">
          Haz clic en una tarjeta del Kanban para ver su historial de chat y enviar mensajes.
        </p>
      </div>
    );
  }

  // ─── Main Panel ────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0f172a] rounded-3xl overflow-hidden shadow-[inset_4px_4px_8px_rgba(0,0,0,0.05),inset_-4px_-4px_8px_rgba(255,255,255,0.7)] dark:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.8),inset_-4px_-4px_8px_rgba(255,255,255,0.02)]">
      {/* Contact header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground truncate">
            {contact.contact_name || contact.phone_number}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono">
            {contact.phone_number}
            {contact.cct && ` · ${contact.cct}`}
          </p>
        </div>

        {/* Bot Pause Toggle */}
        <div className="flex gap-2 flex-col items-stretch">
          <button
            onClick={() => onToggleBotPause(contact.id, !contact.bot_paused)}
            className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-all border flex items-center justify-center gap-1.5 ${
              contact.bot_paused
                ? "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-400"
                : "bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-400"
            }`}
            title={contact.bot_paused ? "Reactivar Bot" : "Pausar Bot (modo humano)"}
          >
            {contact.bot_paused ? <><Pause size={12} strokeWidth={2.5} /> Bot Pausado</> : <><Bot size={12} strokeWidth={2.5} /> Bot Activo</>}
          </button>
          
          <button
            onClick={() => onAssignToMe(contact.id)}
            className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-all border flex items-center justify-center gap-1.5 ${
              contact.assigned_to === 'yo'
                ? "bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200"
                : "bg-muted border-border text-muted-foreground hover:bg-black hover:text-white"
            }`}
          >
            {contact.assigned_to === 'yo' ? <><User size={12} strokeWidth={2.5} /> Mío</> : "✋ Tomar"}
          </button>
        </div>

        {/* Deal Status Buttons */}
        {contact.lead_status === 'open' ? (
          <div className="flex gap-1">
            <button
              onClick={() => onChangeStatus(contact.id, 'won')}
              className="text-[10px] flex items-center gap-1 font-bold px-3 py-1.5 rounded-full transition-all border bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              title="Marcar como Agendado (Ganado)"
            >
              <Check size={12} strokeWidth={2.5} /> Cerrar
            </button>
            <button
              onClick={() => onChangeStatus(contact.id, 'lost')}
              className="text-[10px] flex items-center gap-1 font-bold px-3 py-1.5 rounded-full transition-all border bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
              title="Descartar (Perdido/Spam)"
            >
              <Trash2 size={12} strokeWidth={2.5} /> Descartar
            </button>
          </div>
        ) : (
          <button
            onClick={() => onChangeStatus(contact.id, 'open')}
            className={`text-[10px] flex items-center gap-1 font-bold px-3 py-1.5 rounded-full transition-all border ${
              contact.lead_status === 'won' 
                ? 'bg-green-100 border-green-300 text-green-800' 
                : 'bg-red-100 border-red-300 text-red-800'
            }`}
          >
            {contact.lead_status === 'won' ? <><Check size={12} strokeWidth={2.5} /> Reabrir</> : <><Trash2 size={12} strokeWidth={2.5} /> Reabrir</>}
          </button>
        )}

        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
          title="Cerrar"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 px-4 py-3 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-[11px] font-black uppercase tracking-widest transition-all rounded-xl ${
              activeTab === tab.id
                ? "neu-input-inset text-orange-500 opacity-100"
                : "neu-card text-slate-500 hover:text-slate-700 opacity-60 hover:opacity-100"
            }`}
          >
            <span className="text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ━━━ Tab: Chat ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === "chat" && (
        <>
          {/* Messages area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          >
            {loadingMessages ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-8 italic">
                Sin historial de mensajes.
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
          </div>

          {/* Input area */}
          <div className="px-4 pb-4 pt-2 shrink-0">
            {!contact.bot_paused && (
              <div className="text-[10px] uppercase font-bold tracking-widest text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1 opacity-70">
                ⚠️ Pausa el bot antes de escribir
              </div>
            )}
            <div className={`p-1.5 flex gap-2 rounded-2xl transition-all ${contact.bot_paused ? 'neu-input-inset shadow-inner focus-within:ring-2 focus-within:ring-orange-500/50 bg-white/50 dark:bg-slate-900/50' : 'opacity-50 grayscale neu-card'}`}>
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  contact.bot_paused
                    ? "Escribe un mensaje..."
                    : "Bot operando..."
                }
                disabled={!contact.bot_paused || sending}
                className="flex-1 h-10 px-3 text-sm bg-transparent !outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400 font-medium disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={!contact.bot_paused || !messageText.trim() || sending}
                className="w-10 h-10 flex items-center justify-center neu-list-item text-orange-500 disabled:opacity-40 disabled:cursor-not-allowed hover:text-orange-600 active:scale-95 transition-all"
              >
                {sending ? "..." : <Send size={16} strokeWidth={2.5} className="ml-1" />}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ━━━ Tab: Notas ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === "notes" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <p className="text-[11px] text-muted-foreground">
              Notas internas visibles solo para el equipo. El contacto nunca las verá.
            </p>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Habló con el director, quiere que vayamos el lunes. No cobrar cuota..."
            className="flex-1 mx-4 mb-3 p-3 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between px-4 pb-4">
            <span className="text-[10px] text-muted-foreground">
              {notesSaved && "✅ Guardado"}
              {notesChanged && !notesSaved && "● Sin guardar"}
            </span>
            <button
              onClick={handleSaveNotes}
              disabled={!notesChanged || savingNotes}
              className="text-[11px] font-bold px-4 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all active:scale-95"
            >
              {savingNotes ? "Guardando..." : "💾 Guardar Notas"}
            </button>
          </div>
        </div>
      )}

      {/* ━━━ Tab: Ficha Técnica ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === "ficha" && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            {/* Contact Details */}
            <section>
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Datos del Contacto
              </h4>
              <div className="space-y-2">
                <FichaRow label="Nombre" value={contact.contact_name} />
                <FichaRow label="Teléfono" value={contact.phone_number} mono />
                <FichaRow label="Pipeline" value={contact.pipeline_stage} tag />
                <FichaRow label="Bot" value={contact.bot_paused ? "Pausado" : "Activo"} icon={contact.bot_paused ? <Pause size={12}/> : <Bot size={12}/>} />
                <FichaRow label="Último Mensaje" value={
                  contact.last_message_at 
                    ? new Date(contact.last_message_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
                    : "—"
                } />
                <FichaRow label="Creado" value={
                  contact.created_at 
                    ? new Date(contact.created_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
                    : "—"
                } />
              </div>
            </section>

            {/* School Details */}
            {(contact.cct || contact.school_name) && (
              <section>
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Datos de la Escuela
                </h4>
                <div className="space-y-2">
                  <FichaRow label="CCT" value={contact.cct} mono />
                  <FichaRow label="Nombre" value={contact.school_name} />
                  <FichaRow label="Turno" value={contact.school_turno} />
                </div>
              </section>
            )}

            {/* Empty state for school */}
            {!contact.cct && !contact.school_name && (
              <section className="text-center py-6">
                <span className="mb-2 flex justify-center text-slate-300 dark:text-slate-700">
                  <Building size={32} strokeWidth={1.5}/>
                </span>
                <p className="text-xs text-muted-foreground italic">
                  Escuela aún no identificada. El bot la enlazará automáticamente cuando el contacto proporcione su CCT.
                </p>
              </section>
            )}
          </div>
        </div>
      )}

      {/* ━━━ Tab: Historial (Timeline) ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === "history" && (
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50/50 dark:bg-black/20">
          <div className="relative border-l-2 border-muted pl-6 space-y-8">
            {timelineEvents.map((evt, idx) => (
              <div key={evt.id} className="relative">
                {/* Dot */}
                <div className={`absolute -left-[35px] top-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-sm text-white ${evt.color}`}>
                  {evt.icon}
                </div>
                {/* Content */}
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <h4 className="text-sm font-bold text-foreground">{evt.title}</h4>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {evt.date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{evt.desc}</p>
                </div>
              </div>
            ))}

            {/* Pulsing indicator if open */}
            {contact.lead_status === 'open' && (
              <div className="relative pt-2">
                <div className="absolute -left-[31px] top-4 w-4 h-4 rounded-full bg-primary/20 animate-ping"></div>
                <div className="absolute -left-[29px] top-5 w-2 h-2 rounded-full bg-primary"></div>
                <p className="text-xs text-muted-foreground italic opacity-70">Esperando el próximo evento...</p>
              </div>
            )}
            
            {/* End indicator if closed */}
            {contact.lead_status !== 'open' && (
              <div className="relative pt-2">
                <div className="absolute -left-[29px] top-5 w-2 h-2 rounded-full bg-muted-foreground"></div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-50">FIN DEL CICLO</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ficha Row Component ───────────────────────────────────
function FichaRow({ label, value, mono = false, tag = false, icon }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      {tag ? (
        <span className="text-[10px] font-semibold bg-muted text-foreground px-2 py-0.5 rounded-full">
          {value}
        </span>
      ) : (
        <span className={`text-[12px] text-foreground text-right flex items-center justify-end gap-1 ${mono ? "font-mono" : ""}`}>
          {icon} {value}
        </span>
      )}
    </div>
  );
}

// ─── Message Bubble Component ───────────────────────────────
function MessageBubble({ message }) {
  const isInbound = message.direction === "inbound";
  const isBot = message.sender_type === "bot";
  const isHuman = message.sender_type === "human";

  const time = new Date(message.created_at).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let bubbleClass = "";
  let label = "";

  if (isInbound) {
    bubbleClass = "neu-card bg-white dark:bg-slate-800 self-start";
  } else if (isBot) {
    bubbleClass = "neu-input-inset bg-slate-100/50 dark:bg-slate-900/50 text-blue-900 dark:text-blue-100 self-end border border-white/40 dark:border-white/5";
    label = "BOT";
  } else if (isHuman) {
    bubbleClass = "neu-list-item text-orange-900 dark:text-orange-100 self-end ring-1 ring-orange-500/30";
    label = "HUMANO";
  } else {
    bubbleClass = "neu-list-item self-end";
  }

  return (
    <div className={`flex flex-col max-w-[85%] ${isInbound ? "" : "ml-auto"}`}>
      {label && (
        <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${
          isBot ? "text-blue-500 opacity-60" : "text-orange-500 opacity-80"
        } ${isInbound ? "" : "text-right"}`}>
          {label}
        </span>
      )}
      <div className={`rounded-3xl px-4 py-3 text-[13px] font-medium leading-relaxed shadow-sm ${bubbleClass}`}>
        {message.content}
      </div>
      <span className={`text-[9px] font-bold uppercase tracking-widest opacity-40 mt-1.5 ${isInbound ? "ml-2" : "text-right mr-2"}`}>
        {time}
      </span>
    </div>
  );
}
