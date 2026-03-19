"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import { escuelasColumns } from "./escuelas-columns";
import { DataTable } from "./data-table";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

export default function SandboxEscuelasPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all schools from catalogo_escuelas
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sandbox-escuelas");
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

  // ─── Realtime: keep state alive with DB changes ──────────────────────
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('sandbox-escuelas-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'catalogo_escuelas',
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new;
          if (!row?.cct) return;
          setData((prev) => {
            if (prev.some((s) => s.cct === row.cct)) return prev;
            return [...prev, row];
          });
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new;
          if (!row?.cct) return;
          setData((prev) =>
            prev.map((s) => (s.cct === row.cct ? { ...s, ...row } : s))
          );
        } else if (payload.eventType === 'DELETE') {
          const oldRow = payload.old;
          if (!oldRow?.cct) return;
          setData((prev) => prev.filter((s) => s.cct !== oldRow.cct));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Inline update for school fields (keyed by cct)
  const handleUpdateRow = useCallback(
    async (cct, columnId, newValue) => {
      let castValue = newValue;

      if (columnId === "ninos") {
        castValue = newValue === "" || newValue === null ? null : Number(newValue);
        if (castValue !== null && isNaN(castValue)) {
          toast.error("Valor inválido", { description: `"${newValue}" no es un número válido.` });
          throw new Error("Invalid number");
        }
      }

      // Optimistic update
      setData((prev) =>
        prev.map((row) => {
          if (row.cct !== cct) return row;
          return { ...row, [columnId]: castValue };
        })
      );

      try {
        const res = await fetch("/api/sandbox-escuelas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cct, field: columnId, value: castValue }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al guardar");
        toast.success("Guardado", { description: `${columnId} actualizado.` });
      } catch (err) {
        toast.error("Error al guardar", { description: err.message });
        await fetchData();
        throw err;
      }
    },
    [fetchData]
  );

  // Pessimistic delete
  const handleDeleteRow = useCallback(
    async (cct) => {
      try {
        const res = await fetch("/api/sandbox-escuelas", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cct }),
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Error al eliminar");
        }

        setData((prev) => prev.filter((row) => row.cct !== cct));
        toast.success("Escuela eliminada", {
          description: json.message,
        });
      } catch (err) {
        toast.error("Error al eliminar", { description: err.message });
        throw err;
      }
    },
    []
  );

  // Ghost Row: INSERT new school
  const handleCreateRow = useCallback(
    async (form) => {
      try {
        const res = await fetch("/api/sandbox-escuelas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Error al crear escuela");

        // Add new row to data (optimistic)
        setData((prev) => {
          if (prev.some((s) => s.cct === json.data.cct)) return prev;
          return [json.data, ...prev];
        });
        toast.success("✅ Escuela registrada", {
          description: `${json.data.nombre_escuela} (${json.data.cct})`,
        });
      } catch (err) {
        toast.error("Error al crear escuela", { description: err.message });
        throw err;
      }
    },
    []
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Full-bleed header area */}
      <div className="px-6 md:px-10 pt-8 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          🏫 Catálogo de Escuelas — Administración
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          158 escuelas registradas del municipio. Haz clic en cualquier celda para editar.
          Los cambios se guardan automáticamente en <code className="text-xs">catalogo_escuelas</code>.
        </p>
      </div>

      {/* Table — full width, scrolls natively */}
      <div className="px-6 md:px-10 pb-10">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Cargando catálogo de escuelas…</span>
            </div>
          </div>
        ) : (
          <DataTable
            columns={escuelasColumns}
            data={data}
            onUpdateRow={handleUpdateRow}
            onDeleteRow={handleDeleteRow}
            onCreateRow={handleCreateRow}
          />
        )}
      </div>
    </div>
  );
}
