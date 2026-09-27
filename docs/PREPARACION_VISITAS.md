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

El ensayo habitual usa MapLibre. Si `.env.review.local` contiene `NEXT_PUBLIC_ARCGIS_API_KEY`, carga ArcGIS World Imagery; la clave debe limitarse a mapas y a los orígenes autorizados. Sin clave muestra el mapa de calles de OpenStreetMap como respaldo de revisión, con atribución visible. `review:setup` conserva esa variable opcional al regenerar las claves locales. La prueba de Google 3D descrita abajo es una entrada separada; no cambia el proveedor del ensayo habitual.

### Controles del ensayo

- Dos zonas táctiles delimitadas sin instrucciones escritas. Tocar establece el centro del joystick flotante y no mueve el dron; arrastrar controla movimiento o altura/giro. Soltar, perder el foco o rotar la pantalla deja los controles a cero. Admite dos dedos simultáneos y no intercepta botones, marcadores ni el gimbal.
- Gimbal relativo entre -90° y 0°: tocar no cambia el ángulo. Deslizar lo ajusta desde el valor actual. También admite flechas, Inicio y Fin por teclado. MapLibre permite mirar al horizonte; la vista compatible de Leaflet solo representa el ajuste con zoom.
- Velocidades lenta/normal/rápida: 3/8/18 m/s de desplazamiento, 2/4/6 m/s de ascenso y 35/50/70°/s de giro. Predeterminada: normal. Todas conservan el límite fijo del ensayo de 120 m sobre suelo plano; no representa autorización ni altitud segura de un vuelo real.
- Pantalla completa solicita orientación horizontal cuando el navegador la admite. En caso contrario se conserva la vista normal y se puede girar físicamente el dispositivo. Los cambios de tamaño no recrean el mapa.
- Sin degradado ni desenfoque en el encabezado; se conservan tarjetas independientes para los indicadores y créditos cartográficos obligatorios.
- El ojo muestra/oculta lugares guardados y narraciones. El radar consulta, solo al pulsarlo, las mismas categorías culturales de Overpass que el editor de narraciones. Busca a 3 km de la posición simulada, muestra hasta 200 lugares adicionales y evita duplicados cercanos con el mismo nombre. Los marcadores violetas permiten consultar nombre/distancia; no generan audio ni escriben en el catálogo. Ocultar/mostrar reutiliza el resultado; «Buscar aquí» actualiza la zona. Se manejan resultado vacío, error y cancelación sin reiniciar el mapa.

### Prueba local de Google Photorealistic 3D Tiles

Desde Preparar visita → **Probar relieve 3D** se abre `/staff/visitas/[id]/simulacion-3d`, con CesiumJS y Google Photorealistic 3D Tiles. Solo existe en desarrollo con `FLYHIGH_REVIEW_LAB=1`, entorno `isolated-test` y Supabase local validado. Requiere piloto o auxiliar activo y visita accesible. Si falta la ubicación escolar, la entrada dice **Elegir despegue y probar 3D**: abre una referencia en Uruapan y exige seleccionar y confirmar un punto del mapa antes de habilitar vuelo. No se asigna esa referencia a la escuela. El punto es temporal, se pierde al salir y no escribe coordenadas, escuelas, historial ni telemetría.

En el proyecto de Google Cloud con facturación, habilitar [Map Tiles API](https://console.cloud.google.com/apis/library/tile.googleapis.com) y crear una clave exclusiva en [Credenciales](https://console.cloud.google.com/apis/credentials). Restringirla a Map Tiles API y, cuando sea viable, a la IP pública de salida del servidor; esta integración es del servidor, no usa restricciones de referente del navegador. Es preferible una clave separada, en la misma cuenta/proyecto, a cambiar permisos de las claves de narraciones. Configurar cuotas y alertas de presupuesto: no es un proveedor gratuito ilimitado y abrir una sesión 3D consume la API.

Guardar la clave únicamente en `.env.local` como `GOOGLE_MAP_TILES_API_KEY`, sin prefijo `NEXT_PUBLIC_`, sin pegarla en conversaciones ni incorporarla a Git. La API local lee expresamente **solo esa credencial** como excepción autorizada al aislamiento de integraciones; el arranque de la Mesa sigue bloqueando la herencia del resto del entorno. Las rutas de datos están autenticadas, verifican recursos firmados por usuario con caducidad y solo permiten el host/rutas de Google 3D. La clave no viaja al teléfono. No se reenvían errores del proveedor que puedan contenerla.

El motor y sus workers se sirven desde el paquete Cesium instalado, por el mismo origen LAN y sin CDN. El servidor no persiste datos de Google; conserva las directivas de caché del proveedor en recursos binarios y el service worker no los guarda. Se mantienen los créditos visibles de Google Maps y de los proveedores de cada sector.

El ensayo 3D conserva Modo 3, gimbal de -90° a 0°, marcadores y radar. La cámara usa una altura relativa al **despegue**, no un desplazamiento automático siguiendo cada pendiente. La protección mantiene un margen de 8 m sobre la geometría medida: una malla más alta eleva la cámara incluso en pausa; una medición gruesa no reemplaza una altura mayor ya confirmada en el mismo punto. Ante una zona sin superficie medida, se detiene el desplazamiento horizontal mientras se consulta. Son aproximaciones visuales, no detección de obstáculos ni certificación de que cada triángulo futuro de Google esté disponible. La protección tiene prioridad sobre el techo virtual y su corrección aparece en la telemetría.

El icono de mapa permite mover la vista cenital, tocar un nuevo punto y pulsar **Despegar aquí**. La confirmación calcula la superficie antes de mover la cámara, reutiliza la sesión de Google y no recrea WebGL. **Regresar al despegue** lleva al último punto confirmado, no altera la escuela. Un error conserva el selector y no confirma coordenadas inventadas.

### Cabina y ajustes de referencia Air 3S / RC 2

- Telemetría inferior en horizontal: altura relativa, distancia al despegue, velocidad horizontal/vertical, rumbo y gimbal. No se inventan batería, señal GNSS ni sensores reales.
- Ajustes → **Control → Ajustes de ganancia y Expo**: perfiles independientes **Cine, Normal y Sport**. Editar un perfil no activa ese modo ni modifica otro. Se conservan durante el ensayo; restablecer solo afecta al perfil abierto.
- **11 sliders por perfil**: velocidad horizontal, ascenso, descenso, velocidad angular, suavidad de giro, sensibilidad de frenado, Expo de ascenso/descenso, Expo de giro, Expo de avance/traslación, velocidad máxima de inclinación y suavidad del gimbal. Todos se conectan a la respuesta del simulador; la velocidad del gimbal limita los grados por segundo reales de la cámara.
- Ajustes → **Seguridad**: techo virtual 120/300/500 m (120 inicial). Bajar el techo no teletransporta una aeronave que ya está arriba: permite descender y bloquea más ascenso. No altera las restricciones de una aeronave real.
- Ajustes → **Imagen**: Alta por defecto (error geométrico máximo 6 px, hasta 1.5 píxeles de render por píxel CSS, caché de memoria 192 MiB) o Equilibrada (12 px, 1×, 128 MiB). Los créditos de Google y proveedores siguen visibles y compactos. El crédito del motor dice CesiumJS: no se usan servicios Cesium ion.
- La estructura toma como referencia [DJI Fly: Gain & Expo](https://repair.dji.com/help/content?customId=01700009257&lang=en&paperDocType=ARTICLE&re=US&spaceId=17), el [manual Air 3S](https://dl.djicdn.com/downloads/DJI_Air_3S/UM/DJI_Air_3S_User_Manual_v1.0_en.pdf) y sus [especificaciones](https://www.dji.com/air-3s/specs). Los perfiles iniciales y ecuaciones son propios del ensayo, no valores de fábrica certificados. Los rangos de velocidad se acotan a 21 m/s horizontal y 10 m/s vertical; no se simula viento ni el firmware/control de vuelo DJI. Las versiones/regiones pueden tener otros rangos en el RC 2.

La carga exige WebGL compatible y conexión; el detalle y los edificios dependen de la cobertura de Google. Mejorar los ajustes no crea texturas ausentes. Si no se puede confirmar la superficie, se indica el error; no se degrada silenciosamente a calles.

La API lleva `private, no-store` y el service worker usa solo red para este endpoint. No se comparten cachés de preparaciones entre cuentas.

## Comprobaciones

- Lógica: `node --test --test-isolation=none tests/narration-preparation.test.mjs tools/review-lab/core.test.cjs`.
- Integración local, con mesa conectada: `node tools/review-lab/verify-preparations.cjs`. Comprueba autenticación, permisos, cronograma futuro, orden, confirmación, vuelta a borrador, concurrencia, rechazo de contenido inválido y ausencia de cambios operativos. Crea una visita temporal y elimina exclusivamente esa visita al finalizar.
- El usuario realiza las comprobaciones visuales. La mesa dispone de dos visitas ficticias futuras: una cercana a un punto importado y otra sin coordenadas.
- Regresión de controles: `tests/narration-preparation.test.mjs` y `tests/cultural-pois.test.mjs`. El ejecutable Electron de la mesa puede correr `tools/review-lab/verify-mobile.cjs --flight-only`: comprueba ingreso LAN, renderizado nativo, cámara, estabilidad, pantalla completa, controles multitáctiles, gimbal, velocidades y radar. Utiliza imágenes y respuestas del radar de prueba para no automatizar descargas masivas de servicios públicos; no acredita disponibilidad del proveedor.
- Seguridad de Google: `node --test --test-isolation=none tests/google-3d-proxy.test.mjs`. La prueba optativa `tools/review-lab/verify-google-3d.cjs`, con el ejecutable Electron de la Mesa, abre **una vista real oculta** con consumo de API, sin capturas ni exportación: comprueba ingreso LAN, renderizado de mallas, cámara sobre superficie, créditos, controles, estabilidad y que la clave no llegue al navegador. No ejecutarla repetidamente como prueba gratuita ni conectarla a CI.
- `tests/flight-cockpit.test.mjs` comprueba superficie, techo, los 11 controles, independencia de perfiles, tasas de ascenso/descenso/giro, curvas por eje, frenado y dinámica del gimbal. La prueba oculta incluye `verify-google-cockpit.cjs` para menú, créditos, selección temporal y una inyección de malla más alta durante vuelo estacionario. La opción `--missing-origin` usa una visita ficticia existente sin coordenadas, exige elegir despegue y verifica que el registro sigue sin modificaciones.

Recorrido de revisión: Inicio → Ver cronograma → escuela futura → agregar tres narraciones → cambiar orden → volver y entrar → ensayar → dejar lista → modificar orden y verificar regreso a borrador. Comprobar también lista/mapa, escuela sin ubicación y error de reproducción.

## Límites de esta entrega

No integra aún la secuencia en la pantalla de Operación. No reproduce automáticamente, no graba métricas de ensayo y no descarga audios para uso offline. La preparación confirmada significa que el orden fue confirmado, no que se haya comprobado equipo, salida de sonido o condiciones de vuelo. La generación de contenido conserva los servicios y permisos existentes; la mesa aislada no recibe credenciales externas de generación.
