"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useMemo } from "react";
import { hrColumns } from "./hr-columns";
import { DataTable } from "./data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { eventsColumns } from "./events-columns";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";

export default function SandboxHRPage() {
  const [data, setData] = useState([]);
  const [eventsData, setEventsData] = useState([]);
  const [docsData, setDocsData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initial Fetch of EVERYTHING
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resStaff, resEvents, resDocs] = await Promise.all([
        fetch("/api/sandbox-hr"),
        fetch("/api/sandbox-hr/events"),
        fetch("/api/sandbox-hr/docs")
      ]);
      
      const [jsonStaff, jsonEvents, jsonDocs] = await Promise.all([
        resStaff.json(), resEvents.json(), resDocs.json()
      ]);

      if (!resStaff.ok) throw new Error(jsonStaff.error);
      if (!resEvents.ok) throw new Error(jsonEvents.error);
      if (!resDocs.ok) throw new Error(jsonDocs.error);

      setData(jsonStaff.data || []);
      setEventsData(jsonEvents.data || []);
      setDocsData(jsonDocs.data || []);
    } catch (err) {
      toast.error("Error al cargar la base de datos", { description: err.message });
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime Subscriptions
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('sandbox-hr-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_profiles' }, (payload) => {
        const row = payload.new;
        if (payload.eventType === 'INSERT') {
          if (!row?.user_id) return;
          setData((prev) => {
            if (prev.some((s) => s.user_id === row.user_id)) return prev;
            return [...prev, row];
          });
        } else if (payload.eventType === 'UPDATE') {
          if (!row?.user_id) return;
          setData((prev) => prev.map((s) => (s.user_id === row.user_id ? { ...s, ...row } : s)));
        } else if (payload.eventType === 'DELETE') {
          const oldRow = payload.old;
          if (!oldRow?.user_id) return;
          setData((prev) => prev.filter((s) => s.user_id !== oldRow.user_id));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hr_documents' }, (payload) => {
        setDocsData(prev => [payload.new, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hr_documents' }, (payload) => {
        const row = payload.new;
        setDocsData((prev) => prev.map((d) => (d.id === row.id ? { ...d, ...row } : d)));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_prep_events' }, (payload) => {
        setEventsData(prev => [payload.new, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'staff_prep_events' }, (payload) => {
        const row = payload.new;
        setEventsData((prev) => prev.map((e) => (e.id === row.id ? { ...e, ...row } : e)));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'staff_journeys' }, (payload) => {
        const row = payload.new;
        setEventsData((prev) => prev.map((e) => {
           if (e.journey_id === row.id) {
               // Update the inner staff_journeys object inside the event
               return { ...e, staff_journeys: row };
           }
           return e;
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update Methods
  const handleUpdate = useCallback(async (id, field, value, stateSetter, apiRoute) => {
    let originalData = [];
    stateSetter(prev => {
      originalData = prev;
      return prev.map(row => {
        // Handle both uuid formats (profiles use user_id, events use id)
        const rowId = row.user_id || row.id;
        if (rowId !== id) return row;
        return { ...row, [field]: value };
      });
    });

    try {
      const res = await fetch(apiRoute, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, field, value })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al actualizar");
      toast.success("Actualizado", { description: "El cambio se ha registrado en Supabase." });
    } catch (err) {
      toast.error("Error al guardar", { description: err.message });
      stateSetter(originalData); // Rollback
    }
  }, []);

  const handleUpdateStaff = useCallback((id, field, value) => {
    handleUpdate(id, field, value, setData, "/api/sandbox-hr");
  }, [handleUpdate]);

  const handleUpdateEvent = useCallback((id, field, value) => {
    handleUpdate(id, field, value, setEventsData, "/api/sandbox-hr/events");
  }, [handleUpdate]);

  const handleUpdateDoc = useCallback((id, field, value) => {
    handleUpdate(id, field, value, setDocsData, "/api/sandbox-hr/docs");
  }, [handleUpdate]);

  const handleCreateCheckout = useCallback(async (userId, journeyId, isoDate) => {
    try {
      if (!userId || !journeyId) throw new Error("Faltan datos base para crear el checkout.");
      const res = await fetch("/api/sandbox-hr/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          journey_id: journeyId,
          event_type: "checkout",
          created_at: isoDate,
          payload: { source: "hr_manual_override" }
        })
      });
      if (!res.ok) throw new Error("Error al crear salida manual");
      // Resync events
      const updatedRes = await fetch("/api/sandbox-hr/events").then(r => r.json());
      setEventsData(updatedRes.data || []);
      toast.success("Hora de salida registrada correctamente.");
    } catch (err) {
      toast.error(err.message);
    }
  }, []);

  // Compute mapped events to group check-in and check-out per employee per day
  const flatEventsData = useMemo(() => {
    const grouped = {};

    eventsData.forEach(ev => {
      // Identificar tipos de evento
      const evtType = (ev.event_type || "").toLowerCase();
      const isCheckin = evtType.includes('checkin') || evtType.includes('asistencia') || evtType.includes('asistencia / check-in');
      const isCheckout = evtType.includes('checkout') || evtType.includes('salida') || evtType.includes('cierre');

      const isTeamCheck = evtType === 'team_check';

      if (!isCheckin && !isCheckout && !isTeamCheck) return;

      const groupingUserId = isTeamCheck ? ev.payload?.target_user_id : ev.user_id;
      if (!groupingUserId) return; // Ignores malformed records without user

      const evtDate = new Date(ev.created_at);
      // Grouping key: userId + local date string
      const rawDateStr = evtDate.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City" });
      const groupId = `${groupingUserId}_${rawDateStr}`;

      if (!grouped[groupId]) {
        const staffInfo = data.find(s => s.user_id === groupingUserId);
        
        const journey = ev.staff_journeys || {};
        let userRole = ev.user_role; // Role fetched from staff_presence via API

        let autoCheckoutTime = "Sin registro";
        let autoCheckoutId = null;

        if (userRole && journey.meta) {
           const key = `closure_checkout_${userRole}_done_at`;
           const checkoutIso = journey.meta[key];
           if (checkoutIso) {
              const coDate = new Date(checkoutIso);
              autoCheckoutTime = coDate.toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: "America/Mexico_City" });
           }
           // Always assign synthetic ID to intercept edits using the role!
           autoCheckoutId = `checkout_${ev.journey_id}_${userRole}`;
        }

        grouped[groupId] = {
          id: groupId,
          user_id: groupingUserId,
          journey_id: ev.journey_id,
          staff_name: staffInfo?.full_name || staffInfo?.email || 'Desconocido',
          date_raw: evtDate, // For sorting the flat array
          fecha: evtDate.toLocaleDateString("es-MX", { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: "America/Mexico_City" }),
          hora_entrada: "Sin registro",
          hora_salida: autoCheckoutTime,
          checkin_id: null,
          checkout_id: autoCheckoutId,
          escuela: ev.staff_journeys?.school_name || 'Desconocida',
          uniforme_valido: false,
          gafete_valido: false,
          app_lista: false,
          payload: {}, // reference para editable-cell NativeSelect
          _processedChecks: {} // lock for chronological priority
        };
      }

      const grp = grouped[groupId];
      const evtTime = evtDate.toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: "America/Mexico_City" });

      if (isCheckin) {
        // Tomar el checkin más temprano o el primero encontrado
        if (grp.hora_entrada === "Sin registro" || evtDate < grp.date_raw) {
          grp.hora_entrada = evtTime;
          grp.checkin_id = ev.id;
          
          // Si Recursos Humanos hizo una corrección manual, priorizarla...
          if (typeof ev.payload?.uniforme_valido === 'boolean') grp.uniforme_valido = ev.payload.uniforme_valido;
          if (typeof ev.payload?.gafete_valido === 'boolean') grp.gafete_valido = ev.payload.gafete_valido;
          if (typeof ev.payload?.app_lista === 'boolean') grp.app_lista = ev.payload.app_lista;
          
          grp.payload = ev.payload || {};
          grp.date_raw = evtDate; // actualizar date base para orden estricto
        }
      }

      if (isCheckout) {
        // Tomar el checkout más reciente
        if (grp.hora_salida === "Sin registro" || evtDate > grp.date_raw) {
          grp.hora_salida = evtTime;
          grp.checkout_id = ev.id;
        }
      }

      if (isTeamCheck) {
        // Desempaquetar los checks recolectados por el docente (TeacherTeamChecklist)
        // Ignorar si HR ya forzó un override booleano directamente en el checkin:
        const isHROverridden = (flag) => grp.checkin_id && typeof grp.payload?.[flag] === 'boolean';
        
        const type = ev.payload?.check_type || '';
        const isOk = ev.payload?.status === 'OK';

        if (!grp._processedChecks[type]) {
            grp._processedChecks[type] = true;

            if (type.includes('uniform') || type.includes('shirt')) {
                if (!isHROverridden('uniforme_valido')) grp.uniforme_valido = isOk;
            }
            if (type.includes('gafete') || type.includes('badge')) {
                if (!isHROverridden('gafete_valido')) grp.gafete_valido = isOk;
            }
            if (type.includes('app') || type.includes('smart')) {
                if (!isHROverridden('app_lista')) grp.app_lista = isOk;
            }
        }
      }

    });

    // Devolver array plano ordenado desde lo más reciente
    return Object.values(grouped).sort((a, b) => b.date_raw - a.date_raw);
  }, [eventsData, data]);

  // Master Actions
  const handleDeleteRow = useCallback(async (userId) => {
    try {
      const res = await fetch("/api/sandbox-hr", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId }),
      });
      if (!res.ok) throw new Error("Error al eliminar");
      setData((prev) => prev.filter((row) => row.user_id !== userId));
      toast.success("Registro eliminado", { description: "Perfil purgado exitosamente." });
    } catch (err) {
      toast.error("Error al eliminar", { description: err.message });
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-6 md:px-10 pt-8 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">
          📊 Panel de Recursos Humanos 
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Vista dual: administra el listado general de personal o controla la bitácora histórica horizontal de cada check-in. Edición rápida haciendo clic en las celdas amarillas.
        </p>
      </div>

      <div className="w-full px-6 md:px-10 pb-10 flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-64 border rounded-xl">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
              <span className="text-sm text-muted-foreground">Sincronizando Base de Datos HQ…</span>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="asistencias" className="w-full flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4 w-full overflow-hidden">
              <TabsList className="bg-slate-100 rounded-lg p-1 h-12 shadow-sm border border-slate-200 overflow-x-auto flex-nowrap no-scrollbar w-full md:w-auto justify-start">
                <TabsTrigger value="asistencias" className="rounded-md font-semibold text-sm px-4 md:px-6 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm transition-all h-full shrink-0">📋 Bitácora de Asistencias</TabsTrigger>
                <TabsTrigger value="directorio" className="rounded-md font-semibold text-sm px-4 md:px-6 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm transition-all h-full shrink-0">👥 Directorio Staff</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="asistencias" className="focus-visible:outline-none focus:outline-none flex-1 mt-0">
              <div className="bg-white border rounded-lg shadow-sm w-full overflow-hidden">
                <DataTable
                  columns={eventsColumns}
                  data={flatEventsData}
                  onUpdateRow={handleUpdateEvent}
                  onCreateCheckout={handleCreateCheckout}
                  onRefreshData={fetchData}
                />
              </div>
            </TabsContent>

            <TabsContent value="directorio" className="focus-visible:outline-none focus:outline-none flex-1 mt-0">
              <div className="bg-white border rounded-lg shadow-sm w-full overflow-hidden">
                <DataTable
                  columns={hrColumns}
                  data={data}
                  onUpdateRow={handleUpdateStaff}
                  onDeleteRow={handleDeleteRow}
                />
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
