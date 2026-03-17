"use client";

import { useState, Fragment, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GhostRow } from "./ghost-row";

// Excel formatting constants
const CURRENCY_COLS = new Set(["cuota_alumno", "tarifa_base", "subsidio_calc", "recaudacion_calc", "venta_bruta_calc"]);
const INTEGER_COLS = new Set(["total_students", "becados", "total_flights"]);
const WIDE_COLS = { school_name: 30, direccion: 28, nombre_director: 22, cct: 18, date: 14, telefono_director: 16 };

const HEADER_STYLE = {
  fill: { fgColor: { rgb: "1E3A8A" } },
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11, name: "Calibri" },
  alignment: { horizontal: "center", vertical: "center" },
  border: { bottom: { style: "medium", color: { rgb: "0F2557" } } },
};
const CELL_BASE = {
  font: { sz: 10, name: "Calibri" },
  alignment: { vertical: "center" },
  border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } },
};
const SUB_HEADER_STYLE = {
  fill: { fgColor: { rgb: "3B82F6" } },
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 9, name: "Calibri" },
  alignment: { horizontal: "center", vertical: "center" },
};
const SUB_CELL_STYLE = {
  font: { sz: 9, name: "Calibri", color: { rgb: "475569" } },
  alignment: { vertical: "center" },
  fill: { fgColor: { rgb: "F8FAFC" } },
  border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } },
};

export function DataTable({ columns, data, onUpdateRow, onDeleteRow, renderSubComponent, onCreateRow, fetchAllSubRows }) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [sorting, setSorting] = useState([]);
  const [columnSizing, setColumnSizing] = useState({});

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, columnFilters, expanded, sorting, columnSizing },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    getRowCanExpand: () => !!renderSubComponent,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
    getRowId: (row) => row.id,
    meta: {
      updateData: onUpdateRow,
      deleteRow: onDeleteRow,
    },
  });

  // Professional Excel export with row grouping
  const handleExportExcel = useCallback(async () => {
    try {
      const mod = await import("xlsx-js-style");
      const XLSX = mod.default || mod;

      const visibleCols = table.getAllLeafColumns().filter(
        (col) => !["row_number", "expander", "actions"].includes(col.id)
      );
      const headers = visibleCols.map((col) => {
        const def = col.columnDef;
        return typeof def.header === "string" ? def.header : col.id;
      });

      // Build worksheet cell-by-cell for proper styling
      const ws = {};
      const outlineRows = [];
      let R = 0; // current row index (0-based)
      const C = visibleCols.length;

      // Helper: write a row of styled cells
      const writeRow = (rowIdx, cells) => {
        cells.forEach((cell, ci) => {
          const ref = XLSX.utils.encode_cell({ r: rowIdx, c: ci });
          ws[ref] = cell;
        });
      };

      // Header row (R=0)
      writeRow(R, headers.map((h) => ({ v: h, t: "s", s: HEADER_STYLE })));
      R++;

      // Pre-fetch all vuelos for grouping to avoid individual sequential fetches
      const vuelosByJourney = {};
      if (fetchAllSubRows) {
        try {
          const allVuelos = await fetchAllSubRows();
          allVuelos.forEach((v) => {
            if (!vuelosByJourney[v.journey_id]) vuelosByJourney[v.journey_id] = [];
            vuelosByJourney[v.journey_id].push(v);
          });
        } catch (e) {
          console.error("Error fetching all vuelos for export:", e);
        }
      }

      // Data rows
      const rows = table.getFilteredRowModel().rows;
      for (const row of rows) {
        // Parent row
        const parentCells = visibleCols.map((col) => {
          let val = row.getValue(col.id);
          const isCur = CURRENCY_COLS.has(col.id);
          const isInt = INTEGER_COLS.has(col.id);
          let t = "s", s = { ...CELL_BASE };

          if (isCur) {
            val = val != null && val !== "" ? Number(val) : null;
            t = val != null ? "n" : "s";
            s.numFmt = '"$"#,##0.00';
            if (val == null) val = "";
          } else if (isInt) {
            val = val != null && val !== "" ? Number(val) : 0;
            t = "n";
            s.numFmt = "#,##0";
          }

          // Zebra striping on even data rows
          if ((R - 1) % 2 === 1) s.fill = { fgColor: { rgb: "F1F5F9" } };

          return { v: val ?? "", t, s };
        });
        writeRow(R, parentCells);
        R++;

        // Add child vuelos (now from pre-fetched grouped map)
        const vuelos = vuelosByJourney[row.original.id];
        if (vuelos && vuelos.length > 0) {
          // Sub-header
          const subH = ["", "Vuelo #", "Alumnos", "Duración (s)", "Inicio", "Fin"];
          writeRow(R, visibleCols.map((_, ci) => ({ v: subH[ci] || "", t: "s", s: SUB_HEADER_STYLE })));
          outlineRows.push(R);
          R++;

          vuelos.forEach((v, vi) => {
            const vals = ["", vi + 1, v.student_count || 0, v.duration_seconds || 0, v.start_time || "", v.end_time || ""];
            writeRow(R, visibleCols.map((_, ci) => ({
              v: vals[ci] ?? "", t: typeof vals[ci] === "number" ? "n" : "s", s: SUB_CELL_STYLE,
            })));
            outlineRows.push(R);
            R++;
          });
        }
      }

      // Set sheet range
      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: R - 1, c: C - 1 } });

      // Column widths
      ws["!cols"] = visibleCols.map((col) => ({
        wch: WIDE_COLS[col.id] || (CURRENCY_COLS.has(col.id) ? 16 : 12),
      }));

      // Freeze header row
      ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2" };

      // Auto-filter
      const lastColLetter = XLSX.utils.encode_col(C - 1);
      ws["!autofilter"] = { ref: `A1:${lastColLetter}${R}` };

      // Outline levels for grouped sub-rows
      if (outlineRows.length > 0) {
        ws["!rows"] = [];
        for (const ri of outlineRows) {
          ws["!rows"][ri] = { level: 1, hidden: true };
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Misiones");
      
      // Native Blob download via file-saver ensures correct filenames
      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      
      const fileSaverModule = await import("file-saver");
      const saveAs = fileSaverModule.default?.saveAs || fileSaverModule.saveAs || fileSaverModule.default;
      
      saveAs(blob, `FlyHigh_Misiones_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Error al exportar: " + err.message);
    }
  }, [table, fetchAllSubRows]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input placeholder="Buscar en toda la tabla…" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="max-w-sm h-9" />
        <span className="text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} registros</span>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Table Wrapper for horizontal scroll background fix */}
      <div className="rounded-lg border bg-slate-50/50">
        <div className="min-w-max bg-card pb-2">
          <Table style={{ width: table.getCenterTotalSize() }}>
            <TableHeader className="sticky top-0 z-20 bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.08)]">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => {
                    const isCalc = header.column.columnDef.meta?.isCalculated;
                    return (
                    <TableHead key={header.id} className={`${isCalc ? "bg-slate-100" : "bg-white"} relative group select-none`} style={{ width: header.getSize() }}>
                      {header.isPlaceholder ? null : (
                        <div className={header.column.getCanSort() ? "cursor-pointer flex items-center gap-1" : ""} onClick={header.column.getToggleSortingHandler()}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className="text-muted-foreground/50 text-xs">
                              {{ asc: "↑", desc: "↓" }[header.column.getIsSorted()] ?? "↕"}
                            </span>
                          )}
                        </div>
                      )}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none opacity-0 group-hover:opacity-100 transition-opacity ${header.column.getIsResizing() ? "bg-blue-500 opacity-100" : "bg-slate-300"}`}
                        />
                      )}
                    </TableHead>
                  )})}
                </TableRow>
              ))}
              <TableRow className="bg-slate-50/80">
                {table.getAllLeafColumns().map((col) => (
                  <TableHead key={col.id} className="py-1 px-1 bg-slate-50/80" style={{ width: col.getSize() }}>
                    {col.getCanFilter() ? (
                      <input
                        value={(col.getFilterValue() ?? "")}
                        onChange={(e) => col.setFilterValue(e.target.value || undefined)}
                        placeholder="Filtrar…"
                        className="w-full h-6 text-xs border rounded px-1 bg-white outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    ) : null}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {onCreateRow && <GhostRow columnCount={columns.length} onCreateRow={onCreateRow} />}

              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <Fragment key={row.id}>
                    <TableRow className={row.getIsExpanded() ? "bg-muted/30 border-b-0" : ""}>
                      {row.getVisibleCells().map((cell) => {
                        const isCalc = cell.column.columnDef.meta?.isCalculated;
                        return (
                        <TableCell key={cell.id} style={{ width: cell.column.getSize() }} className={isCalc ? "bg-slate-100/80" : ""}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )})}
                    </TableRow>
                    {row.getIsExpanded() && renderSubComponent && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={row.getVisibleCells().length} className="p-0">
                          {renderSubComponent({ row })}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    No se encontraron resultados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>

            {/* Sticky Total Footer */}
            <TableFooter className="sticky bottom-0 z-20 bg-slate-100 shadow-[0_-1px_3px_0_rgba(0,0,0,0.08)]">
              {table.getFooterGroups().map((fg) => (
                <TableRow key={fg.id}>
                  {fg.headers.map((header) => {
                    const isCalc = header.column.columnDef.meta?.isCalculated;
                    return (
                    <TableCell key={header.id} style={{ width: header.getSize() }} className={`py-2.5 font-semibold text-slate-800 border-t border-slate-200 ${isCalc ? "bg-slate-200" : ""}`}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                    </TableCell>
                  )})}
                </TableRow>
              ))}
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
