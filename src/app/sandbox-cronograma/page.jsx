"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import { cronogramaColumns } from "./cronograma-columns";
import { DataTable } from "./data-table";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

import FlyerDownloadModal from "@/components/flyers/FlyerDownloadModal";

export default function SandboxCronogramaPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFlyerModal, setShowFlyerModal] = useState(false);
  const [flyerSchoolData, setFlyerSchoolData] = useState(null);

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

  // ─── Realtime: subscribe to proximas_escuelas changes ──────────────────────
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('sandbox-cronograma-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'proximas_escuelas',
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new;
          if (!row?.id) return;
          // Only add if it matches the active filter (not completada/en_progreso)
          if (row.estatus === 'completada' || row.estatus === 'en_progreso') return;
          setData((prev) => {
            if (prev.some((s) => s.id === row.id)) return prev;
            return [row, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new;
          if (!row?.id) return;
          // If status changed to completada/en_progreso, remove from view
          if (row.estatus === 'completada' || row.estatus === 'en_progreso') {
            setData((prev) => prev.filter((s) => s.id !== row.id));
            return;
          }
          setData((prev) =>
            prev.map((s) => (s.id === row.id ? { ...s, ...row } : s))
          );
        } else if (payload.eventType === 'DELETE') {
          const oldRow = payload.old;
          if (!oldRow?.id) return;
          setData((prev) => prev.filter((s) => s.id !== oldRow.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  const handleOpenFlyerModal = useCallback(async (school) => {
    let updatedSchool = { ...school };
    let needsUpdate = false;

    if (!updatedSchool.nombre_escuela) {
      const val = prompt("Falta: Nombre de la escuela");
      if (!val) return;
      updatedSchool.nombre_escuela = val;
      needsUpdate = true;
    }
    if (!updatedSchool.fecha_programada) {
      const val = prompt("Falta: Fecha programada (YYYY-MM-DD)");
      if (!val) return;
      updatedSchool.fecha_programada = val;
      needsUpdate = true;
    }
    if (updatedSchool.tarifa_base == null || updatedSchool.tarifa_base === "") {
      const val = prompt("Falta: Tarifa Base/Fija ($)");
      if (!val) return;
      updatedSchool.tarifa_base = parseFloat(val) || 100;
      needsUpdate = true;
    }
    if (updatedSchool.cuota_alumno == null || updatedSchool.cuota_alumno === "") {
      const val = prompt("Falta: Cuota por alumno ($)");
      if (!val) return;
      updatedSchool.cuota_alumno = parseFloat(val) || 50;
      needsUpdate = true;
    }

    if (needsUpdate) {
      // Opt update in DB for missing fields
      for (const [key, value] of Object.entries(updatedSchool)) {
         if (school[key] !== value) {
            await handleUpdateRow(school.id, key, value);
         }
      }
    }

    setFlyerSchoolData(updatedSchool);
    setShowFlyerModal(true);
  }, [handleUpdateRow]);

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
          openFlyerModal={handleOpenFlyerModal}
        />
      </div>
      {showFlyerModal && flyerSchoolData && (
        <FlyerDownloadModal
          schoolData={flyerSchoolData}
          onClose={() => {
            setShowFlyerModal(false);
            setFlyerSchoolData(null);
          }}
        />
      )}
    </div>
  );
}
