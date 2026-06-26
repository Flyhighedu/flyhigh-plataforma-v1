"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import { journeyColumns } from "./journey-columns";
import { DataTable } from "./data-table";
import { VuelosSubTable } from "./vuelos-subtable";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

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

  // ─── Realtime: keep state alive with field operations ──────────────────────
  // We use a ref to always access the latest `data` without re-subscribing.
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  // Track fields that are currently being saved to prevent realtime from clobbering
  // optimistic updates. Key format: "journeyId::fieldName"
  const savingFieldsRef = useRef(new Set());

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('sandbox-vuelos-realtime')
      // ── cierres_mision: captures total_students, total_flights, becados ──
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'cierres_mision',
      }, (payload) => {
        const row = payload.new;
        if (!row?.journey_id) return;

        setData((prev) =>
          prev.map((j) => {
            if (j.id !== row.journey_id) return j;
            // Only apply fields that are NOT currently being saved (anti-clobber)
            const updated = { ...j };
            if (row.total_students != null && !savingFieldsRef.current.has(`${j.id}::total_students`)) {
              updated.total_students = row.total_students;
            }
            if (row.total_flights != null && !savingFieldsRef.current.has(`${j.id}::total_flights`)) {
              updated.total_flights = row.total_flights;
            }
            if (row.becados != null && !savingFieldsRef.current.has(`${j.id}::becados`)) {
              updated.becados = row.becados;
            }
            return updated;
          })
        );
      })
      // ── staff_journeys: captures status changes + field edits from other tabs ──
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'staff_journeys',
      }, (payload) => {
        const row = payload.new;
        if (!row?.id) return;

        setData((prev) =>
          prev.map((j) => {
            if (j.id !== row.id) return j;
            return {
              ...j,
              status:            row.status            ?? j.status,
              school_name:       row.school_name        ?? j.school_name,
              tipo_escuela:      row.tipo_escuela       ?? j.tipo_escuela,
              tarifa_base:       row.tarifa_base        ?? j.tarifa_base,
              cuota_alumno:      row.cuota_alumno       ?? j.cuota_alumno,
              numero_sector:     row.numero_sector      ?? j.numero_sector,
              numero_zona:       row.numero_zona        ?? j.numero_zona,
              cct:               row.cct                ?? j.cct,
              direccion:         row.direccion           ?? j.direccion,
              nombre_director:   row.nombre_director     ?? j.nombre_director,
              telefono_director: row.telefono_director   ?? j.telefono_director,
            };
          })
        );
      })
      // ── staff_journeys INSERT: new journeys from other sources ──
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'staff_journeys',
      }, (payload) => {
        const row = payload.new;
        if (!row?.id) return;
        // Only add if not already present (avoids duplication from optimistic inserts)
        setData((prev) => {
          if (prev.some((j) => j.id === row.id)) return prev;
          return [{ ...row, total_students: 0, total_flights: 0, becados: 0, vuelo_count: 0 }, ...prev];
        });
      })
      // ── bitacora_vuelos INSERT: live student count accumulation ──
      // ONLY accumulate for rows that DON'T have a sealed cierre.
      // Rows with cierre get their totals from cierres_mision, not live sums.
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bitacora_vuelos',
      }, (payload) => {
        const row = payload.new;
        if (!row?.journey_id) return;
        const addedStudents = Number(row.student_count) || 0;

        setData((prev) =>
          prev.map((j) => {
            if (j.id !== row.journey_id) return j;
            // Skip live accumulation if this row has a sealed cierre —
            // the cierre values are the source of truth for these rows
            if (j._has_cierre) {
              return {
                ...j,
                vuelo_count: (Number(j.vuelo_count) || 0) + 1,
              };
            }
            return {
              ...j,
              total_students: (Number(j.total_students) || 0) + addedStudents,
              vuelo_count:    (Number(j.vuelo_count) || 0) + 1,
            };
          })
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Subscribe once, merge via functional setState

  // Inline update for journey fields
  // For total_students / total_flights: triggers UPSERT-cierre + seal
  const handleUpdateRow = useCallback(
    async (rowId, columnId, newValue) => {
      const isCierreField = columnId === "total_students" || columnId === "total_flights" || columnId === "becados";
      let castValue = newValue;

      if (["total_students", "total_flights", "becados", "tarifa_base", "cuota_alumno"].includes(columnId)) {
        castValue = newValue === "" || newValue === null ? (isCierreField ? 0 : null) : Number(newValue);
        if (castValue !== null && isNaN(castValue)) {
          toast.error("Valor inválido", { description: `"${newValue}" no es un número válido.` });
          throw new Error("Invalid number");
        }
      }

      // Mark this field as saving to prevent realtime from clobbering
      const savingKey = `${rowId}::${columnId}`;
      savingFieldsRef.current.add(savingKey);

      // Optimistic update
      setData((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          return { ...row, [columnId]: castValue };
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

        const label = isCierreField ? `${columnId === "total_students" ? "Alumnos Volados" : columnId === "becados" ? "Becados" : "Vuelos"} → cierres_mision` : columnId;
        toast.success("Guardado", { description: `${label} actualizado.` });
      } catch (err) {
        toast.error("Error al guardar", { description: err.message });
        await fetchData();
        throw err;
      } finally {
        // Allow realtime to update this field again after a short delay
        // (gives the realtime event time to arrive and be ignored)
        setTimeout(() => savingFieldsRef.current.delete(savingKey), 2000);
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

  // Fetch ALL sub-rows (vuelos) for fast Excel export grouping
  const fetchAllSubRows = useCallback(async () => {
    const res = await fetch("/api/sandbox-vuelos?all_vuelos=1");
    const json = await res.json();
    return json.data || [];
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Full-bleed header area */}
      <div className="px-6 md:px-10 pt-8 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          🛩️ Bitácora de Vuelos — Maestro-Detalle
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Haz clic en cualquier celda para editar. La fila verde (＋) permite inyectar misiones históricas.
          Al editar Niños o Vuelos, se ejecuta un UPSERT en <code className="text-xs">cierres_mision</code> y se sella el journey.
        </p>
      </div>

      {/* Table — full width, no max-w cap — scrolls natively */}
      <div className="w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">Cargando journeys…</span>
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
            fetchAllSubRows={fetchAllSubRows}
          />
        )}
      </div>
    </div>
  );
}
