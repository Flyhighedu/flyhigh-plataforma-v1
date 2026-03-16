"use client";

import { useState, Fragment, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GhostRow } from "./ghost-row";

// Column sets for Excel formatting
const CURRENCY_COLS = new Set(["costo_por_nino", "tarifa_base", "cuota_alumno", "subsidio_patrocinador"]);
const INTEGER_COLS = new Set(["total_students", "becados", "total_flights"]);
const WIDE_COLS = { school_name: 30, colonia_comunidad: 24, cct: 18, date: 14 };

// Shared styles
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
const ZEBRA_FILL = { fgColor: { rgb: "F1F5F9" } };

export function DataTable({ columns, data, onUpdateRow, onDeleteRow, renderSubComponent, onCreateRow }) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [expanded, setExpanded] = useState({});

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, expanded },
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    getRowCanExpand: () => !!renderSubComponent,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    globalFilterFn: "includesString",
    meta: {
      updateData: onUpdateRow,
      deleteRow: onDeleteRow,
    },
  });

  // Professional Excel export with xlsx-js-style
  const handleExportExcel = useCallback(() => {
    import("xlsx-js-style").then((XLSX) => {
      const rows = table.getFilteredRowModel().rows;
      const visibleCols = table.getAllLeafColumns().filter(
        (col) => !["row_number", "expander", "actions"].includes(col.id)
      );

      const headers = visibleCols.map((col) => {
        const def = col.columnDef;
        return typeof def.header === "string" ? def.header : col.id;
      });

      // Build data matrix with styled cells
      const aoa = [];

      // Header row (styled)
      aoa.push(headers.map((h) => ({ v: h, t: "s", s: HEADER_STYLE })));

      // Data rows
      rows.forEach((row, rIdx) => {
        const rowCells = visibleCols.map((col) => {
          let val = row.getValue(col.id);
          const isCurrency = CURRENCY_COLS.has(col.id);
          const isInt = INTEGER_COLS.has(col.id);

          // Determine cell type and value
          let cellType = "s"; // string
          let cellValue = val ?? "";
          let numFmt = undefined;

          if (isCurrency) {
            cellValue = val != null && val !== "" ? Number(val) : null;
            cellType = cellValue != null ? "n" : "s";
            numFmt = '"$"#,##0.00';
            if (cellValue == null) cellValue = "";
          } else if (isInt) {
            cellValue = val != null && val !== "" ? Number(val) : 0;
            cellType = "n";
            numFmt = "#,##0";
          }

          // Build cell style
          const style = { ...CELL_BASE };
          if (rIdx % 2 === 1) style.fill = ZEBRA_FILL;
          if (numFmt) style.numFmt = numFmt;

          return { v: cellValue, t: cellType, s: style };
        });
        aoa.push(rowCells);
      });

      // Create worksheet from AOA
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Column widths
      ws["!cols"] = visibleCols.map((col) => ({
        wch: WIDE_COLS[col.id] || (CURRENCY_COLS.has(col.id) ? 16 : 12),
      }));

      // Freeze first row
      ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2" };
      // SheetJS panes format
      ws["!panes"] = [{ state: "frozen", ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" }];

      // Auto-filter
      const lastCol = XLSX.utils.encode_col(visibleCols.length - 1);
      ws["!autofilter"] = { ref: `A1:${lastCol}${rows.length + 1}` };

      // Create workbook and download
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Misiones");
      XLSX.writeFile(wb, `FlyHigh_Misiones_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
  }, [table]);

  return (
    <div className="space-y-4">
      {/* Toolbar: search + export */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Buscar en toda la tabla…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm h-9"
        />
        <span className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} registros
        </span>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Table — full height, native browser scroll, sticky header */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader className="sticky top-0 z-20 bg-white dark:bg-slate-900 shadow-[0_1px_3px_0_rgba(0,0,0,0.08)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    className="bg-white dark:bg-slate-900"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {/* Ghost Row — always on top */}
            {onCreateRow && (
              <GhostRow
                columnCount={columns.length}
                onCreateRow={onCreateRow}
              />
            )}

            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow className={row.getIsExpanded() ? "bg-muted/30 border-b-0" : ""}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
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
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No se encontraron resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
