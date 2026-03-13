"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { journeyColumns } from "./journey-columns";
import { DataTable } from "./data-table";
import { VuelosSubTable } from "./vuelos-subtable";
import { toast } from "sonner";

export default function SandboxVuelosPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch journeys (master level)
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sandbox-vuelos");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al cargar datos");
      setData(json.data || []);
    } catch (err) {
      toast.error("Error al cargar datos", { description: err.message });
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Inline update for journey fields
  const handleUpdateRow = useCallback(
    async (rowId, columnId, newValue) => {
      let castValue = newValue;
      if (columnId === "costo_por_nino") {
        castValue = newValue === "" || newValue === null ? null : Number(newValue);
        if (castValue !== null && isNaN(castValue)) {
          toast.error("Valor inválido", { description: `"${newValue}" no es un número válido.` });
          throw new Error("Invalid number");
        }
      }

      // Optimistic update
      setData((prev) =>
        prev.map((row) =>
          row.id === rowId ? { ...row, [columnId]: castValue } : row
        )
      );

      try {
        const res = await fetch("/api/sandbox-vuelos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: rowId, field: columnId, value: castValue, table: "staff_journeys" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al guardar");

        toast.success("Guardado", { description: `"${columnId}" actualizado.` });
      } catch (err) {
        toast.error("Error al guardar", { description: err.message });
        await fetchData();
        throw err;
      }
    },
    [fetchData]
  );

  // Pessimistic delete: only remove row from state after Supabase confirms
  const handleDeleteRow = useCallback(
    async (journeyId) => {
      try {
        const res = await fetch("/api/sandbox-vuelos", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journeyId }),
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Error al eliminar");
        }

        // Only now remove from local state
        setData((prev) => prev.filter((row) => row.id !== journeyId));
        toast.success("Registro eliminado desde la raíz en Supabase", {
          description: json.message,
        });
      } catch (err) {
        toast.error("Error al eliminar", { description: err.message });
        throw err;
      }
    },
    []
  );

  // Render expanded vuelos subtable
  const renderSubComponent = useCallback(
    ({ row }) => <VuelosSubTable journeyId={row.original.id} />,
    []
  );

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            🛩️ Bitácora de Vuelos — Maestro-Detalle
          </h1>
          <p className="text-muted-foreground mt-1">
            Haz clic en ▶ para expandir los vuelos de cada journey. Las celdas
            de Fecha, Tipo y Costo/Niño son editables.
          </p>
        </div>

        {/* Master Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">
                Cargando journeys…
              </span>
            </div>
          </div>
        ) : (
          <DataTable
            columns={journeyColumns}
            data={data}
            onUpdateRow={handleUpdateRow}
            onDeleteRow={handleDeleteRow}
            renderSubComponent={renderSubComponent}
          />
        )}
      </div>
    </div>
  );
}
