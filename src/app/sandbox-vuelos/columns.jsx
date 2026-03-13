"use client";

import { EditableCell } from "./editable-cell";

// Helper: format ISO timestamp → readable "13 Mar 2026, 14:30"
function formatTimestamp(val) {
  if (!val) return "—";
  try {
    return new Date(val).toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return val;
  }
}

// Helper: format seconds → "5m 30s"
function formatDuration(sec) {
  if (sec === null || sec === undefined) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export const columns = [
  {
    accessorKey: "mission_id",
    header: "Misión",
    cell: (props) => <EditableCell {...props} />,
  },
  {
    accessorKey: "journey_id",
    header: "Journey",
    cell: ({ getValue }) => {
      const v = getValue();
      return (
        <span className="text-muted-foreground font-mono text-xs" title={v}>
          {v ? v.slice(0, 8) + "…" : "—"}
        </span>
      );
    },
    enableGlobalFilter: false,
  },
  {
    accessorKey: "student_count",
    header: "Alumnos",
    cell: (props) => <EditableCell {...props} />,
  },
  {
    accessorKey: "duration_seconds",
    header: "Duración",
    cell: (props) => <EditableCell {...props} />,
    // Show formatted duration in the filter, but edit raw seconds
  },
  {
    accessorKey: "start_time",
    header: "Hora Inicio",
    cell: ({ getValue }) => (
      <span className="text-sm">{formatTimestamp(getValue())}</span>
    ),
    enableGlobalFilter: false,
  },
  {
    accessorKey: "end_time",
    header: "Hora Fin",
    cell: ({ getValue }) => (
      <span className="text-sm">{formatTimestamp(getValue())}</span>
    ),
    enableGlobalFilter: false,
  },
  {
    accessorKey: "created_at",
    header: "Creado",
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground">
        {formatTimestamp(getValue())}
      </span>
    ),
    enableGlobalFilter: false,
  },
];
