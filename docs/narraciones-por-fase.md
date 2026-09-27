# Narraciones del piloto: una ficha, cuatro versiones

## Vocabulario y responsabilidades

- **Narración** es la función de la aplicación. Cada **ficha** representa un **lugar** (con punto en el mapa) o un **tema** (sin ubicación). No se crea una ficha diferente por grado.
- **Oficial** viene del Directorio Global administrado por el equipo. El piloto puede consultarla, pero no editarla ni publicarla.
- **Personal** pertenece al piloto que la creó. Puede guardarse incompleta y volver a editarse. Guardarla no la convierte en oficial.
- La biblioteca del piloto tiene una sola entrada principal de creación: **Crear desde el mapa**. Abre el mapa táctico existente; el radar muestra lugares y el piloto toca un punto para abrir su ficha con nombre/ubicación ya identificados. Ahí siguen la investigación, el guion y audio generales y el selector de imagen. El tema general también se crea desde ese mapa, sin ubicación.
- La biblioteca no exige elegir grado para explorar o reproducir una versión general existente. La selección de grado aparece dentro de la ficha solo cuando hay versiones por fase; una ficha personal permite prepararlas en una acción separada, sin volver a capturar nombre, descripción o coordenadas.

## Selección educativa

El piloto selecciona el grado; el sistema resuelve la fase y elige el guion y audio asociados:

| Grados | Fase de educación básica | Clave interna |
| --- | --- | --- |
| 1.º–3.º de preescolar | 2 | `phase2` |
| 1.º–2.º de primaria | 3 | `phase3` |
| 3.º–4.º de primaria | 4 | `phase4` |
| 5.º–6.º de primaria | 5 | `phase5` |

La fase 1 corresponde a educación inicial y no forma parte de esta experiencia. Esta agrupación sigue el [Plan de Estudio SEP 2025](https://educacionbasica.sep.gob.mx/wp-content/uploads/2025/Plan_y_programas_de_estudio_2025/Plan%20de%20Estudio%202025%20-WEB-.pdf). La adaptación del guion por fase **no equivale** a certificar cobertura curricular ni a verificar hechos: el equipo debe revisar la investigación y los textos.

## Datos y compatibilidad

`pilot_pois` y `master_route_pois` conservan `narrative_script`/`audio_url` como **versión general** para las fichas anteriores. `phase_variants` (JSONB) guarda opcionalmente `phase2` a `phase5`, cada una con `script`, `audio_url`, duración y fecha de generación. Si hay guion para la fase elegida pero falta su audio, no se reproduce el audio general ni el de otra fase. Si no hay guion para esa fase, una versión general existente se ofrece con esa etiqueta explícita.

Un cambio al texto invalida el audio de esa fase. Una preparación confirmada conserva una instantánea con grado y se marca como desactualizada cuando cambia su fuente. La generación reutiliza las seis reglas de la narradora y la voz TTS `Despina`; únicamente se añade una indicación de enfoque educativo. Se genera una investigación base, luego cuatro guiones editables y, tras revisión, cuatro audios. Las fuentes antiguas no se reescriben automáticamente.

## Implantación

Aplicar `supabase/migrations/20260927000000_narration_phase_variants.sql` en el entorno de destino **antes** de habilitar la nueva pantalla. La mesa de revisión usa una migración equivalente y copia los audios oficiales por fase a su propio almacenamiento local. La interfaz de administración aún no edita estas variantes; las narraciones oficiales ya existentes continúan como generales hasta que el equipo las adapte y publique en una etapa posterior.
