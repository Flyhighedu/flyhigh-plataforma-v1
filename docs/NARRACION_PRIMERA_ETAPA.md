# Primera etapa: narración accesible y medible

Fecha: 24 de septiembre de 2026. Propuesta, no implementación de producción.

## Decisión recomendada

Crear un módulo pequeño de narración dentro de FlyHigh, con acceso propio desde el menú del piloto y desde operación. Reutilizar usuarios, biblioteca y supervisor. Su acceso no dependerá de que los demás terminen tareas de la jornada.

La primera entrega permite preparar una secuencia, reproducirla con botones y registrar qué ocurrió. La simplificación completa de la operación de los tres empleados queda como una etapa separada. Abrir o ensayar narraciones no debe cambiar el estado de una jornada ni equivaler a autorizar un vuelo.

El usuario confirmó que la otra aplicación es el panel de supervisor de FlyHigh. La integración propuesta se dirige a ese panel.

## Qué confirmé en el código

Revisión estática de los archivos locales actuales, incluidos cambios existentes sin commit. No se probó la operación en dispositivos, no se consultaron registros de producción ni se modificó la base de datos.

| Lugar actual | Evidencia | Consecuencia para la propuesta |
|---|---|---|
| `/staff/dashboard` | Selecciona pantallas por estado, rol y banderas compartidas | Insertar el reproductor únicamente al final de este flujo conservaría las esperas |
| `PilotMusicAmbienceScreen` | El inicio conjunto requiere música del piloto, docente listo, auxiliar listo y referencia de foto del stand | La entrada a narraciones necesita independencia de este conjunto de condiciones |
| `TeacherOperationReadyScreen` | La docente no puede confirmar su preparación hasta que el piloto confirme ambientación musical | Hay dependencias cruzadas concretas que deben revisarse al rediseñar operación |
| `HeaderHamburgerMenu` | “Directo a operación” escribe `OPERATION`, registra contingencia y redirige | Este atajo cambia la jornada; no sirve como acceso neutro a la biblioteca |
| `/staff/mapeo` → `TacticalMapScreen` → `POIDetailModal` | Edición de guion y generación/guardado de audio mediante `SharedNarrativeFactory` | Reutilizar la creación de contenido existente |
| `/staff/poi` → `POIMapEditor` | Editor sencillo de puntos de interés | No confundir esta pantalla con la fábrica completa de narraciones |
| `StaffOperationLegacy` → `OperationUI` → `CopilotOrbUI` | Narración integrada con registro de vuelo, música, micrófono y reconocimiento de voz | Separar el reproductor de audio del motor de reconocimiento; compartirlo entre acceso propio y operación |
| `useVoiceCopilot` | Reproducción, cancelación y fin del audio viven dentro del reconocimiento | No basta con cambiar el aspecto del botón del micrófono |
| `/api/official-pois` | Carga el Directorio Global ordenado por `sort_order`; operación agrega puntos personales por fecha de creación | Un catálogo ordenado no es todavía una secuencia elegida para un vuelo |
| `/supervisor/dashboard` | Escucha cambios de jornadas, eventos y bitácora de vuelos; muestra grabaciones y auditorías | Conservar fuentes operativas y agregar información específica de reproducción |
| `UnifiedFlightCard` | Evalúa datos educativos, energía vocal, interacción y participación audible atribuidos al piloto | El modelo híbrido necesita distinguir contenido grabado, intervención humana y observación del grupo |

## Pantallas de la primera entrega

### 1. Preparar experiencia

Acceso propuesto: `/staff/narraciones`, desde cualquier etapa de la jornada y con los permisos del piloto. La ruta aún no existe.

- Elegir audios existentes y ordenar una secuencia pequeña para la escuela/ruta del día.
- Mostrar título, duración y disponibilidad real de cada archivo; excluir o señalar audios faltantes.
- Probar el sonido y verificar descarga antes de depender de la reproducción sin conexión.
- Guardar la selección para reutilizarla en el siguiente grupo.
- Ensayar sin jornada activa. Una sesión de ensayo no cuenta como vuelo ni como actividad real del equipo.
- Para uso real, vincular la sesión a la jornada y al vuelo existente cuando sea posible. Si no hay vuelo registrado, mostrar “sesión sin vincular”; no inventar uno.

Crear/editar un guion continúa en la biblioteca existente. El piloto no debe navegar por el mapa ni generar contenido durante la reproducción.

### 2. Narrar

- Título grande del momento y una pista breve para reconocer cuándo usarlo.
- Botón principal: Reproducir / Pausar / Continuar, según el estado real del audio.
- Controles secundarios: Detener audio, Repetir y Omitir.
- Lista secundaria para saltar a otro momento si cambia el recorrido.
- Al terminar un audio, preparar el siguiente sin reproducirlo automáticamente.
- Un solo audio de narración activo; prevenir doble toque y solapamiento.
- Reducir la música durante la narración usando la lógica existente de `useFlightAudio`, desacoplada del reconocimiento de voz.
- Una pausa de narración no debe confundirse con una pausa operativa. “Detener audio” tampoco termina el vuelo.
- Si falla el archivo, mantener el momento visible con Reintentar / Omitir. Registrar el fallo sin fingir reproducción.
- Desactivar la escucha automática de comandos en este modo. Mantener separada la posibilidad de grabar el micrófono.

El acceso propio sirve para preparar y ensayar aun cuando operación muestre una espera. Durante un vuelo registrado, el mismo reproductor debe estar disponible dentro de operación para evitar cambios de pantalla y duplicación de reproducción.

### 3. Resumen

Resumen breve al cerrar la sesión y tarjeta correspondiente en el supervisor. La pantalla de narración no impone un cuestionario para continuar.

- Audios iniciados y terminados; omisiones, repeticiones y fallos.
- Tiempo efectivamente reproducido y sesión/jornada/vuelo asociados.
- Estado de sincronización y última actualización.
- Observación opcional posterior de la docente: participación observada y un recuerdo expresado por el grupo. “Sin observar” es distinto de cero.

## Tres personas, tareas independientes donde sea posible

| Persona | Primera etapa | Coordinación necesaria |
|---|---|---|
| Piloto | Preparar secuencia y activar los momentos cuando corresponda; intervención breve si procede | Conocer qué grupo/ruta está en curso |
| Docente | Presentar una misión al grupo y hacer un cierre breve | Confirmar la preparación real del grupo; no tiene que liberar cada audio |
| Auxiliar | Continuar montaje, equipo y atención operativa según sus responsabilidades | Informar disponibilidad o incidencias; no tiene que liberar cada audio |

Es una distribución propuesta para validar en una jornada. No se da por hecho que la docente pueda preparar al siguiente grupo mientras el actual está en vuelo: depende de quién atienda al grupo presente y de sus tareas reales.

Principio para el rediseño posterior: una dependencia debe restringir la acción que realmente depende de ella. Las tareas propias, ayuda, incidencias y preparación de narraciones deberían seguir accesibles. Los pendientes administrativos o de evidencia pueden presentarse como avisos donde corresponda; las confirmaciones operativas necesarias no se marcan como realizadas automáticamente.

## Métricas que sí podemos interpretar

| Métrica | Fuente propuesta | Límite |
|---|---|---|
| Reproducciones iniciadas | Evento efectivo de reproducción del dispositivo | Un toque no garantiza que salió sonido; tampoco garantiza que los niños lo oyeron |
| Audios terminados | Fin real del archivo | No demuestra aprendizaje |
| Omitidos y repetidos | Acciones explícitas | Pueden ser decisiones adecuadas del piloto, no errores |
| Fallos | Error de carga/reproducción | Separar problema de archivo, dispositivo y sincronización cuando haya evidencia |
| Tiempo narrado | Tramos realmente reproducidos, excluyendo pausas | No usar duración del archivo multiplicada por clics |
| Interacción con el teléfono | Acciones de interfaz durante la sesión | No equivale a número de miradas ni mide por sí sola carga del piloto |
| Participación/recuerdo | Observación breve y opcional del grupo | No inferirlos del silencio ni de una grabación que no capta al grupo |
| Duración de vuelo / alumnos | Registros operativos existentes | No duplicar vuelos ni alumnos al iniciar una sesión de narración |

No mantener una calificación que penalice al piloto por hablar menos al utilizar narración grabada. Revisar tanto el análisis de audio como las etiquetas del supervisor antes de interpretar resultados del modo híbrido. Una mano levantada no es participación audible.

## Integración técnica acotada

1. Extraer carga de biblioteca y reproducción a piezas compartidas. El reconocimiento de voz pasa a ser un mecanismo opcional de activación.
2. Guardar secuencia/versiones e identificadores originales de audios. Fijar la selección al iniciar una sesión para que una edición en vivo del catálogo no cambie su orden.
3. Registrar sesiones/eventos de narración separados del estado global de operación. Propuesta de eventos: inicio efectivo, pausa, continuación, fin, detención, omisión, error y cierre de sesión.
4. Usar identificadores únicos de sesión y evento, con vínculo a jornada y al identificador real del vuelo cuando exista. Autorizar por usuario/rol y asignación, también en servidor/base de datos.
5. Persistir eventos localmente y sincronizar con deduplicación al recuperar conexión. Distinguir en supervisor hora del evento y hora de recepción, y mostrar datos pendientes/desactualizados.
6. Añadir la tarjeta de narración al supervisor. Reutilizar bitácora y estado de vuelos, sin derivar `OPERATION` de una reproducción de audio.
7. Evitar dos reproductores simultáneos entre pestañas/pantallas y separar ensayos de métricas reales.

El esquema de sesiones y eventos es propuesto. Antes de implementarlo hay que contrastarlo con el esquema y permisos efectivos de Supabase. La cola de sincronización existente no prueba por sí sola disponibilidad de archivos de audio sin conexión.

## Orden de ejecución

**Primero:** preparar una sola secuencia con contenido existente y construir reproductor táctil independiente, persistencia básica y eventos visibles en supervisor. Entrega delimitada, accesible por bandera de función y reversible.

**Después:** probar con los tres roles, en el teléfono y salida de audio reales. Verificar carga de archivos, pausas, cambios de momento, interrupciones del navegador, reinicio, pérdida de red y sincronización sin duplicados. Comprobar que abrir narraciones no modifica estados de otros roles y que iniciar un ensayo no suma vuelos.

**A continuación:** incorporar unas pocas intervenciones grabadas y observar resultados. Las proporciones 40/60, cuatro interacciones y vuelos de ocho minutos de la conversación son hipótesis de diseño, no requisitos ni evidencia de eficacia. La propuesta debe ajustarse a edades, ruta y operación real.

**Más adelante:** simplificar el flujo completo de los tres empleados usando lo aprendido. GPS, reproducción automática, control físico y evaluación educativa más compleja quedan fuera de esta primera entrega.

## Criterio de éxito

El piloto abre, prepara y ensaya narraciones aunque otros tengan pendientes; durante el uso real activa cada momento con una acción clara, y el supervisor puede ver lo ocurrido con su estado de sincronización. Los registros del resto del equipo siguen representando lo que realmente hicieron.
