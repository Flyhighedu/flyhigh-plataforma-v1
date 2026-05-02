"use client";

import { useState, useRef, useEffect } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export function GhostRow({ columnCount, onCreateRow }) {
  const emptyForm = {
    school_name: "",
    date: "",
    cct: "",
    direccion: "",
    nombre_director: "",
    telefono_director: "",
    numero_sector: "",
    numero_zona: "",
    tipo_escuela: "",
    cuota_alumno: "",
    tarifa_base: "",
    total_students: "",
    becados: "",
    total_flights: "",
  };
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

  // Column order must match journey-columns.jsx exactly:
  // # | ▶ | Fecha | Escuela | CCT | Dirección | Director | Tel | Sector | Zona |
  // Estado | Tipo |
  // Niños | Becados | Tarifa | Cuota |
  // SubsidioNiño(c) | Recaudación(c) | CostoBecados(c) | SubsidioTotal(c) | AportPatr(c) | VentaBruta(c) |
  // Vuelos | Acción

  return (
    <TableRow className="bg-emerald-50/30 border-t-2 border-dashed border-emerald-300 hover:bg-emerald-50/50">
      <TableCell>
        <span className="text-emerald-500 text-lg font-bold">＋</span>
      </TableCell>
      <TableCell />
      <TableCell>
        <Input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      <TableCell>
        <Input
          ref={firstRef}
          type="text"
          placeholder="Nombre…"
          value={form.school_name}
          onChange={(e) =>
            setForm((f) => ({ ...f, school_name: e.target.value }))
          }
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      <TableCell>
        <Input
          type="text"
          placeholder="CCT…"
          value={form.cct}
          onChange={(e) => setForm((f) => ({ ...f, cct: e.target.value }))}
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      <TableCell>
        <Input
          type="text"
          placeholder="Dirección…"
          value={form.direccion}
          onChange={(e) =>
            setForm((f) => ({ ...f, direccion: e.target.value }))
          }
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      <TableCell>
        <Input
          type="text"
          placeholder="Director(a)…"
          value={form.nombre_director}
          onChange={(e) =>
            setForm((f) => ({ ...f, nombre_director: e.target.value }))
          }
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      <TableCell>
        <Input
          type="text"
          placeholder="Tel…"
          value={form.telefono_director}
          onChange={(e) =>
            setForm((f) => ({ ...f, telefono_director: e.target.value }))
          }
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      {/* ── Sector & Zona ── */}
      <TableCell>
        <Input
          type="text"
          placeholder="Sector…"
          value={form.numero_sector}
          onChange={(e) =>
            setForm((f) => ({ ...f, numero_sector: e.target.value }))
          }
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      <TableCell>
        <Input
          type="text"
          placeholder="Zona…"
          value={form.numero_zona}
          onChange={(e) =>
            setForm((f) => ({ ...f, numero_zona: e.target.value }))
          }
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      {/* ── Estado (auto-sealed) ── */}
      <TableCell>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
          → closed
        </span>
      </TableCell>
      {/* ── Tipo ── */}
      <TableCell>
        <select
          value={form.tipo_escuela}
          onChange={(e) =>
            setForm((f) => ({ ...f, tipo_escuela: e.target.value }))
          }
          onKeyDown={kd}
          className={`w-full h-8 text-sm rounded-md border px-2 ${cls}`}
        >
          <option value="">—</option>
          <option value="Pública">Pública</option>
          <option value="Privada">Privada</option>
        </select>
      </TableCell>
      {/* ── Volumen: Niños & Becados ── */}
      <TableCell>
        <Input
          type="number"
          placeholder="0"
          min={0}
          value={form.total_students}
          onChange={(e) =>
            setForm((f) => ({ ...f, total_students: e.target.value }))
          }
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          placeholder="0"
          min={0}
          value={form.becados}
          onChange={(e) => setForm((f) => ({ ...f, becados: e.target.value }))}
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      {/* ── Unitarios: Tarifa & Cuota ── */}
      <TableCell>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">$</span>
          <Input
            type="number"
            placeholder="0"
            min={0}
            value={form.tarifa_base}
            onChange={(e) =>
              setForm((f) => ({ ...f, tarifa_base: e.target.value }))
            }
            onKeyDown={kd}
            className={`${cls} w-20`}
          />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">$</span>
          <Input
            type="number"
            placeholder="0"
            min={0}
            value={form.cuota_alumno}
            onChange={(e) =>
              setForm((f) => ({ ...f, cuota_alumno: e.target.value }))
            }
            onKeyDown={kd}
            className={`${cls} w-20`}
          />
        </div>
      </TableCell>
      {/* ── 6 calculated columns — auto ── */}
      <TableCell>
        <span className="text-muted-foreground italic text-xs">auto</span>
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground italic text-xs">auto</span>
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground italic text-xs">auto</span>
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground italic text-xs">auto</span>
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground italic text-xs">auto</span>
      </TableCell>
      <TableCell>
        <span className="text-muted-foreground italic text-xs">auto</span>
      </TableCell>
      {/* ── Vuelos ── */}
      <TableCell>
        <Input
          type="number"
          placeholder="0"
          min={0}
          value={form.total_flights}
          onChange={(e) =>
            setForm((f) => ({ ...f, total_flights: e.target.value }))
          }
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      {/* ── Acción ── */}
      <TableCell>
        <button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className="inline-flex items-center justify-center h-8 px-3 rounded-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
