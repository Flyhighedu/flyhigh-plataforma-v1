"use client";

import { useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { useState } from "react";
import KanbanColumn from "./kanban-column";
import KanbanCard from "./kanban-card";

export default function KanbanBoard({
  contacts,
  stages,
  onMoveContact,
  onSelectContact,
  selectedContactId,
}) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Group contacts by pipeline_stage
  const columns = useMemo(() => {
    const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);
    return sorted.map((stage) => ({
      ...stage,
      contacts: contacts
        .filter((c) => c.pipeline_stage === stage.id)
        .sort((a, b) => {
          // Sort by last_message_at DESC (most recent first)
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        }),
    }));
  }, [contacts, stages]);

  const activeContact = activeId
    ? contacts.find((c) => c.id === activeId)
    : null;

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const contactId = active.id;
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    // Determine which column we dropped on
    // "over" could be a column id or another card id
    let targetStage = over.id;

    // If we dropped on a card, find which column it belongs to
    const overContact = contacts.find((c) => c.id === over.id);
    if (overContact) {
      targetStage = overContact.pipeline_stage;
    }

    // Only update if the stage actually changed
    if (contact.pipeline_stage !== targetStage) {
      onMoveContact(contactId, targetStage);
    }
  }

  function handleDragOver(event) {
    // Can be used for visual feedback during drag
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-nowrap md:gap-6 gap-4 p-2 h-full w-full mask-image-right pr-12">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            stage={column}
            contacts={column.contacts}
            onSelectContact={onSelectContact}
            selectedContactId={selectedContactId}
          />
        ))}
      </div>

      {/* Drag overlay — floating card that follows cursor */}
      <DragOverlay dropAnimation={{ duration: 200 }}>
        {activeContact ? (
          <KanbanCard contact={activeContact} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
