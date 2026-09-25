-- Local FlyHigh review baseline, generated from PostgREST public schema metadata on 2026-09-25.

-- Contains structure only. No production records, user accounts or production keys.

-- This is a compatibility baseline for local review, not a declaration of production RLS parity.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public."admin_custom_flyers" (
  "id" text NOT NULL,
  "source_id" text NOT NULL,
  "html_content" text NOT NULL,
  "config" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."audio_quality_audits" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "journey_id" uuid,
  "user_id" uuid,
  "flight_number" integer,
  "source" text DEFAULT 'bitacora' NOT NULL,
  "audio_url" text,
  "audio_duration_seconds" integer,
  "status" text DEFAULT 'pending' NOT NULL,
  "score" integer,
  "menciona_nombre_equipo" boolean,
  "nombre_equipo_detectado" text,
  "menciona_destino" boolean,
  "destino_detectado" text,
  "dinamica_sube_sube" boolean,
  "energia_interaccion" text,
  "participacion_ninos_audible" boolean,
  "feedback_para_isa" text,
  "resumen_supervisor" text,
  "raw_response" jsonb,
  "model_used" text DEFAULT 'gemini-2.5-flash',
  "error_message" text,
  "analyzed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "energia_positiva" boolean,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."bitacora_pausas" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "mission_id" text NOT NULL,
  "pause_type" text NOT NULL,
  "reason" text,
  "start_time" timestamptz DEFAULT now() NOT NULL,
  "end_time" timestamptz,
  "maintenance_checklist" jsonb,
  "resume_checklist" jsonb,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."bitacora_vuelos" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "mission_id" text,
  "mission_data" jsonb,
  "duration_seconds" integer,
  "student_count" integer,
  "staff_count" integer,
  "start_time" timestamptz,
  "end_time" timestamptz,
  "incidents" jsonb,
  "created_by" uuid DEFAULT auth.uid(),
  "created_at" timestamptz DEFAULT now(),
  "journey_id" uuid,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."catalogo_escuelas" (
  "cct" text NOT NULL,
  "codigo_postal" text,
  "nombre_escuela" text,
  "turno" text,
  "tipo" text,
  "ninos" integer,
  "visitada" boolean DEFAULT false,
  "estado_pipeline" text DEFAULT 'sin_contacto',
  "nivel_educativo" text DEFAULT 'PRIMARIA',
  PRIMARY KEY ("cct")
);

CREATE TABLE IF NOT EXISTS public."cierres_mision" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "mission_id" text,
  "total_flights" integer,
  "total_students" integer,
  "checklist_verified" boolean,
  "signature_url" text,
  "group_photo_url" text,
  "start_time" timestamptz,
  "end_time" timestamptz,
  "created_by" uuid DEFAULT auth.uid(),
  "created_at" timestamptz DEFAULT now(),
  "school_id" integer,
  "school_name_snapshot" text,
  "mission_datetime" timestamptz,
  "journey_id" text,
  "becados" integer DEFAULT 0,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."crm_citas_venta" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cct" text NOT NULL,
  "titulo" text DEFAULT 'Cita de Ventas' NOT NULL,
  "fecha_hora" timestamptz NOT NULL,
  "duracion_min" integer DEFAULT 60,
  "responsable" text,
  "notas" text,
  "estado" text DEFAULT 'pendiente',
  "recordatorio_48h" boolean DEFAULT false,
  "recordatorio_24h" boolean DEFAULT false,
  "recordatorio_2h" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."crm_contacts" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "phone_number" text NOT NULL,
  "contact_name" text,
  "cct" text,
  "pipeline_stage" text DEFAULT '1_explorando' NOT NULL,
  "bot_paused" boolean DEFAULT false NOT NULL,
  "assigned_to" text,
  "notes" text,
  "last_message_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "lead_status" text DEFAULT 'open' NOT NULL,
  "reminder_at" timestamptz,
  "reminder_note" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."crm_escuelas_detalles" (
  "cct" text NOT NULL,
  "notas" text,
  "reminder_at" timestamptz,
  "reminder_note" text,
  "assigned_to" text,
  "last_interaction_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("cct")
);

CREATE TABLE IF NOT EXISTS public."crm_pipeline_log" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "cct" text NOT NULL,
  "nombre_escuela" text NOT NULL,
  "estado_anterior" text NOT NULL,
  "estado_nuevo" text NOT NULL,
  "cambiado_por" text DEFAULT 'Admin',
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."crm_pipeline_stages" (
  "id" text NOT NULL,
  "label" text NOT NULL,
  "color" text DEFAULT '#6366f1' NOT NULL,
  "icon" text DEFAULT '📌',
  "sort_order" integer NOT NULL,
  "is_terminal" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."escuelas_extras" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "nombre" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."fechas_disponibles" (
  "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "fecha" date NOT NULL,
  "cupo_maximo" integer DEFAULT 2,
  "cupo_usado" integer DEFAULT 0,
  "activa" boolean DEFAULT true,
  "notas" text,
  "created_at" timestamptz DEFAULT now(),
  "matutino_bloqueado" boolean DEFAULT false,
  "vespertino_bloqueado" boolean DEFAULT false,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."fondo_patrocinadores" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "patrocinador_id" integer NOT NULL,
  "categoria" text NOT NULL,
  "monto_asignado" numeric DEFAULT 0 NOT NULL,
  "monto_consumido" numeric DEFAULT 0 NOT NULL,
  "periodo" text DEFAULT '2026' NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."historial_vuelos" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "nombre_escuela" text NOT NULL,
  "ninos_sesion" integer NOT NULL,
  "colonia" text,
  "acta_url" text,
  "foto_url" text,
  "fecha" date DEFAULT CURRENT_DATE,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."hr_documents" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "doc_type" text NOT NULL,
  "file_url" text NOT NULL,
  "file_name" text,
  "expires_at" date,
  "status" text DEFAULT 'pending',
  "validated_at" timestamptz,
  "validated_by" uuid,
  "rejection_reason" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."hr_payslips" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "period_label" text NOT NULL,
  "period_start" date NOT NULL,
  "period_end" date NOT NULL,
  "amount" numeric NOT NULL,
  "concept" text,
  "payment_method" text,
  "notes" text,
  "pdf_url" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."hr_schedule_config" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "date" date NOT NULL,
  "required_checkin_time" time DEFAULT '07:00:00',
  "note" text,
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."hr_time_off" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "reason" text,
  "evidence_url" text,
  "status" text DEFAULT 'pending',
  "reviewed_by" uuid,
  "reviewed_at" timestamptz,
  "reviewer_note" text,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."impacto_global" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "ninos_totales_meta" integer DEFAULT 30000,
  "ninos_volados_acumulado" integer DEFAULT 0,
  "escuelas_visitadas_total" integer DEFAULT 0,
  "vuelo_en_vivo" boolean DEFAULT false,
  "ultima_actualizacion" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."intel_projects" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text DEFAULT 'Sin nombre' NOT NULL,
  "file_name" text DEFAULT '',
  "filters" jsonb,
  "prices" jsonb,
  "som_percent" integer DEFAULT 30,
  "route_ccts" text[],
  "school_count" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "owner" text,
  "pin" text,
  "stats" jsonb,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."intel_schools" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "cct" text NOT NULL,
  "nombre" text DEFAULT '',
  "municipio" text DEFAULT '',
  "sostenimiento" text DEFAULT '',
  "is_privada" boolean DEFAULT false,
  "alumnos" integer DEFAULT 0,
  "latitud" double precision,
  "longitud" double precision,
  "turno" text DEFAULT '',
  "extra_data" jsonb,
  "nivel_educativo" text DEFAULT '',
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."master_route_pois" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "route_id" uuid NOT NULL,
  "name" text DEFAULT 'Nuevo Punto' NOT NULL,
  "description" text DEFAULT '',
  "image_url" text DEFAULT '',
  "lat" double precision,
  "lng" double precision,
  "dato_clave_1" text DEFAULT '',
  "dato_clave_2" text DEFAULT '',
  "dato_clave_3" text DEFAULT '',
  "pregunta_estudio_1" text DEFAULT '',
  "pregunta_estudio_2" text DEFAULT '',
  "pregunta_estudio_3" text DEFAULT '',
  "pregunta_interaccion" text DEFAULT '',
  "ai_context" jsonb,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "narrative_script" text,
  "audio_url" text,
  "audio_duration_seconds" integer,
  "audio_generated_at" timestamptz,
  "research_article" text,
  "is_general_topic" boolean DEFAULT false,
  "trigger_keywords" text[],
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."master_routes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text DEFAULT 'Nueva Ruta' NOT NULL,
  "description" text DEFAULT '',
  "emoji" text DEFAULT '🗺️',
  "status" text DEFAULT 'draft' NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "published_at" timestamptz,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."official_soundtracks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "artist" text,
  "track_type" text NOT NULL,
  "storage_path" text NOT NULL,
  "public_url" text NOT NULL,
  "file_size_bytes" bigint DEFAULT 0,
  "mime_type" text NOT NULL,
  "duration_seconds" numeric,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."patrocinadores" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "nombre" text NOT NULL,
  "email" text NOT NULL,
  "password" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  "aportacion_total" numeric DEFAULT 0,
  "logo_url" text,
  "mantener_logo_original" boolean DEFAULT false,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."pilot_pois" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "category" text DEFAULT 'general' NOT NULL,
  "is_favorite" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "dato_clave_1" text,
  "dato_clave_2" text,
  "pregunta_interaccion" text,
  "research_article" text,
  "pregunta_estudio" text,
  "image_url" text,
  "pregunta_estudio_1" text,
  "pregunta_estudio_2" text,
  "dato_clave_3" text,
  "pregunta_estudio_3" text,
  "narrative_script" text,
  "audio_url" text,
  "audio_duration_seconds" integer,
  "audio_generated_at" timestamptz,
  "is_general_topic" boolean DEFAULT false,
  "trigger_keywords" text[],
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."pilot_route_progress" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "route_id" uuid NOT NULL,
  "poi_id" uuid NOT NULL,
  "completed" boolean DEFAULT false,
  "confidence_level" integer DEFAULT 0,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."pledges" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "presentation_id" text NOT NULL,
  "amount" bigint NOT NULL,
  "name" text,
  "org" text,
  "status" text DEFAULT 'proposed' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."poi_locations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "emoji" text DEFAULT '📍' NOT NULL,
  "lat" double precision NOT NULL,
  "lng" double precision NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_by_name" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."precios_cuotas" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "tipo_escuela" text NOT NULL,
  "precio" numeric NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "destacado" boolean DEFAULT false,
  "descripcion" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."presentations" (
  "id" text NOT NULL,
  "target_amount" bigint DEFAULT 0 NOT NULL,
  "base_confirmed" bigint DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."proximas_escuelas" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "nombre_escuela" text NOT NULL,
  "colonia" text NOT NULL,
  "fecha_programada" date NOT NULL,
  "estatus" text DEFAULT 'Programado',
  "created_at" timestamptz DEFAULT now(),
  "is_archived" boolean DEFAULT false NOT NULL,
  "archived_at" timestamptz,
  "cct" text,
  "nombre_director" text,
  "telefono_director" text,
  "cuota_alumno" numeric,
  "tarifa_base" numeric DEFAULT 80,
  "subsidio_patrocinador" numeric,
  "ubicacion_lat" double precision,
  "ubicacion_lng" double precision,
  "numero_zona" text,
  "numero_sector" text,
  "nombre_maestro_delegado" text,
  "telefono_maestro_delegado" text,
  "registrado_via" text DEFAULT 'manual',
  "notas" text,
  "turno" text,
  "numero_ninos" integer,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."sponsor_dashboard_stats" (
  "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "children_flown" bigint,
  "schools_visited" bigint,
  "children_goal" bigint,
  "last_update" date,
  "observations" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."sponsors" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "empresa_nombre" text NOT NULL,
  "logo_url" text,
  "usuario" text NOT NULL,
  "password_hash" text NOT NULL,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."staff_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "journey_id" uuid,
  "type" text NOT NULL,
  "actor_user_id" uuid,
  "payload" jsonb,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."staff_journeys" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "date" date NOT NULL,
  "school_id" bigint,
  "school_name" text,
  "status" text DEFAULT 'prep' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now(),
  "created_by" uuid,
  "mission_state" text DEFAULT 'PILOT_PREP' NOT NULL,
  "route_started_at" timestamptz,
  "route_started_by" uuid,
  "arrival_photo_taken_at" timestamptz,
  "arrival_photo_taken_by" uuid,
  "arrival_photo_url" text,
  "reset_nonce" uuid DEFAULT gen_random_uuid(),
  "meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "tipo_escuela" text,
  "cct" text,
  "direccion" text,
  "tarifa_base" numeric,
  "cuota_alumno" numeric,
  "subsidio_patrocinador" numeric,
  "nombre_director" text,
  "telefono_director" text,
  "numero_sector" text,
  "numero_zona" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."staff_prep_events" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "journey_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."staff_prep_photos" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "journey_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "file_path" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "item_id" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."staff_presence" (
  "user_id" uuid NOT NULL,
  "journey_id" uuid,
  "last_seen_at" timestamptz DEFAULT now(),
  "role" text,
  "is_online" boolean DEFAULT true,
  PRIMARY KEY ("user_id")
);

CREATE TABLE IF NOT EXISTS public."staff_profiles" (
  "user_id" uuid NOT NULL,
  "full_name" text DEFAULT '' NOT NULL,
  "role" text DEFAULT 'assistant' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now(),
  "initial_password" text,
  "avatar_config" jsonb,
  "phone" text,
  PRIMARY KEY ("user_id")
);

CREATE TABLE IF NOT EXISTS public."stats" (
  "id" bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "total_sponsored_kids" bigint DEFAULT 7450,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."tavily_usage" (
  "id" integer GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "month_key" text DEFAULT to_char(now(), 'YYYY-MM'::text) NOT NULL,
  "usage_count" integer DEFAULT 0 NOT NULL,
  "monthly_limit" integer DEFAULT 1000 NOT NULL,
  "last_used_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."training_cards" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "module_id" uuid NOT NULL,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "card_type" text DEFAULT 'knowledge',
  "difficulty" integer DEFAULT 1,
  "status" text DEFAULT 'draft',
  "sort_order" integer DEFAULT 0,
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."training_modules" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '',
  "source_text" text NOT NULL,
  "icon" text DEFAULT '📋',
  "color" text DEFAULT '#6366F1',
  "status" text DEFAULT 'draft',
  "target_roles" text[],
  "created_by" uuid,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."video_markers" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "journey_id" uuid,
  "device_timestamp" timestamptz NOT NULL,
  "marker_type" text DEFAULT 'Reacción Épica',
  "synced_at" timestamptz,
  "user_id" uuid,
  "cct" text,
  "school_name_snapshot" text,
  "tag" text,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."whatsapp_conversations" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "phone_number" text NOT NULL,
  "contact_name" text,
  "conversation_state" text DEFAULT 'inicio' NOT NULL,
  "collected_data" jsonb,
  "cct_identificado" text,
  "proxima_escuela_id" bigint,
  "last_message_at" timestamptz DEFAULT now(),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  "nudge_sent" timestamptz,
  "nudge_level" integer DEFAULT 0,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS public."whatsapp_messages" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid,
  "phone_number" text NOT NULL,
  "direction" text NOT NULL,
  "sender_type" text NOT NULL,
  "message_type" text DEFAULT 'text' NOT NULL,
  "content" text NOT NULL,
  "metadata" jsonb,
  "wa_message_id" text,
  "status" text DEFAULT 'sent',
  "created_at" timestamptz DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS review_one_journey_per_school_day ON public.staff_journeys (date, school_id) WHERE school_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS review_journeys_day ON public.staff_journeys (date, status);

CREATE INDEX IF NOT EXISTS review_school_schedule ON public.proximas_escuelas (fecha_programada, estatus);

ALTER TABLE public."staff_journeys" ADD CONSTRAINT "review_staff_journeys_school_id_fk" FOREIGN KEY ("school_id") REFERENCES public."proximas_escuelas" (id);

ALTER TABLE public."staff_prep_events" ADD CONSTRAINT "review_staff_prep_events_journey_id_fk" FOREIGN KEY ("journey_id") REFERENCES public."staff_journeys" (id);

ALTER TABLE public."staff_prep_photos" ADD CONSTRAINT "review_staff_prep_photos_journey_id_fk" FOREIGN KEY ("journey_id") REFERENCES public."staff_journeys" (id);

ALTER TABLE public."staff_events" ADD CONSTRAINT "review_staff_events_journey_id_fk" FOREIGN KEY ("journey_id") REFERENCES public."staff_journeys" (id);

ALTER TABLE public."staff_presence" ADD CONSTRAINT "review_staff_presence_journey_id_fk" FOREIGN KEY ("journey_id") REFERENCES public."staff_journeys" (id);

ALTER TABLE public."bitacora_vuelos" ADD CONSTRAINT "review_bitacora_vuelos_journey_id_fk" FOREIGN KEY ("journey_id") REFERENCES public."staff_journeys" (id);

ALTER TABLE public."master_route_pois" ADD CONSTRAINT "review_master_route_pois_route_id_fk" FOREIGN KEY ("route_id") REFERENCES public."master_routes" (id);

ALTER TABLE public."pilot_route_progress" ADD CONSTRAINT "review_pilot_route_progress_route_id_fk" FOREIGN KEY ("route_id") REFERENCES public."master_routes" (id);

ALTER TABLE public."pilot_route_progress" ADD CONSTRAINT "review_pilot_route_progress_poi_id_fk" FOREIGN KEY ("poi_id") REFERENCES public."master_route_pois" (id);

ALTER TABLE public."admin_custom_flyers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."admin_custom_flyers" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."audio_quality_audits" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."audio_quality_audits" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."bitacora_pausas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."bitacora_pausas" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."bitacora_vuelos" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."bitacora_vuelos" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."catalogo_escuelas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."catalogo_escuelas" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."cierres_mision" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."cierres_mision" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."crm_citas_venta" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."crm_citas_venta" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."crm_contacts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."crm_contacts" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."crm_escuelas_detalles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."crm_escuelas_detalles" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."crm_pipeline_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."crm_pipeline_log" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."crm_pipeline_stages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."crm_pipeline_stages" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."escuelas_extras" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."escuelas_extras" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."fechas_disponibles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."fechas_disponibles" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."fondo_patrocinadores" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."fondo_patrocinadores" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."historial_vuelos" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."historial_vuelos" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."hr_documents" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."hr_documents" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."hr_payslips" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."hr_payslips" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."hr_schedule_config" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."hr_schedule_config" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."hr_time_off" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."hr_time_off" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."impacto_global" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."impacto_global" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."intel_projects" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."intel_projects" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."intel_schools" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."intel_schools" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."master_route_pois" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."master_route_pois" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."master_routes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."master_routes" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."official_soundtracks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."official_soundtracks" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."patrocinadores" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."patrocinadores" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."pilot_pois" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."pilot_pois" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."pilot_route_progress" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."pilot_route_progress" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."pledges" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."pledges" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."poi_locations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."poi_locations" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."precios_cuotas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."precios_cuotas" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."presentations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."presentations" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."proximas_escuelas" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."proximas_escuelas" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."sponsor_dashboard_stats" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."sponsor_dashboard_stats" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."sponsors" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."sponsors" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."staff_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."staff_events" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."staff_journeys" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."staff_journeys" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."staff_prep_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."staff_prep_events" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."staff_prep_photos" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."staff_prep_photos" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."staff_presence" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."staff_presence" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."staff_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."staff_profiles" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."stats" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."stats" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."tavily_usage" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."tavily_usage" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."training_cards" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."training_cards" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."training_modules" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."training_modules" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."video_markers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."video_markers" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."whatsapp_conversations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."whatsapp_conversations" FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public."whatsapp_messages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_authenticated_access" ON public."whatsapp_messages" FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "review_public_read" ON public."official_soundtracks" FOR SELECT TO anon USING (true);

INSERT INTO storage.buckets (id, name, public) VALUES ('staff-arrival', 'staff-arrival', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('prep-evidence', 'prep-evidence', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('staff-telemetry', 'staff-telemetry', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('escuelas_fotos', 'escuelas_fotos', true) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('official_soundtracks', 'official_soundtracks', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "review_storage_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id IN ('staff-arrival', 'prep-evidence', 'staff-telemetry', 'escuelas_fotos', 'official_soundtracks'));

CREATE POLICY "review_storage_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('staff-arrival', 'prep-evidence', 'staff-telemetry', 'escuelas_fotos', 'official_soundtracks'));

CREATE POLICY "review_storage_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('staff-arrival', 'prep-evidence', 'staff-telemetry', 'escuelas_fotos', 'official_soundtracks')) WITH CHECK (bucket_id IN ('staff-arrival', 'prep-evidence', 'staff-telemetry', 'escuelas_fotos', 'official_soundtracks'));

CREATE POLICY "review_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('staff-arrival', 'prep-evidence', 'staff-telemetry', 'escuelas_fotos', 'official_soundtracks'));

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['staff_journeys', 'staff_prep_events', 'staff_prep_photos', 'staff_events', 'staff_presence', 'staff_profiles', 'proximas_escuelas', 'bitacora_vuelos', 'cierres_mision'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = table_name) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END $$;
