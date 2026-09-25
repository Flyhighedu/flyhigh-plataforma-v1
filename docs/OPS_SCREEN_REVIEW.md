# Inventario inicial de Fly High Ops

Alcance: revisión estática del código vigente de staff, selector principal y resolución de desmontaje. No es un recorrido visual ni una prueba de cada estado con tres usuarios. No se realizaron operaciones en la base de datos.

## Conteo verificable

- 105 componentes JS/JSX en src/components/staff.
- 44 archivos cuyo nombre termina en Screen.
- 54 componentes de esa carpeta importados por el dashboard, incluidos menús, controles y overlays.
- El dashboard tiene 3310 líneas.
- Estos números NO equivalen a pantallas únicas: hay componentes compartidos, variantes por rol, modales y componentes legacy. No se confirma un total de 50 pantallas activas.

## Dependencias comprobadas

| Etapa | Quién actúa | Qué ven los demás |
|---|---|---|
| Zona de descarga | Auxiliar | waiting_dropzone muestra DropzoneWaitingScreen al resto, salvo preparación pendiente del piloto |
| Asignación de descarga | Docente | waiting_unload_assignment muestra WaitingUnloadAssignmentScreen al resto |
| Montaje | Roles y banderas compartidas | La selección de pantalla depende de asientos, audífonos, gafas y tareas particulares |
| Retorno | Auxiliar confirma llegada | Piloto/docente permanecen en retorno hasta auxArrivalNotified |
| Inventario y carga electrónica | Piloto | Docente/auxiliar pasan por apoyo en bodega según banderas |
| Estacionamiento, llaves y audiovisuales | Auxiliar | Piloto/docente esperan antes de checkout |

Fuentes: src/app/staff/dashboard/page.js, src/utils/dismantlingRouting.js, src/utils/metaHelpers.js. El bloqueo específico shouldLockPilot comprueba preparación propia del piloto; no todos los bloqueos son dependencias cruzadas.

## Evaluación de UX

La diferenciación por rol es apropiada. El acoplamiento global hace que un registro tardío, error o falta de sincronización pueda impedir avanzar. Una tarea físicamente dependiente no implica que deba bloquear toda la navegación. Mantener Inicio, ayuda, narraciones e incidencias disponibles; reservar restricciones para acciones concretas justificadas por seguridad u operación.

Clasificación propuesta para validar con el equipo: conservar check-in y resultados; agrupar instrucciones y pequeños checklists; convertir esperas en estados visibles con otras tareas accesibles; revisar contingencias y salida de demo; retirar pasos obsoletos solo después de conocer el proceso nuevo.

## Inventario de componentes candidatos

Importado por dashboard no significa que todas sus ramas sean alcanzables. Roles y banderas detectados automáticamente son indicios, no un mapa exhaustivo.

| Componente | Importado por dashboard | Nombre Screen | Referencias a roles | Contiene escrituras directas |
|---|---|---|---|
| AdWallDismantleScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| ApoyoBodegaScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| ArrivalNotificationScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| AuxAdWallInstallScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| AuxCivicEvidenceParallelScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| AuxOperationReadyScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| AuxParkingVehicleScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| AuxRecordingChargingScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| AuxVehicleChecklist.js | Sí | No | Compartido/no inferido | Sí |
| AuxWaitingScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| ChargingStationScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| CheckoutScreen.js | Sí | Sí | auxiliar, pilot, teacher, assistant | Sí |
| ClosureTaskScreen.js | No | Sí | auxiliar, pilot | Sí |
| ContainerLoadingScreen.js | No | Sí | Compartido/no inferido | No detectadas |
| ContingencyBypassMenu.js | Sí | No | Compartido/no inferido | Sí |
| DependencyTransitionOverlay.js | Sí | No | Compartido/no inferido | No detectadas |
| DroneStorageScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| DropzoneActionScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| DropzoneWaitingScreen.js | Sí | Sí | pilot | No detectadas |
| EnRutaScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| EquipmentUnloadScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| FinalParkingScreen.js | Sí | Sí | assistant, auxiliar | Sí |
| GlassesSetupScreen.js | Sí | Sí | pilot | Sí |
| GlassesStorageScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| GlobalLoadingScreen.js | Sí | Sí | assistant, auxiliar, teacher, pilot | Sí |
| HeaderHamburgerMenu.js | Sí | No | teacher, pilot | Sí |
| HeadphonesSetupScreen.js | Sí | Sí | pilot | Sí |
| HeadphonesStorageScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| MissionBrief.js | Sí | No | assistant | Sí |
| MissionSelector.js | Sí | No | Compartido/no inferido | No detectadas |
| MomentoDeCargarScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| OperationPanelConstructionScreen.js | Sí | Sí | assistant, auxiliar | No detectadas |
| OperationStartBridgeScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| PilotMusicAmbienceScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| PilotOperationalWaitScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| PilotPrepareFlightScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| PrepChecklist.js | Sí | No | pilot, assistant, teacher | Sí |
| ResetProcessButton.js | Sí | No | Compartido/no inferido | No detectadas |
| ReturnInventoryScreen.js | Sí | Sí | pilot | No detectadas |
| ReturnRouteScreen.js | Sí | Sí | assistant, auxiliar, teacher, pilot | Sí |
| SeatDeploymentScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| SeatFoldingScreen.js | Sí | Sí | assistant, auxiliar, teacher, pilot | Sí |
| StaffOperationLegacy.js | Sí | No | assistant, auxiliar, teacher, pilot | Sí |
| StartDemoFab.js | Sí | No | Compartido/no inferido | No detectadas |
| SupervisorBitacoraScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| TacticalMapScreen.js | No | Sí | Compartido/no inferido | Sí |
| TaskErrorBoundary.js | Sí | No | Compartido/no inferido | No detectadas |
| TeacherCivicNotificationScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| TeacherCivicParallelScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| TeacherOperationReadyScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| TeacherWaitingScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |
| UnloadAssignmentActionScreen.js | Sí | Sí | Compartido/no inferido | Sí |
| UnloadScreen.js | Sí | Sí | pilot, teacher, assistant | Sí |
| UpcomingMissionsList.js | Sí | No | Compartido/no inferido | No detectadas |
| VehiclePositioningScreen.js | Sí | Sí | assistant, auxiliar, teacher, pilot | Sí |
| WaitingAuxLoad.js | Sí | No | Compartido/no inferido | No detectadas |
| WaitingUnloadAssignmentScreen.js | Sí | Sí | Compartido/no inferido | No detectadas |

## Cómo completar la revisión visual

Preparar una galería local con datos ficticios y sin conexiones de escritura, agrupada por rol y etapa. Recorrer variantes de espera/error/offline, salida al inicio y recuperación. Evitar usar modo test de producción como garantía de aislamiento: el dashboard contiene flujos con preview=false y escrituras a jornadas de prueba.

