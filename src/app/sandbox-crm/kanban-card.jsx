"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Flame, Building, Bot, User, ArrowRight } from "lucide-react";

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

function truncate(text, max = 55) {
  if (!text) return null;
  const clean = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '');
  return clean.length > max ? clean.substring(0, max) + '…' : clean;
}

// Returns hours since last message
function hoursSince(dateStr) {
  if (!dateStr) return Infinity;
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

export default function KanbanCard({ contact, onClick, isSelected, isDragging }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: contact.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragging = isDragging || isSortableDragging;

  // ─── Rotting logic ─────────────────────────────────────
  const hrs = hoursSince(contact.last_message_at);
  const isRotting = hrs > 24 && contact.pipeline_stage !== '4_agendado';
  const isWarning = hrs > 12 && hrs <= 24 && contact.pipeline_stage !== '4_agendado';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        group relative p-4 cursor-grab active:cursor-grabbing
        transition-all duration-300 select-none overflow-hidden
        ${dragging
          ? "opacity-90 shadow-2xl scale-[1.02] ring-2 ring-orange-500/40 rotate-1 bg-white dark:bg-slate-800"
          : isSelected
            ? "neu-list-item ring-2 ring-orange-500"
            : isRotting
              ? "neu-list-item ring-1 ring-rose-300 dark:ring-rose-800"
              : isWarning
                ? "neu-list-item ring-1 ring-amber-300 dark:ring-amber-800"
                : "neu-list-item"
        }
      `}
    >
      {/* Rotting pulse indicator */}
      {isRotting && !dragging && (
        <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center overflow-hidden">
             <div className="absolute top-[-10px] right-[-10px] w-12 h-12 bg-rose-500/20 rounded-full animate-ping"></div>
             <span className="relative z-10 translate-x-1 -translate-y-1 text-rose-500"><Flame size={12} strokeWidth={3} /></span>
        </div>
      )}

      {/* New message indicator */}
      {contact._hasNewMessage && (
        <span className="absolute top-3 right-3 w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse" />
      )}

      {/* School badge (if linked) */}
      {contact.school_name && (
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-blue-500 dark:text-blue-400 mb-3 truncate w-[90%]">
          <Building size={12} />
          <span className="truncate">{contact.school_name}</span>
        </div>
      )}

      {/* Contact name + time */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black neu-text truncate leading-none mb-1">
            {contact.contact_name || "Prospecto Sin Nombre"}
          </p>
          <p className="text-[11px] font-bold neu-text-sub font-mono tracking-wider opacity-60">
            {contact.phone_number}
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${
            isRotting ? "text-rose-500" : isWarning ? "text-amber-500" : "neu-text-sub opacity-50"
          }`}>
            {timeAgo(contact.last_message_at)}
          </span>
          {isRotting && (
            <span className="text-[8px] text-white bg-rose-500 px-1.5 py-0.5 rounded shadow-sm font-black uppercase tracking-widest mt-0.5">
              SLA Fallido
            </span>
          )}
        </div>
      </div>

      {/* Message preview: Bot question + User answer */}
      {(contact.last_bot_message || contact.last_user_message) && (
        <div className="mt-3 mb-3 pl-3 border-l-2 border-slate-200 dark:border-slate-700 space-y-1.5 text-[11.5px] leading-tight">
          {contact.last_bot_message && (
            <p className="neu-text-sub opacity-70 truncate font-medium flex items-center gap-1.5" title={contact.last_bot_message}>
              <Bot size={12} className="shrink-0" /> {truncate(contact.last_bot_message, 45)}
            </p>
          )}
          {contact.last_user_message && (
            <p className="neu-text truncate font-bold flex items-center gap-1.5" title={contact.last_user_message}>
              <User size={12} className="shrink-0" /> {truncate(contact.last_user_message, 45)}
            </p>
          )}
        </div>
      )}

      {/* CCT tag */}
      {contact.cct && !contact.school_name && (
        <div className="text-[10px] font-bold uppercase tracking-widest border border-slate-200 dark:border-slate-700 text-slate-500 rounded-lg px-2 py-1 mb-2 inline-block">
          CCT: {contact.cct}
        </div>
      )}

      {/* Footer: Bot status */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
        <span
          className={`inline-flex items-center justify-center min-w-[70px] text-[9.5px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-inner ${
            contact.bot_paused
              ? "bg-amber-500 text-white"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {contact.bot_paused ? "Humano" : "Bot"}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          Abrir Módulo <ArrowRight size={12} strokeWidth={3} />
        </span>
      </div>
    </div>
  );
}
