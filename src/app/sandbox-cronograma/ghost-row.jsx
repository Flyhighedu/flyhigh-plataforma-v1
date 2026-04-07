"use client";

import { useState, useRef, useEffect } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

export function GhostRow({ columnCount, onCreateRow }) {
  const emptyForm = {
    cct: "",
    nombre_escuela: "",
    colonia: "",
    estatus: "pendiente",
    fecha_programada: new Date().toISOString().split('T')[0],
    tarifa_base: 80,
    turno: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const firstRef = useRef(null);

  useEffect(() => {
    fetch("/api/sandbox-escuelas")
      .then((res) => res.json())
      .then((json) => {
        if (json.data) setCatalog(json.data);
      })
      .catch((err) => console.error("Error loading catalog:", err));
  }, []);

  const handleNameChange = (e) => {
    const val = e.target.value;
    const match = catalog.find((c) => c.nombre_escuela === val);
    setForm((f) => ({
      ...f,
      nombre_escuela: val,
      cct: match ? match.cct : f.cct,
      turno: match && match.turno ? match.turno : f.turno,
    }));
  };

  const canSave = form.nombre_escuela.trim() && form.fecha_programada;
  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      await onCreateRow(form);
      setForm(emptyForm);
      setTimeout(() => firstRef.current?.focus(), 50);
    } catch {} finally {
      setIsSaving(false);
    }
  };
  const kd = (e) => {
    if (e.key === "Enter" && canSave) { e.preventDefault(); handleSave(); }
  };

  const cls = "h-8 text-sm bg-emerald-50/50 border-emerald-200 focus:ring-emerald-500 w-full";

  return (
    <TableRow className="bg-emerald-50/30 border-t-2 border-dashed border-emerald-300 hover:bg-emerald-50/50">
      {/* Estatus */}
      <TableCell className="p-1">
        <select
          value={form.estatus}
          onChange={(e) => setForm((f) => ({ ...f, estatus: e.target.value }))}
          className={`h-8 text-xs font-semibold rounded-md border px-1 outline-none ${cls}`}
        >
          <option value="pendiente">Pendiente</option>
          <option value="completada">Completada</option>
        </select>
      </TableCell>
      {/* Fecha Programada */}
      <TableCell className="p-1">
         <Input
          type="date"
          value={form.fecha_programada}
          onChange={(e) => setForm((f) => ({ ...f, fecha_programada: e.target.value }))}
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      {/* Nombre */}
      <TableCell className="p-1">
        <Input
          ref={firstRef}
          type="text"
          list="school-list-catalog"
          placeholder="Nombre Esc…"
          value={form.nombre_escuela}
          onChange={handleNameChange}
          onKeyDown={kd}
          className={cls}
        />
        <datalist id="school-list-catalog">
          {catalog.map((c) => (
            <option key={c.cct} value={c.nombre_escuela} />
          ))}
        </datalist>
      </TableCell>
      {/* Turno */}
      <TableCell className="p-1">
        <select
          value={form.turno || ""}
          onChange={(e) => setForm((f) => ({ ...f, turno: e.target.value }))}
          className={`h-8 text-[11px] font-semibold rounded-md border px-1 outline-none text-slate-600 bg-white border-emerald-200 focus:ring-emerald-500 w-full cursor-pointer uppercase`}
        >
          <option value="">No Definido</option>
          <option value="Matutino">Matutino</option>
          <option value="Vespertino">Vespertino</option>
        </select>
      </TableCell>
      {/* CCT */}
      <TableCell className="p-1">
        <Input
          type="text"
          placeholder="16DPR…"
          value={form.cct}
          onChange={(e) => setForm((f) => ({ ...f, cct: e.target.value }))}
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      {/* Colonia */}
      <TableCell className="p-1">
        <Input
          type="text"
          placeholder="Colonia…"
          value={form.colonia}
          onChange={(e) => setForm((f) => ({ ...f, colonia: e.target.value }))}
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      {/* Tarifa Fija */}
      <TableCell className="p-1">
         <Input
          type="number"
          placeholder="80"
          value={form.tarifa_base}
          onChange={(e) => setForm((f) => ({ ...f, tarifa_base: e.target.value }))}
          onKeyDown={kd}
          className={cls}
        />
      </TableCell>
      
      {/* Spacers for the rest of the columns (Cuota Alm, Subsidio, Director, Tel Director, Delegado, Tel, Zona, Sector, Origen) = 9 columns */}
      <TableCell className="p-1"></TableCell>
      <TableCell className="p-1"></TableCell>
      <TableCell className="p-1"></TableCell>
      <TableCell className="p-1"></TableCell>
      <TableCell className="p-1"></TableCell>
      <TableCell className="p-1"></TableCell>
      <TableCell className="p-1"></TableCell>
      <TableCell className="p-1"><span className="text-xs text-slate-400 italic">manual</span></TableCell>

      {/* Acción: Insertar */}
      <TableCell className="p-1">
        <button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className="inline-flex items-center w-full justify-center h-8 px-2 rounded-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? "..." : "＋ Agregar"}
        </button>
      </TableCell>
    </TableRow>
  );
}
