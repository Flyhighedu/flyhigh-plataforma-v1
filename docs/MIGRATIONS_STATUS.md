# Reconciliación de migraciones de Supabase

Revisión: 22 de septiembre de 2026. Proyecto `sbzwffqhzmlxtnjyjduk`.

## Resultado verificado

- 58 migraciones registradas en `supabase_migrations.schema_migrations`.
- 40 archivos SQL locales repartidos en tres carpetas.
- 5 archivos tienen candidatos por nombre/versión en el historial; no se ha certificado igualdad del SQL.
- Se consultaron columnas, políticas, índices, triggers y funciones del catálogo PostgreSQL, sin leer registros de negocio ni ejecutar migraciones.

**No hay correspondencia directa suficiente para ejecutar `db push` o reparar el historial.** Parte del esquema actual existe sin un archivo local con la versión remota. La ausencia de un nombre en el historial no demuestra que el cambio esté pendiente; pudo aplicarse manualmente o con otro nombre. Las políticas ausentes pueden haber sido sustituidas por migraciones posteriores.

## Comparación por archivo

| Archivo | Candidatos en historial | Efectos estructurales presentes | Efectos ausentes o sustituidos |
|---|---|---|---|
| `web/migrations/001_crm_tables.sql` | Sin coincidencia directa | 13/13 | — |
| `web/migrations/002_fix_realtime_rls.sql` | Sin coincidencia directa | 2/2 | — |
| `web/migrations/003_crm_kanban_revamp.sql` | Sin coincidencia directa | 3/3 | — |
| `web/migrations/004_crm_status_architecture.sql` | Sin coincidencia directa | 3/3 | — |
| `web/migrations/005_fix_legacy_pipeline_constraint.sql` | Sin coincidencia directa | 2/2 | — |
| `web/migrations/007_add_cita_ventas_state.sql` | `20260424053415` | 1/1 | — |
| `web/migrations/008_create_crm_escuelas.sql` | Sin coincidencia directa | 2/2 | — |
| `web/migrations/009_create_pilot_pois.sql` | Sin coincidencia directa | 7/7 | — |
| `web/migrations/hr_module_phase1.sql` | Sin coincidencia directa | 19/19 | — |
| `web/supabase/migrations/001_staff_v1_tables.sql` | `20260210053402` | 16/17 | `staff_prep_events.staff_prep_events_select_own_journey` |
| `web/supabase/migrations/002_proximas_escuelas_rls.sql` | Sin coincidencia directa | 5/5 | — |
| `web/supabase/migrations/002_staff_en_ruta.sql` | `20260212004817`, `20260212010011` | 13/13 | — |
| `web/supabase/migrations/003_staff_journey_meta.sql` | `20260214050716` | 2/2 | — |
| `web/supabase/migrations/004_history_snapshot_and_soft_delete.sql` | `20260220053202` | 10/10 | — |
| `web/supabase/migrations/005_bitacora_vuelos_realtime.sql` | Sin coincidencia directa | 0/0 | — |
| `web/supabase/migrations/006_staff_journeys_realtime.sql` | Sin coincidencia directa | 0/0 | — |
| `web/supabase/migrations/007_supervisor_event_tables_realtime.sql` | Sin coincidencia directa | 0/0 | — |
| `web/supabase/migrations/008_cierres_mision_realtime.sql` | Sin coincidencia directa | 0/0 | — |
| `web/supabase/migrations/008_staff_event_schema_compat.sql` | Sin coincidencia directa | 3/6 | `idx_staff_prep_events_journey_created_at`, `idx_staff_prep_photos_journey_created_at`, `idx_staff_events_journey_created_at` |
| `web/supabase/migrations/009_cierres_mision_rls_policies.sql` | Sin coincidencia directa | 6/6 | — |
| `web/supabase/migrations/010_cronograma_bitacora_sync.sql` | Sin coincidencia directa | 2/2 | — |
| `web/supabase/migrations/011_staff_profiles_avatar.sql` | Sin coincidencia directa | 2/2 | — |
| `web/supabase/migrations/012_add_capture_fields_to_proximas_escuelas.sql` | Sin coincidencia directa | 3/3 | — |
| `web/supabase/migrations/013_poi_locations.sql` | Sin coincidencia directa | 5/5 | — |
| `web/supabase/migrations/014_add_ficha_didactica_to_pilot_pois.sql` | Sin coincidencia directa | 5/5 | — |
| `web/supabase/migrations/014_poi_info_cache.sql` | Sin coincidencia directa | 0/3 | `poi_info_cache`, `idx_poi_cache_key`, `poi_info_cache.poi_cache_public_read` |
| `web/supabase/migrations/015_tavily_odometer.sql` | Sin coincidencia directa | 3/3 | — |
| `web/supabase/migrations/20260501_admin_custom_flyers.sql` | Sin coincidencia directa | 4/4 | — |
| `web/supabase/migrations/20260505_crm_citas_log.sql` | Sin coincidencia directa | 8/8 | — |
| `web/supabase/migrations/20260505_rutas_maestras.sql` | Sin coincidencia directa | 10/10 | — |
| `web/supabase/migrations/20260506_add_pilot_narration_source.sql` | Sin coincidencia directa | 1/1 | — |
| `web/supabase/migrations/20260506_audio_quality_audits.sql` | Sin coincidencia directa | 7/7 | — |
| `web/supabase/migrations/20260506_pilot_narration_source.sql` | Sin coincidencia directa | 1/1 | — |
| `supabase/migrations/20260508071257_add_energia_positiva_column.sql` | Sin coincidencia directa | 0/0 | — |
| `supabase/migrations/20260513214000_add_narrative_factory_columns.sql` | Sin coincidencia directa | 13/13 | — |
| `supabase/migrations/20260514180000_narrative_factory_rls_fix.sql` | Sin coincidencia directa | 18/18 | — |
| `supabase/migrations/20260515070000_add_general_topics.sql` | Sin coincidencia directa | 5/5 | — |
| `supabase/migrations/20260515082500_add_pilot_pois_general_topics.sql` | Sin coincidencia directa | 8/8 | — |
| `supabase/migrations/20260518060000_create_official_soundtracks.sql` | Sin coincidencia directa | 8/8 | — |
| `supabase/migrations/20260528000000_storage_cleanup.sql` | Sin coincidencia directa | 1/1 | — |

## Decisiones de manejo

1. Conservar los SQL originales y no renumerar el historial remoto.
2. Las siete migraciones fuera del repositorio quedan copiadas como referencia en `docs/legacy-migrations/external/`; no forman parte de la cola automática de Supabase.
3. Antes de futuras migraciones, reconciliar las diferencias del inventario y establecer una línea base del esquema actual en una base de prueba.
4. Adoptar después una sola carpeta de migraciones nuevas con versiones timestamp únicas. No mezclar los archivos legacy actuales con una cola automática nueva.
5. `poi_info_cache` no está en el catálogo público actual: revisar su uso antes de decidir crearla.

## Evidencias

- `migration-inventory.json`: hashes locales, candidatos del historial y comprobación por objeto (heurística; no comprueba cuerpos de funciones, expresiones de políticas, tipos, constraints, buckets ni transformaciones de datos).
- `remote-migration-history.json`: versiones y nombres remotos.
- `remote-schema-catalog.json`: metadatos estructurales, sin registros de negocio.

No se aplicaron migraciones, no se renombraron versiones y no se cambió el historial remoto.

## Verificaciones adicionales

- Las cuatro migraciones Realtime tienen sus tablas incluidas actualmente en `supabase_realtime` (ver `remote-realtime-metadata.json`).
- El archivo externo `20260508071257_add_energia_positiva_column.sql` está vacío. La columna `audio_quality_audits.energia_positiva` sí existe, al igual que `energia_interaccion`.
- `poi_info_cache` es utilizada por `/api/poi-batch-info` y `/api/poi-approve` y no existe en el esquema público actual. Su migración requiere revisión y aplicación planificada, no ejecución automática de toda la carpeta.
