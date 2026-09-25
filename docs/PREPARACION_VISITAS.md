# Preparación de visitas y narraciones

## Experiencia implementada

- Inicio del piloto: próxima visita, resumen de preparación, Preparar visita y Ver cronograma. El check-in conserva su flujo independiente.
- `/staff/cronograma`: próximas visitas no archivadas, lista cronológica y mapa con ubicaciones confirmadas. Las visitas futuras se pueden consultar. Conserva la vista y escuela seleccionada durante la sesión.
- `/staff/visitas/[id]`: contexto de la visita, secuencia numerada, agregar narraciones, subir/bajar/quitar, reutilizar preparaciones, guardar borrador, ensayar y confirmar.
- `/staff/narraciones`: biblioteca de lugares y temas generales, búsqueda, escucha previa y guion. El acceso a creación/edición reutiliza el mapa y la fábrica existentes.
- El entorno de la escuela muestra puntos con audio a 10 km, por distancia geográfica en línea recta. No calcula ni aprueba una ruta de vuelo.

## Secuencia y guardado

Cada preparación pertenece al usuario y al registro de visita de `proximas_escuelas`, conservando la fecha para detectar reprogramaciones. Una misma escuela puede tener preparaciones para distintas visitas. Se pueden copiar otras preparaciones como borrador; las de la misma CCT aparecen primero.

La selección contiene hasta 40 narraciones únicas. Guarda identificadores y una copia del nombre, guion, URL de audio y metadatos de generación. El servidor obtiene estos valores del catálogo, no de los datos enviados por el cliente.

Los cambios se guardan con una espera de 500 ms y devuelven el estado a borrador. La interfaz distingue pendiente, guardando, guardado y error. Una copia local por usuario/visita permite recuperar cambios pendientes al volver; no es una promesa de reproducción offline. No se puede confirmar mientras haya cambios pendientes o audios faltantes.

Confirmar requiere una secuencia no vacía, audio y la versión actual del contenido. Un cambio de contenido, desaparición de una narración o reprogramación exige revisión. La concurrencia usa un número de revisión: una escritura antigua recibe 409 y no sobrescribe el trabajo guardado.

El ensayo usa una sola instancia de audio por pantalla. Al finalizar prepara el siguiente elemento, pero nunca lo reproduce automáticamente. Permite pausar, continuar, detener, omitir y repetir el ensayo. Salir detiene el audio. No escribe jornadas, check-ins, vuelos, métricas ni datos del supervisor.

## Permisos y despliegue

La API `/api/staff/preparation` autentica al usuario y requiere perfil activo de piloto o auxiliar. El cronograma respeta la política de lectura existente de `proximas_escuelas`; no inventa asignaciones de equipo que el esquema actual no contiene. Cada usuario solo puede leer sus preparaciones. Las escrituras pasan por la API, que verifica visita accesible, usuario, contenido y revisión. La tabla tiene RLS y no permite escrituras directas de clientes.

Migración de producción preparada, **no aplicada a producción**: `supabase/migrations/20260925120000_visit_narration_plans.sql`. Aplicarla antes de desplegar estas pantallas con el procedimiento de migraciones autorizado del proyecto. No ejecutar el conjunto de migraciones antiguas a ciegas.

La mesa de revisión aplica exactamente esa migración mediante `tools/review-lab/migrate-preparations.cjs`, con destino fijo local y validación previa. También se aplica al conectar mediante `setup-local.cjs`. El contenido oficial mantiene la sincronización unidireccional existente. No hay cambios de datos en producción.

La API lleva `private, no-store` y el service worker usa solo red para este endpoint. No se comparten cachés de preparaciones entre cuentas.

## Comprobaciones

- Lógica: `node --test --test-isolation=none tests/narration-preparation.test.mjs tools/review-lab/core.test.cjs`.
- Integración local, con mesa conectada: `node tools/review-lab/verify-preparations.cjs`. Comprueba autenticación, permisos, cronograma futuro, orden, confirmación, vuelta a borrador, concurrencia, rechazo de contenido inválido y ausencia de cambios operativos. Crea una visita temporal y elimina exclusivamente esa visita al finalizar.
- El usuario realiza las comprobaciones visuales. La mesa dispone de dos visitas ficticias futuras: una cercana a un punto importado y otra sin coordenadas.

Recorrido de revisión: Inicio → Ver cronograma → escuela futura → agregar tres narraciones → cambiar orden → volver y entrar → ensayar → dejar lista → modificar orden y verificar regreso a borrador. Comprobar también lista/mapa, escuela sin ubicación y error de reproducción.

## Límites de esta entrega

No integra aún la secuencia en la pantalla de Operación. No reproduce automáticamente, no graba métricas de ensayo y no descarga audios para uso offline. La preparación confirmada significa que el orden fue confirmado, no que se haya comprobado equipo, salida de sonido o condiciones de vuelo. La generación de contenido conserva los servicios y permisos existentes; la mesa aislada no recibe credenciales externas de generación.
