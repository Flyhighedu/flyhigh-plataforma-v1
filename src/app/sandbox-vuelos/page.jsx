"use client";

import { useEffect, useState, useCallback } from "react";
import { columns } from "./columns";
import { DataTable } from "./data-table";
import { toast } from "sonner";

export default function SandboxVuelosPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all rows via server-side API (bypasses RLS)
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sandbox-vuelos");
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Error al cargar datos");
      }

      setData(json.data || []);
    } catch (err) {
      toast.error("Error al cargar datos", {
        description: err.message,
      });
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Inline update: optimistic + API PATCH
  const handleUpdateRow = useCallback(
    async (rowId, columnId, newValue) => {
      // Cast numeric columns
      let castValue = newValue;
      if (columnId === "student_count" || columnId === "duration_seconds") {
        castValue = newValue === "" || newValue === null ? null : Number(newValue);
        if (castValue !== null && isNaN(castValue)) {
          toast.error("Valor inválido", {
            description: `"${newValue}" no es un número válido.`,
          });
          throw new Error("Invalid number");
        }
      }

      // Optimistic update
      setData((prev) =>
        prev.map((row) =>
          row.id === rowId ? { ...row, [columnId]: castValue } : row
        )
      );

      // Persist via API
      try {
        const res = await fetch("/api/sandbox-vuelos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: rowId, field: columnId, value: castValue }),
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Error al guardar");
        }

        toast.success("Guardado", {
          description: `Campo "${columnId}" actualizado correctamente.`,
        });
      } catch (err) {
        toast.error("Error al guardar", {
          description: err.message,
        });
        // Revert optimistic update
        await fetchData();
        throw err;
      }
    },
    [fetchData]
  );

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            🛩️ Bitácora de Vuelos
          </h1>
          <p className="text-muted-foreground mt-1">
            Sandbox — datos crudos con edición en celda. Haz clic en cualquier
            celda editable para modificar su valor.
          </p>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">
                Cargando bitácora…
              </span>
            </div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={data}
            onUpdateRow={handleUpdateRow}
          />
        )}
      </div>
    </div>
  );
}
