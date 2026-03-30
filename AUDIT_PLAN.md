# Auditoría Completa: Base de Datos como Única Fuente de Verdad (SSoT)

## Contexto

El objetivo es que **toda la información mostrada en cualquier interfaz** provenga directamente de las tablas Supabase, y que cualquier edición en las tablas Sandbox se refleje en tiempo real en todas las interfaces. Actualmente existen tablas redundantes, datos hardcodeados, y fuentes de datos desconectadas.

---

## 1. Inventario Completo de Tablas Supabase

### ✅ Tablas Operativas ACTIVAS (Usadas por Staff PWA + Sandbox)

| Tabla | Propósito | Sandbox que la edita |
|---|---|---|
| `staff_journeys` | Jornadas operativas (fecha, escuela, status) | `sandbox-vuelos` (lectura/escritura) |
| `bitacora_vuelos` | Registro de vuelos individuales (duración, alumnos) | `sandbox-vuelos` (lectura en tiempo real) |
| `cierres_mision` | Cierre final de misión (totales, firmas, fotos) | `sandbox-vuelos` (lectura/escritura) |
| `staff_profiles` | Perfiles de operativos (nombre, rol) | Admin → HR Command Center |
| `staff_prep_events` | Checklist pre-salida | Solo PWA Staff |
| `staff_prep_photos` | Fotos de evidencia | Solo PWA Staff |
| `staff_events` | Eventos operativos (llegada, inicio, etc.) | Solo PWA Staff |
| `staff_presence` | Presencia GPS en tiempo real | Solo PWA Staff |

### ✅ Tablas de Catálogo ACTIVAS

| Tabla | Propósito | Sandbox que la edita |
|---|---|---|
| `catalogo_escuelas` | Catálogo maestro de escuelas (CCT, nombre, tipo, niños) | `sandbox-escuelas` ✅ |
| `proximas_escuelas` | Calendario de misiones programadas (fecha, escuela, estatus) | Admin → Cronograma |

### ⚠️ Tablas de Patrocinadores (SIN Sandbox)

| Tabla | Propósito | ¿Tiene Sandbox? |
|---|---|---|
| `patrocinadores` | Datos de patrocinadores (nombre, email, password, aportación) | ❌ Solo CRUD en Admin |
| `fondo_patrocinadores` | Desglose de fondos por categoría | ❌ Sin interfaz |

### ⚠️ Tablas Auxiliares/Configuración

| Tabla | Propósito | ¿Tiene Sandbox? |
|---|---|---|
| `stats` | Configuración global (total_sponsored_kids) | ❌ Editada manualmente en Admin |
| `escuelas_extras` | Escuelas históricas/adicionales (nombre) | ❌ Solo lectura |

---

## 2. Mapa de Interfaces vs. Fuentes de Datos

### 🔍 Hallazgos Críticos por Página

---

### `/sandbox-vuelos` — ✅ SSoT CORRECTO
- **API**: `/api/sandbox-vuelos/route.js`
- **Tablas**: `staff_journeys` + `cierres_mision` + `bitacora_vuelos` + `proximas_escuelas`
- **Estado**: ✅ Bidireccional. Ediciones se guardan en Supabase y se reflejan en tiempo real.

---

### `/sandbox-escuelas` — ✅ SSoT CORRECTO
- **API**: `/api/sandbox-escuelas/route.js`
- **Tabla**: `catalogo_escuelas`
- **Estado**: ✅ CRUD completo + Realtime. Ediciones modifican directamente la BD.

---

### `/sandbox-dashboards` — ⚠️ PARCIALMENTE SSoT

- **API**: `/api/sandbox-dashboards/route.js`
- **Tablas Correctas**: `cierres_mision`, `bitacora_vuelos`, `staff_journeys` → ✅ SSoT
- **Problemas encontrados**:

**P1: La tabla `stats` tiene un valor hardcodeado `total_sponsored_kids`** (línea 69 de la API). El panel Impacto muestra `sponsoredKidsGoal: statsRow?.total_sponsored_kids || 7209`. Este dato NO viene de ningún cálculo real — es un número metido manualmente sin interfaz Sandbox para editarlo.

**P2: La tabla `catalogo_escuelas` se usa para "capacityUtilization"** (línea 196-198). Calcula cuántos niños del catálogo han sido atendidos, pero `catalogo_escuelas.ninos` frecuentemente es `null` porque no todos los registros tienen el dato completo.

**P3: Las tablas `patrocinadores` y `fondo_patrocinadores`** alimentan el Panel Patrocinios (líneas 353-383). Estos datos NO tienen interfaz Sandbox — se editan solo desde el CRUD básico del Admin panel, que usa llamadas directas a Supabase DESDE EL CLIENTE (no vía API route), lo cual puede fallar por RLS.

---

### `/dashboard` (Panel de Transparencia Público) — ⚠️ PROBLEMAS MÚLTIPLES

- **API**: `/api/dashboard-data/route.js`

**P4 [ALTA]: "Cronograma de Misiones" usa `proximas_escuelas` como fuente, NO `staff_journeys`.**
El dashboard público muestra una sección "Cronograma de Misiones" con campos `nombre_escuela`, `colonia`, `fecha_programada`, `estatus` que vienen de `proximas_escuelas`. Pero esta tabla es el **calendario de programación** del Admin y es totalmente independiente de `staff_journeys` (la tabla real de operaciones). Si una misión se ejecuta pero no fue programada en `proximas_escuelas`, NO aparece en el cronograma. Hay desconexión entre lo programado y lo ejecutado.

**P5 [ALTA]: El login de patrocinadores usa llamadas directas al cliente Supabase.**
En `dashboard/page.js` (líneas 896-900), el login de patrocinadores consulta `patrocinadores` directamente con `supabaseNew.from('patrocinadores').select('*').eq('email', ...).eq('password', ...)`. Esto: (a) almacena contraseñas en texto plano, (b) accede directamente desde el cliente, y (c) no usa API routes ni service_role.

**P6:** El contador "Niños Becados" combina datos de `cierres_mision.becados` con los del API. El valor de `ninosPatrocinados` viene del campo `becados` sumado de `cierres_mision`, lo cual SÍ es correcto desde la perspectiva SSoT. ✅

---

### `/admin` (Panel de Administración) — ⚠️ MEZCLA DE PATRONES

**P7 [ALTA]: 6+ llamadas directas al cliente Supabase (`supabaseNew.from(...)`).**
El admin hace llamadas directas desde el navegador a:
- `patrocinadores` (fetch, insert, update, delete) — líneas 530-772
- `cierres_mision` (fetch) — línea 355
- `proximas_escuelas` (fetch) — línea 373
- `stats` (fetch/update) — líneas 495-517
- `escuelas_extras` (fetch) — línea 454
- `bitacora_vuelos` (fetch) — línea 434

Esto es inconsistente: `catalogo_escuelas` y `proximas_escuelas` usan API routes (`/api/admin/...`), pero `patrocinadores` y `stats` van directo al cliente. Las llamadas directas dependen del rol `anon` de Supabase y pueden fallar silenciosamente por RLS.

---

### `/escuelas` (Página Pública de Escuelas) — ⚠️ FUENTE DESCONECTADA

**P8: `EscuelasGallery3D` lee de DOS tablas para mostrar nombres de escuelas.**
Combina `proximas_escuelas.nombre_escuela` + `escuelas_extras.nombre` para el marquee animado de "Ellos ya volaron". Debería leer del `catalogo_escuelas` (la SSoT de escuelas) o de `cierres_mision` (escuelas realmente visitadas).

---

### `/patrocinadores` (Página Pública) — ✅ SIN PROBLEMA DE DATOS

- `SponsorsGrid.js` tiene los datos de patrocinadores **hardcodeados** como constantes JS (GIANTS array). No consulta Supabase.
- Esto es intencional: es content marketing estático.
- **Nota futura**: Cuando crees la tabla Sandbox de patrocinadores, este contenido podría dinamizarse.

---

## 3. Resumen de Problemas Ordenados por Prioridad

| # | Severidad | Problema | ¿Dónde? |
|---|---|---|---|
| P4 | 🔴 ALTA | Cronograma Público usa `proximas_escuelas` en vez de `staff_journeys`+`cierres_mision` | `/dashboard` |
| P7 | 🔴 ALTA | Admin hace 6+ queries directas al cliente, no por API routes (puede fallar por RLS) | `/admin` |
| P5 | 🔴 ALTA | Login de patrocinadores con password en texto plano y query directa | `/dashboard` |
| P3 | 🟡 MEDIA | Patrocinadores NO tienen interfaz Sandbox tipo Excel | `/admin` |
| P1 | 🟡 MEDIA | `stats.total_sponsored_kids` es valor manual sin interfaz Sandbox | `/sandbox-dashboards` |
| P8 | 🟡 MEDIA | Galería escuelas lee de `proximas_escuelas` + `escuelas_extras` en vez de SSoT | `/escuelas` |
| P2 | 🟢 BAJA | `catalogo_escuelas.ninos` tiene muchos nulls, distorsiona capacity % | `/sandbox-dashboards` |

---

## 4. Redundancias entre Tablas

- `proximas_escuelas` (Calendario Admin) alimenta → `staff_journeys` (Operaciones reales)
- `catalogo_escuelas` (Catálogo Maestro) alimenta → `proximas_escuelas` (via CCT/nombre)
- `escuelas_extras` (Nombres históricos) → REDUNDANTE con `cierres_mision.school_name_snapshot`

**`escuelas_extras`** es completamente redundante. Sus datos (nombres de escuelas históricas) deberían venir de `cierres_mision.school_name_snapshot` (escuelas realmente visitadas) o de `catalogo_escuelas` (el catálogo maestro).

**`proximas_escuelas`** y **`catalogo_escuelas`** tienen overlap: ambas tienen `nombre_escuela`. Pero `proximas_escuelas` es para *programar misiones* y `catalogo_escuelas` es el *catálogo maestro*. Esto está semánticamente correcto, pero el cronograma del dashboard debería mostrar datos de `staff_journeys`+`cierres_mision` (lo ejecutado), no de `proximas_escuelas` (lo programado).

---

## 5. Plan de Acción Propuesto

### Fase A: Corregir fuentes de datos desconectadas (P4, P8)

1. **Dashboard Público Cronograma (P4)**: Refactorizar la sección "Cronograma de Misiones" para que muestre datos de `staff_journeys` + `cierres_mision` (misiones reales) en lugar de `proximas_escuelas` (misiones programadas). El API `/api/dashboard-data` ya trae `journeys` y `cierres` — solo falta usarlos.

2. **Galería Escuelas (P8)**: Cambiar `EscuelasGallery3D` para leer nombres desde `cierres_mision.school_name_snapshot` (escuelas realmente visitadas) en vez de `proximas_escuelas` + `escuelas_extras`.

### Fase B: Migrar Admin a API routes (P7)

3. Crear API routes server-side para las operaciones de admin que actualmente son client-side:
   - `/api/admin/sponsors` (CRUD para `patrocinadores`)
   - `/api/admin/stats` (lectura/escritura para `stats`)
   - Migrar las llamadas directas a `supabaseNew.from(...)` en `admin/page.js`

### Fase C: Crear Sandbox de Patrocinadores (P3, Futuro)

4. Crear `/sandbox-patrocinadores` con el mismo patrón Excel que `sandbox-vuelos` y `sandbox-escuelas`:
   - Tabla editable para `patrocinadores` (nombre, aportación, email)
   - Tabla editable para `fondo_patrocinadores` (categoría, monto asignado/consumido)
   - Con realtime bidireccional

### Fase D: Limpieza de tablas (Futuro)

5. Marcar `escuelas_extras` como deprecada / eliminar datos redundantes.
6. Integrar `stats.total_sponsored_kids` como campo derivado de `cierres_mision` (sum de `becados`).

---

## Preguntas para el Usuario

1. **¿Ejecuto las Fases A y B ahora?** (corregir datos desconectados + migrar admin a API routes)
2. **¿La Fase C (Sandbox Patrocinadores tipo Excel) la quieres ahora o después?**
3. **P5: El login de patrocinadores con password en texto plano es un riesgo de seguridad. ¿Lo migramos a un sistema más seguro ahora?**
