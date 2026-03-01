export const PILOT_PREP_BLOCKS = [
    {
        id: 'flight_kit',
        label: 'Kit de vuelo',
        icon: 'flight_takeoff',
        color: '#0066FF',
        bgColor: '#EFF6FF',
        items: [
            { id: 'drone', label: 'Dron', defaultQty: 1, max: 5 },
            { id: 'controllers', label: 'Controles', defaultQty: 3, max: 10 },
            { id: 'propellers', label: 'Hélices de repuesto', defaultQty: 4, max: 20 },
            { id: 'drone_batteries', label: 'Baterías de dron', defaultQty: 6, max: 20 }
        ]
    },
    {
        id: 'energy_center',
        label: 'Centro de energía',
        icon: 'battery_charging_full',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
        items: [
            { id: 'power_station', label: 'Centro de energía', defaultQty: 1, max: 2 },
            { id: 'chargers', label: 'Cargadores / Hub', defaultQty: 1, max: 5 }
        ]
    },
    {
        id: 'vr_experience',
        label: 'Experiencia VR',
        icon: 'view_in_ar',
        color: '#8B5CF6',
        bgColor: '#F5F3FF',
        items: [
            { id: 'goggles', label: 'Gafas VR', defaultQty: 1, max: 50 },
            { id: 'headphones', label: 'Audífonos', defaultQty: 1, max: 50 },
            { id: 'cabinet', label: 'Gabinete de carga', defaultQty: 1, max: 2 },
            { id: 'speaker', label: 'Bocina', defaultQty: 1, max: 2 },
            { id: 'media_player', label: 'MP3 / Reproductor', defaultQty: 1, max: 2 },
            { id: 'microphone', label: 'Micrófono', defaultQty: 1, max: 2 },
            { id: 'adapters', label: 'Cables / Adaptadores', defaultQty: 1, max: 10 }
        ]
    }
];

export const PILOT_BLOCK_CHECK_MAP = {
    flight_kit: ['drone_stored', 'controller_stored', 'sd_cards'],
    energy_center: ['batteries_ready'],
    vr_experience: ['goggles_kit']
};

export const AUX_LOAD_GROUPS = [
    {
        id: 'containers_check',
        label: 'Contenedores en vehículo',
        subtitle: 'Verifica que los 5 contenedores electrónicos estén arriba del vehículo.',
        icon: 'battery_charging_full',
        color: '#F59E0B',
        bgColor: '#FFFBEB',
        items: [
            { id: 'container_1', label: 'Contenedor 1 — Arriba del vehículo', type: 'check_confirm' },
            { id: 'container_2', label: 'Contenedor 2 — Arriba del vehículo', type: 'check_confirm' },
            { id: 'container_3', label: 'Contenedor 3 — Arriba del vehículo', type: 'check_confirm' },
            { id: 'container_4', label: 'Contenedor 4 — Arriba del vehículo', type: 'check_confirm' },
            { id: 'container_5', label: 'Contenedor 5 — Arriba del vehículo', type: 'check_confirm' }
        ],
        photos: [
            { id: 'panorama_1', label: 'Foto panorámica 1 (contenedores visibles)', type: 'photo' },
            { id: 'panorama_2', label: 'Foto panorámica 2 (si en la 1 no se ven todos)', type: 'photo' }
        ]
    }
];

export const TEACHER_TEAM_CHECK_TYPES = [
    { id: 'uniforme', label: 'Uniforme', icon: 'shirt', colorClass: 'text-blue-600' },
    { id: 'gafete', label: 'Gafete', icon: 'badge-check', colorClass: 'text-purple-600' },
    { id: 'app', label: 'App', icon: 'smartphone', colorClass: 'text-green-600' }
];
