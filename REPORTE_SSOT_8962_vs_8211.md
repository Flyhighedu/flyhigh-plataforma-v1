¡Excelente observación! Acabo de hacer un análisis profundo del código (revisando las sumas exactas y las APIs) y encontré exactamente de dónde sale ese **8,962** frente al **8,211** (una diferencia exacta de **751 alumnos**).

Aquí tienes el hallazgo de por qué pasa esto y cuáles son las demás discrepancias en toda la plataforma.

---

### 🔍 1. El Misterio de los 8,962 vs 8,211 (Diferencia: 751 alumnos)

**¿Por qué sucede?**
- **En tu Sandbox (`sandbox-vuelos` = 8,962):** La tabla Sandbox es **"Live" (en vivo)**. Su código suma los datos de misiones cerradas (`cierres_mision`) **MÁS** los alumnos de *vuelos activos* (`bitacora_vuelos`) de misiones que se están operando hoy pero que el staff **aún no ha firmado ni cerrado formally**.
- **En tu Analytics (`sandbox-dashboards` = 8,211):** El panel de Analytics y el Dashboard Público solo cuentan misiones *completamente finalizadas* (las que tienen un registro oficial en `cierres_mision`). Ignoran las misiones activas.

Esos **751 alumnos de diferencia** son niños que volaron en misiones "en proceso" que aún no han hecho su "Cierre de Misión" en la PWA del staff.

---

### 🔍 2. Auditoría Completa: Las 4 Grandes Discrepancias

Realicé una auditoría en los tres niveles de tu plataforma (`/sandbox-vuelos`, `/sandbox-dashboards`, `/dashboard` y `/admin`) para encontrar por qué no son un reflejo perfecto. Aquí están todos los "falsos SSoT":

#### 🚨 Problema 1: Cálculo de Impacto Desincronizado (El de los 8,962)
- **Dónde:** `/sandbox-dashboards` (Analytics) y `/dashboard` (Público).
- **El fallo:** Las tres APIs están calculando los totales de forma distinta. Sandbox suma `cierres` + `bitacora en vivo`. Analytics suma solo `cierres`.
- **La Solución (SSoT):** Debemos unificar la lógica en `sandbox-dashboards` y `dashboard` para que apliquen la misma prioridad: *Misión Cerrada -> Toma totales de `cierres_mision` | Misión Activa -> Suma en vivo los totales de `bitacora_vuelos`*.

#### 🚨 Problema 2: El Cronograma de Misiones Público es Falso
- **Dónde:** `/dashboard` (Dashboard de Transparencia).
- **El fallo:** Tu cronograma público está leyendo datos de la tabla `proximas_escuelas` (lo que el admin programó en el calendario), pero **NO** de `staff_journeys` (lo que el staff realmente está operando en campo). Si un equipo de staff abre un journey no programado, nunca aparecerá en el dashboard público como misión en curso.
- **La Solución (SSoT):** Refactorizar el dashboard público para que su cronograma nazca estrictamente de `staff_journeys`. 

#### 🚨 Problema 3: Metas y Porcentajes de Impacto Rotos
- **Dónde:** `/sandbox-dashboards` (Panel de Eficiencia y Panel de Impacto).
- **El fallo:** 
  1. La meta de niños becados toma el dato `statsRow?.total_sponsored_kids || 7209`. Ese es un valor inyectado manualmente (no nace de las aportaciones reales de los patrocinadores).
  2. El % de "Utilización de Capacidad" compara tus vuelos contra la tabla `catalogo_escuelas`. Pero en muchas escuelas, el campo `ninos` está vacío (es `null`), hundiendo erróneamente el porcentaje.
- **La Solución (SSoT):** Las metas deben ser la suma de `fondo_patrocinadores` y el `%` de capacidad debe ignorar las escuelas donde el catálogo no tiene el censo de alumnos registrado.

#### 🚨 Problema 4: Datos Redundantes de Escuelas (Ellos Ya Volaron)
- **Dónde:** `/escuelas` (Página pública).
- **El fallo:** La bonita galería 3D que dice "Ellos ya volaron" no lee de las misiones completadas. Lee de una tabla muerta llamada `escuelas_extras` sumada al calendario de programación.
- **La Solución (SSoT):** Conectar la galería directo a `cierres_mision.school_name_snapshot` para que cada nombre mostrado sea genuinamente de una misión completada.

---

### 🛠 Plan de Corrección Definitivo (Tu Única Fuente de Verdad)

Para inyectar el ADN SSoT en todo tu sistema, necesitamos actualizar las APIs. El plan es:

1. **Unificar la regla de totales:** Replicar tu lógica de "Live + Cierres" de `sandbox-vuelos` hacia los paneles de Analytics y el Dashboard Público, para que el `8,962` se vea en todos lados.
2. **Conectar el Cronograma Público:** Enchufar el timeline público de misiones a `staff_journeys` para que refleje operaciones reales.
3. **Conectar la Galería de Escuelas:** Borrar la dependencia de tablas muertas y mostrar solo a las escuelas con Misión Cerrada.
4. **Parchear el Panel Admin (Opcional):** El Admin actualmente usa "consultas directas" a Supabase sin API routes (lo que puede bloquearse por reglas de seguridad y mostrar datos vacíos). Sería ideal migrar sus accesos a API.

¿Te parece bien si comienzo inmediatamente por el **Problema 1 y 2**? Refactorizaré las APIs `sandbox-dashboards/route.js` y `dashboard-data/route.js` para que ambos paneles muestren los 8,962 alumnos exactos que dice tu tabla Sandbox y conectaré el cronograma real.
