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

const formatNumber = (val) =>
  new Intl.NumberFormat("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

// --- Turno dropdown cell ---
function TurnoSelectCell({ getValue, row, column, table }) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue || "");
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => setValue(initialValue || ""), [initialValue]);

  const handleChange = async (e) => {
    const nv = e.target.value || null;
    if (nv === value) return;
    setValue(nv || "");
    setIsSaving(true);
    try { await table.options.meta?.updateData(row.original.cct, column.id, nv); }
    catch { setValue(initialValue || ""); }
    finally { setIsSaving(false); }
  };

  return (
    <select value={value} onChange={handleChange} disabled={isSaving}
      className={`appearance-none cursor-pointer rounded-md px-2 py-0.5 text-xs font-medium border border-slate-200 outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 bg-white transition-all ${isSaving ? "opacity-50" : ""}`}>
      <option value="">—</option>
      <option value="MATUTINO">Matutino</option>
      <option value="VESPERTINO">Vespertino</option>
      <option value="NOCTURNO">Nocturno</option>
      <option value="DISCONTINUO">Discontinuo</option>
    </select>
  );
}

// --- Tipo dropdown cell ---
function TipoSelectCell({ getValue, row, column, table }) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue || "");
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => setValue(initialValue || ""), [initialValue]);

  const handleChange = async (e) => {
    const nv = e.target.value || null;
    if (nv === value) return;
    setValue(nv || "");
    setIsSaving(true);
    try { await table.options.meta?.updateData(row.original.cct, column.id, nv); }
    catch { setValue(initialValue || ""); }
    finally { setIsSaving(false); }
  };

  const colors = {
    "PRIVADO": "bg-violet-100 text-violet-800",
    "FEDERAL TRANSFERIDO": "bg-blue-100 text-blue-800",
  };

  return (
    <select value={value} onChange={handleChange} disabled={isSaving}
      className={`appearance-none cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium border-0 outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 transition-all ${colors[value] || "bg-gray-100 text-gray-800"} ${isSaving ? "opacity-50" : ""}`}>
      <option value="">—</option>
      <option value="PRIVADO">Privado</option>
      <option value="FEDERAL TRANSFERIDO">Federal Transferido</option>
    </select>
  );
}

// --- Delete action cell ---
function DeleteActionCell({ row, table }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const school = row.original;
  const label = school.nombre_escuela || school.cct;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await table.options.meta?.deleteRow(school.cct);
      setIsOpen(false);
    } catch {} finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md text-destructive hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none" disabled={isDeleting} title="Eliminar escuela">
        {isDeleting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive border-t-transparent" /> :
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
          <AlertDialogDescription>
            Esto eliminará la escuela <strong>&quot;{label}&quot;</strong> (CCT: {school.cct}) <strong>permanentemente</strong>.
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

// --- Columns definition ---
export const escuelasColumns = [
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
    accessorKey: "cct",
    header: "CCT",
    cell: ({ getValue }) => (
      <span className="text-sm font-mono text-slate-700">{getValue() || "—"}</span>
    ),
    size: 140,
    enableGlobalFilter: true,
  },
  {
    accessorKey: "nombre_escuela",
    header: "Nombre de la Escuela",
    cell: (props) => <EditableCell {...props} />,
    size: 280,
    enableGlobalFilter: true,
  },
  {
    accessorKey: "tipo",
    header: "Tipo",
    cell: (props) => <TipoSelectCell {...props} />,
    size: 160,
    enableGlobalFilter: true,
  },
  {
    accessorKey: "ninos",
    header: "Niños",
    cell: (props) => <EditableCell {...props} />,
    size: 90,
    enableGlobalFilter: false,
    footer: ({ table }) => {
      const sum = table.getFilteredRowModel().rows.reduce((s, r) => s + (Number(r.getValue("ninos")) || 0), 0);
      return <span className="font-bold text-sm">{formatNumber(sum)}</span>;
    },
  },
  {
    accessorKey: "codigo_postal",
    header: "C.P.",
    cell: (props) => <EditableCell {...props} />,
    size: 90,
    enableGlobalFilter: true,
  },
  {
    accessorKey: "turno",
    header: "Turno",
    cell: (props) => <TurnoSelectCell {...props} />,
    size: 130,
    enableGlobalFilter: false,
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
