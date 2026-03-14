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

// Inline dropdown for status editing
function StatusSelectCell({ getValue, row, column, table }) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = async (e) => {
    const newValue = e.target.value;
    if (newValue === value) return;

    setValue(newValue); // optimistic
    setIsSaving(true);
    try {
      await table.options.meta?.updateData(row.original.id, column.id, newValue);
    } catch {
      setValue(initialValue); // revert
    } finally {
      setIsSaving(false);
    }
  };

  const colors = statusColors[value] || "bg-gray-100 text-gray-800";

  return (
    <select
      value={value || ""}
      onChange={handleChange}
      disabled={isSaving}
      className={`appearance-none cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium border-0 outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 transition-all ${colors} ${isSaving ? "opacity-50" : ""}`}
      title="Cambiar estado"
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// Delete action cell with AlertDialog
function DeleteActionCell({ row, table }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const journey = row.original;
  const label = journey.school_name || journey.date || journey.id.slice(0, 8);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await table.options.meta?.deleteRow(journey.id);
    } catch {
      // error already handled via toast in parent
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger
          className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          disabled={isDeleting}
          title="Eliminar journey"
        >
          {isDeleting ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />
            </svg>
          )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esto eliminará la misión <strong>&quot;{label}&quot;</strong> y todos
            los vuelos/evidencias asociados <strong>permanentemente desde la raíz</strong>.
            <br /><br />
            <span className="text-destructive font-medium">
              Esta acción no se puede deshacer.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            Sí, eliminar permanentemente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Inline dropdown for tipo_escuela (Pública / Privada)
function TipoEscuelaCell({ getValue, row, column, table }) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setValue(initialValue || "");
  }, [initialValue]);

  const handleChange = async (e) => {
    const newValue = e.target.value || null;
    if (newValue === value) return;

    setValue(newValue || "");
    setIsSaving(true);
    try {
      await table.options.meta?.updateData(row.original.id, column.id, newValue);
    } catch {
      setValue(initialValue || "");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={isSaving}
      className={`appearance-none cursor-pointer rounded-md px-2 py-0.5 text-xs font-medium border border-slate-200 outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 bg-white transition-all ${isSaving ? "opacity-50" : ""}`}
      title="Tipo de escuela"
    >
      <option value="">—</option>
      <option value="Pública">Pública</option>
      <option value="Privada">Privada</option>
    </select>
  );
}

// Inline currency input for costo_por_nino ($ prefix)
function CostoPorNinoCell({ getValue, row, column, table }) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const onSave = async () => {
    setIsEditing(false);
    if (value === initialValue) return;

    const numValue = value === "" || value === null ? null : Number(value);
    setIsSaving(true);
    try {
      await table.options.meta?.updateData(row.original.id, column.id, numValue);
    } catch {
      setValue(initialValue);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground font-medium">$</span>
        <input
          autoFocus
          type="number"
          min={0}
          value={value ?? ""}
          onChange={(e) => setValue(e.target.value)}
          onBlur={onSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") { setValue(initialValue); setIsEditing(false); }
          }}
          className="h-8 w-20 text-sm border rounded-md px-1 outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer rounded px-1 py-0.5 hover:bg-muted/70 transition-colors min-h-[28px] flex items-center ${isSaving ? "opacity-50" : ""}`}
      title="Clic para editar"
    >
      {value !== null && value !== undefined && value !== ""
        ? <span className="text-sm font-medium">${Number(value).toLocaleString("es-MX")}</span>
        : <span className="text-muted-foreground italic text-sm">—</span>}
    </div>
  );
}

export const journeyColumns = [
  {
    id: "row_number",
    header: "#",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground/60 font-mono select-none">
        {row.index + 1}
      </span>
    ),
    size: 36,
    enableGlobalFilter: false,
  },
  {
    id: "expander",
    header: () => null,
    cell: ({ row }) => (
      <button
        onClick={row.getToggleExpandedHandler()}
        className="cursor-pointer p-1 rounded hover:bg-muted/70 transition-colors"
        title={row.getIsExpanded() ? "Colapsar vuelos" : "Ver vuelos"}
      >
        {row.getIsExpanded() ? "▼" : "▶"}
      </button>
    ),
    size: 40,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "date",
    header: "Fecha",
    cell: (props) => <EditableCell {...props} />,
  },
  {
    accessorKey: "school_name",
    header: "Escuela",
    cell: (props) => <EditableCell {...props} />,
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: (props) => <StatusSelectCell {...props} />,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "tipo_escuela",
    header: "Tipo",
    cell: (props) => <TipoEscuelaCell {...props} />,
  },
  {
    accessorKey: "costo_por_nino",
    header: "Costo/Niño",
    cell: (props) => <CostoPorNinoCell {...props} />,
  },
  {
    accessorKey: "total_students",
    header: "Niños",
    cell: (props) => <EditableCell {...props} />,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "becados",
    header: "Becados",
    cell: (props) => <EditableCell {...props} />,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "total_flights",
    header: "Vuelos",
    cell: (props) => <EditableCell {...props} />,
    enableGlobalFilter: false,
  },
  {
    id: "actions",
    header: () => null,
    cell: (props) => <DeleteActionCell {...props} />,
    size: 50,
    enableGlobalFilter: false,
  },
];
