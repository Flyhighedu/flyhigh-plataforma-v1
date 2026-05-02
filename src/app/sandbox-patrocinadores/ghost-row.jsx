"use client";

import { useState, useRef, useEffect } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export function GhostRow({ columnCount, onCreateRow }) {
  const emptyForm = {
    nombre: "",
    email: "",
    password: "",
    aportacion_total: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const firstRef = useRef(null);

  const canSave =
    form.nombre.trim() && form.email.trim() && form.password.trim();
  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      await onCreateRow({
        ...form,
        aportacion_total:
          form.aportacion_total === "" ? 0 : Number(form.aportacion_total),
      });
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
    "h-8 text-sm bg-fuchsia-50/50 border-fuchsia-200 focus:ring-fuchsia-500 w-full";

  return (
    <TableRow className="bg-fuchsia-50/30 border-t-2 border-dashed border-fuchsia-300 hover:bg-fuchsia-50/50">
      {/* Fecha (Automática) */}
      <TableCell className="p-1 text-center">
        <span className="text-xs text-slate-400 italic">Automática</span>
      </TableCell>

      {/* Razón Social / Nombre */}
      <TableCell className="p-1">
        <Input
          ref={firstRef}
          type="text"
          placeholder="Nombre de la empresa..."
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>

      {/* Correo */}
      <TableCell className="p-1">
        <Input
          type="email"
          placeholder="contacto@empresa.com"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>

      {/* Contraseña */}
      <TableCell className="p-1">
        <Input
          type="text"
          placeholder="Asignar contraseña..."
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>

      {/* Inversión */}
      <TableCell className="p-1">
        <div className="flex items-center gap-1">
          <span className="text-slate-400 px-1">$</span>
          <Input
            type="number"
            placeholder="0"
            value={form.aportacion_total}
            onChange={(e) =>
              setForm((f) => ({ ...f, aportacion_total: e.target.value }))
            }
            onKeyDown={kd}
            className={cls}
          />
        </div>
      </TableCell>

      {/* Acción: Insertar */}
      <TableCell className="p-1">
        <button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className="inline-flex items-center w-full justify-center h-8 px-2 rounded-md text-xs font-semibold text-white bg-fuchsia-600 hover:bg-fuchsia-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? "..." : "＋ Agregar"}
        </button>
      </TableCell>
    </TableRow>
  );
}
