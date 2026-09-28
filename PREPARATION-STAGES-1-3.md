# Preparación de experiencias — etapas 1 a 3

## Entrega

Implementación local sobre `feature/piloto-narraciones`. Respaldo del trabajo anterior: `9132ccb`. No se publicó ni desplegó esta iteración.

### Base y modelo

- ScheduleScreen usa ScheduleMap con su contrato de marcadores; PreparationMap queda dedicado al editor.
- El instalador local aplica planes, preparation_context y preferencias en una transacción.
- Coordenadas ausentes, vacías o inválidas no se convierten en puntos en cero. Cero válido sigue permitido.
- El editor pasa su catálogo al mapa, evitando una segunda carga independiente. La caché del mapa independiente queda separada por usuario.
- visit_narration_plans.items mantiene la secuencia canónica. Cada snapshot v2 añade behavior route/reference, location e is_general_topic, conservando narrativa y fase.
- preparation_context mantiene escuela y fase. review queda reservado como null; no afirma una revisión 3D.
- La geometría se deriva de escuela, puntos route con ubicación y regreso. References y temas conservan su posición narrativa sin insertar destinos físicos.
- Preparaciones antiguas se normalizan sin reemplazar silenciosamente el texto guardado. La siguiente escritura usa el modelo compatible v2.
- pilot_poi_preferences conserva el comportamiento habitual privado por usuario y POI, con RLS. Cada visita puede sobrescribirlo sin cambiar el catálogo ni la preferencia.

### Construcción 2D

- Leaflet existente, escuela destacada, recorrido azul, números de secuencia, referencias diferenciadas y POI secundarios agrupados.
- Ficha integrada con una acción principal y opción discreta Punto de referencia.
- Una sola secuencia canónica para mapa y lista; alternativa móvil Mapa/Secuencia.
- Subir/Bajar, arrastre conservado, mensajes inmediatos y Deshacer para agregar, quitar, ordenar y cambiar comportamiento.
- Escritor serial de autoguardado: una respuesta antigua no sustituye una edición nueva; revisión optimista, borrador local, reintento y recuperación tras conflicto.
- Duración mostrada exclusivamente como duración de narraciones.

### Migraciones

Aplicadas únicamente en Supabase local aislado:

1. 20260925120000_visit_narration_plans.sql (idempotente).
2. 20260927180000_preparation_location_and_phase.sql.
3. 20260928010000_preparation_poi_preferences.sql (nueva).

La migración nueva deberá aplicarse en el entorno de destino antes de desplegar este código. No se migró producción.

## Verificación realizada

- Suite completa: 105 pruebas aprobadas, cero fallos.
- Nuevo modelo: 11 pruebas de geometría, referencias, legado, coordenadas, contenido, agrupamiento, cola serial, undo, errores, conflictos y recuperación.
- Integración contra servidor y Supabase local: autenticación, escuela obligatoria incluso en peticiones antiguas, guardado/lectura, v2, preferencias privadas, sobrescritura por visita, RLS, confirmación, concurrencia, contenido inválido y ausencia de escrituras operativas; aprobada.
- ESLint de módulos afectados: aprobado.
- npm run build: aprobado. El primer intento quedó bloqueado por spawn EPERM; el segundo completó las 127 páginas. Advertencias de middleware y archivos grandes excluidos del precache permanecen.
- Inspección de aplicación real: escritorio y celular con viewport efectivo 390 × 844; escuela, catálogo, selección, ficha, referencias, preferencia privada, Subir/Bajar, quitar, Deshacer, autoguardado, recarga y confirmación observados.
- Se corrigieron durante la inspección el encuadre del selector escolar, pérdida de foco en marcadores y superposición de controles del mapa sobre la ficha.
- Captura local: .review-lab/preparation-captures/mobile-sequence.png.

## Pendiente y límites de validación

El usuario pidió detener las pruebas mediante la aplicación y realizará las restantes.

- Arrastre: el componente y su conexión con el estado canónico están implementados, pero los intentos automatizados no produjeron un reordenamiento observable. No se declara validado. Revisar con dedo o ratón y comprobar Deshacer de todo el gesto.
- Cronograma: contrato corregido y ruta HTTP validada; falta inspección visual del mapa.
- Legado, coordenadas ausentes, recuperación y conflictos: cubiertos en pruebas de modelo/API, pero no todos recorridos visualmente de extremo a extremo.
- Confirmar en dispositivo real la altura/desplazamiento de la ficha y accesibilidad de la acción principal en pantallas más bajas. La prueba actual es de viewport, no hardware móvil.
- tools/review-lab/verify-visit-planner.cjs conserva el guion de interfaz anterior y necesita actualizarse antes de reutilizarlo como prueba E2E. No se ejecutó como evidencia de esta entrega.

## Siguiente etapa

El modelo canónico queda disponible para conectar futuras propuestas o revisión 3D. No se implementó recomendador, observación automática, tiempos de vuelo, nueva operación ni integración 3D completa. El ensayo libre existente permanece separado; esta iteración no valida su integración con la nueva preparación.
