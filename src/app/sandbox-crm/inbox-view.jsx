"use client";

import { useState, useMemo } from "react";
import InboxPanel from "./inbox-panel";
import { Search, Flame, Building, Bot, MessageSquare, Clock, StickyNote, Bell, Zap, User } from "lucide-react";

function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function truncate(text, max = 50) {
  if (!text) return "";
  const clean = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '');
  return clean.length > max ? clean.substring(0, max) + '…' : clean;
}

export default function InboxView({ contacts, stages = [], selectedContactId, onSelectContact, onToggleBotPause, onChangeStatus, onMoveContact, onSaveNotes, onSaveReminder }) {
  const [search, setSearch] = useState("");

  const uniqueStages = useMemo(() => {
    return Array.from(new Set(contacts.map(c => c.pipeline_stage))).filter(Boolean);
  }, [contacts]);

  // Premium stage colors
  const stageStyles = {
    '1_nuevo': 'bg-blue-600 text-white border-blue-700',
    '2_calificando': 'bg-purple-600 text-white border-purple-700',
    '3_configurando_visita': 'bg-amber-500 text-white border-amber-600',
    '4_agendado': 'bg-emerald-600 text-white border-emerald-700',
    '5_no_interesado': 'bg-slate-600 text-white border-slate-700',
  };
  const defaultStageStyle = 'bg-indigo-600 text-white border-indigo-700';

  const filtered = useMemo(() => {
    let list = contacts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => 
        (c.contact_name || "").toLowerCase().includes(q) ||
        (c.phone_number || "").includes(q) ||
        (c.school_name || "").toLowerCase().includes(q)
      );
    }
    // Sort latest message first
    return list.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
  }, [contacts, search]);

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  return (
    <div className="flex w-full h-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      
      {/* ─── COLUMNA IZQUIERDA: LISTA DE CHATS (30%) ─── */}
      <div className="w-[320px] shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={16} />
            </span>
            <input 
              type="text" 
              placeholder="Buscar chat o escuela..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto neumorphic-scrollbar">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No hay chats activos.</div>
          ) : (
            filtered.map((c) => {
              const isSelected = selectedContactId === c.id;
              const hasNew = c._hasNewMessage;
              const isRotting = (Date.now() - new Date(c.last_message_at).getTime()) > 24 * 60 * 60 * 1000 && c.pipeline_stage !== '4_agendado';

              return (
                <div 
                  key={c.id} 
                  onClick={() => onSelectContact(c)}
                  className={`mx-3 my-2 p-3.5 rounded-2xl border cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                    isSelected 
                      ? 'bg-white dark:bg-slate-800/90 border-[#60a5fa]/40 shadow-[0_4px_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20' 
                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/60 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700/80'
                  }`}
                >
                  {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-500"></div>}
                  
                  <div className="flex justify-between items-start mb-1.5">
                    <h3 className="font-bold text-[14px] text-slate-800 dark:text-slate-200 truncate pr-2">
                      {c.contact_name || c.phone_number}
                    </h3>
                    <span className={`text-[10px] whitespace-nowrap font-bold uppercase tracking-widest ${hasNew ? 'text-blue-500' : isRotting ? 'text-rose-500' : 'text-slate-400'}`}>
                      {timeAgo(c.last_message_at)}
                    </span>
                  </div>
                  
                  {c.school_name && (
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#2563eb] mb-1.5 truncate">
                      <Building size={10} /> {c.school_name}
                    </div>
                  )}

                  {/* Etapa del Embudo Badge */}
                  {c.pipeline_stage && stages && (
                    <div className="mb-2.5">
                       <span className={`flex w-fit items-center gap-1.5 text-[9px] font-black uppercase tracking-widest border shadow-sm px-2 py-0.5 rounded-lg truncate max-w-full ${stageStyles[c.pipeline_stage] || defaultStageStyle}`}>
                        <Zap size={10} className="shrink-0 opacity-80" />
                        {stages.find(s => s.id === c.pipeline_stage)?.title || c.pipeline_stage.replace(/^\d+_?/, '').replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}

                  <div className="text-[12px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                    {c.last_user_message && c.last_bot_message ? (
                      new Date(c.last_user_message_at) > new Date(c.last_bot_message_at) ? (
                         <span className="truncate">{truncate(c.last_user_message, 40)}</span>
                      ) : (
                         <span className="truncate flex items-center gap-1"><Bot size={12}/> {truncate(c.last_bot_message, 40)}</span>
                      )
                    ) : (
                      <span className="truncate">{truncate(c.last_user_message || c.last_bot_message, 40)}</span>
                    )}
                  </div>

                  {/* Micro-Chips for Notes & Reminders */}
                  {(c.notes || c.reminder_at) && (
                     <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {c.notes && (
                           <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-sm shadow-sm transition-all hover:bg-slate-200">
                              <StickyNote size={10} className="text-slate-500" /> Nota
                           </span>
                        )}
                        {c.reminder_at && (
                           <span className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm shadow-sm border transition-all ${
                             new Date(c.reminder_at) <= new Date() 
                               ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/30 dark:border-rose-800 dark:text-rose-400 animate-pulse' 
                               : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400'
                           }`}>
                              <Bell size={10} className={new Date(c.reminder_at) <= new Date() ? "" : ""} /> Recordatorio
                           </span>
                        )}
                     </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── COLUMNA CENTRAL Y DERECHA (CHAT Y CONTEXTO) ─── */}
      <div className="flex-1 flex bg-[#efeae2] dark:bg-[#0b141a] relative" style={{ backgroundImage: "radial-gradient(#d1c5b4 1px, transparent 1px)", backgroundSize: '20px 20px' }}>
        {selectedContact ? (
          <div className="flex-1 w-full h-full animate-in fade-in zoom-in-95 duration-300">
             {/* Reutilizamos transitoriamente el InboxPanel pero a pantalla completa sin modal */}
             <InboxPanel 
                contact={selectedContact}
                stages={stages}
                onToggleBotPause={onToggleBotPause}
                onChangeStatus={onChangeStatus}
                onMoveContact={onMoveContact}
                onSaveNotes={onSaveNotes}
                onSaveReminder={onSaveReminder}
                onClose={() => onSelectContact(null)} // Not used visibly in 3-column but passed for safety
             />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 opacity-60">
             <MessageSquare size={48} strokeWidth={1} className="mb-4" />
             <p className="text-sm font-bold uppercase tracking-widest">Selecciona un chat para comenzar</p>
          </div>
        )}
      </div>

    </div>
  );
}
