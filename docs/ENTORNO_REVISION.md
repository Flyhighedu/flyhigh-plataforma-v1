# Mesa de revisión local de FlyHigh

La mesa abre las pantallas reales de Piloto, Maestra, Auxiliar y Supervisión general desde el mismo código de `web` que se despliega. Un cambio hecho en esos componentes aparece aquí al recargar y llegará a producción cuando se despliegue esa versión del repositorio. La base de datos es distinta: el laboratorio usa Supabase en esta computadora, con escuela, jornada y cuentas ficticias. Ningún vuelo de prueba debe alimentar las métricas reales.

## Puesta en marcha

1. Instalar WSL 2 y Docker Desktop para Windows, reiniciar el equipo si Windows lo solicita y abrir Docker Desktop hasta que el motor esté activo.
2. Abrir `Abrir revision FlyHigh.vbs` en la raíz del proyecto, o ejecutar `npm run review` desde `web`.
3. Pulsar **Conectar pruebas**. La primera vez, la mesa inicia Supabase local, aplica el esquema de revisión, crea una escuela y jornada ficticias, genera cuatro cuentas y arranca Next en `http://localhost:3100`. La descarga inicial de contenedores puede tardar varios minutos.
4. Pulsar **Entrar** en cada perfil. Se utiliza el formulario real de FlyHigh con las cuentas locales; no hace falta teclear contraseñas. Las cuatro sesiones se conservan por separado al cerrar la mesa.

Como alternativa para diagnosticar el arranque, ejecutar `npm run review:setup` desde `web`. La configuración generada se guarda en `.env.review.local`; las cuentas ficticias quedan en `.review-lab/test-accounts.json`. Ambos archivos se excluyen de Git. La carpeta del proyecto está en OneDrive, por lo que su sincronización es independiente de Git.

## Cómo se ve y qué prueba

Cada panel inicia en **vista celular vertical de proporción 9:19,5**, con un ancho interno estable de 390 píxeles CSS. La mesa escala esa vista para acomodarla a la tarjeta, de modo que reducir la tarjeta no comprime el diseño de FlyHigh. El botón **Vista amplia** cambia sólo ese panel; **Vista celular** lo devuelve. **Ocupar ventana** ajusta las cuatro pantallas a la altura disponible sin deformar la proporción; **Vista normal** vuelve al diseño anterior. **Modo oscuro** cambia los controles de la mesa y conserva los colores reales de FlyHigh dentro de cada pantalla. Las opciones de cada perfil agrupan Inicio, Recargar, Sin red, Anotar e Inspeccionar. **Enfocar** centra un perfil, y **Ver las cuatro** restaura la comparación. La aplicación dentro del panel es la misma ruta real de `/staff/dashboard` o `/supervisor/dashboard`; los botones cambian el tamaño de su navegador, no sustituyen sus componentes.

**Inicio** vuelve al tablero del perfil; **Recargar** actualiza ese panel; **Sin red** simula una desconexión sólo para ese perfil; **Anotar** guarda un hallazgo local; **Inspeccionar** abre las herramientas de desarrollo. El informe se abre con **Mis hallazgos** y vive en `.review-lab/HALLAZGOS.md`.

Las cuatro pantallas comparten la misma jornada local. Así se pueden observar esperas, cambios de estado y métricas entre roles. La mesa no crea una rama paralela del código. Los cambios de estructura de base requieren migraciones revisadas para ambos entornos antes de desplegar.

## Aislamiento y alcance técnico

La mesa sólo acepta Supabase en `http://127.0.0.1:54321` o `http://localhost:54321`; compara las claves con `.env.local` y rechaza el proyecto conocido de producción. Next arranca con variables de pruebas saneadas y una compilación separada `.next-review`. Cada rol tiene cookies y almacenamiento propios. El modo antiguo de suplantación se desactiva en el laboratorio para obligar al acceso real de cada cuenta.

El esquema local inicial está en `tools/review-lab/backend/supabase/migrations`. Se generó a partir de metadatos estructurales públicos de PostgREST, **sin registros de negocio**; incluye las tablas que la aplicación expone, permisos de lectura/escritura para usuarios autenticados de prueba, Storage y Realtime necesarios para revisar flujos. Estos permisos locales son deliberadamente sencillos y **no certifican igualdad con las políticas, funciones, índices o restricciones de producción**. El historial remoto tiene migraciones que no están representadas exactamente por los archivos legacy del repositorio; ver `MIGRATIONS_STATUS.md`. Antes de desplegar cambios de esquema, reconciliar esa historia y verificar el esquema real.

La prueba automatizada de la mesa usa un servidor sintético local, no FlyHigh: `npm run review:test` y los modos `--self-test=write` / `--self-test=read` comprueban separación y persistencia de sesiones, bloqueo de producción, desconexión individual y tamaños de vista. La prueba completa de jornadas, narraciones y métricas exige que Docker y Supabase local estén activos. Cámara, GPS y audio deben comprobarse también en teléfonos físicos.

## Estado de instalación

El 25 de septiembre de 2026 quedó funcionando Supabase local en Docker Desktop. Se comprobaron el acceso de las cuatro cuentas separadas y sus tableros con la misma escuela ficticia; Supervisión general muestra a los tres empleados. La mesa también pasó sus pruebas de aislamiento de sesiones, cambio de vista, proporción de celular y ajuste a la ventana. El esquema local sigue siendo una aproximación estructural para revisión y no equivale a certificar las reglas de producción.
