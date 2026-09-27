# Preparación de visitas y narraciones

## Experiencia implementada

- Inicio del piloto: próxima visita, resumen de preparación, Preparar visita y Ver cronograma. El check-in conserva su flujo independiente.
- `/staff/cronograma`: próximas visitas no archivadas, lista cronológica y mapa con ubicaciones confirmadas. Las visitas futuras se pueden consultar. Conserva la vista y escuela seleccionada durante la sesión.
- `/staff/visitas/[id]`: contexto de la visita, secuencia numerada, agregar narraciones, subir/bajar/quitar, reutilizar preparaciones, guardar borrador, ensayar y confirmar.
- `/staff/narraciones`: biblioteca de lugares y temas generales, búsqueda, escucha previa y guion. El acceso a creación/edición reutiliza el mapa y la fábrica existentes.
- El entorno de la escuela muestra puntos con audio a 10 km, por distancia geográfica en línea recta. No calcula ni aprueba una ruta de vuelo.
- La Mesa de revisión habilita `/staff/visitas/[id]/simulacion`: un ensayo experimental y efímero con controles Modo 3, cámara inclinable y POIs a 10 km. No está expuesto fuera de `FLYHIGH_REVIEW_LAB=1`, no guarda telemetría ni controla una aeronave.

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

La simulación usa MapLibre. Si `.env.review.local` contiene `NEXT_PUBLIC_ARCGIS_API_KEY`, carga ArcGIS World Imagery; la clave debe limitarse a mapas y a los orígenes autorizados. Sin clave muestra el mapa de calles de OpenStreetMap como respaldo de revisión, con atribución visible. `review:setup` conserva esa variable opcional al regenerar las claves locales. Google Map Tiles aún no está integrado ni activo.

### Controles del ensayo

- Dos zonas táctiles delimitadas sin instrucciones escritas. Tocar establece el centro del joystick flotante y no mueve el dron; arrastrar controla movimiento o altura/giro. Soltar, perder el foco o rotar la pantalla deja los controles a cero. Admite dos dedos simultáneos y no intercepta botones, marcadores ni el gimbal.
- Gimbal relativo entre -90° y 0°: tocar no cambia el ángulo. Deslizar lo ajusta desde el valor actual. También admite flechas, Inicio y Fin por teclado. MapLibre permite mirar al horizonte; la vista compatible de Leaflet solo representa el ajuste con zoom.
- Velocidades lenta/normal/rápida: 3/8/18 m/s de desplazamiento, 2/4/6 m/s de ascenso y 35/50/70°/s de giro. Predeterminada: normal. Todas conservan el límite fijo del ensayo de 120 m sobre suelo plano; no representa autorización ni altitud segura de un vuelo real.
- Pantalla completa solicita orientación horizontal cuando el navegador la admite. En caso contrario se conserva la vista normal y se puede girar físicamente el dispositivo. Los cambios de tamaño no recrean el mapa.
- Sin degradado ni desenfoque en el encabezado; se conservan tarjetas independientes para los indicadores y créditos cartográficos obligatorios.
- El ojo muestra/oculta lugares guardados y narraciones. El radar consulta, solo al pulsarlo, las mismas categorías culturales de Overpass que el editor de narraciones. Busca a 3 km de la posición simulada, muestra hasta 200 lugares adicionales y evita duplicados cercanos con el mismo nombre. Los marcadores violetas permiten consultar nombre/distancia; no generan audio ni escriben en el catálogo. Ocultar/mostrar reutiliza el resultado; «Buscar aquí» actualiza la zona. Se manejan resultado vacío, error y cancelación sin reiniciar el mapa.

### Credencial de Google pendiente

En el proyecto de Google Cloud con facturación, habilitar [Map Tiles API](https://console.cloud.google.com/apis/library/tile.googleapis.com) y crear una clave exclusiva en [Credenciales](https://console.cloud.google.com/apis/credentials). Restringirla a Map Tiles API y al origen de consumo que se defina en su integración. Es preferible una clave separada, en la misma cuenta/proyecto, a cambiar los permisos de las claves de narraciones.

No pegar la clave en conversaciones ni incorporarla a Git. Puede guardarse en `.env.local` como `GOOGLE_MAP_TILES_API_KEY` (sin prefijo `NEXT_PUBLIC_`) para la futura integración del servidor. Guardarla por sí solo no activa el satélite; la Mesa bloquea por diseño la herencia de credenciales externas y requerirá configuración explícita de esta integración.

La API lleva `private, no-store` y el service worker usa solo red para este endpoint. No se comparten cachés de preparaciones entre cuentas.

## Comprobaciones

- Lógica: `node --test --test-isolation=none tests/narration-preparation.test.mjs tools/review-lab/core.test.cjs`.
- Integración local, con mesa conectada: `node tools/review-lab/verify-preparations.cjs`. Comprueba autenticación, permisos, cronograma futuro, orden, confirmación, vuelta a borrador, concurrencia, rechazo de contenido inválido y ausencia de cambios operativos. Crea una visita temporal y elimina exclusivamente esa visita al finalizar.
- El usuario realiza las comprobaciones visuales. La mesa dispone de dos visitas ficticias futuras: una cercana a un punto importado y otra sin coordenadas.
- Regresión de controles: `tests/narration-preparation.test.mjs` y `tests/cultural-pois.test.mjs`. El ejecutable Electron de la mesa puede correr `tools/review-lab/verify-mobile.cjs --flight-only`: comprueba ingreso LAN, renderizado nativo, cámara, estabilidad, pantalla completa, controles multitáctiles, gimbal, velocidades y radar. Utiliza imágenes y respuestas del radar de prueba para no automatizar descargas masivas de servicios públicos; no acredita disponibilidad del proveedor.

Recorrido de revisión: Inicio → Ver cronograma → escuela futura → agregar tres narraciones → cambiar orden → volver y entrar → ensayar → dejar lista → modificar orden y verificar regreso a borrador. Comprobar también lista/mapa, escuela sin ubicación y error de reproducción.

## Límites de esta entrega

No integra aún la secuencia en la pantalla de Operación. No reproduce automáticamente, no graba métricas de ensayo y no descarga audios para uso offline. La preparación confirmada significa que el orden fue confirmado, no que se haya comprobado equipo, salida de sonido o condiciones de vuelo. La generación de contenido conserva los servicios y permisos existentes; la mesa aislada no recibe credenciales externas de generación.
