"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Search, PenTool, CheckSquare, MessageSquare } from "lucide-react";
import KanbanCard from "./kanban-card";

// Mapeo seguro de iconos según el ID o label de la fase, evitando emojis de la BD.
function getColumnIcon(stageId) {
  if (!stageId) return <MessageSquare size={16} strokeWidth={2.5} />;
  const idStr = stageId.toLowerCase();
  if (idStr.includes('explora') || idStr.includes('menu')) return <Search size={16} strokeWidth={2.5} />;
  if (idStr.includes('agend')) return <PenTool size={16} strokeWidth={2.5} />;
  if (idStr.includes('config')) return <CheckSquare size={16} strokeWidth={2.5} />;
  return <MessageSquare size={16} strokeWidth={2.5} />;
}

export default function KanbanColumn({
  stage,
  contacts,
  onSelectContact,
  selectedContactId,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      className={`flex flex-col flex-1 min-w-[280px] max-w-[360px] shrink-0 rounded-3xl p-1 transition-all duration-300 ${
        isOver ? "ring-2 ring-blue-500/30 scale-[1.01]" : ""
      }`}
      style={{
        boxShadow: isOver 
          ? 'inset 6px 6px 12px rgba(0,0,0,0.1), inset -6px -6px 12px rgba(255,255,255,0.8)' 
          : 'inset 4px 4px 8px var(--neu-shadow-dark), inset -4px -4px 8px var(--neu-shadow-light)',
        backgroundColor: 'var(--neu-bg)'
      }}
    >
      {/* Column header */}
      <div className="flex items-center gap-3 px-5 py-4 shrink-0 border-b border-white/40 dark:border-white/5">
        <span className="text-slate-500 dark:text-slate-400">
          {getColumnIcon(stage.id)}
        </span>
        <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex-1 opacity-90">{stage.label}</h3>
        <span
          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm"
          style={{
            backgroundColor: 'var(--neu-surface)',
            color: stage.color || '#64748B',
          }}
        >
          {contacts.length}
        </span>
      </div>

      {/* Cards container */}
      <div ref={setNodeRef} className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[150px] no-scrollbar mask-image-bottom pb-8">
        <SortableContext
          items={contacts.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {contacts.map((contact) => (
            <KanbanCard
              key={contact.id}
              contact={contact}
              onClick={() => onSelectContact(contact)}
              isSelected={selectedContactId === contact.id}
            />
          ))}
        </SortableContext>

        {contacts.length === 0 && (
          <div className="flex flex-col flex-1 items-center justify-center min-h-[120px] text-[11px] uppercase tracking-widest font-bold opacity-30 neu-text-sub mt-4 border-2 border-dashed border-slate-300/50 dark:border-slate-700/50 rounded-2xl mx-2">
            Bandeja Vacía
          </div>
        )}
      </div>
    </div>
  );
}
