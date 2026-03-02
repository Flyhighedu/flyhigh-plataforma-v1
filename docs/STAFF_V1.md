# FlyHigh EDU — Staff V1: Guía de Configuración

## Requisitos Previos

1. **Node.js** ≥ 18
2. **Supabase Project** activo (ID: `sbzwffqhzmlxtnjyjduk`)

---

## 1. Variables de Entorno

Agrega a `.env.local`:

```env
# Ya existente
NEXT_PUBLIC_SUPABASE_URL=https://sbzwffqhzmlxtnjyjduk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu_anon_key>

# NUEVO — Service Role Key (requerido para crear usuarios desde admin)
SUPABASE_SERVICE_ROLE_KEY=<tu_service_role_key>
```

> La **Service Role Key** la encuentras en:
> Supabase Dashboard → Settings → API → `service_role` (secret)

---

## 2. Ejecutar Migración SQL

Copia el contenido de `supabase/migrations/001_staff_v1_tables.sql` y ejecútalo en:

> Supabase Dashboard → SQL Editor → New Query → Pegar → Run

Esto crea:
- `staff_profiles` — Perfiles de operativos con roles
- `staff_journeys` — Jornadas diarias
- `staff_prep_events` — Eventos de checklist pre-jornada
- `staff_prep_photos` — Fotos de evidencia
- Agrega columna `journey_id` a `bitacora_vuelos`

---

## 3. Crear Storage Bucket

En Supabase Dashboard → Storage → Create Bucket:
- **Name**: `prep-evidence`
- **Public**: Sí
- **File size limit**: 5 MB

---

## 4. Crear el Primer Usuario Admin

1. Entra a `/admin` con la contraseña existente (`Flyhigh2026`)
2. Ve al tab **"Operativos"**
3. Crea un usuario con rol **Admin**
4. Usa ese email/password para logear en `/staff/login`

> El primer usuario se puede crear sin validación de admin (no existe ningún perfil aún).

---

## 5. Flujo de Staff (resumen)

1. **Login**: `/staff/login` — email + password
2. **Dashboard**: `/staff/dashboard` — stepper de 3 pasos:
   - **Montaje**: Checklist por rol (Piloto/Docente/Auxiliar)
   - **Operación**: Registro de vuelos (funcionalidad existente)
   - **Reporte**: Cierre de misión con foto + firma + sync
3. **Auto-detección de escuela**: Si hay una escuela programada para hoy en `proximas_escuelas`, se selecciona automáticamente. Si no, se muestra el selector manual.

---

## 6. Roles

| Rol | Checklist Pre-Jornada |
|---|---|
| 🎮 Piloto | Drone, control, baterías, gafas, SD |
| 📚 Docente | Guion/música, reglas, material |
| 📦 Auxiliar | Contenedores, foto cajuela, vehículo, salida |
| ⚙️ Admin | Equipo, escuela, revisión general |

---

## 7. Troubleshooting

| Problema | Solución |
|---|---|
| "SUPABASE_SERVICE_ROLE_KEY no configurada" | Agrega la variable a `.env.local` y reinicia `npm run dev` |
| "No tienes un perfil de operativo" | El admin debe crear el usuario desde `/admin` → Operativos |
| "Tu cuenta está desactivada" | El admin debe reactivar al usuario desde Operativos |
| Error 42P01 (tabla no existe) | Ejecuta la migración SQL del paso 2 |
| Fotos no suben | Crea el bucket `prep-evidence` en Storage (paso 3) |

---

## Archivos Nuevos (V1)

```
src/
├── app/
│   ├── api/staff/
│   │   ├── create-user/route.js    ← Crear usuario (server-side)
│   │   ├── reset-password/route.js ← Reset password (server-side)
│   │   └── set-active/route.js     ← Activar/desactivar (server-side)
│   ├── staff/
│   │   ├── login/page.js           ← Login limpio (modificado)
│   │   ├── dashboard/page.js       ← Stepper de 3 pasos (reescrito)
│   │   └── layout.js               ← Layout con online/offline (modificado)
│   └── admin/page.js               ← Tab Operativos agregado (modificado)
├── components/staff/
│   ├── StaffOperationLegacy.js     ← Dashboard original extraído
│   ├── PrepChecklist.js            ← Checklist pre-jornada por rol
│   └── ClosureLegacy.js            ← Cierre de misión extraído
├── config/
│   └── prepChecklistConfig.js      ← Config de checklists por rol
└── middleware.js                    ← Protección de rutas (modificado)

supabase/migrations/
└── 001_staff_v1_tables.sql         ← Migración de BD
docs/
└── STAFF_V1.md                     ← Este documento
```
