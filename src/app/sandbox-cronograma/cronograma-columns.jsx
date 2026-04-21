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
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const formatMoney = (val) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);

const statusColors = {
  pendiente: "bg-blue-100 text-blue-800",
  completada: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800",
};

const STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "completada", label: "Completada" },
  { value: "cancelada", label: "Cancelada" }
];

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
      className={`text-xs font-semibold rounded-full px-2 py-1 outline-none appearance-none cursor-pointer text-center ${colors} ${isSaving ? "opacity-50" : ""}`}>
      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-white text-slate-900">{o.label}</option>)}
    </select>
  );
}

function DeleteActionCell({ row, table }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const item = row.original;
  const label = item.nombre_escuela || item.cct || `ID ${item.id}`;

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
        title="Eliminar registro"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
      </Button>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tierra Arrasada: Confirmar Destrucción</AlertDialogTitle>
            <div className="text-sm text-slate-500 space-y-2">
              <p>Estás a punto de borrar del cronograma a:</p>
              <p className="font-mono bg-slate-100 p-2 rounded break-all">{label} (ID: {item.id})</p>
              <p className="text-red-600 font-semibold mt-2">
                Advertencia: Esto borrará el registro físicamente. Si ya se operó y la misión está en bitácora de vuelos, podrías crear registros huérfanos.
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
            }} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
              {isDeleting ? "Borrando..." : "Destruir Registro"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const TURNO_OPTIONS = [
  { value: "", label: "No Definido" },
  { value: "Matutino", label: "Matutino" },
  { value: "Vespertino", label: "Vespertino" }
];

function TurnoSelectCell({ getValue, row, column, table }) {
  const normalizeTurno = (v) => {
    if (!v) return "";
    const lower = String(v).toLowerCase();
    if (lower.includes("matutino")) return "Matutino";
    if (lower.includes("vespertino")) return "Vespertino";
    return "";
  };
  const initialValue = normalizeTurno(getValue());
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => setValue(normalizeTurno(getValue())), [getValue()]);

  const handleChange = async (e) => {
    const nv = e.target.value;
    if (nv === value) return;
    setValue(nv);
    setIsSaving(true);
    try { await table.options.meta?.updateData(row.original.id, column.id, nv); }
    catch { setValue(initialValue || ""); }
    finally { setIsSaving(false); }
  };

  const isMatutino = value?.toLowerCase() === "matutino";
  const isVespertino = value?.toLowerCase() === "vespertino";
  let classes = "bg-slate-100 text-slate-600 border border-slate-200";
  if (isMatutino) classes = "bg-blue-50 text-blue-700 border border-blue-200";
  if (isVespertino) classes = "bg-orange-50 text-orange-700 border border-orange-200";

  return (
    <select value={value} onChange={handleChange} disabled={isSaving}
      className={`text-xs font-semibold rounded-md px-2 py-1.5 outline-none cursor-pointer text-center w-full transition-colors ${classes} ${isSaving ? "opacity-50" : ""}`}>
      {TURNO_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-white text-slate-900">{o.label}</option>)}
    </select>
  );
}

export const cronogramaColumns = [
  {
    accessorKey: "estatus",
    header: "Estatus",
    cell: StatusSelectCell,
    size: 130,
  },
  {
    accessorKey: "fecha_programada",
    header: "Fecha Obj.",
    cell: (props) => {
        // Render raw editable cell but with format
        const val = props.getValue();
        if (val) {
            return (
                <div className="flex flex-col">
                    <EditableCell {...props} />
                    <span className="text-[10px] text-muted-foreground">{format(new Date(val + 'T12:00:00Z'), "dd MMM", {locale: es})}</span>
                </div>
            )
        }
        return <EditableCell {...props} />
    },
    size: 130,
  },
  {
    accessorKey: "nombre_escuela",
    header: "Misión (Escuela)",
    cell: EditableCell,
    size: 300,
  },
  {
    accessorKey: "turno",
    header: "Turno",
    cell: TurnoSelectCell,
    size: 110,
  },
  {
    accessorKey: "cct",
    header: "CCT",
    cell: EditableCell,
    size: 120,
  },
  {
    accessorKey: "colonia",
    header: "Colonia / Fila",
    cell: EditableCell,
    size: 180,
  },
  {
    accessorKey: "tarifa_base",
    header: "Tarifa Fija",
    cell: (props) => {
      const val = props.getValue();
      return (
        <div className="flex items-center gap-1 font-mono text-sm">
          <span className="text-slate-400">$</span>
          <EditableCell {...props} />
        </div>
      );
    },
    size: 100,
  },
  {
    accessorKey: "cuota_alumno",
    header: "Cuota Alm.",
    cell: (props) => {
      const val = props.getValue();
      return (
        <div className="flex items-center gap-1 font-mono text-sm">
          <span className="text-slate-400">$</span>
          <EditableCell {...props} />
        </div>
      );
    },
    size: 100,
  },
  {
    accessorKey: "subsidio_patrocinador",
    header: "Subsidio Patroc.",
    cell: (props) => {
      const val = props.getValue();
      return (
        <div className="flex items-center gap-1 font-mono text-sm">
          <span className="text-slate-400">$</span>
          <EditableCell {...props} />
        </div>
      );
    },
    size: 130,
  },
  {
    accessorKey: "nombre_director",
    header: "Director",
    cell: EditableCell,
    size: 180,
  },
  {
    accessorKey: "numero_ninos",
    header: "# Niños",
    cell: EditableCell,
    size: 90,
  },
  {
    accessorKey: "telefono_director",
    header: "Tel Director",
    cell: EditableCell,
    size: 130,
  },
  {
    accessorKey: "nombre_maestro_delegado",
    header: "Delegado (Enlace)",
    cell: EditableCell,
    size: 180,
  },
  {
    accessorKey: "telefono_maestro_delegado",
    header: "Tel Delegado",
    cell: EditableCell,
    size: 130,
  },
  {
    accessorKey: "numero_zona",
    header: "Zona",
    cell: EditableCell,
    size: 80,
  },
  {
    accessorKey: "numero_sector",
    header: "Sector",
    cell: EditableCell,
    size: 80,
  },
  {
    accessorKey: "registrado_via",
    header: "Origen",
    cell: ({ getValue }) => <span className="text-xs text-slate-500 uppercase tracking-widest">{getValue()}</span>,
    size: 100,
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
