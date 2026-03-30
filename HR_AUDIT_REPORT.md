# Auditoría del Módulo de Recursos Humanos (Registro de Salidas)

## 📌 Resumen Ejecutivo
El panel de **Recursos Humanos** (Bitácora de Asistencias) no está mostrando las horas de salida (`Salida: Sin registro`) debido a un fallo en la interpretación de los datos (traductor) del lado del cliente. 

El panel está buscando un evento específico en una tabla incorrecta, mientras que la aplicación móvil guarda las salidas de forma muy diferente dentro de un objeto JSON estructurado por roles.

---

## 🔎 Hallazgo Principal: Discrepancia del "Traductor"

### ¿Qué hace el código actual? (El Traductor)
En el archivo `src/app/sandbox-hr/page.jsx`, el traductor itera sobre todos los eventos (`staff_prep_events`) buscando la salida:

```javascript
// Identificar tipos de evento
const evtType = (ev.event_type || "").toLowerCase();
const isCheckout = evtType.includes('checkout') || evtType.includes('salida') || 
                   evtType.includes('cierre');
```
**(Lógica Actual):** El panel asume que la salida genera un registro independiente en la tabla `staff_prep_events` con el nombre `checkout`, `salida` o `cierre`.

### La Realidad Operativa (El Sistema Móvil)
Tras consultar directamente la base de datos de producción (`staff_prep_events`), **los eventos de tipo "checkout" no existen**. Los únicos tipos de eventos que emite la app móvil son:
- `mission_chip`
- `team_check`
- `aux2_photo`, `aux2_check`
- `check`, `checkin`

**Entonces, ¿Dónde está la hora de salida real?**  
La aplicación operativa, al ser *offline-first* y tener múltiples roles, guarda las validaciones de salida directamente agrupadas en la misión maestra de ese día, es decir, dentro del campo `meta` de la tabla `staff_journeys`.

Al auditar una misión (ej. Misión del 10 de Marzo), encontramos que los Checkouts (Salidas) están registrados minuciosamente por **rol** con la estampa de tiempo exacta (UTC) de esta manera en el JSON de la misión:

```json
{
  "closure_checkout_pilot_done_at": "2026-03-10T23:16:26.545Z",
  "closure_checkout_assistant_done_at": "2026-03-10T23:03:18.740Z",
  "closure_checkout_teacher_done_at": "2026-03-10T23:16:17.445Z"
}
```

---

## 🛑 Conclusión del Diagnóstico

El registro de salida **SÍ EXISTE** y nunca se perdió. La aplicación móvil de los coordinadores lo está registrando de forma perfecta. 

El vacío en tu base de datos de Excel (Salida: "Sin registro") ocurre porque **el traductor del panel de RH está buscando peras en una canasta de manzanas**. Busca un evento con nombre `"checkout"` suelto en el historial, pero el núcleo operativo guarda las horas de salida como propiedades estructuradas (`_done_at`) relativas a un `journey_id` y al `role` de cada usuario.

> [!CAUTION]
> **El problema es exclusivo de lectura (Frontend).** La integridad de los datos de vuelo y asistencias de tu personal está 100% a salvo y no se ha perdido ninguna hora de cierre real.

---

## 🛠️ ¿Cómo podemos solucionarlo? (Propuesta de Reparación)

Para hacer que esta tabla interprete muy bien la vida operativa real de los coordinadores, debemos refactorizar el traductor en `page.jsx` para que:

1. **Si un evento es un `checkin`**, obtenga automáticamente el `staff_journeys.meta` de esa misión.
2. Determine **qué rol** jugó esa persona ese día (quizá determinable leyendo si está referenciado como piloto, docente o auxiliar).
3. Lea directamente su respectiva variable de salida (ej. `closure_checkout_pilot_done_at`) cruzando el `journey_id` del día.
4. Mapee e inyecte esa hora exacta (transformada a tu zona horaria) en la columna `hora_salida`.

¿Te gustaría que implementemos e iniciemos las modificaciones de este traductor para que el Dashboard por fin capture estas salidas del JSON maestro?
