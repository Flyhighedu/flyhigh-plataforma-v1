# Operación mínima y recuperación de FlyHigh

24 de septiembre de 2026. Alcance acordado en conversación: conservar alta y consulta de escuelas, organizar las pantallas de los tres empleados y supervisión, evitar bloqueos sin salida y mejorar operación/narración del piloto.

Este documento convierte la propuesta de reconstrucción gradual en un primer recorrido verificable. No representa funciones implementadas ni una certificación de producción. Revisión estática del código local; no se hicieron escrituras remotas.

## Recorrido actual recuperado del código

1. El cronograma administrativo (`src/app/admin/cronograma/page.jsx`) consulta `/api/admin/list-schools` y guarda mediante `/api/admin/save-school`. También hay otros consumidores de estas rutas.
2. Estas rutas leen/escriben `proximas_escuelas`: nombre, fecha, turno, ubicación y otros datos. Las altas de esta API usan estatus `pendiente`.
3. `/staff/dashboard` consulta escuelas desde la fecha local actual, contempla varios estatus y carga hasta 30 registros. Recupera escuela seleccionada, jornada y presencia del equipo. También escucha cambios en `proximas_escuelas`.
4. Las pantallas de preparación y las banderas de la jornada determinan cuándo se llega a operación.
5. En la rama explícita de operación del dashboard:
   - Piloto: `StaffOperationLegacy` → `OperationUI` (vuelos, pausas, audio, narraciones).
   - Docente: `SupervisorBitacoraScreen` (preparación de tanda, identificación de equipo, ruta/destinos, bitácora y audio).
   - Auxiliar: `OperationPanelConstructionScreen`. A pesar de su nombre, tiene una función de marcadores de video para el auxiliar; no equivale a un panel operativo completo.
6. `/supervisor/dashboard` es el panel de seguimiento general. Es distinto de la pantalla de la docente, aunque esta última use “Supervisor” en su nombre de componente.

Los identificadores de personal existen en los datos de escuela. No se certificó aquí el alcance efectivo por usuario: hay que verificar consulta, permisos del servidor y RLS conjuntamente antes de afirmar que cada empleado solo ve escuelas asignadas.

## Hallazgo prioritario: actualización de agenda y cambio de jornada mezclados

En `src/app/staff/dashboard/page.js`, el listener `school_assignments` escucha todos los eventos de `proximas_escuelas`.

Para altas/actualizaciones con fecha actual o futura y estatus `pendiente`, la rama revisada selecciona la escuela recibida y reinicia varios estados de navegación. La rama de archivado también limpia la selección y recarga sin comprobar ahí que el registro sea la escuela activa.

Esto es evidencia de un riesgo en código, no una reproducción confirmada en dispositivos. Revisar junto con `refreshMission`, permisos de lectura y entrega de eventos.

**Regla de reemplazo:** un cambio de agenda actualiza la agenda. Cambiar la jornada activa es otra acción. Agregar la escuela B mientras se opera en A no debe mover a nadie de A ni reiniciar su trabajo. Si cambia o se cancela A, mostrar el cambio y resolverlo explícitamente conservando sus registros.

## Primera entrega funcional propuesta

Recorrido: **registrar escuela → verla en los tres perfiles → abrir/retomar la misma jornada → preparar grupo → registrar un vuelo con narraciones → consultarlo en supervisión → recuperar tras una interrupción**.

La creación de contenido existente se conserva. La primera entrega usa una secuencia pequeña de audios; no exige construir todas las misiones educativas ni sustituir montaje, traslado y cierre al mismo tiempo.

| Superficie | Contenido mínimo propuesto | Responsabilidad |
|---|---|---|
| Agenda administrativa | Alta/edición de escuela y fecha, datos necesarios, equipo cuando corresponda | Mantener programación; no reiniciar jornadas por editar otra escuela |
| Inicio compartido del personal | Escuela y fecha claramente visibles, jornada activa, retomar, acceso a tareas propias y ayuda | Dar orientación y salida a las esperas |
| Operación piloto | Grupo/vuelo actual, inicio/fin de registro, secuencia de narración, pausa/detención de audio, incidencia y sincronización | Control del registro de vuelo y narración; abrir audio no autoriza despegue |
| Operación docente | Preparación y datos del grupo, envío al piloto, grupo actual/siguiente, cierre breve | Preparación del grupo; evitar registro duplicado del mismo vuelo |
| Operación auxiliar | Tareas propias, estado de equipo, incidencia y marcador de video existente | Apoyo operativo; funciones adicionales según necesidades observadas |
| Panel de supervisión | Escuela/jornada, progreso por rol, vuelos/alumnos confirmados, narraciones, incidencias y última sincronización | Consultar hechos y pendientes; no confundir falta de conexión con falta de trabajo |

Estos mínimos son un punto de partida de producto, no una reasignación definitiva de las tareas del equipo.

## Recuperación y restricciones

| Situación | Comportamiento requerido |
|---|---|
| Se cierra la app o se reinicia el teléfono | Ofrecer retomar la jornada y el registro guardado. Mostrar lo que no pudo recuperarse; nunca asumir completado |
| Se pierde la red después de preparar contenido | Conservar acciones localmente cuando sea posible y mostrar sincronización pendiente. Audio offline solo si el archivo fue descargado y verificado |
| Un guardado falla | Mantener datos, mostrar fallo y permitir reintento; no presentar éxito falso |
| Doble toque o reenvío tras reconexión | Un identificador estable por operación evita duplicar el registro confirmado |
| Otro empleado aún no termina | Mantener accesibles las tareas independientes; mostrar qué falta, quién lo confirma y cuándo se actualizó |
| Una dependencia necesaria no se puede confirmar | Restringir esa acción concreta y permitir pedir ayuda. No desbloquear por tiempo transcurrido ni por desconexión |
| Una persona confirma fuera del teléfono original | Registrar verificación/suplencia autorizada con actor, hora, motivo y alcance; no inventar que el empleado original terminó |
| Llega una acción vieja tras reconectar | Comprobar versión/estado actual antes de aplicarla; no sobrescribir silenciosamente avances posteriores |
| Se pulsa “Actualizar” o “Retomar” | Recuperar sin borrar la jornada ni cambiarla a contingencia |
| Se hace un ensayo/demo | Usar datos aislados, sin sumar vuelos reales ni cambiar jornadas operativas |

La interfaz compartida de recuperación tendría estado de conexión, pendientes por sincronizar, reintento y acceso a ayuda. No incluir un “desbloquear todo” que dé por cumplidos requisitos.

## Orden del trabajo

### A. Proteger el recorrido de escuelas y establecer pruebas aisladas

- Registrar el comportamiento actual con datos ficticios y tres sesiones por rol.
- Verificar autorizaciones de alta/edición y acceso del personal antes de reutilizar las rutas existentes.
- Separar actualización de agenda de selección/reanudación de jornada.
- Distinguir error de consulta, agenda vacía y datos guardados sin conexión.
- Probar altas, edición, reprogramación, archivado y dos escuelas en el mismo día sin alterar una sesión activa ajena al cambio.

### B. Construir una jornada mínima con recuperación y el piloto mejorado

- Definir quién registra cada hecho y usar los mismos identificadores de jornada, grupo y vuelo entre perfiles.
- Centralizar permisos y transiciones del recorrido nuevo; aislarlo de atajos y escrituras antiguas sobre los mismos estados.
- Implementar inicio/retomar y recuperación mínima para los tres perfiles.
- Incorporar reproductor táctil compartido entre preparación y operación del piloto, reutilizando biblioteca/fábrica de narraciones.
- Separar estado del audio, estado del registro de vuelo, preparación por rol y conexión del dispositivo.

### C. Cerrar el recorrido con supervisión y validar con el equipo

- Mostrar eventos confirmados y pendientes en el supervisor, con hora del hecho y de sincronización cuando difieran.
- Probar un grupo completo con los tres dispositivos; contrastar registro del vuelo, alumnos y narraciones.
- Repetir solo los escenarios relevantes de fallo y recuperación antes de sustituir el flujo anterior.
- Retirar cada entrada antigua al migrar su responsabilidad; evitar dos pantallas competidoras que decidan el estado de la misma jornada.

## Criterios de aceptación del primer recorrido

1. Una escuela creada aparece para los perfiles autorizados con fecha y datos consistentes.
2. Agregar o archivar otra escuela no cambia ni reinicia la jornada activa.
3. Piloto y docente trabajan sobre el mismo grupo/vuelo, sin duplicar el número de alumnos.
4. El piloto puede preparar y ensayar narraciones sin esperar tareas ajenas; el ensayo no cuenta como vuelo.
5. Terminar o detener una narración no finaliza el vuelo; pausar el vuelo y pausar el audio son acciones distintas.
6. Tras recargar la app se recupera lo guardado y se identifican pendientes, sin reiniciar al resto del equipo.
7. Al recuperar conexión, los reintentos no duplican registros ni pisan cambios posteriores.
8. Un teléfono desconectado aparece como información desactualizada, sin asumir que la persona dejó de trabajar.
9. Toda excepción operativa tiene responsable y motivo y no convierte tareas omitidas en completadas.
10. El supervisor coincide con los registros confirmados; los datos de ensayo permanecen fuera de los resultados reales.

## Límites de esta revisión

No se ha reproducido aún el salto entre escuelas, recorrido visualmente los tres dispositivos ni certificado permisos/base de datos remota. No se cambió el comportamiento de producción. El detalle del reproductor y métricas está en `NARRACION_PRIMERA_ETAPA.md`.
