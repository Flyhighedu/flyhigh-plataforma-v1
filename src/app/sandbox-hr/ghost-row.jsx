"use client";

import { useState, useRef } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export function GhostRow({ columnCount, onCreateRow }) {
  const emptyForm = {
    id: "",
    full_name: "",
    role: "auxiliar",
    is_active: true,
    phone: "",
    email: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const firstRef = useRef(null);

  const canSave =
    form.id.trim().length > 10 && form.full_name.trim().length > 2;

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      await onCreateRow(form);
      setForm(emptyForm);
      setTimeout(() => firstRef.current?.focus(), 50);
    } catch {
    } finally {
      setIsSaving(false);
    }
  };

  const kd = (e) => {
    if (e.key === "Enter" && canSave) {
      e.preventDefault();
      handleSave();
    }
  };

  const cls =
    "h-8 text-sm bg-emerald-50/50 border-emerald-200 focus:ring-emerald-500 rounded-md font-medium text-slate-700 placeholder:text-slate-400";

  // Column order in hr-columns.jsx:
  // 1: UUID Copy Button -> Here it will be an Input for the new UUID
  // 2: Nombre Completo
  // 3: Rol
  // 4: Activo
  // 5: Telefono
  // 6: Email
  // 7: Acciones

  return (
    <TableRow className="bg-emerald-50/30 border-t-2 border-dashed border-emerald-300 hover:bg-emerald-50/50 transition-colors">
      {/* 1: UUID (Input) */}
      <TableCell className="p-2">
        <Input
          ref={firstRef}
          type="text"
          placeholder="Auth UUID..."
          value={form.id}
          onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
          onKeyDown={kd}
          className={`${cls} w-full text-xs font-mono`}
          title="El UUID generado por Supabase Auth al crear el usuario."
        />
      </TableCell>

      {/* 2: Nombre Completo */}
      <TableCell className="p-2">
        <Input
          type="text"
          placeholder="Ej. Juan Pérez"
          value={form.full_name}
          onChange={(e) =>
            setForm((f) => ({ ...f, full_name: e.target.value }))
          }
          onKeyDown={kd}
          className={`${cls} w-full`}
        />
      </TableCell>

      {/* 3: Rol */}
      <TableCell className="p-2">
        <select
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          onKeyDown={kd}
          className={`w-full h-8 text-sm border px-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-md ${cls}`}
        >
          <option value="admin">Admin</option>
          <option value="pilot">Piloto</option>
          <option value="teacher">Docente</option>
          <option value="assistant">Asistente</option>
          <option value="auxiliar">Auxiliar</option>
        </select>
      </TableCell>

      {/* 4: Activo (Toggle Visual via Select for simplicity in Ghostrow) */}
      <TableCell className="p-2 text-center">
        <select
          value={form.is_active.toString()}
          onChange={(e) =>
            setForm((f) => ({ ...f, is_active: e.target.value === "true" }))
          }
          className={`h-8 text-[11px] font-bold uppercase rounded-md border px-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${form.is_active ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-200 text-slate-600 border-slate-300"}`}
        >
          <option value="true">Activo</option>
          <option value="false">Inactivo</option>
        </select>
      </TableCell>

      {/* 5: Teléfono */}
      <TableCell className="p-2">
        <Input
          type="text"
          placeholder="5500000000"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          onKeyDown={kd}
          className={`${cls} w-full`}
        />
      </TableCell>

      {/* 6: Email */}
      <TableCell className="p-2">
        <Input
          type="email"
          placeholder="staff@flyhigh.com"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          onKeyDown={kd}
          className={`${cls} w-full`}
        />
      </TableCell>

      {/* 7: Acción (Crear) */}
      <TableCell className="p-2 text-center">
        <button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className="inline-flex w-full items-center justify-center h-8 px-3 rounded-lg text-xs font-black text-white bg-emerald-500 hover:bg-emerald-600 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-emerald-500/30 hover:shadow-emerald-500/50"
        >
          {isSaving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            "INJECT"
          )}
        </button>
      </TableCell>
    </TableRow>
  );
}
