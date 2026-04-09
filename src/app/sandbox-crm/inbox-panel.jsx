"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Bot, User, CheckCheck, Send, CheckCircle2, AlertTriangle, Building, Briefcase, Zap, Pause, LockOpen, Bell, AlarmClock } from "lucide-react";

export default function InboxPanel({ contact, stages = [], onToggleBotPause, onChangeStatus, onMoveContact, onSaveNotes, onSaveReminder }) {
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [notesText, setNotesText] = useState(contact?.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [reminderAt, setReminderAt] = useState(contact?.reminder_at ? contact.reminder_at.substring(0, 16) : "");
  const [reminderNote, setReminderNote] = useState(contact?.reminder_note || "");
  const [savingReminder, setSavingReminder] = useState(false);
  const scrollRef = useRef(null);

  // Sync state if contact changes
  useEffect(() => {
    setMessageText("");
    setNotesText(contact?.notes || "");
    setReminderAt(contact?.reminder_at ? contact.reminder_at.substring(0, 16) : "");
    setReminderNote(contact?.reminder_note || "");
  }, [contact]);

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
          setMessages(json.data.sort((a,b) => new Date(a.created_at) - new Date(b.created_at)));
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  if (!contact) return null;

  return (
    <div className="flex w-full h-full relative">
      {/* ─── CENTRAL CHAT COLUMN (65%) ─── */}
      <div className="w-[65%] h-full flex flex-col border-r border-slate-200/50 dark:border-slate-800/50 relative overflow-hidden backdrop-blur-sm bg-white/40 dark:bg-black/40">
        
        {/* Chat Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-white/20 dark:border-white/5 z-10 shadow-sm">
           <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                {contact.contact_name || contact.phone_number}
                {contact.lead_status === 'won' && <CheckCircle2 size={16} className="text-emerald-500" />}
                {contact.lead_status === 'lost' && <AlertTriangle size={16} className="text-rose-500" />}
              </h2>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {contact.phone_number} {contact.school_name ? `• ${contact.school_name}` : ''}
              </span>
           </div>

           {/* Bot Pilot Toggle */}
           <button 
             onClick={() => onToggleBotPause(contact.id, !contact.bot_paused)}
             className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 border ${
               contact.bot_paused 
                 ? "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200" 
                 : "bg-[#25D366]/10 border-[#25D366]/30 text-[#005c4b] dark:text-[#25D366] hover:bg-[#25D366]/20"
             }`}
           >
             {contact.bot_paused ? (
               <><LockOpen size={14}/> Humano al Mando</>
             ) : (
               <><Bot size={14}/> Bot Activo</>
             )}
           </button>
        </div>

        {/* Chat Body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          {loadingMessages ? (
            <div className="m-auto opacity-50 flex items-center gap-2 font-bold uppercase tracking-widest text-xs text-slate-500">
              <Zap size={14} className="animate-pulse" /> Sincronizando Chat...
            </div>
          ) : messages.length === 0 ? (
            <div className="m-auto opacity-50 flex flex-col items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-widest">Aún no hay mensajes</span>
            </div>
          ) : (
            messages.map((msg) => {
              const isInbound = msg.direction === "inbound";
              const isBot = msg.sender_type === "bot";

              const time = new Date(msg.created_at).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div key={msg.id} className={`max-w-[75%] rounded-2xl p-2.5 shadow-sm text-[13px] leading-snug border border-black/5 dark:border-white/5 relative group ${
                  isInbound 
                   ? "self-start bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-sm"
                   : "self-end bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-sm"
                }`}>
                  {!isInbound && (
                    <span className="block text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1 opacity-70">
                      {isBot ? <><Bot size={10} /> FlyHigh Bot</> : <><User size={10} /> Operador</>}
                    </span>
                  )}
                  {isInbound && contact.contact_name && (
                    <span className="block text-[9px] font-black tracking-widest mb-1 text-[#ea580c] dark:text-[#f97316]">
                      {contact.contact_name}
                    </span>
                  )}
                  
                  <span className="break-words whitespace-pre-wrap">{msg.content}</span>
                  
                  <div className={`text-[9px] mt-1 flex items-center gap-1 opacity-70 justify-end`}>
                    {time}
                    {!isInbound && <CheckCheck size={12} className="text-blue-500" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chat Footer (Composer) */}
        <div className="px-6 pb-6 pt-2 bg-gradient-to-t from-white/90 dark:from-slate-900/90 to-transparent">
          <div className={`p-1.5 flex gap-2 rounded-2xl transition-all shadow-sm ${
             contact.bot_paused 
              ? 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-offset-2 ring-blue-500'
              : 'bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 opacity-60 grayscale cursor-not-allowed'
          }`}>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={contact.bot_paused ? "Escribe un mensaje al lead..." : "Bot controlando la conversación. Pausa el bot para intervenir."}
              disabled={!contact.bot_paused || sending}
              className="flex-1 max-h-[120px] min-h-[40px] px-3 py-2 text-sm bg-transparent !outline-none resize-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400 font-medium"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!contact.bot_paused || !messageText.trim() || sending}
              className={`w-12 h-10 flex items-center justify-center rounded-xl transition-all ${
                contact.bot_paused && messageText.trim() 
                 ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md active:scale-95" 
                 : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              }`}
            >
              {sending ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"/> : <Send size={16} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>

      {/* ─── RIGHT CONTEXT COLUMN (35%) ─── */}
      <div className="w-[35%] h-full bg-white dark:bg-slate-900 border-l border-white/20 overflow-y-auto px-6 py-6 pb-24">
        
        {/* Core Info */}
        <div className="flex flex-col items-center mb-8">
           <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 border-4 border-slate-50 dark:border-slate-900 shadow-md">
             <User size={32} className="text-slate-400" />
           </div>
           <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 text-center leading-tight">
             {contact.contact_name || "Sin Titular"}
           </h3>
           <p className="text-sm font-bold text-slate-500 mt-1 font-mono tracking-wider">{contact.phone_number}</p>
        </div>

        {/* Pipeline Control */}
        <div className="mb-6 relative group">
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Zap size={12} className="text-amber-500" /> Etapa del Embudo</span>
           <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-0.5 border border-slate-200 dark:border-slate-800 relative z-10 transition-all group-hover:border-blue-500/50 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.1)]">
             <select 
               className="w-full bg-transparent p-2.5 text-[13px] font-bold outline-none cursor-pointer text-slate-700 dark:text-slate-200 capitalize"
               value={contact.pipeline_stage || ""}
               onChange={(e) => {
                 if(onMoveContact) onMoveContact(contact.id, e.target.value);
               }}
             >
               <option value="" disabled>Seleccionar etapa...</option>
               {[...stages].sort((a,b) => a.sort_order - b.sort_order).map(s => {
                 const cleanTitle = (s.title || s.id || "").replace(/^\d+_?/, '').replace(/_/g, ' ');
                 return (
                   <option key={s.id} value={s.id} className="capitalize">
                     {cleanTitle}
                   </option>
                 );
               })}
             </select>
           </div>
        </div>

        {/* Notas Internas (Operador) */}
        <div className="mb-8">
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Briefcase size={12} className="text-indigo-400" /> Notas Libres</span>
           <div className="relative">
             <textarea 
               value={notesText}
               onChange={(e) => setNotesText(e.target.value)}
               onBlur={() => {
                 if(contact.notes !== notesText && notesText.trim() !== "") {
                   setSavingNotes(true);
                   if(onSaveNotes) onSaveNotes(contact.id, notesText).finally(() => setSavingNotes(false));
                 }
               }}
               placeholder="Escribe recordatorios o contexto del lead..."
               className="w-full min-h-[90px] bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-[13px] text-slate-700 dark:text-slate-300 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-y"
             />
             {savingNotes && <div className="absolute bottom-3 right-3 w-3 h-3 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin" />}
           </div>
        </div>

        {/* Recordatorios (Operador) */}
        <div className="mb-8">
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><AlarmClock size={12} className="text-amber-500" /> Recordatorio</span>
           <div className="relative flex flex-col gap-2">
             <input 
               type="datetime-local" 
               className="w-full bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[12px] text-slate-700 dark:text-slate-200 outline-none transition-all focus:border-amber-500/50 focus:ring-4 focus:ring-amber-500/10 cursor-pointer"
               value={reminderAt}
               onChange={(e) => setReminderAt(e.target.value)}
             />
             <div className="relative">
               <textarea 
                 value={reminderNote}
                 onChange={(e) => setReminderNote(e.target.value)}
                 placeholder="¿Qué hay que recordar?"
                 className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-[13px] text-slate-700 dark:text-slate-300 outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-amber-400/50 focus:ring-4 focus:ring-amber-500/10 transition-all resize-none min-h-[60px]"
               />
             </div>
             
             <button
               disabled={savingReminder || (!reminderAt && !!reminderNote)}
               onClick={() => {
                 setSavingReminder(true);
                 if (onSaveReminder) {
                   onSaveReminder(contact.id, reminderAt || null, reminderNote || null).finally(() => setSavingReminder(false));
                 } else {
                   setSavingReminder(false);
                 }
               }}
               className="mt-1 w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-amber-50 text-amber-600 dark:bg-slate-800/30 dark:hover:bg-amber-900/30 dark:text-amber-500 p-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all border border-slate-200 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-800 disabled:opacity-50"
             >
               {savingReminder ? (
                 <>
                   <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                   <span>Guardando...</span>
                 </>
               ) : (
                 <>
                   <Bell size={12} />
                   <span>Fijar Alarma</span>
                 </>
               )}
             </button>
           </div>
        </div>

        {/* Details Card */}
        <div className="space-y-4 mb-8">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Insights Recuperados</span>
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
               <Building size={16} />
             </div>
             <div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Escuela</p>
               <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{contact.school_name || "Pendiente de captura"}</p>
             </div>
          </div>
          {contact.cct && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 flex items-center justify-center shrink-0">
                 <Briefcase size={16} />
               </div>
               <div>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Clave CCT</p>
                 <p className="text-sm font-bold font-mono tracking-wider text-slate-800 dark:text-slate-200">{contact.cct}</p>
               </div>
            </div>
          )}
        </div>

        {/* Win/Loss Record Actions */}
        <div className="space-y-2">
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Cierre Administrativo</span>
           <button 
             onClick={() => onChangeStatus(contact.id, 'won')}
             className="w-full py-3 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 font-bold text-sm transition-all hover:bg-emerald-100"
           >
             Marcar como Ganado
           </button>
           <button 
             onClick={() => onChangeStatus(contact.id, 'lost')}
             className="w-full py-3 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 font-bold text-sm transition-all hover:bg-rose-100"
           >
             Descartar Lead
           </button>
        </div>

      </div>
    </div>
  );
}
