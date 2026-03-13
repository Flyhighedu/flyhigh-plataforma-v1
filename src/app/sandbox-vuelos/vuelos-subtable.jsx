"use client";

import { useEffect, useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
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
import { columns as vueloColumns } from "./columns";
import { toast } from "sonner";

export function VuelosSubTable({ journeyId, onUpdateVuelo }) {
  const [vuelos, setVuelos] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVuelos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sandbox-vuelos?journey_id=${journeyId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setVuelos(json.data || []);
    } catch (err) {
      toast.error("Error al cargar vuelos", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [journeyId]);

  useEffect(() => {
    fetchVuelos();
  }, [fetchVuelos]);

  const handleUpdate = useCallback(
    async (rowId, columnId, newValue) => {
      let castValue = newValue;
      if (columnId === "student_count" || columnId === "duration_seconds") {
        castValue = newValue === "" || newValue === null ? null : Number(newValue);
        if (castValue !== null && isNaN(castValue)) {
          toast.error("Valor inválido", { description: `"${newValue}" no es un número válido.` });
          throw new Error("Invalid number");
        }
      }

      // Optimistic
      setVuelos((prev) =>
        prev.map((row) => (row.id === rowId ? { ...row, [columnId]: castValue } : row))
      );

      try {
        const res = await fetch("/api/sandbox-vuelos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: rowId, field: columnId, value: castValue, table: "bitacora_vuelos" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        toast.success("Vuelo actualizado", { description: `"${columnId}" guardado.` });
      } catch (err) {
        toast.error("Error al guardar vuelo", { description: err.message });
        await fetchVuelos();
        throw err;
      }
    },
    [fetchVuelos]
  );

  const table = useReactTable({
    data: vuelos,
    columns: vueloColumns,
    getCoreRowModel: getCoreRowModel(),
    meta: { updateData: handleUpdate },
  });

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 px-6 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Cargando vuelos…
      </div>
    );
  }

  if (vuelos.length === 0) {
    return (
      <div className="py-4 px-6 text-sm text-muted-foreground italic">
        Sin vuelos registrados para este journey.
      </div>
    );
  }

  return (
    <div className="px-6 py-3">
      <div className="rounded-md border bg-muted/30">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/50">
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="text-xs">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="text-xs py-1.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
