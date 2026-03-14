"use client";

import { useState, useRef, useEffect } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export function GhostRow({ columnCount, onCreateRow }) {
  const emptyForm = { school_name: "", date: "", total_students: "", becados: "", total_flights: "", tipo_escuela: "", costo_por_nino: "" };
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    if (firstRef.current) firstRef.current.focus();
  }, []);

  const canSave = form.school_name.trim() && form.date;

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      await onCreateRow(form);
      setForm(emptyForm);
    } catch {
      // toast handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && canSave) {
      e.preventDefault();
      handleSave();
    }
  };

  const inputCls = "h-8 text-sm bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 focus:ring-emerald-500";

  return (
    <TableRow className="bg-emerald-50/30 dark:bg-emerald-950/10 border-t-2 border-dashed border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20">
      {/* Expander placeholder */}
      <TableCell>
        <span className="text-emerald-500 text-lg font-bold" title="Nueva misión">＋</span>
      </TableCell>

      {/* Date */}
      <TableCell>
        <Input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          onKeyDown={handleKeyDown}
          className={inputCls}
        />
      </TableCell>

      {/* School — free text input (Excel-style) */}
      <TableCell>
        <Input
          ref={firstRef}
          type="text"
          placeholder="Nombre de la escuela…"
          value={form.school_name}
          onChange={(e) => setForm((f) => ({ ...f, school_name: e.target.value }))}
          onKeyDown={handleKeyDown}
          className={inputCls}
        />
      </TableCell>

      {/* Status — auto */}
      <TableCell>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
          → closed
        </span>
      </TableCell>

      {/* Tipo Escuela */}
      <TableCell>
        <select
          value={form.tipo_escuela}
          onChange={(e) => setForm((f) => ({ ...f, tipo_escuela: e.target.value }))}
          onKeyDown={handleKeyDown}
          className={`w-full h-8 text-sm rounded-md border px-2 ${inputCls} bg-emerald-50/50 dark:bg-emerald-950/20`}
        >
          <option value="">—</option>
          <option value="Pública">Pública</option>
          <option value="Privada">Privada</option>
        </select>
      </TableCell>

      {/* Costo/Niño */}
      <TableCell>
        <Input
          type="number"
          placeholder="$"
          min={0}
          value={form.costo_por_nino}
          onChange={(e) => setForm((f) => ({ ...f, costo_por_nino: e.target.value }))}
          onKeyDown={handleKeyDown}
          className={inputCls}
        />
      </TableCell>

      {/* Niños */}
      <TableCell>
        <Input
          type="number"
          placeholder="0"
          min={0}
          value={form.total_students}
          onChange={(e) => setForm((f) => ({ ...f, total_students: e.target.value }))}
          onKeyDown={handleKeyDown}
          className={inputCls}
        />
      </TableCell>

      {/* Becados */}
      <TableCell>
        <Input
          type="number"
          placeholder="0"
          min={0}
          value={form.becados}
          onChange={(e) => setForm((f) => ({ ...f, becados: e.target.value }))}
          onKeyDown={handleKeyDown}
          className={inputCls}
        />
      </TableCell>

      {/* Vuelos */}
      <TableCell>
        <Input
          type="number"
          placeholder="0"
          min={0}
          value={form.total_flights}
          onChange={(e) => setForm((f) => ({ ...f, total_flights: e.target.value }))}
          onKeyDown={handleKeyDown}
          className={inputCls}
        />
      </TableCell>

      {/* Action: Save button */}
      <TableCell>
        <button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title={canSave ? "Guardar misión (Enter)" : "Escribe el nombre y selecciona fecha"}
        >
          {isSaving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            "Sellar"
          )}
        </button>
      </TableCell>
    </TableRow>
  );
}
