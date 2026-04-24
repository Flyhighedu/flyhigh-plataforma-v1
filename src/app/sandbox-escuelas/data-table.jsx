"use client";

import { useState, Fragment, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
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
const INTEGER_COLS = new Set(["ninos"]);
const WIDE_COLS = { nombre_escuela: 36, cct: 18, codigo_postal: 10, tipo: 22, turno: 14, estado_pipeline: 32 };

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

export function DataTable({ columns, data, onUpdateRow, onDeleteRow, onCreateRow }) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState([]);
  const [sorting, setSorting] = useState([]);
  const [columnSizing, setColumnSizing] = useState({});

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, columnFilters, sorting, columnSizing },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
    getRowId: (row) => row.cct,
    meta: {
      updateData: onUpdateRow,
      deleteRow: onDeleteRow,
    },
  });

  // Professional Excel export — with native dropdowns, totals, and conditional formatting
  const handleExportExcel = useCallback(async () => {
    try {
      const mod = await import("xlsx-js-style");
      const XLSX = mod.default || mod;

      const visibleCols = table.getAllLeafColumns().filter(
        (col) => !["row_number", "actions"].includes(col.id)
      );
      const headers = visibleCols.map((col) => {
        const def = col.columnDef;
        return typeof def.header === "string" ? def.header : col.id;
      });

      const ws = {};
      let R = 0;
      const C = visibleCols.length;

      const writeRow = (rowIdx, cells) => {
        cells.forEach((cell, ci) => {
          const ref = XLSX.utils.encode_cell({ r: rowIdx, c: ci });
          ws[ref] = cell;
        });
      };

      // Pipeline state labels for Excel display
      const PIPELINE_LABELS = {
        sin_contacto: '□□□□□□□□ Sin contacto (0/8)',
        llamada_sin_respuesta: '■□□□□□□□ Llamada sin respuesta (1/8)',
        contactada: '■■□□□□□□ En conversación (2/8)',
        cita_ventas: '■■■□□□□□ Presentación Agendada (3/8)',
        agendada: '■■■■□□□□ Agendada (4/8)',
        en_preparacion: '■■■■■□□□ En preparación (5/8)',
        en_ruta: '■■■■■■□□ En ruta (6/8)',
        operando: '■■■■■■■□ Operando (7/8)',
        visitada: '■■■■■■■■ Completada ✓ (8/8)',
        perdida: '×××××××× Perdida ✗',
      };

      // Pipeline state fill colors for conditional formatting
      const PIPELINE_FILLS = {
        sin_contacto: null,
        llamada_sin_respuesta: { fgColor: { rgb: "FDBA74" } }, // orange-300
        contactada: { fgColor: { rgb: "DBEAFE" } },    // light blue
        cita_ventas: { fgColor: { rgb: "DDD6FE" } },   // violet-200
        agendada: { fgColor: { rgb: "BFDBFE" } },      // blue
        en_preparacion: { fgColor: { rgb: "FEF3C7" } }, // light amber
        en_ruta: { fgColor: { rgb: "FDE68A" } },        // amber
        operando: { fgColor: { rgb: "FCD34D" } },       // dark amber
        visitada: { fgColor: { rgb: "D1FAE5" } },       // light green
        perdida: { fgColor: { rgb: "FECACA" } },        // light red
      };

      // Header row
      writeRow(R, headers.map((h) => ({ v: h, t: "s", s: HEADER_STYLE })));
      R++;

      // Data rows
      const rows = table.getFilteredRowModel().rows;
      for (const row of rows) {
        const parentCells = visibleCols.map((col) => {
          let val = row.getValue(col.id);
          const isInt = INTEGER_COLS.has(col.id);
          let t = "s", s = { ...CELL_BASE };

          if (isInt) {
            val = val != null && val !== "" ? Number(val) : 0;
            t = "n";
            s.numFmt = "#,##0";
          }

          // Pipeline column: show human-readable label + conditional fill
          if (col.id === "estado_pipeline") {
            const pipelineKey = val || "sin_contacto";
            val = PIPELINE_LABELS[pipelineKey] || PIPELINE_LABELS.sin_contacto;
            const fill = PIPELINE_FILLS[pipelineKey];
            if (fill) s.fill = fill;
          }

          if ((R - 1) % 2 === 1 && !s.fill) s.fill = { fgColor: { rgb: "F1F5F9" } };

          return { v: val ?? "", t, s };
        });
        writeRow(R, parentCells);
        R++;
      }

      // --- Footer row: Totals ---
      const FOOTER_STYLE = {
        font: { bold: true, sz: 11, name: "Calibri", color: { rgb: "1E3A8A" } },
        fill: { fgColor: { rgb: "E2E8F0" } },
        alignment: { vertical: "center" },
        border: { top: { style: "medium", color: { rgb: "1E3A8A" } } },
      };

      const footerCells = visibleCols.map((col, ci) => {
        const colLetter = XLSX.utils.encode_col(ci);

        if (col.id === "nombre_escuela") {
          return { v: "TOTALES", t: "s", s: FOOTER_STYLE };
        }

        if (col.id === "ninos") {
          // SUM formula for niños column
          return { f: `SUM(${colLetter}2:${colLetter}${R})`, t: "n", s: { ...FOOTER_STYLE, numFmt: "#,##0" } };
        }

        if (col.id === "estado_pipeline") {
          // COUNTIF for completed schools  
          const completedLabel = PIPELINE_LABELS.visitada;
          return {
            f: `COUNTIF(${colLetter}2:${colLetter}${R},"${completedLabel}")&"/"&COUNTA(${colLetter}2:${colLetter}${R})&" completadas"`,
            t: "s",
            s: { ...FOOTER_STYLE, font: { ...FOOTER_STYLE.font, color: { rgb: "059669" } } }
          };
        }

        return { v: "", t: "s", s: FOOTER_STYLE };
      });
      writeRow(R, footerCells);
      R++;

      // --- Sheet metadata ---
      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: R - 1, c: C - 1 } });
      ws["!cols"] = visibleCols.map((col) => ({
        wch: WIDE_COLS[col.id] || 12,
      }));

      // Autofilter on header row
      const lastColLetter = XLSX.utils.encode_col(C - 1);
      ws["!autofilter"] = { ref: `A1:${lastColLetter}1` };

      // --- Native Excel Data Validation (Dropdowns) ---
      const dataValidations = [];
      const lastDataRow = R - 1; // exclude footer

      visibleCols.forEach((col, ci) => {
        const colLetter = XLSX.utils.encode_col(ci);
        const range = `${colLetter}2:${colLetter}${lastDataRow}`;

        if (col.id === "turno") {
          dataValidations.push({
            sqref: range,
            type: "list",
            formula1: '"MATUTINO,VESPERTINO,NOCTURNO,DISCONTINUO"',
          });
        }

        if (col.id === "tipo") {
          dataValidations.push({
            sqref: range,
            type: "list",
            formula1: '"PRIVADO,FEDERAL TRANSFERIDO"',
          });
        }

        if (col.id === "estado_pipeline") {
          const labels = Object.values(PIPELINE_LABELS).join(",");
          dataValidations.push({
            sqref: range,
            type: "list",
            formula1: `"${labels}"`,
          });
        }
      });

      if (dataValidations.length > 0) {
        ws["!dataValidation"] = dataValidations;
      }

      // --- Build and save workbook ---
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Catálogo Escuelas");

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      const fileSaverModule = await import("file-saver");
      const saveAs = fileSaverModule.default?.saveAs || fileSaverModule.saveAs || fileSaverModule.default;

      saveAs(blob, `FlyHigh_Catalogo_Escuelas_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Excel export error:", err);
      alert("Error al exportar: " + err.message);
    }
  }, [table]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input placeholder="Buscar por escuela, CCT, C.P.…" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="max-w-sm h-9" />
        <span className="text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} escuelas</span>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Table Wrapper */}
      <div className="rounded-lg border bg-slate-50/50">
        <div className="min-w-max bg-card pb-2">
          <Table style={{ width: table.getCenterTotalSize() }}>
            <TableHeader className="sticky top-0 z-20 bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.08)]">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <TableHead key={header.id} className="bg-white relative group select-none" style={{ width: header.getSize() }}>
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
                  ))}
                </TableRow>
              ))}
              <TableRow className="bg-slate-50/80">
                {table.getAllLeafColumns().map((col) => (
                  <TableHead key={col.id} className="py-1 px-1 bg-slate-50/80" style={{ width: col.getSize() }}>
                    {col.id === "visitada" ? (
                      <select
                        value={(col.getFilterValue() ?? "")}
                        onChange={(e) => col.setFilterValue(e.target.value || undefined)}
                        className="w-full h-6 text-xs border rounded px-1 bg-white outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
                      >
                        <option value="">Todas</option>
                        <option value="si">✅ Visitadas</option>
                        <option value="no">⭕ Pendientes</option>
                      </select>
                    ) : col.getCanFilter() ? (
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
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
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
                  {fg.headers.map((header) => (
                    <TableCell key={header.id} style={{ width: header.getSize() }} className="py-2.5 font-semibold text-slate-800 border-t border-slate-200">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableFooter>
          </Table>
        </div>
      </div>
    </div>
  );
}
