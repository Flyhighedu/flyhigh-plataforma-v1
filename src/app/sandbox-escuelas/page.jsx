"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import { escuelasColumns } from "./escuelas-columns";
import { DataTable } from "./data-table";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

const TABS = [
  { key: "PRIMARIA", label: "🏫 Primarias", color: "bg-blue-600", shadow: "shadow-blue-500/30" },
  { key: "PREESCOLAR", label: "🧒 Preescolares", color: "bg-violet-600", shadow: "shadow-violet-500/30" },
];

export default function SandboxEscuelasPage() {
  const [activeNivel, setActiveNivel] = useState("PRIMARIA");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importStatus, setImportStatus] = useState(null); // null | 'loading' | { success, message }

  // Fetch schools filtered by nivel_educativo
  const fetchData = useCallback(async (nivel) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sandbox-escuelas?nivel=${nivel || activeNivel}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al cargar datos");
      setData(json.data || []);
    } catch (err) {
      toast.error("Error al cargar datos", { description: err.message });
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [activeNivel]);

  // Refetch when tab changes
  useEffect(() => {
    fetchData(activeNivel);
  }, [activeNivel]);

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
          // Only add if it matches the active tab
          if (row.nivel_educativo !== activeNivel) return;
          setData((prev) => {
            if (prev.some((s) => s.cct === row.cct)) return prev;
            return [...prev, row];
          });
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new;
          if (!row?.cct) return;
          // If nivel changed away from our tab, remove it
          if (row.nivel_educativo !== activeNivel) {
            setData((prev) => prev.filter((s) => s.cct !== row.cct));
            return;
          }
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
  }, [activeNivel]);

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
        await fetchData(activeNivel);
        throw err;
      }
    },
    [fetchData, activeNivel]
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

  // Ghost Row: INSERT new school (with current tab's nivel_educativo)
  const handleCreateRow = useCallback(
    async (form) => {
      try {
        const res = await fetch("/api/sandbox-escuelas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, nivel_educativo: activeNivel }),
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
    [activeNivel]
  );

  // ─── One-shot import handler ─────────────────────────────────────
  const handleImportPreescolares = async () => {
    if (!confirm('⚠️ Importar 138 preescolares desde el CSV.\n\nEsto agregará la columna nivel_educativo y cargará los datos.\n¿Continuar?')) return;
    setImportStatus('loading');
    try {
      const res = await fetch('/api/admin/import-preescolares', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error en la importación');
      setImportStatus(json);
      toast.success(json.message || '✅ Importación exitosa');
      // Refresh the preescolar tab
      if (activeNivel === 'PREESCOLAR') {
        fetchData('PREESCOLAR');
      }
    } catch (err) {
      setImportStatus({ success: false, message: err.message });
      toast.error('Error en la importación', { description: err.message });
    }
  };

  const activeTab = TABS.find(t => t.key === activeNivel);
  const schoolCount = data.length;
  const totalNinos = data.reduce((s, r) => s + (Number(r.ninos) || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Full-bleed header area */}
      <div className="px-6 md:px-10 pt-8 pb-2">
        <h1 className="text-2xl font-bold tracking-tight">
          🏫 Catálogo de Escuelas — Administración
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Haz clic en cualquier celda para editar.
          Los cambios se guardan automáticamente en <code className="text-xs">catalogo_escuelas</code>.
        </p>
      </div>

      {/* ─── Tab bar ─── */}
      <div className="px-6 md:px-10 pt-4 pb-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-muted/50">
          {TABS.map((tab) => {
            const isActive = activeNivel === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveNivel(tab.key)}
                className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? `${tab.color} text-white ${tab.shadow} shadow-lg`
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Live counter badge */}
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-foreground font-semibold">
            <span className="text-xs opacity-60">Escuelas:</span>
            <span className="font-bold">{schoolCount.toLocaleString('es-MX')}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-foreground font-semibold">
            <span className="text-xs opacity-60">Alumnos:</span>
            <span className="font-bold">{totalNinos.toLocaleString('es-MX')}</span>
          </span>
        </div>

        {/* Import button — only show on Preescolar tab when empty */}
        {activeNivel === 'PREESCOLAR' && schoolCount === 0 && !loading && (
          <button
            onClick={handleImportPreescolares}
            disabled={importStatus === 'loading'}
            className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-lg shadow-violet-500/30 transition-all active:scale-95 disabled:opacity-50"
          >
            {importStatus === 'loading' ? (
              <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Importando…</>
            ) : (
              <>📥 Importar Preescolares desde CSV</>
            )}
          </button>
        )}
      </div>

      {/* Import status banner */}
      {importStatus && importStatus !== 'loading' && (
        <div className={`mx-6 md:mx-10 mb-4 p-4 rounded-xl text-sm font-medium ${importStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {importStatus.message}
          {importStatus.summary && (
            <span className="block mt-1 text-xs opacity-80">
              Insertados: {importStatus.summary.inserted} | Duplicados omitidos: {importStatus.summary.skipped_duplicates}
              {importStatus.summary.errors && <span className="text-red-600 block">Errores: {importStatus.summary.errors.join(', ')}</span>}
            </span>
          )}
        </div>
      )}

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
