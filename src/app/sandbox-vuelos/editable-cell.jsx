"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

export function EditableCell({ getValue, row, column, table }) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef(null);

  // Sync with external updates (e.g. after refetch)
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const onSave = async () => {
    setIsEditing(false);
    if (value === initialValue) return;

    setIsSaving(true);
    try {
      await table.options.meta?.updateData(
        row.original.id,
        column.id,
        value
      );
    } catch {
      // revert on failure — toast is fired by the parent
      setValue(initialValue);
    } finally {
      setIsSaving(false);
    }
  };

  const onCancel = () => {
    setValue(initialValue);
    setIsEditing(false);
  };

  // Determine input type based on column
  const isNumeric = ["costo_por_nino", "total_students", "total_flights"].includes(column.id);

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type={isNumeric ? "number" : "text"}
        value={value ?? ""}
        onChange={(e) => setValue(isNumeric ? e.target.value : e.target.value)}
        onBlur={onSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
        className="h-8 w-full min-w-[60px] text-sm"
        min={isNumeric ? 0 : undefined}
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer rounded px-1 py-0.5 hover:bg-muted/70 transition-colors min-h-[28px] flex items-center ${
        isSaving ? "opacity-50" : ""
      }`}
      title="Clic para editar"
    >
      {value !== null && value !== undefined && value !== ""
        ? String(value)
        : <span className="text-muted-foreground italic">—</span>}
    </div>
  );
}
