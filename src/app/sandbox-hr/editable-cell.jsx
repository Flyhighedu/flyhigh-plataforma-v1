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
        row.id,
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
  const isNumeric = ["ninos"].includes(column.id);

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type={isNumeric ? "number" : "text"}
        value={value ?? ""}
        onChange={(e) => setValue(e.target.value)}
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

export function NativeSelectCell({ getValue, row, column, table }) {
  const [isSaving, setIsSaving] = useState(false);
  const initialValue = getValue();
  const [val, setVal] = useState(initialValue);

  // Sync when parent data changes
  useEffect(() => setVal(initialValue), [initialValue]);

  const onChange = async (e) => {
    const newValue = e.target.value === "true";
    setVal(newValue);
    setIsSaving(true);
    try {
      const payload = row.original.payload || {};
      const newPayload = { ...payload, [column.id]: newValue };
      
      await table.options.meta?.updateData(
        row.original.checkin_id, // Ensure we send the checkin DB ID
        "payload",
        newPayload
      );
    } catch {
      setVal(initialValue);
    } finally {
      setIsSaving(false);
    }
  };

  if (!row.original.checkin_id) {
    return <span className="text-muted-foreground italic text-xs">Sin checkin</span>;
  }

  return (
    <select
      disabled={isSaving}
      value={val ? "true" : "false"}
      onChange={onChange}
      className={`h-7 w-auto bg-transparent border border-slate-200 text-xs font-medium focus:ring-1 focus:ring-emerald-500 rounded cursor-pointer hover:bg-slate-50 transition-colors ${val ? 'text-emerald-700' : 'text-slate-500'} ${isSaving ? 'opacity-50' : ''}`}
    >
      <option value="true">✅ Sí</option>
      <option value="false">❌ No</option>
    </select>
  );
}

export function EditableTimeCell({ getValue, row, column, table }) {
  // Determine if it's the 'hora_entrada' or 'hora_salida' column
  const targetEventIdKey = column.id === "hora_entrada" ? "checkin_id" : "checkout_id";
  const eventId = row.original[targetEventIdKey];
  
  const rawValue = getValue();
  const initialValue = rawValue === "Sin registro" ? "" : rawValue;
  const [val, setVal] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => setVal(initialValue), [initialValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

  const onSave = async () => {
    setIsEditing(false);
    if (val === initialValue) return;
    
    try {
      const baseDate = new Date(row.original.date_raw);
      if (val) {
        const [hours, mins] = val.split(":");
        baseDate.setHours(parseInt(hours, 10), parseInt(mins, 10), 0);
      }
      
      const isoDate = val ? baseDate.toISOString() : null;

      if (!eventId) {
         // Create checkout if doesn't exist yet
         if (val && table.options.meta?.createCheckout) {
             await table.options.meta.createCheckout(row.original.user_id, row.original.journey_id, isoDate);
         }
      } else {
         await table.options.meta?.updateData(
            eventId,
            "created_at",
            isoDate
         );
      }
    } catch {
      setVal(initialValue);
    }
  };

  const onCancel = () => {
    setVal(initialValue);
    setIsEditing(false);
  };

  if (!eventId) {
    return <span className="text-muted-foreground italic text-xs opacity-60">Sin registro</span>;
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="time"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={onSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
        className="h-8 w-[100px] text-xs font-mono"
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-pointer px-2 py-1 hover:bg-slate-100 rounded text-xs font-mono font-medium min-h-[28px] flex items-center"
      title="Clic para editar hora"
    >
      {val || <span className="text-muted-foreground italic">—</span>}
    </div>
  );
}
