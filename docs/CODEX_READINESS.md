# Estado de preparación en Codex

Revisión: 22 de septiembre de 2026.

## Accesos

- Vercel: sesión autenticada; carpeta enlazada a `flyhigh-plataforma-v1`, equipo `david-sanchezs-projects-977e9f25`. GitHub conectado a `Flyhighedu/flyhigh-plataforma-v1`, rama de producción `main`, raíz del repositorio. Producción READY en el commit `9758cabea0def9005789cae89310df8c804ab1a7`, dominio `flyhighedu.com.mx`.
- Supabase: CLI autenticada; proyecto `sbzwffqhzmlxtnjyjduk` ACTIVE_HEALTHY. Consultas administrativas de metadatos verificadas. La CLI se usa con `--linked --project-ref sbzwffqhzmlxtnjyjduk`; no se convirtió la carpeta legacy en una cola apta para db push.
- GitHub: sesión `flyhighedumx-pixel`, solo lectura (`push: false`). Autorización de la cuenta propietaria `Flyhighedu` pendiente de completar y verificar. El usuario confirmó que esa cuenta le pertenece.

## Configuración y cambios locales

- ADMIN_PASSWORD, ADMIN_AUTH_SECRET y CRON_SECRET generados con aleatoriedad criptográfica a petición del usuario. Guardados en `.env.local` y Vercel Production/Preview como secretos. No se incluyeron valores en este informe. La contraseña se consulta en `.env.local` y conviene guardarla en un gestor personal.
- Se retiraron los valores de respaldo del login y firma administrativa. Los tokens requieren firma válida, rol admin y caducidad válida.
- Los cron rechazan solicitudes cuando falta configuración o autorización.
- Middleware exige token administrativo en create-user, edit-user, reset-password, set-active y list de `/api/staff`.
- Esta corrección NO es una auditoría completa: otras APIs que usan service_role aún requieren revisar su autorización por rol. Hay APIs compartidas por ventas, supervisor y página pública; protegerlas en bloque puede romper esos consumidores. La cookie administrativa sigue siendo legible por JavaScript porque la interfaz actual depende de ello.
- `.gitignore` reparado para eliminar bytes nulos. Variables y enlace de Vercel siguen ignorados.
- 100 errores de ESLint corregidos sin desactivar reglas. Quedan 87 errores y 167 advertencias en src; ver LINT_STATUS.md y lint-baseline.json.
- 40 SQL locales contrastados con 58 migraciones registradas y catálogo remoto. Solo cinco tienen candidatos directos por nombre; se conserva la incertidumbre sobre equivalencia de contenido. Se archivaron las siete migraciones externas como referencias dentro de docs/legacy-migrations/external. Ver MIGRATIONS_STATUS.md.

## Verificaciones

- Build de producción aprobado después de los cambios: 118 páginas generadas. Advertencias existentes de middleware y recursos grandes fuera del precache offline.
- Prueba de tokens: falta de secreto, alteración de payload, caducidad, rol no administrativo y cambio de secreto rechazados.
- Ocho comprobaciones HTTP locales iniciales pasaron: login y cron sin configuración responden 503; cinco rutas de gestión de cuentas sin sesión responden 401.
- Tras configurar secretos: login correcto 200, contraseña incorrecta 401 y cron sin autorización 401. El cookie secure de producción no se conserva en el cliente HTTP de prueba sobre localhost; no se verificó aquí una sesión de navegador sobre HTTPS.
- git diff --check aprobado con la configuración normal del repositorio.

## Pendientes reales

1. Completar acceso GitHub de Flyhighedu y verificar push.
2. Revisar los 87 errores de lint restantes con pruebas por flujo; no está todo saneado.
3. Reconciliación SQL definitiva y entorno de pruebas antes de automatizar migraciones. `poi_info_cache` no existe aunque dos APIs la utilizan; faltan también tres índices de eventos según el catálogo. No se aplicaron cambios remotos a la base.
4. Revisar autorización del resto de APIs administrativas y de staff, además del modo de prueba y exposición de datos en RLS.
5. Revisar variables de integraciones: GROQ_API_KEY, META_ACCESS_TOKEN y META_PHONE_NUMBER_ID están referenciadas en código/local pero no aparecieron en las variables del proyecto de Vercel. No se copiaron sin validar su uso y destino.
6. Validar preview y flujos funcionales antes de publicar. Ningún commit, push, deploy o migración se ejecutó durante esta revisión. Las nuevas variables remotas entran en vigor en despliegues posteriores.

El repositorio es público. Los dumps/auditorías ya versionados requieren una revisión de contenido; no se ha certificado que estén libres de datos sensibles.
