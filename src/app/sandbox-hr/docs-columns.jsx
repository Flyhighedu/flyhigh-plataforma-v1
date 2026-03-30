"use client";

import { EditableCell } from "./editable-cell";
import { ExternalLink } from "lucide-react";

export const docsColumns = [
  {
    id: "document_type",
    header: "Documento",
    cell: ({ row }) => (
      <div className="font-bold text-xs uppercase text-slate-700 tracking-wider">
        {row.original.document_type}
      </div>
    ),
    size: 150,
  },
  {
    id: "status",
    header: "Validación (Aprobar)",
    cell: ({ row, table, column }) => {
      const val = row.original.status || "pending";
      const colors = {
        pending: "bg-amber-100 text-amber-700 ring-1 ring-amber-200",
        approved: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
        rejected: "bg-rose-100 text-rose-700 ring-1 ring-rose-200"
      };

      const handleChange = async (e) => {
        const newValue = e.target.value;
        if (newValue === val) return;
        try {
          // Pass the DOCTUMENT ID (row.original.id), not staff_id.
          // Wait, the HR API expects the row ID to update hr_documents!
          await table.options.meta?.updateData(row.original.id, "status", newValue);
        } catch (err) {
            console.error(err);
        }
      };

      return (
        <select 
          value={val} 
          onChange={handleChange}
          className={`appearance-none cursor-pointer rounded-full px-3 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-400 transition-all ${colors[val] || "bg-slate-100 text-slate-800"}`}
        >
          <option value="pending">En Revisión</option>
          <option value="approved">✔ Aprobado</option>
          <option value="rejected">❌ Rechazado</option>
        </select>
      );
    },
    size: 150,
  },
  {
    id: "expiration_date",
    accessorKey: "expiration_date",
    header: "Vencimiento (AAAA-MM-DD)",
    cell: EditableCell,
    size: 150,
  },
  {
    id: "file_url",
    header: "Archivo Físico",
    cell: ({ row }) => {
      const url = row.original.file_url;
      if (!url) return <span className="text-slate-300 italic text-[10px]">Sin adjunto</span>;
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:text-blue-700 transition-colors text-xs font-medium bg-blue-50 hover:bg-blue-100 p-1.5 rounded-md w-max">
          <ExternalLink size={12} />
          Ver Documento
        </a>
      );
    },
    size: 150,
  }
];
