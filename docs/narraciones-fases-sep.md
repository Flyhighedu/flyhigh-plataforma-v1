# Narraciones por fase: primera iteración

Un punto conserva su investigación compartida y su narración General. El editor común de Administración y Narraciones permite crear cinco versiones independientes: fase 2 (preescolar), 3 (1.º–2.º de primaria), 4 (3.º–4.º), 5 (5.º–6.º) y 6 (secundaria). La pantalla de operación sigue usando General; la selección por grado queda para otra implementación.

Cada versión guarda propósito, enfoque curricular, notas, guion, marca de revisión y audio en `narrative_versions`. Un cambio de guion descarta su audio y revisión, sin modificar otras versiones. Cambiar propósito o referente exige volver a revisar. La marca de revisión es una declaración de la persona editora, no una certificación docente ni de la SEP. Se permiten borradores sin audio.

La generación ofrece una propuesta que debe aceptarse antes de reemplazar el guion. Una respuesta tardía permanece ligada a la fase solicitada aunque se cambie de pestaña. Los errores de generación o guardado conservan la edición abierta. Los audios tienen rutas independientes y su duración se calcula desde el PCM recibido. La calidad de las voces requiere escucha humana.

## Base educativa y alcance

La distribución de grados procede del [Plan de Estudio, p. 157](https://educacionbasica.sep.gob.mx/wp-content/uploads/2024/06/Plan-de-Estudio-ISBN-ELECTRONICO.pdf#page=157). El catálogo inicial incorpora un referente de naturaleza por fase, con resúmenes y enlaces a los programas oficiales de 2024:

- [Fase 2, p. 46](https://educacionbasica.sep.gob.mx/wp-content/uploads/2024/09/2425_s0_Programa_Sintetico_Fase2.pdf#page=46).
- [Fase 3, p. 55](https://educacionbasica.sep.gob.mx/wp-content/uploads/2024/09/Programa_Sintetico_Fase_3.pdf#page=55).
- [Fase 4, p. 57](https://educacionbasica.sep.gob.mx/wp-content/uploads/2024/09/Programa_Sintetico_Fase_4.pdf#page=57).
- [Fase 5, p. 61](https://educacionbasica.sep.gob.mx/wp-content/uploads/2024/09/Programa_Sintetico_Fase_5.pdf#page=61).
- [Fase 6, p. 78](https://educacionbasica.sep.gob.mx/wp-content/uploads/2024/09/Programa_Sintetico_Fase_6.pdf#page=78): contenido de Geografía de **1.º de secundaria**; no atribuirlo a todos los grados.

Otros temas muestran la orientación general de la fase y requieren precisar contenido y PDA con revisión pedagógica. No se ha catalogado todo el currículo. Las extensiones sugeridas y las orientaciones narrativas son decisiones editoriales de FlyHigh, no mandatos de la SEP. La IA solo debe usar la investigación aportada como base factual; sus resultados requieren revisión humana.

## Entorno y verificación

Aplicar `supabase/migrations/20260927120000_narrative_phase_versions.sql` antes de desplegar el código. La migración añade JSONB con valor `{}` sin transformar los guiones originales y permite temas generales sin coordenadas, manteniendo la exigencia para puntos geográficos nuevos. No modifica las políticas de propiedad existentes. Esta entrega aplica la migración **solo localmente**.

En el laboratorio, `node tools/review-lab/migrate-narration-phases.cjs` valida que la conexión sea local. `node tools/review-lab/seed-phase-example.cjs` añade cinco borradores documentados de Cupatitzio si no existen, conservando General y sus audios. La investigación enlaza fuentes de CONANP y SEMARNAT. Los borradores no se marcan revisados.

Para probar generación real, configurar `GEMINI_API_KEY` en `.env.review.local`. Puede usarse la clave ya autorizada de la aplicación: la base sigue siendo local. Los endpoints de investigación, guion y audio leen esa configuración en cada solicitud, sin reiniciar sesiones ni cambiar el QR. El laboratorio nunca hereda automáticamente las credenciales de `.env.local`. Sin clave explícita, el editor permite escribir y guardar, y los endpoints explican la falta de configuración. La aplicación habitual continúa leyendo su variable de entorno.

El laboratorio prepara el almacenamiento `poi-narratives` durante `review:setup`. Para actualizar una instalación local existente sin reiniciar sus sesiones: `node tools/review-lab/ensure-narration-storage.cjs`.

Pruebas unitarias: `node --test --test-isolation=none tests/gemini-config.test.mjs tests/narrative-phases.test.mjs tests/review-audio.test.mjs tools/review-lab/core.test.cjs`.

Regresión no visual: `tools/review-lab/verify-narration-phases.cjs` con Electron del laboratorio y servidor local activo. Usa registros temporales, comprueba persistencia de ambos paneles y simula respuestas de IA sin costes. No sustituye una prueba con el proveedor real ni la evaluación pedagógica.

Verificación real del 27 de septiembre de 2026: Gemini devolvió un guion de fase 3 de 51 palabras y el TTS produjo un WAV de 24 segundos. Se comprobó la descarga desde el almacenamiento local y la duración a partir de sus bytes; después se retiró el archivo de prueba sin modificar las narraciones guardadas. La calidad auditiva y pedagógica continúa requiriendo revisión humana.

Revisión visual pendiente del usuario: Administración → Narraciones → Barranca del Cupatitzio; cambiar entre fases, revisar propósito, guion y fundamento. Repetir en Narraciones del piloto, donde el punto oficial se consulta en modo lectura, a 390 px y escritorio. En un punto propio, editar dos fases, guardar sin audio y reabrir.

Para volver al editor anterior, restaurar código con un commit de reversión; conservar las columnas nuevas para no perder borradores. No borrar ni trasladar las versiones a General.
