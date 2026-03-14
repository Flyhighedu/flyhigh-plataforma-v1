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
  // For total_students / total_flights: triggers UPSERT-cierre + seal
  const handleUpdateRow = useCallback(
    async (rowId, columnId, newValue) => {
      const isCierreField = columnId === "total_students" || columnId === "total_flights" || columnId === "becados";
      let castValue = newValue;

      if (["costo_por_nino", "total_students", "total_flights", "becados"].includes(columnId)) {
        castValue = newValue === "" || newValue === null ? (isCierreField ? 0 : null) : Number(newValue);
        if (castValue !== null && isNaN(castValue)) {
          toast.error("Valor inválido", { description: `"${newValue}" no es un número válido.` });
          throw new Error("Invalid number");
        }
      }

      // Optimistic update
      setData((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const updates = { [columnId]: castValue };
          // If editing Niños/Vuelos, also optimistically set status to closed
          if (isCierreField) updates.status = "closed";
          return { ...row, ...updates };
        })
      );

      try {
        const res = await fetch("/api/sandbox-vuelos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: rowId, field: columnId, value: castValue, table: "staff_journeys" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al guardar");

        const label = isCierreField ? `${columnId === "total_students" ? "Niños" : columnId === "becados" ? "Becados" : "Vuelos"} → cierres_mision` : columnId;
        toast.success("Guardado", { description: `${label} actualizado.` });
      } catch (err) {
        toast.error("Error al guardar", { description: err.message });
        await fetchData();
        throw err;
      }
    },
    [fetchData]
  );

  // Ghost Row: double INSERT (staff_journeys + cierres_mision)
  const handleCreateRow = useCallback(
    async (form) => {
      try {
        const res = await fetch("/api/sandbox-vuelos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al crear misión");

        // Add new row to top of data (optimistic)
        setData((prev) => [json.data, ...prev]);
        toast.success("✅ Misión sellada", {
          description: `${json.data.school_name || "Nueva misión"} — ${json.data.total_students} niños, ${json.data.total_flights} vuelos.`,
        });
      } catch (err) {
        toast.error("Error al crear misión", { description: err.message });
        throw err;
      }
    },
    []
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
            Haz clic en cualquier celda para editar. La fila verde (＋) permite inyectar misiones históricas.
            Al editar Niños o Vuelos, se ejecuta un UPSERT en <code className="text-xs">cierres_mision</code> y se sella el journey.
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
            onCreateRow={handleCreateRow}
            renderSubComponent={renderSubComponent}
          />
        )}
      </div>
    </div>
  );
}
