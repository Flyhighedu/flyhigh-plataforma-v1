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
import { Copy } from 'lucide-react';

function RoleSelectCell({ getValue, row, column, table }) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue || "auxiliar");
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => setValue(initialValue || "auxiliar"), [initialValue]);

  const handleChange = async (e) => {
    const nv = e.target.value || null;
    if (nv === value) return;
    setValue(nv || "auxiliar");
    setIsSaving(true);
    try { await table.options.meta?.updateData(row.id, column.id, nv); }
    catch { setValue(initialValue || "auxiliar"); }
    finally { setIsSaving(false); }
  };

  const colors = {
    "admin": "bg-purple-100 text-purple-800",
    "pilot": "bg-amber-100 text-amber-800",
    "teacher": "bg-sky-100 text-sky-800",
    "assistant": "bg-rose-100 text-rose-800",
    "auxiliar": "bg-slate-100 text-slate-800",
  };

  return (
    <select value={value} onChange={handleChange} disabled={isSaving}
      className={`appearance-none cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-bold border-0 outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-400 transition-all ${colors[value] || "bg-gray-100 text-gray-800"} ${isSaving ? "opacity-50" : ""}`}>
      <option value="admin">Admin</option>
      <option value="pilot">Piloto</option>
      <option value="teacher">Teacher</option>
      <option value="assistant">Asistente</option>
      <option value="auxiliar">Auxiliar</option>
    </select>
  );
}

function ActiveToggleCell({ getValue, row, column, table }) {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue !== false);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => setValue(initialValue !== false), [initialValue]);

  const toggle = async () => {
    const nv = !value;
    setValue(nv);
    setIsSaving(true);
    try { await table.options.meta?.updateData(row.id, column.id, nv); }
    catch { setValue(initialValue !== false); }
    finally { setIsSaving(false); }
  };

  return (
    <button
      onClick={toggle}
      disabled={isSaving}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${value ? 'bg-emerald-500' : 'bg-slate-300'}`}
      role="switch"
      aria-checked={value}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${value ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  );
}

function DeleteActionCell({ row, table }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const staff = row.original;
  const label = staff.full_name || staff.id;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await table.options.meta?.deleteRow(staff.user_id || staff.id);
      setIsOpen(false);
    } catch {} finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none" disabled={isDeleting} title="Eliminar registro">
        {isDeleting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" /> :
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>DANGER: ¿Estás seguro de eliminar este perfil?</AlertDialogTitle>
          <AlertDialogDescription>
            Eliminarás el perfil operativo de <strong>&quot;{label}&quot;</strong> y todo su historial de misiones asociado.
            <br /><br /><span className="text-red-500 font-medium tracking-wide">ESTA ACCIÓN ES IRREVERSIBLE EN PRODUCCIÓN.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="font-bold border-slate-300 text-slate-600">Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-red-600 font-black text-white hover:bg-red-700 shadow-md">OBLITERAR PERFIL</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const hrColumns = [
  {
    id: "row_number",
    header: "#",
    cell: ({ row }) => <span className="text-[10px] text-muted-foreground/60 font-mono select-none">{row.index + 1}</span>,
    size: 40,
    enableResizing: false,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    meta: { sticky: true, stickyLeft: 0 },
  },
  {
    accessorKey: "full_name",
    header: "Personal Operativo",
    cell: (props) => <EditableCell {...props} />,
    size: 250,
    enableGlobalFilter: true,
    meta: { sticky: true, stickyLeft: 40, stickyBorder: true },
  },
  {
    accessorKey: "role",
    header: "Rol en Misión",
    cell: (props) => <RoleSelectCell {...props} />,
    size: 150,
    enableGlobalFilter: true,
  },
  {
    accessorKey: "is_active",
    header: "Inactivo / Activo",
    cell: (props) => <ActiveToggleCell {...props} />,
    size: 120,
    enableGlobalFilter: false,
  },
  {
    accessorKey: "phone",
    header: "Número Móvil",
    cell: (props) => <EditableCell {...props} />,
    size: 150,
    enableGlobalFilter: true,
  },
  {
    accessorKey: "email",
    header: "Correo Corporativo",
    cell: (props) => <EditableCell {...props} />,
    size: 200,
    enableGlobalFilter: true,
  },
  {
    id: "actions",
    header: () => null,
    cell: (props) => <DeleteActionCell {...props} />,
    size: 50,
    enableResizing: false,
    enableSorting: false,
  },
];
