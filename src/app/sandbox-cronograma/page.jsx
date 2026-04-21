"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import { cronogramaColumns } from "./cronograma-columns";
import { DataTable } from "./data-table";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

export default function SandboxCronogramaPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sandbox-cronograma");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al cargar datos");
      const fetched = json.data || [];
      setData(fetched.filter(s => s.estatus !== 'completada' && s.estatus !== 'en_progreso'));
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

  // Realtime updates
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);

  // Smart Polling (RLS Bypass Fallback)
  // Ensures realtime updates happen inside the Admin Sandbox safely without exposing Service Role keys.
  useEffect(() => {
    let unmounted = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/sandbox-cronograma", { cache: "no-store", headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } });
        const json = await res.json();
        if (unmounted || !json.data) return;
        const incoming = json.data.filter(s => s.estatus !== 'completada' && s.estatus !== 'en_progreso');

        setData(prev => {
          let hasChange = false;
          // Look for deletes
          const incomingIds = new Set(incoming.map(s => s.id));
          if (prev.some(p => p.id && !incomingIds.has(p.id))) hasChange = true;
          
          if (!hasChange) {
            // Look for inserts or modifications using deep compare
            for (const inc of incoming) {
              const existing = prev.find(p => p.id === inc.id);
              if (!existing || JSON.stringify(existing) !== JSON.stringify(inc)) {
                 hasChange = true; break;
              }
            }
          }

          if (hasChange) {
             return incoming.map(inc => {
                const existing = prev.find(p => p.id === inc.id);
                // Return original reference if identical, avoiding input focus loss in EditableCell
                return (existing && JSON.stringify(existing) === JSON.stringify(inc)) ? existing : inc;
             });
          }
          return prev;
        });

      } catch (e) {
        // Silently fail on network disruption
      }
    }, 2000); // 2-second fast poll simulates realtime

    return () => {
      unmounted = true;
      clearInterval(timer);
    };
  }, []);

  const handleUpdateRow = useCallback(
    async (id, columnId, newValue) => {
      let castValue = newValue;

      if (['cuota_alumno', 'tarifa_base', 'subsidio_patrocinador', 'numero_ninos'].includes(columnId)) {
        castValue = newValue === "" || newValue === null ? null : Number(newValue);
        if (castValue !== null && isNaN(castValue)) {
          toast.error("Valor inválido", { description: `"${newValue}" no es un número válido.` });
          throw new Error("Invalid number");
        }
      }

      // Optimistic update
      setData((prev) => {
        if (columnId === 'estatus' && castValue === 'completada') {
            return prev.filter(row => row.id !== id);
        }
        return prev.map((row) => {
          if (row.id !== id) return row;
          return { ...row, [columnId]: castValue };
        });
      });

      try {
        const res = await fetch("/api/sandbox-cronograma", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, field: columnId, value: castValue }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed updates");
        toast.success(`Actualizado el campo ${columnId}`);
      } catch (err) {
        toast.error("Ocurrió un error", { description: err.message });
        setData([...dataRef.current]);
      }
    },
    [] // Revert using dataRef
  );

  const handleDeleteRow = useCallback(async (id) => {
    const backup = [...dataRef.current];
    setData((prev) => prev.filter((row) => row.id !== id));
    
    try {
      const res = await fetch(`/api/sandbox-cronograma?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fallo eliminando fila");
      toast.success("Misión eliminada del cronograma de manera permanente.");
    } catch (err) {
      toast.error("Error al borrar", { description: err.message });
      setData(backup);
    }
  }, []);

  const handleCreateRow = useCallback(async (newRowData) => {
    try {
      const res = await fetch("/api/sandbox-cronograma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRowData),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fallo integrando fila.");
      
      setData((prev) => [json.data, ...prev]);
      toast.success("¡Agendada con éxito!");
      return true;
    } catch (err) {
      toast.error("Error al agendar", { description: err.message });
      return false;
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 w-full h-full bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-slate-50 text-slate-900 rounded-lg min-h-screen">
      <div className="w-full">
        <DataTable
          columns={cronogramaColumns}
          data={data}
          onUpdateRow={handleUpdateRow}
          onDeleteRow={handleDeleteRow}
          onCreateRow={handleCreateRow}
        />
      </div>
    </div>
  );
}
