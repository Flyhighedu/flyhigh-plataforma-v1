"use client";

import { useState, useRef, useEffect } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export function GhostRow({ columnCount, onCreateRow }) {
  const emptyForm = {
    school_name: "", date: "", cct: "", colonia_comunidad: "",
    tipo_escuela: "", costo_por_nino: "", tarifa_base: "", cuota_alumno: "", subsidio_patrocinador: "",
    total_students: "", becados: "", total_flights: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    if (firstRef.current) firstRef.current.focus();
  }, []);

  // Auto-suggest subsidio when tarifa and cuota are filled
  useEffect(() => {
    if (form.tarifa_base && form.cuota_alumno && !form.subsidio_patrocinador) {
      const suggested = Number(form.tarifa_base) - Number(form.cuota_alumno);
      if (!isNaN(suggested)) {
        setForm((f) => ({ ...f, subsidio_patrocinador: String(suggested) }));
      }
    }
  }, [form.tarifa_base, form.cuota_alumno]);

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

  // Column order must match journey-columns.jsx exactly:
  // 0: # | 1: expander | 2: date | 3: school_name | 4: cct | 5: colonia
  // 6: status | 7: tipo_escuela | 8: costo_por_nino | 9: tarifa_base
  // 10: cuota_alumno | 11: subsidio | 12: total_students | 13: becados
  // 14: total_flights | 15: actions

  return (
    <TableRow className="bg-emerald-50/30 dark:bg-emerald-950/10 border-t-2 border-dashed border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20">
      {/* 0: # */}
      <TableCell>
        <span className="text-emerald-500 text-lg font-bold" title="Nueva misión">＋</span>
      </TableCell>

      {/* 1: Expander */}
      <TableCell />

      {/* 2: Fecha */}
      <TableCell>
        <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} onKeyDown={handleKeyDown} className={inputCls} />
      </TableCell>

      {/* 3: Escuela */}
      <TableCell>
        <Input ref={firstRef} type="text" placeholder="Nombre…" value={form.school_name} onChange={(e) => setForm((f) => ({ ...f, school_name: e.target.value }))} onKeyDown={handleKeyDown} className={inputCls} />
      </TableCell>

      {/* 4: CCT */}
      <TableCell>
        <Input type="text" placeholder="CCT…" value={form.cct} onChange={(e) => setForm((f) => ({ ...f, cct: e.target.value }))} onKeyDown={handleKeyDown} className={inputCls} />
      </TableCell>

      {/* 5: Colonia */}
      <TableCell>
        <Input type="text" placeholder="Colonia…" value={form.colonia_comunidad} onChange={(e) => setForm((f) => ({ ...f, colonia_comunidad: e.target.value }))} onKeyDown={handleKeyDown} className={inputCls} />
      </TableCell>

      {/* 6: Estado — auto */}
      <TableCell>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">→ closed</span>
      </TableCell>

      {/* 7: Tipo */}
      <TableCell>
        <select value={form.tipo_escuela} onChange={(e) => setForm((f) => ({ ...f, tipo_escuela: e.target.value }))} onKeyDown={handleKeyDown} className={`w-full h-8 text-sm rounded-md border px-2 ${inputCls}`}>
          <option value="">—</option>
          <option value="Pública">Pública</option>
          <option value="Privada">Privada</option>
        </select>
      </TableCell>

      {/* 8: Costo/Niño */}
      <TableCell>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">$</span>
          <Input type="number" placeholder="0" min={0} value={form.costo_por_nino} onChange={(e) => setForm((f) => ({ ...f, costo_por_nino: e.target.value }))} onKeyDown={handleKeyDown} className={`${inputCls} w-20`} />
        </div>
      </TableCell>

      {/* 9: Tarifa Base */}
      <TableCell>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">$</span>
          <Input type="number" placeholder="0" min={0} value={form.tarifa_base} onChange={(e) => setForm((f) => ({ ...f, tarifa_base: e.target.value }))} onKeyDown={handleKeyDown} className={`${inputCls} w-20`} />
        </div>
      </TableCell>

      {/* 10: Cuota Alumno */}
      <TableCell>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">$</span>
          <Input type="number" placeholder="0" min={0} value={form.cuota_alumno} onChange={(e) => setForm((f) => ({ ...f, cuota_alumno: e.target.value }))} onKeyDown={handleKeyDown} className={`${inputCls} w-20`} />
        </div>
      </TableCell>

      {/* 11: Subsidio (auto-suggest) */}
      <TableCell>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">$</span>
          <Input type="number" placeholder="auto" value={form.subsidio_patrocinador} onChange={(e) => setForm((f) => ({ ...f, subsidio_patrocinador: e.target.value }))} onKeyDown={handleKeyDown} className={`${inputCls} w-20`} />
        </div>
      </TableCell>

      {/* 12: Niños */}
      <TableCell>
        <Input type="number" placeholder="0" min={0} value={form.total_students} onChange={(e) => setForm((f) => ({ ...f, total_students: e.target.value }))} onKeyDown={handleKeyDown} className={inputCls} />
      </TableCell>

      {/* 13: Becados */}
      <TableCell>
        <Input type="number" placeholder="0" min={0} value={form.becados} onChange={(e) => setForm((f) => ({ ...f, becados: e.target.value }))} onKeyDown={handleKeyDown} className={inputCls} />
      </TableCell>

      {/* 14: Vuelos */}
      <TableCell>
        <Input type="number" placeholder="0" min={0} value={form.total_flights} onChange={(e) => setForm((f) => ({ ...f, total_flights: e.target.value }))} onKeyDown={handleKeyDown} className={inputCls} />
      </TableCell>

      {/* 15: Acción */}
      <TableCell>
        <button onClick={handleSave} disabled={!canSave || isSaving} className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" title={canSave ? "Guardar misión (Enter)" : "Escribe nombre y fecha"}>
          {isSaving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : "Sellar"}
        </button>
      </TableCell>
    </TableRow>
  );
}
