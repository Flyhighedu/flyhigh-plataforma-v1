"use client";

import { useState, useRef, useEffect } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export function GhostRow({ columnCount, onCreateRow }) {
  const emptyForm = {
    cct: "",
    nombre_escuela: "",
    tipo: "",
    ninos: "",
    codigo_postal: "",
    turno: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const firstRef = useRef(null);

  const canSave = form.cct.trim() && form.nombre_escuela.trim();
  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      await onCreateRow(form);
      setForm(emptyForm);
      // Re-focus first field for rapid data entry
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
    "h-8 text-sm bg-emerald-50/50 border-emerald-200 focus:ring-emerald-500";

  // Column order must match escuelas-columns.jsx exactly:
  // # | CCT | Nombre | Tipo | Niños | C.P. | Turno | ✈️ Visitada | Acción
  return (
    <TableRow className="bg-emerald-50/30 border-t-2 border-dashed border-emerald-300 hover:bg-emerald-50/50">
      {/* # */}
      <TableCell>
        <span className="text-emerald-500 text-lg font-bold">＋</span>
      </TableCell>
      {/* CCT */}
      <TableCell>
        <Input
          ref={firstRef}
          type="text"
          placeholder="16DPR…"
          value={form.cct}
          onChange={(e) => setForm((f) => ({ ...f, cct: e.target.value }))}
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      {/* Nombre */}
      <TableCell>
        <Input
          type="text"
          placeholder="Nombre de la escuela…"
          value={form.nombre_escuela}
          onChange={(e) =>
            setForm((f) => ({ ...f, nombre_escuela: e.target.value }))
          }
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      {/* Tipo */}
      <TableCell>
        <select
          value={form.tipo}
          onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
          onKeyDown={kd}
          className={`w-full h-8 text-sm rounded-md border px-2 ${cls}`}
        >
          <option value="">—</option>
          <option value="PRIVADO">Privado</option>
          <option value="FEDERAL TRANSFERIDO">Federal Transferido</option>
          <option value="ESTATAL">Estatal</option>
        </select>
      </TableCell>
      {/* Niños */}
      <TableCell>
        <Input
          type="number"
          placeholder="0"
          min={0}
          value={form.ninos}
          onChange={(e) => setForm((f) => ({ ...f, ninos: e.target.value }))}
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      {/* C.P. */}
      <TableCell>
        <Input
          type="text"
          placeholder="60000"
          value={form.codigo_postal}
          onChange={(e) =>
            setForm((f) => ({ ...f, codigo_postal: e.target.value }))
          }
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      {/* Turno */}
      <TableCell>
        <select
          value={form.turno}
          onChange={(e) => setForm((f) => ({ ...f, turno: e.target.value }))}
          onKeyDown={kd}
          className={`w-full h-8 text-sm rounded-md border px-2 ${cls}`}
        >
          <option value="">—</option>
          <option value="MATUTINO">Matutino</option>
          <option value="VESPERTINO">Vespertino</option>
          <option value="NOCTURNO">Nocturno</option>
          <option value="DISCONTINUO">Discontinuo</option>
        </select>
      </TableCell>
      {/* ✈️ Visitada — auto-set by trigger, read-only */}
      <TableCell>
        <span className="text-muted-foreground italic text-xs">auto</span>
      </TableCell>
      {/* Acción: Insertar */}
      <TableCell>
        <button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            "Crear"
          )}
        </button>
      </TableCell>
    </TableRow>
  );
}
