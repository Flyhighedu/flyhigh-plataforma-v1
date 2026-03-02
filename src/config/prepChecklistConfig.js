// Configuración de checklists por rol para la fase de Montaje (Pre-Jornada)
// ═══════════════════════════════════════════════════════════════════
// FUENTE ÚNICA DE VERDAD — Editar este archivo actualiza automáticamente
// tanto el sistema Operativo como el Supervisor.
// ═══════════════════════════════════════════════════════════════════

export const PREP_CHECKLISTS = {
    pilot: {
        label: 'Piloto',
        emoji: '🎮',
        color: 'blue',
        icon: 'flight',
        items: [
            { id: 'drone_stored', label: 'Drone guardado y verificado', critical: true, group: 'Kit de vuelo' },
            { id: 'controller_stored', label: 'Control remoto guardado', critical: true, group: 'Kit de vuelo' },
            { id: 'sd_cards', label: 'Tarjetas SD formateadas', critical: false, group: 'Kit de vuelo' },
            { id: 'batteries_ready', label: 'Baterías cargadas y listas', critical: true, group: 'Centro de energía' },
            { id: 'goggles_kit', label: 'Gafas y kit crítico OK', critical: true, group: 'Experiencia VR' },
        ]
    },
    teacher: {
        label: 'Docente',
        emoji: '📚',
        color: 'purple',
        icon: 'school',
        items: [
            { id: 'uniform_ok', label: 'Uniforme correcto (equipo completo)', critical: true, group: 'Montaje docente' },
            { id: 'id_badges', label: 'Gafetes visibles', critical: true, group: 'Montaje docente' },
            { id: 'mission_confirm', label: 'Confirmación de misión', type: 'mission_chips', critical: true, group: 'Montaje docente' },
            { id: 'group_selfie', label: 'Selfie de Verificación', description: 'Obligatoria: Para confirmar uso de uniforme completo y gafete.', type: 'photo', critical: true, liveOnly: true, group: 'Montaje docente' },
        ]
    },
    assistant: {
        label: 'Auxiliar',
        emoji: '📦',
        color: 'amber',
        icon: 'support_agent',
        items: [
            { id: 'vehicle_loc', label: 'Vehículo en zona de carga', type: 'photo', critical: true, group: 'Montaje del vehículo' },
            { id: 'keys_hand', label: 'Llaves en mano', type: 'check_confirm', group: 'Montaje del vehículo', critical: true },
            { id: 'tires_visual', label: 'Revisión visual de neumáticos', type: 'check_confirm', group: 'Montaje del vehículo', critical: true },
            { id: 'fuel_level', label: 'Combustible mínimo (Foto tablero)', type: 'photo', critical: true, group: 'Montaje del vehículo' },
            { id: 'trunk_open', label: 'Cajuela abierta lista', type: 'photo', critical: true, group: 'Checklist de carga' },
        ]
    },
    admin: {
        label: 'Admin',
        emoji: '⚙️',
        color: 'slate',
        icon: 'settings',
        items: [
            { id: 'team_confirmed', label: 'Equipo confirmado', critical: false, group: 'Administración' },
            { id: 'school_contacted', label: 'Escuela contactada', critical: false, group: 'Administración' },
            { id: 'overview_check', label: 'Revisión general OK', critical: false, group: 'Administración' },
        ]
    },
    supervisor: {
        label: 'Supervisor',
        emoji: '👁️',
        color: 'teal',
        icon: 'visibility',
        items: []
    }
};

export const ROLE_LABELS = {
    pilot: 'Piloto',
    teacher: 'Docente',
    assistant: 'Auxiliar',
    admin: 'Admin',
    supervisor: 'Supervisor'
};

export const ROLE_COLORS = {
    pilot: { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-50', border: 'border-blue-200' },
    teacher: { bg: 'bg-purple-500', text: 'text-purple-600', light: 'bg-purple-50', border: 'border-purple-200' },
    assistant: { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50', border: 'border-amber-200' },
    admin: { bg: 'bg-slate-500', text: 'text-slate-600', light: 'bg-slate-50', border: 'border-slate-200' },
    supervisor: { bg: 'bg-teal-500', text: 'text-teal-600', light: 'bg-teal-50', border: 'border-teal-200' },
};

// ── Helper: agrupa items por su campo `group` ──
// Usado por el Supervisor para renderizar bloques de acordeón
export function getGroupedItems(role) {
    const config = PREP_CHECKLISTS[role];
    if (!config) return [];
    const groupMap = {};
    config.items.forEach(item => {
        const g = item.group || 'General';
        if (!groupMap[g]) groupMap[g] = [];
        groupMap[g].push(item);
    });
    return Object.entries(groupMap).map(([name, items]) => ({ name, items }));
}
