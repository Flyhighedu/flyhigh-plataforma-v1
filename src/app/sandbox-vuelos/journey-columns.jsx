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

const statusColors = {
  pending: "bg-slate-100 text-slate-800 border border-slate-200",
  arrived: "bg-sky-100 text-sky-800",
  setup: "bg-amber-100 text-amber-800",
  briefing: "bg-indigo-100 text-indigo-800",
  boarding: "bg-blue-100 text-blue-800",
  flight: "bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200 shadow-sm",
  deboarding: "bg-teal-100 text-teal-800",
  wrapup: "bg-orange-100 text-orange-800",
  closed: "bg-green-100 text-green-800 font-bold border border-green-200",
  cancelled: "bg-red-100 text-red-800",
};

const STATUS_LABELS = {
  pending: "Pendiente (Esperando)",
  arrived: "✅ En Sitio",
  setup: "🔧 Armando Equipo",
  briefing: "👨‍🏫 Capacitación",
  boarding: "🥽 Abordaje (Lentes)",
  flight: "🚀 Volando Play",
  deboarding: "👋 Desabordaje",
  wrapup: "📦 Desmontaje",
  closed: "🔒 CERRADA",
  cancelled: "❌ Cancelada",
};

// Formatters for exact values (no rounding to integers)
const formatMoneyExact = (val) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);
const formatNumberExact = (val) => new Intl.NumberFormat("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);

// --- Shared inline cell components ---

function StatusTelemetryCell({ getValue, row }) {
  const value = getValue() || "pending";
  const colors = statusColors[value] || statusColors.pending;
  const label = STATUS_LABELS[value] || value;
  
  return (
    <div className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold select-none ring-1 ring-inset ring-black/5 ${colors}`} title={`Telemetría de la PWA: ${label}`}>
      {label}
    </div>
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
      {value != null && value !== "" ? <span className="text-sm font-medium">{formatMoneyExact(Number(value))}</span> : <span className="text-muted-foreground italic text-sm">—</span>}
    </div>
  );
}

function ForceCloseActionCell({ row, table }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const journey = row.original;
  const isClosed = journey.status === "closed";

  const forceClose = async () => {
    setIsSaving(true);
    try {
      await table.options.meta?.updateData(journey.id, 'status', 'closed');
      setIsOpen(false);
    } catch {} finally { setIsSaving(false); }
  };

  if (isClosed) {
    return <span className="text-[10px] w-8 h-8 flex items-center justify-center opacity-50 cursor-pointer text-green-700" title="Misión Cerrada">✅</span>;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger 
        className="text-[12px] w-8 h-8 flex items-center justify-center rounded-md bg-stone-100/50 text-stone-600 hover:bg-red-100 hover:text-red-700 transition-colors shadow-sm ring-1 ring-stone-200 hover:ring-red-200 outline-none cursor-pointer" 
        title="Cierre Forzoso de Misión"
      >
        🔒
      </AlertDialogTrigger>
      <AlertDialogContent className="shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-stone-900">
            Cierre Administrativo Forzoso
          </AlertDialogTitle>
          <div className="space-y-4 text-stone-600 text-sm">
            <AlertDialogDescription className="block m-0">
              Estás a punto de liquidar unilateralmente la misión en la escuela <strong>{journey.school_name}</strong>.
            </AlertDialogDescription>
            <div className="bg-red-50 text-red-700 p-3 rounded-md border border-red-200 font-medium">
              ⚠️ Cuidado: Esta acción removerá automáticamente a la escuela del Cronograma y sobrescribirá la tablet de la PWA. Úsalo ÚNICAMENTE si el equipo olvidó cerrarla o hubo problemas técnicos graves en campo.
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white">Abortar</AlertDialogCancel>
          <AlertDialogAction disabled={isSaving} onClick={(e) => { e.preventDefault(); forceClose(); }} className="bg-red-600 hover:bg-red-700 text-white border-0 transition-colors shadow-sm">
            {isSaving ? "Calculando y Cerrando..." : "Sí, Forzar Cierre"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteActionCell({ row, table }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const journey = row.original;
  const label = journey.school_name || journey.date || journey.id.slice(0, 8);

  const handleDelete = async () => {
    setIsDeleting(true);
    try { 
      await table.options.meta?.deleteRow(journey.id); 
      setIsOpen(false);
    } catch {} finally { 
      setIsDeleting(false); 
      setConfirmText("");
    }
  };

  const isConfirmed = confirmText.trim().toUpperCase() === "ELIMINAR";

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) setConfirmText(""); }}>
      <AlertDialogTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 border border-transparent rounded-md text-destructive hover:text-white hover:bg-destructive transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none" disabled={isDeleting} title="Limpieza Profunda (Tierra Arrasada)">
        {isDeleting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> :
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>}
      </AlertDialogTrigger>
      <AlertDialogContent className="border-destructive/20 bg-background/95 backdrop-blur shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Limpieza Forense Irreversible
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600 text-sm block m-0">
            Estás a punto de aniquilar la estructura completa de la misión <strong>&quot;{label}&quot;</strong>.
          </AlertDialogDescription>
          <div className="w-full text-left space-y-3 pt-2">
            <ul className="list-disc pl-5 text-sm space-y-1 font-medium text-slate-700">
              <li>Todos los {journey.vuelo_count || 0} vuelos de la bitácora.</li>
              <li>Firmas digitales del cierre de misión.</li>
              <li><strong>Fotos grupal y de bitácora eliminadas físicamente de Storage.</strong></li>
              <li>Expedientes del personal (Eventos, Fotos, Asistencia).</li>
            </ul>
            <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm font-semibold border border-destructive/20">
              Esta acción de Nivel 5 es permanente y no hay papelera de reciclaje.
            </div>
            
            <div className="pt-2 w-full">
              <label className="text-sm font-semibold text-slate-800 mb-1.5 block">
                Escribe <span className="text-destructive font-mono select-none">ELIMINAR</span> para detonar:
              </label>
              <input 
                type="text" 
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ELIMINAR"
                className="w-full h-10 px-3 py-2 text-base font-mono bg-background border rounded-md outline-none focus:ring-2 focus:ring-destructive focus:border-transparent transition-all"
                autoComplete="off"
              />
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel onClick={() => setConfirmText("")}>Cancelar</AlertDialogCancel>
          <button 
            type="button"
            onClick={handleDelete} 
            disabled={!isConfirmed || isDeleting}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Aniquilando datos..." : "Ejecutar Purga Definitiva"}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// --- Calculated read-only cell ---
function CalcCell({ value, prefix = "" }) {
  return (
    <span className="text-sm font-medium text-slate-500 italic">
      {value != null ? (prefix === "$" ? formatMoneyExact(Number(value)) : `${prefix}${formatNumberExact(Number(value))}`) : "—"}
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
    meta: { sticky: true, stickyLeft: 0 },
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
    meta: { sticky: true, stickyLeft: 40 },
  },
  {
    accessorKey: "date",
    header: "Fecha",
    cell: (props) => <EditableCell {...props} />,
    size: 110,
    meta: { sticky: true, stickyLeft: 80 },
  },
  {
    accessorKey: "school_name",
    header: "Escuela",
    cell: (props) => <EditableCell {...props} />,
    size: 200,
    meta: { sticky: true, stickyLeft: 190, stickyBorder: true },
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
    accessorKey: "numero_sector",
    header: "Sector",
    cell: (props) => <EditableCell {...props} />,
    size: 90,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "numero_zona",
    header: "Zona",
    cell: (props) => <EditableCell {...props} />,
    size: 90,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "status",
    header: "Fase (Radar Ojo de Dios)",
    cell: (props) => <StatusTelemetryCell {...props} />,
    size: 150,
    enableGlobalFilter: false,
  },
  {
    id: "actions",
    header: () => null,
    cell: (props) => (
      <div className="flex items-center justify-end gap-1.5 w-full pr-1">
        <ForceCloseActionCell {...props} />
        <DeleteActionCell {...props} />
      </div>
    ),
    size: 90,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "tipo_escuela",
    header: "Tipo",
    cell: (props) => <TipoEscuelaCell {...props} />,
    size: 90,
  },
  // ═══ VOLUME INPUTS (Volumen) ═══
  {
    accessorKey: "total_students",
    header: "Alumnos Volados",
    cell: (props) => <EditableCell {...props} />,
    size: 80,
    enableGlobalFilter: false,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("total_students")) || 0), 0);
      return <span className="font-bold text-sm">{formatNumberExact(sum)}</span>;
    },
  },
  {
    accessorKey: "vuelo_count",
    header: "Vuelos",
    cell: ({ getValue }) => <span className="text-sm tabular-nums">{getValue() || 0}</span>,
    size: 70,
    enableGlobalFilter: false,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("vuelo_count")) || 0), 0);
      return <span className="font-bold text-sm">{formatNumberExact(sum)}</span>;
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
      return <span className="font-bold text-sm">{formatNumberExact(sum)}</span>;
    },
  },
  // ═══ UNIT PRICE INPUTS (Unitarios) ═══
  {
    accessorKey: "tarifa_base",
    header: "Tarifa Base",
    cell: (props) => <CurrencyCell {...props} />,
    size: 120,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("tarifa_base")) || 0), 0);
      return <span className="font-bold text-sm">{formatMoneyExact(sum)}</span>;
    },
  },
  {
    accessorKey: "cuota_alumno",
    header: "Cuota Alumno",
    cell: (props) => <CurrencyCell {...props} />,
    size: 120,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("cuota_alumno")) || 0), 0);
      return <span className="font-bold text-sm">{formatMoneyExact(sum)}</span>;
    },
  },
  // ═══ CALCULATED COLUMNS — read-only, exact arithmetic, no rounding ═══
  // Subtotales → Gran Total. meta.isCalculated applies bg-slate-100 styling.
  {
    id: "subsidio_calc",
    header: "Subsidio por Niño",
    accessorFn: (row) => {
      const t = Number(row.tarifa_base);
      const c = Number(row.cuota_alumno);
      if (!Number.isFinite(t) || !Number.isFinite(c) || t === 0) return null;
      return t - c;
    },
    cell: ({ getValue }) => <CalcCell value={getValue()} prefix="$" />,
    size: 140,
    enableColumnFilter: false,
    meta: { isCalculated: true },
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("subsidio_calc")) || 0), 0);
      return <span className="font-bold text-sm text-slate-500 italic">{formatMoneyExact(sum)}</span>;
    },
  },
  {
    id: "recaudacion_calc",
    header: "Recaudación",
    // (Total Niños − Becados) × Cuota Alumno
    accessorFn: (row) => {
      const n = Number(row.total_students);
      const b = Number(row.becados) || 0;
      const c = Number(row.cuota_alumno);
      if (!Number.isFinite(n) || !Number.isFinite(c) || n === 0) return null;
      return (n - b) * c;
    },
    cell: ({ getValue }) => <CalcCell value={getValue()} prefix="$" />,
    size: 130,
    enableColumnFilter: false,
    meta: { isCalculated: true },
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("recaudacion_calc")) || 0), 0);
      return <span className="font-bold text-sm text-slate-500 italic">{formatMoneyExact(sum)}</span>;
    },
  },
  {
    id: "costo_total_becados",
    header: "Costo Total Becados",
    // Becados × Tarifa Base
    accessorFn: (row) => {
      const b = Number(row.becados);
      const t = Number(row.tarifa_base);
      if (!Number.isFinite(b) || !Number.isFinite(t) || b === 0 || t === 0) return null;
      return b * t;
    },
    cell: ({ getValue }) => <CalcCell value={getValue()} prefix="$" />,
    size: 150,
    enableColumnFilter: false,
    meta: { isCalculated: true },
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("costo_total_becados")) || 0), 0);
      return <span className="font-bold text-sm text-slate-500 italic">{formatMoneyExact(sum)}</span>;
    },
  },
  {
    id: "subsidio_total_calc",
    header: "Subsidio Total",
    // (Tarifa Base − Cuota Alumno) × (Total Niños − Becados)
    accessorFn: (row) => {
      const t = Number(row.tarifa_base);
      const c = Number(row.cuota_alumno);
      const n = Number(row.total_students);
      const b = Number(row.becados) || 0;
      if (!Number.isFinite(t) || !Number.isFinite(c) || !Number.isFinite(n) || t === 0 || n === 0) return null;
      return (t - c) * (n - b);
    },
    cell: ({ getValue }) => <CalcCell value={getValue()} prefix="$" />,
    size: 130,
    enableColumnFilter: false,
    meta: { isCalculated: true },
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("subsidio_total_calc")) || 0), 0);
      return <span className="font-bold text-sm text-slate-500 italic">{formatMoneyExact(sum)}</span>;
    },
  },
  {
    id: "aportacion_patrocinador",
    header: "Total Aportación Patrocinador",
    // (Becados × Tarifa) + ((Tarifa − Cuota) × (Niños − Becados))
    accessorFn: (row) => {
      const t = Number(row.tarifa_base);
      const c = Number(row.cuota_alumno);
      const n = Number(row.total_students);
      const b = Number(row.becados) || 0;
      if (!Number.isFinite(t) || !Number.isFinite(n) || t === 0 || n === 0) return null;
      const costoBecados = b * t;
      const subsidioNoBecados = (t - (Number.isFinite(c) ? c : 0)) * (n - b);
      return costoBecados + subsidioNoBecados;
    },
    cell: ({ getValue }) => <CalcCell value={getValue()} prefix="$" />,
    size: 180,
    enableColumnFilter: false,
    meta: { isCalculated: true },
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("aportacion_patrocinador")) || 0), 0);
      return <span className="font-bold text-sm text-slate-500 italic">{formatMoneyExact(sum)}</span>;
    },
  },
  {
    id: "venta_bruta_calc",
    header: "Venta Bruta",
    // Tarifa Base × Total Niños
    accessorFn: (row) => {
      const t = Number(row.tarifa_base);
      const n = Number(row.total_students);
      if (!Number.isFinite(t) || !Number.isFinite(n) || t === 0 || n === 0) return null;
      return t * n;
    },
    cell: ({ getValue }) => <CalcCell value={getValue()} prefix="$" />,
    size: 130,
    enableColumnFilter: false,
    meta: { isCalculated: true },
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("venta_bruta_calc")) || 0), 0);
      return <span className="font-bold text-sm text-slate-500 italic">{formatMoneyExact(sum)}</span>;
    },
  },
  // ═══ OPERATIONAL ═══
  {
    accessorKey: "total_flights",
    header: "Vuelos",
    cell: (props) => <EditableCell {...props} />,
    size: 80,
    enableGlobalFilter: false,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("total_flights")) || 0), 0);
      return <span className="font-bold text-sm">{formatNumberExact(sum)}</span>;
    },
  },
];
