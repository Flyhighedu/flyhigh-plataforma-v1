# Respaldo y Restauracion de Historial (FlyHigh)

Este documento protege los datos historicos antes de cambios en Historial de Misiones / Informe de Mision.

## 1) Respaldo completo (Supabase panel)

1. Entra a Supabase Dashboard del proyecto.
2. Ve a `Project Settings` -> `Backups`.
3. Crea o valida un backup completo reciente (`Full backup`).
4. Anota:
   - fecha/hora
   - tipo de backup
   - identificador del backup

> Este es el respaldo principal para recuperacion total del proyecto.

## 2) Respaldo adicional de tablas historicas (local)

Ejecuta en este repositorio:

```bash
npm run backup:history
```

Se genera una carpeta en `backups/history-backup-<timestamp>/` con:

- `cierres_mision.json`
- `bitacora_vuelos.json`
- `bitacora_pausas.json`
- `proximas_escuelas.json`
- `staff_journeys.json`
- `manifest.json` (conteos y hash por tabla)

## 3) Verificacion rapida de conteos

Para comparar conteos actuales contra un backup:

```bash
npm run verify:history-counts -- backups/history-backup-<timestamp>
```

## 3.1) Migracion recomendada para blindaje historico

Ejecutar en Supabase SQL Editor:

```sql
-- Archivo:
-- supabase/migrations/004_history_snapshot_and_soft_delete.sql
```

Esta migracion:

- agrega `school_id`, `school_name_snapshot`, `mission_datetime` en `cierres_mision`
- agrega columnas de archivado en `proximas_escuelas`
- hace backfill no destructivo para historico existente

Ejecucion automatizada (API de Supabase / MCP-compatible):

```bash
SUPABASE_ACCESS_TOKEN=<personal_access_token> npm run migrate:history-004
```

Luego validar:

```bash
npm run verify:history-schema
npm run verify:history-counts -- backups/history-backup-<timestamp>
npm run smoke:history
```

## 4) Restauracion (si algo sale mal)

### Opcion A: restauracion completa (recomendada)

1. Supabase Dashboard -> `Project Settings` -> `Backups`.
2. Selecciona el backup completo.
3. Ejecuta restore del proyecto.

### Opcion B: restauracion puntual de tablas historicas

Usar los JSON en `backups/history-backup-<timestamp>/` para reinsertar registros de:

- `cierres_mision`
- `bitacora_vuelos`
- `bitacora_pausas`
- `proximas_escuelas`
- `staff_journeys`

Recomendado en este orden:

1. `proximas_escuelas`
2. `staff_journeys`
3. `bitacora_vuelos`
4. `bitacora_pausas`
5. `cierres_mision`

> Nota: para restauracion puntual, ejecutar en ventana de mantenimiento y con validacion previa de IDs/llaves.
