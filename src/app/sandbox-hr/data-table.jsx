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
  TableFooter, // Added just in case future columns need a footer
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { GhostRow } from "./ghost-row";

export function DataTable({ columns, data, onUpdateRow, onDeleteRow, renderSubComponent, onCreateRow, onCreateCheckout, onRefreshData }) {
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
    getRowId: (row) => row.id || row.user_id,
    meta: {
      updateData: onUpdateRow,
      deleteRow: onDeleteRow,
      createCheckout: onCreateCheckout,
      refreshData: onRefreshData,
    },
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input placeholder="Buscar en toda la tabla…" value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="max-w-sm h-9" />
        <span className="text-sm text-muted-foreground">{table.getFilteredRowModel().rows.length} registros</span>
      </div>

      {/* Identical full width without scroll hide natively */}
      <div className="w-full">
        <div className="bg-card w-full">
          <Table style={{ width: table.getCenterTotalSize(), tableLayout: 'fixed' }}>
            <TableHeader className="sticky top-0 z-20 bg-white shadow-[0_1px_3px_0_rgba(0,0,0,0.08)]">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => {
                    const isSticky = header.column.columnDef.meta?.sticky;
                    const stickyLeft = header.column.columnDef.meta?.stickyLeft;
                    const stickyBorder = header.column.columnDef.meta?.stickyBorder;
                    const stickyStyle = isSticky ? { position: 'sticky', left: stickyLeft, zIndex: 30 } : {};
                    const stickyClass = isSticky ? 'bg-white' : '';
                    const borderClass = stickyBorder ? 'border-r-2 border-slate-300' : '';
                    const sizeStyle = { width: header.getSize(), minWidth: header.getSize(), maxWidth: header.getSize() };
                    return (
                    <TableHead key={header.id} className={`bg-white relative group select-none overflow-hidden ${stickyClass} ${borderClass}`} style={{ ...sizeStyle, ...stickyStyle }}>
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
              
              {/* Row 2: Filters */}
              <TableRow className="bg-slate-50">
                {table.getAllLeafColumns().map((col) => {
                  const isSticky = col.columnDef.meta?.sticky;
                  const stickyLeft = col.columnDef.meta?.stickyLeft;
                  const stickyBorder = col.columnDef.meta?.stickyBorder;
                  const stickyStyle = isSticky ? { position: 'sticky', left: stickyLeft, zIndex: 30 } : {};
                  const borderClass = stickyBorder ? 'border-r-2 border-slate-300' : '';
                  const sizeStyle = { width: col.getSize(), minWidth: col.getSize(), maxWidth: col.getSize() };
                  return (
                  <TableHead key={col.id} className={`py-1 px-1 bg-slate-50 overflow-hidden ${borderClass}`} style={{ ...sizeStyle, ...stickyStyle }}>
                    {col.getCanFilter() ? (
                      <input
                        value={(col.getFilterValue() ?? "")}
                        onChange={(e) => col.setFilterValue(e.target.value || undefined)}
                        placeholder="Filtrar..."
                        className="w-full h-6 text-xs border rounded px-1 bg-white outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    ) : null}
                  </TableHead>
                )})}
              </TableRow>
            </TableHeader>

            <TableBody>
              {onCreateRow && <GhostRow columnCount={columns.length} onCreateRow={onCreateRow} />}

              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <Fragment key={row.id}>
                    {/* Compact zebra striping mimicking vuelos */}
                    <TableRow className={`group transition-colors ${row.getIsExpanded() ? "bg-muted/30 border-b-0" : "hover:bg-muted/50"} ${row.index % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                      {row.getVisibleCells().map((cell) => {
                        const isSticky = cell.column.columnDef.meta?.sticky;
                        const stickyLeft = cell.column.columnDef.meta?.stickyLeft;
                        const stickyBorder = cell.column.columnDef.meta?.stickyBorder;
                        const stickyStyle = isSticky ? { position: 'sticky', left: stickyLeft, zIndex: 10 } : {};
                        const stickyClass = isSticky ? `bg-white group-hover:bg-slate-50` : ''; 
                        const borderClass = stickyBorder ? 'border-r-2 border-slate-300' : '';
                        const sizeStyle = { width: cell.column.getSize(), minWidth: cell.column.getSize(), maxWidth: cell.column.getSize() };
                        
                        return (
                        <TableCell key={cell.id} style={{ ...sizeStyle, ...stickyStyle }} className={`overflow-hidden py-1.5 ${stickyClass} ${borderClass}`}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      )})}
                    </TableRow>
                    {row.getIsExpanded() && renderSubComponent && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={row.getVisibleCells().length} className="p-0 border-b-2 border-b-slate-200">
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
            
            {/* Optional Footer */}
          </Table>
        </div>
      </div>
    </div>
  );
}
