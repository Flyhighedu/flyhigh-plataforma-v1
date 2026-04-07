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
  const [isManualName, setIsManualName] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    fetch("/api/sandbox-escuelas")
      .then((res) => res.json())
      .then((json) => {
        if (json.data) setCatalog(json.data);
      })
      .catch((err) => console.error("Error loading catalog:", err));
  }, []);

  const handleSelectChange = (e) => {
    const val = e.target.value;
    if (val === "MANUAL_ENTRY") {
      setIsManualName(true);
      setForm((f) => ({ ...f, nombre_escuela: "", cct: "", turno: "" }));
      return;
    }
    const match = catalog.find((c) => c.nombre_escuela === val);
    
    let turnoNormalize = f => f;
    if (match && match.turno) {
      const lower = String(match.turno).toLowerCase();
      if (lower.includes("matutino")) turnoNormalize = () => "Matutino";
      if (lower.includes("vespertino")) turnoNormalize = () => "Vespertino";
    }

    setForm((f) => ({
      ...f,
      nombre_escuela: val,
      cct: match ? match.cct : f.cct,
      turno: match && match.turno ? turnoNormalize() : f.turno,
    }));
  };

  const canSave = form.nombre_escuela.trim() && form.fecha_programada && form.turno;
  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      await onCreateRow(form);
      setForm(emptyForm);
      setIsManualName(false);
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
      <TableCell className="p-1 min-w-[200px]">
        {!isManualName ? (
           <select
             value={form.nombre_escuela}
             onChange={handleSelectChange}
             onKeyDown={kd}
             className={`${cls} text-[11px] font-semibold px-2 uppercase outline-none select-none border rounded-md min-w-[200px] bg-white`}
           >
             <option value="">Seleccione Misión...</option>
             <option value="MANUAL_ENTRY" className="font-bold bg-amber-100 text-amber-900 border-b border-amber-200">➕ Ingresar Nueva (Foránea)</option>
             {catalog.map((c) => (
               <option key={c.cct} value={c.nombre_escuela}>{c.nombre_escuela}</option>
             ))}
           </select>
        ) : (
           <div className="flex items-center gap-1 w-full bg-amber-50 rounded-sm border border-amber-300 pr-1 min-w-[200px]">
             <Input
               ref={firstRef}
               autoFocus
               type="text"
               placeholder="Ingresar foránea..."
               value={form.nombre_escuela}
               onChange={(e) => setForm(f => ({ ...f, nombre_escuela: e.target.value }))}
               onKeyDown={kd}
               className={`h-7 w-full text-xs font-semibold px-2 outline-none border-none shadow-none focus-visible:ring-0 bg-transparent uppercase`}
             />
             <button 
               onClick={() => { setIsManualName(false); setForm(f => ({ ...f, nombre_escuela: "", cct: "", turno: "" })); }} 
               title="Volver al Catálogo" 
               className="text-amber-600 hover:text-amber-800 p-0.5 flex-shrink-0" 
               tabIndex={-1}
             >✕</button>
           </div>
        )}
      </TableCell>
      {/* Turno */}
      <TableCell className="p-1">
        <select
          value={form.turno || ""}
          onChange={(e) => setForm((f) => ({ ...f, turno: e.target.value }))}
          className={`h-8 text-[11px] font-semibold rounded-md border px-1 outline-none text-slate-600 ${!form.turno ? 'bg-rose-50 border-rose-300 ring-rose-500' : 'bg-white border-emerald-200'} focus:ring-emerald-500 w-full cursor-pointer uppercase`}
        >
          <option value="" disabled>SELECCIONE...</option>
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
