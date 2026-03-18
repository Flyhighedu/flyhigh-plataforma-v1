"use client";

import { EditableCell } from "./editable-cell";

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatHour(val) {
  if (!val) return null;
  try {
    return new Date(val).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Mexico_City",
    });
  } catch {
    return null;
  }
}

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

function formatDuration(sec) {
  if (sec == null || sec === "") return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatGapMs(prevEndIso, curStartIso) {
  if (!prevEndIso || !curStartIso) return null;
  try {
    const ms = new Date(curStartIso).getTime() - new Date(prevEndIso).getTime();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  } catch {
    return null;
  }
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconClock({ size = 11 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="#888" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconTimer({ size = 11 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="#888" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="13" r="8" />
      <polyline points="12 9 12 13 15 15" />
      <line x1="9" y1="2" x2="15" y2="2" />
      <line x1="12" y1="2" x2="12" y2="5" />
    </svg>
  );
}

// ─── Shared Fallback ──────────────────────────────────────────────────────────

function Pending({ label = "Sin registro" }) {
  return (
    <span className="italic text-slate-400/80 text-[10px] leading-none" aria-label="Dato no disponible">
      {label}
    </span>
  );
}

function Dot() {
  return <span className="text-slate-300 text-[10px] select-none leading-none">•</span>;
}

// ─── Flight Summary Cell (NO Margen — moved to separator rows) ────────────────
/**
 * Vuelo N
 * Total: X (Niños: Y | Staff: Z)  •  [clock] Despegue: HH:MM
 */
function FlightSummaryCell({ row, table }) {
  const idx = row.index + 1;

  const rawStudents = row.original?.student_count;
  const rawStaff    = row.original?.staff_count;
  const rawStart    = row.original?.start_time;

  const students = rawStudents != null && rawStudents !== "" ? Number(rawStudents) : null;
  const staff    = rawStaff    != null && rawStaff    !== "" ? Number(rawStaff)    : null;
  const total    = students != null && staff != null
    ? students + staff
    : students ?? staff ?? null;
  const hora = formatHour(rawStart);

  return (
    <div className="flex flex-col gap-[3px] py-0.5 min-w-0 overflow-hidden">
      <span className="text-xs font-semibold text-slate-700 leading-tight truncate">
        Vuelo {idx}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap min-w-0 overflow-hidden">
        {total != null ? (
          <span className="text-[10px] text-slate-500 whitespace-nowrap leading-none">
            Total:{" "}
            <span className="font-medium text-slate-700">{total}</span>
            {" "}
            <span className="text-slate-400">
              (Niños:{" "}
              {students != null
                ? <span className="font-medium text-blue-600">{students}</span>
                : <Pending label="—" />}
              {" | "}
              Staff:{" "}
              {staff != null
                ? <span className="font-medium text-violet-600">{staff}</span>
                : <Pending label="—" />}
              )
            </span>
          </span>
        ) : (
          <Pending label="Sin datos" />
        )}

        <Dot />

        <span className="flex items-center gap-[3px] text-[10px] text-slate-500 whitespace-nowrap leading-none">
          <IconClock />
          <span className="text-slate-400">Despegue:</span>{" "}
          {hora != null
            ? <span className="font-medium text-slate-600">{hora}</span>
            : <Pending label="N/A" />}
        </span>
      </div>
    </div>
  );
}

// ─── Inter-flight Gap Separator Component ─────────────────────────────────────
/**
 * Rendered between two flight rows.
 * Height ≈ 40% of a normal row. Shows: [timer icon] Tiempo entre vuelos: Xm Xs
 */
export function FlightGapSeparator({ prevEnd, curStart, colSpan }) {
  const gap = formatGapMs(prevEnd, curStart);

  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0, border: "none" }}>
        <div
          className="flex items-center justify-start gap-1.5 bg-slate-50/80 border-y border-dashed border-slate-200/70 pl-4"
          style={{ height: 18, minHeight: 18, maxHeight: 18 }}
        >
          <IconTimer size={10} />
          {gap != null ? (
            <span className="text-[10px] text-slate-400 leading-none">
              Tiempo entre vuelos:{" "}
              <span className="font-medium text-amber-600">{gap}</span>
            </span>
          ) : (
            <span className="text-[10px] italic text-slate-300 leading-none">
              Tiempo N/A
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Column Definitions ───────────────────────────────────────────────────────

export const columns = [
  {
    id: "flight_summary",
    header: "Vuelo",
    cell: (props) => <FlightSummaryCell {...props} />,
    size: 260,
    enableSorting: false,
    enableColumnFilter: false,
    enableGlobalFilter: false,
    enableResizing: true,
  },
  {
    accessorKey: "student_count",
    header: "Niños",
    cell: (props) => <EditableCell {...props} />,
    size: 68,
    enableGlobalFilter: false,
    enableResizing: true,
  },
  {
    accessorKey: "staff_count",
    header: "Staff",
    cell: ({ getValue }) => {
      const val = getValue();
      return val != null && val !== ""
        ? <span className="text-sm text-violet-700 font-medium">{val}</span>
        : <Pending />;
    },
    size: 60,
    enableGlobalFilter: false,
    enableResizing: true,
  },
  {
    accessorKey: "duration_seconds",
    header: "Duración",
    cell: ({ getValue }) => {
      const val = getValue();
      return val != null && val !== ""
        ? <span className="text-sm tabular-nums">{formatDuration(val)}</span>
        : <Pending />;
    },
    size: 80,
    enableGlobalFilter: false,
    enableResizing: true,
  },
  {
    accessorKey: "start_time",
    header: "Inicio",
    cell: ({ getValue }) => {
      const hora = formatHour(getValue());
      return hora
        ? <span className="text-sm tabular-nums text-slate-600">{hora}</span>
        : <Pending />;
    },
    size: 70,
    enableGlobalFilter: false,
    enableResizing: true,
  },
  {
    accessorKey: "end_time",
    header: "Fin",
    cell: ({ getValue }) => {
      const hora = formatHour(getValue());
      return hora
        ? <span className="text-sm tabular-nums text-slate-600">{hora}</span>
        : <Pending />;
    },
    size: 70,
    enableGlobalFilter: false,
    enableResizing: true,
  },
  {
    accessorKey: "created_at",
    header: "Creado",
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground truncate block max-w-[130px]" title={getValue()}>
        {formatTimestamp(getValue())}
      </span>
    ),
    size: 130,
    enableGlobalFilter: false,
    enableResizing: true,
  },
];
