# Reglas de trabajo para agentes

Este archivo define los acuerdos de trabajo para cualquier conversación o agente que modifique este repositorio. Debe leerse antes de realizar cambios.

## Continuidad entre conversaciones

- Las conversaciones se usan de forma secuencial, no simultánea, y trabajan sobre esta misma carpeta.
- Al comenzar una tarea, revisar `git status`, la rama activa y los commits recientes antes de editar.
- El historial de Git y los archivos del repositorio son la fuente compartida de contexto. No asumir que se conoce el contenido de conversaciones anteriores.
- Continuar en la rama activa salvo que el usuario solicite otra estrategia. No cambiar de rama mientras existan cambios sin guardar.
- Preservar todos los cambios existentes. No descartar, sobrescribir ni reformatear trabajo ajeno sin autorización explícita.

## Política de commits

- Crear un commit después de completar y verificar una unidad funcional coherente; no crear un commit por cada ajuste pequeño.
- Crear un checkpoint antes de una modificación grande, riesgosa o difícil de revertir.
- Separar en commits distintos los cambios que pertenezcan a funciones o módulos diferentes.
- Antes de cada commit, revisar el diff y ejecutar las pruebas automatizadas pertinentes al cambio.
- Incluir normalmente solo los archivos relacionados con la tarea actual. Si existen cambios previos o mezclados cuyo origen no sea claro, no incorporarlos a un commit sin consultar al usuario.
- Usar mensajes claros, preferentemente con prefijos como `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:` o `checkpoint:`.
- Al terminar, informar al usuario la rama, el identificador corto del commit, las pruebas ejecutadas y cualquier cambio que haya quedado sin guardar.
- No usar `git reset --hard`, `git checkout --`, `git clean`, rebase, amend, force-push ni otras operaciones que puedan borrar o reescribir trabajo, salvo petición y autorización explícitas del usuario.
- No subir cambios a GitHub ni crear pull requests sin autorización explícita. Los commits locales permiten volver atrás, pero no sustituyen un respaldo remoto.

## Estado de restauración actual

- Punto de restauración protegido: rama `respaldo/antes-narraciones-2026-09-25`.
- Commit de restauración: `8b81bff53936e574eeae679128a0c354116cf0d2`.
- Rama de trabajo iniciada para la siguiente etapa: `feature/piloto-narraciones`.
- No modificar ni eliminar la rama de respaldo.

## Verificación visual

- Hasta nuevo aviso, el usuario realiza las comprobaciones visuales de la aplicación.
- El agente debe indicar de forma breve y concreta qué pantalla, acción, estado y tamaño de ventana necesita que el usuario revise.
- El usuario puede enviar capturas para documentar el resultado.
- No abrir ni controlar la interfaz para hacer revisiones visuales por cuenta propia, salvo que el usuario lo solicite expresamente.
- Las pruebas automatizadas, revisiones estáticas, compilaciones y verificaciones no visuales sí deben realizarse cuando correspondan.

## Alcance actual del producto

- El foco actual es la pantalla de inicio del piloto y la experiencia de Narraciones.
- No modificar todavía la pantalla de operación del piloto, salvo petición explícita.
- La mesa de revisión debe reflejar fielmente la aplicación que llegará a producción.
- El contenido oficial de Narraciones puede sincronizarse desde producción hacia el entorno local de revisión.
- Los datos operativos y de prueba de la mesa de revisión deben permanecer aislados localmente.
- No implementar comandos de voz ni reintroducirlos sin una nueva decisión explícita del usuario.

## Criterio general

- Favorecer una experiencia clara, premium y sencilla, sin añadir funciones por suposición.
- Cuando una decisión cambie arquitectura, datos de producción o el alcance acordado, explicar la alternativa y pedir dirección antes de proceder.
