"use client";

import { NativeSelectCell, EditableTimeCell } from "./editable-cell";

export const eventsColumns = [
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
    accessorKey: "fecha",
    header: "Fecha de Turno",
    cell: ({ row }) => (
      <span className="font-semibold text-slate-700 text-sm whitespace-nowrap capitalize">
        {row.original.fecha}
      </span>
    ),
    size: 200,
    enableGlobalFilter: true,
    meta: { sticky: true, stickyLeft: 40, stickyBorder: true },
  },
  {
    accessorKey: "escuela",
    header: "Escuela / Colegio",
    cell: ({ row }) => (
      <span className="font-medium text-slate-500 text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] inline-block" title={row.original.escuela}>
        {row.original.escuela}
      </span>
    ),
    size: 160,
    enableGlobalFilter: true,
  },
  {
    accessorKey: "staff_name",
    header: "Personal Operativo",
    cell: ({ row }) => (
      <span className="font-bold text-slate-800 text-sm whitespace-nowrap">
        {row.original.staff_name || "Desconocido"}
      </span>
    ),
    size: 180,
    enableGlobalFilter: true,
  },
  {
    id: "hora_entrada",
    accessorKey: "hora_entrada",
    header: "🚶‍♂️ Entrada",
    cell: EditableTimeCell,
    size: 110,
  },
  {
    id: "hora_salida",
    accessorKey: "hora_salida",
    header: "🏃 Salida",
    cell: EditableTimeCell,
    size: 110,
  },
  {
    accessorKey: "uniforme_valido",
    header: "👕 Uniforme",
    cell: NativeSelectCell,
    size: 100,
  },
  {
    accessorKey: "gafete_valido",
    header: "🪪 Gafete",
    cell: NativeSelectCell,
    size: 100,
  },
  {
    accessorKey: "app_lista",
    header: "📱 App Lista",
    cell: NativeSelectCell,
    size: 100,
  }
];
