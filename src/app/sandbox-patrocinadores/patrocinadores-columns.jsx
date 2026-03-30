"use client";

import { useState, useEffect } from "react";
import { EditableCell } from "./editable-cell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function DeleteActionCell({ row, table }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const item = row.original;
  const label = item.nombre || `ID ${item.id}`;

  const handleDelete = async () => {
    setIsDeleting(true);
    try { 
      await table.options.meta?.deleteRow(item.id); 
      setIsOpen(false);
    } catch {} finally { 
      setIsDeleting(false); 
    }
  };

  return (
    <>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={() => setIsOpen(true)}
        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" 
        title="Eliminar patrocinador"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
      </Button>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
            <div className="text-sm text-slate-500 space-y-2">
              <p>Estás a punto de borrar del padrón a:</p>
              <p className="font-mono bg-slate-100 p-2 rounded break-all">{label} (ID: {item.id})</p>
              <p className="text-red-600 font-semibold mt-2">
                Advertencia: Esto borrará el registro físicamente.
              </p>
              <p>Escribe <strong className="select-none">borrar</strong> para confirmar.</p>
            </div>
          </AlertDialogHeader>
          <div className="my-2">
            <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
              className="w-full border p-2 rounded focus:outline-none focus:ring-1 focus:ring-red-500 font-mono text-center uppercase"
              placeholder="Escribe BORRAR" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => {
              e.preventDefault();
              if (confirmText.trim().toLowerCase() !== "borrar") {
                toast.error("Confirmación incorrecta", { description: "Debes escribir 'borrar' para continuar." });
                return;
              }
              handleDelete();
            }} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeleting ? "Borrando..." : "Destruir Registro"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export const patrocinadoresColumns = [
  {
    accessorKey: "created_at",
    header: "Fecha Integración",
    cell: ({ getValue }) => {
        const val = getValue();
        if (!val) return <span className="text-slate-400">-</span>;
        return <span className="text-xs font-mono">{format(new Date(val), "dd MMM yyyy", {locale: es})}</span>;
    },
    size: 130,
  },
  {
    accessorKey: "nombre",
    header: "Razón Social / Nombre",
    cell: EditableCell,
    size: 350,
  },
  {
    accessorKey: "email",
    header: "Correo Contacto",
    cell: EditableCell,
    size: 350,
  },
  {
    accessorKey: "password",
    header: "Contraseña",
    cell: EditableCell,
    size: 180,
  },
  {
    accessorKey: "aportacion_total",
    header: "Inversión ($ MXN)",
    cell: (props) => {
      return (
        <div className="flex items-center gap-1">
          <span className="text-slate-400 text-sm">$</span>
          <EditableCell {...props} />
        </div>
      );
    },
    size: 180,
  },
  {
    id: "actions",
    header: "",
    cell: DeleteActionCell,
    size: 50,
    enableSorting: false,
    enableResizing: false,
  },
];
