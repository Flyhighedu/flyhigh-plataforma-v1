"use client";

import { useState, useEffect } from "react";
import { EditableCell } from "./editable-cell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Status badge colors
const statusColors = {
  prep: "bg-amber-100 text-amber-800",
  operation: "bg-blue-100 text-blue-800",
  report: "bg-purple-100 text-purple-800",
  dismantling: "bg-orange-100 text-orange-800",
  closed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const STATUS_OPTIONS = [
  { value: "prep", label: "Preparación" },
  { value: "operation", label: "Operación" },
  { value: "report", label: "Reporte" },
  { value: "dismantling", label: "Desmontaje" },
  { value: "closed", label: "Cerrada" },
  { value: "cancelled", label: "Cancelada" },
];

// --- Shared inline cell components ---

function StatusSelectCell({ getValue, row, column, table }) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => setValue(initialValue), [initialValue]);

  const handleChange = async (e) => {
    const nv = e.target.value;
    if (nv === value) return;
    setValue(nv);
    setIsSaving(true);
    try { await table.options.meta?.updateData(row.original.id, column.id, nv); }
    catch { setValue(initialValue); }
    finally { setIsSaving(false); }
  };

  const colors = statusColors[value] || "bg-gray-100 text-gray-800";
  return (
    <select value={value || ""} onChange={handleChange} disabled={isSaving}
      className={`appearance-none cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium border-0 outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 transition-all ${colors} ${isSaving ? "opacity-50" : ""}`}>
      {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function TipoEscuelaCell({ getValue, row, column, table }) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue || "");
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => setValue(initialValue || ""), [initialValue]);

  const handleChange = async (e) => {
    const nv = e.target.value || null;
    if (nv === value) return;
    setValue(nv || "");
    setIsSaving(true);
    try { await table.options.meta?.updateData(row.original.id, column.id, nv); }
    catch { setValue(initialValue || ""); }
    finally { setIsSaving(false); }
  };

  return (
    <select value={value} onChange={handleChange} disabled={isSaving}
      className={`appearance-none cursor-pointer rounded-md px-2 py-0.5 text-xs font-medium border border-slate-200 outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 bg-white transition-all ${isSaving ? "opacity-50" : ""}`}>
      <option value="">—</option>
      <option value="Pública">Pública</option>
      <option value="Privada">Privada</option>
    </select>
  );
}

function CurrencyCell({ getValue, row, column, table }) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => setValue(initialValue), [initialValue]);

  const onSave = async () => {
    setIsEditing(false);
    if (value === initialValue) return;
    const num = value === "" || value === null ? null : Number(value);
    setIsSaving(true);
    try { await table.options.meta?.updateData(row.original.id, column.id, num); }
    catch { setValue(initialValue); }
    finally { setIsSaving(false); }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground font-medium">$</span>
        <input autoFocus type="number" min={0} value={value ?? ""} onChange={(e) => setValue(e.target.value)}
          onBlur={onSave} onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") { setValue(initialValue); setIsEditing(false); }}}
          className="h-8 w-20 text-sm border rounded-md px-1 outline-none focus:ring-2 focus:ring-blue-400" />
      </div>
    );
  }

  return (
    <div onClick={() => setIsEditing(true)} className={`cursor-pointer rounded px-1 py-0.5 hover:bg-muted/70 transition-colors min-h-[28px] flex items-center ${isSaving ? "opacity-50" : ""}`} title="Clic para editar">
      {value != null && value !== "" ? <span className="text-sm font-medium">${Number(value).toLocaleString("es-MX")}</span> : <span className="text-muted-foreground italic text-sm">—</span>}
    </div>
  );
}

function DeleteActionCell({ row, table }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const journey = row.original;
  const label = journey.school_name || journey.date || journey.id.slice(0, 8);

  const handleDelete = async () => {
    setIsDeleting(true);
    try { await table.options.meta?.deleteRow(journey.id); } catch {} finally { setIsDeleting(false); }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none" disabled={isDeleting} title="Eliminar journey">
        {isDeleting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" /> :
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esto eliminará la misión <strong>&quot;{label}&quot;</strong> y todos los vuelos/evidencias <strong>permanentemente</strong>.
            <br /><br /><span className="text-destructive font-medium">Esta acción no se puede deshacer.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">Sí, eliminar permanentemente</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// --- Calculated read-only cell ---
function CalcCell({ value, prefix = "" }) {
  return (
    <span className="text-sm font-medium text-slate-600">
      {value != null ? `${prefix}${Number(value).toLocaleString("es-MX")}` : "—"}
    </span>
  );
}

// --- Columns definition ---
// Column order: # | ▶ | Fecha | Escuela | CCT | Dirección | Director | Tel. Director |
// Estado | Tipo | Cuota Alumno | Tarifa Base | Subsidio | Recaudación | Venta Bruta |
// Niños | Becados | Vuelos | 🗑

export const journeyColumns = [
  {
    id: "row_number",
    header: "#",
    cell: ({ row }) => <span className="text-xs text-muted-foreground/60 font-mono select-none">{row.index + 1}</span>,
    size: 40,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
  },
  {
    id: "expander",
    header: () => null,
    cell: ({ row }) => (
      <button onClick={row.getToggleExpandedHandler()} className="cursor-pointer p-1 rounded hover:bg-muted/70 transition-colors" title={row.getIsExpanded() ? "Colapsar vuelos" : "Ver vuelos"}>
        {row.getIsExpanded() ? "▼" : "▶"}
      </button>
    ),
    size: 40,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "date",
    header: "Fecha",
    cell: (props) => <EditableCell {...props} />,
    size: 110,
  },
  {
    accessorKey: "school_name",
    header: "Escuela",
    cell: (props) => <EditableCell {...props} />,
    size: 200,
  },
  {
    accessorKey: "cct",
    header: "CCT",
    cell: (props) => <EditableCell {...props} />,
    size: 120,
  },
  {
    accessorKey: "direccion",
    header: "Dirección",
    cell: (props) => <EditableCell {...props} />,
    size: 180,
  },
  {
    accessorKey: "nombre_director",
    header: "Director(a)",
    cell: (props) => <EditableCell {...props} />,
    size: 150,
  },
  {
    accessorKey: "telefono_director",
    header: "Tel. Director",
    cell: (props) => <EditableCell {...props} />,
    size: 120,
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: (props) => <StatusSelectCell {...props} />,
    size: 110,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "tipo_escuela",
    header: "Tipo",
    cell: (props) => <TipoEscuelaCell {...props} />,
    size: 90,
  },
  {
    accessorKey: "cuota_alumno",
    header: "Cuota Alumno",
    cell: (props) => <CurrencyCell {...props} />,
    size: 120,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("cuota_alumno")) || 0), 0);
      return <span className="font-bold text-sm">${sum.toLocaleString("es-MX")}</span>;
    },
  },
  {
    accessorKey: "tarifa_base",
    header: "Tarifa Base",
    cell: (props) => <CurrencyCell {...props} />,
    size: 120,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("tarifa_base")) || 0), 0);
      return <span className="font-bold text-sm">${sum.toLocaleString("es-MX")}</span>;
    },
  },
  // --- CALCULATED COLUMNS (UI-only, not in DB) ---
  {
    id: "subsidio_calc",
    header: "Subsidio",
    accessorFn: (row) => {
      const t = Number(row.tarifa_base) || 0;
      const c = Number(row.cuota_alumno) || 0;
      return t && c ? t - c : null;
    },
    cell: ({ getValue }) => <CalcCell value={getValue()} prefix="$" />,
    size: 110,
    enableColumnFilter: false,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("subsidio_calc")) || 0), 0);
      return <span className="font-bold text-sm">${sum.toLocaleString("es-MX")}</span>;
    },
  },
  {
    id: "recaudacion_calc",
    header: "Recaudación",
    accessorFn: (row) => {
      const c = Number(row.cuota_alumno) || 0;
      const n = Number(row.total_students) || 0;
      return c && n ? c * n : null;
    },
    cell: ({ getValue }) => <CalcCell value={getValue()} prefix="$" />,
    size: 130,
    enableColumnFilter: false,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("recaudacion_calc")) || 0), 0);
      return <span className="font-bold text-sm">${sum.toLocaleString("es-MX")}</span>;
    },
  },
  {
    id: "venta_bruta_calc",
    header: "Venta Bruta",
    accessorFn: (row) => {
      const t = Number(row.tarifa_base) || 0;
      const n = Number(row.total_students) || 0;
      return t && n ? t * n : null;
    },
    cell: ({ getValue }) => <CalcCell value={getValue()} prefix="$" />,
    size: 130,
    enableColumnFilter: false,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("venta_bruta_calc")) || 0), 0);
      return <span className="font-bold text-sm">${sum.toLocaleString("es-MX")}</span>;
    },
  },
  // --- METRIC COLUMNS ---
  {
    accessorKey: "total_students",
    header: "Niños",
    cell: (props) => <EditableCell {...props} />,
    size: 80,
    enableGlobalFilter: false,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("total_students")) || 0), 0);
      return <span className="font-bold text-sm">{sum.toLocaleString("es-MX")}</span>;
    },
  },
  {
    accessorKey: "becados",
    header: "Becados",
    cell: (props) => <EditableCell {...props} />,
    size: 80,
    enableGlobalFilter: false,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("becados")) || 0), 0);
      return <span className="font-bold text-sm">{sum.toLocaleString("es-MX")}</span>;
    },
  },
  {
    accessorKey: "total_flights",
    header: "Vuelos",
    cell: (props) => <EditableCell {...props} />,
    size: 80,
    enableGlobalFilter: false,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("total_flights")) || 0), 0);
      return <span className="font-bold text-sm">{sum.toLocaleString("es-MX")}</span>;
    },
  },
  {
    id: "actions",
    header: () => null,
    cell: (props) => <DeleteActionCell {...props} />,
    size: 50,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
  },
];
