// =====================================================
// escuadronConfig.js
// Configuración central para "Escuadrón de Vuelo"
// Constantes, items de checklist, y emojis.
// NO depende de ningún otro archivo del flujo operativo.
// =====================================================

// ── Roles ──
export const ESCUADRON_ROLES = {
    supervisor: 'supervisor',  // maps to 'teacher' in staff_profiles
    piloto: 'piloto',          // maps to 'pilot'
    auxiliar: 'auxiliar'        // maps to 'assistant'
};

export const ROLE_TO_ESCUADRON = {
    teacher: ESCUADRON_ROLES.supervisor,
    pilot: ESCUADRON_ROLES.piloto,
    assistant: ESCUADRON_ROLES.auxiliar
};

export const ESCUADRON_ROLE_LABELS = {
    supervisor: 'Supervisor · El Activador',
    piloto: 'Piloto · El Narrador',
    auxiliar: 'Auxiliar · El Guardián'
};

export const ESCUADRON_ROLE_ICONS = {
    supervisor: 'electric_bolt',   // Material Symbol
    piloto: 'mic',
    auxiliar: 'shield'
};

export const ESCUADRON_ROLE_COLORS = {
    supervisor: { bg: '#7C3AED', light: '#EDE9FE', text: '#5B21B6' }, // Purple
    piloto: { bg: '#2563EB', light: '#DBEAFE', text: '#1D4ED8' },     // Blue
    auxiliar: { bg: '#059669', light: '#D1FAE5', text: '#047857' }     // Green
};

// ── Briefing Checklist Items (per escuadrón role) ──
export const BRIEFING_ITEMS = {
    supervisor: [
        {
            id: 'sup_energy',
            text: 'Preparo mi energía al máximo para recibir al grupo',
            icon: '⚡'
        },
        {
            id: 'sup_voting',
            text: 'Tengo claro el protocolo de votación (Regla de 8 Manos)',
            icon: '✋'
        },
        {
            id: 'sup_captain',
            text: 'Sé cómo elegir al Capitán de la Misión',
            icon: '🎖️'
        },
        {
            id: 'sup_timer',
            text: 'Usaré el timer de 4 minutos para el pre-vuelo',
            icon: '⏱️'
        }
    ],
    piloto: [
        {
            id: 'pil_mic',
            text: 'Tengo el micrófono listo para narrar',
            icon: '🎙️'
        },
        {
            id: 'pil_radio',
            text: 'Conozco las frases de radio/aviación para cada momento',
            icon: '📻'
        },
        {
            id: 'pil_bitacora',
            text: 'Sé dónde leer la Bitácora del grupo en mi pantalla',
            icon: '📋'
        },
        {
            id: 'pil_narration',
            text: 'Preparo una narración inmersiva para cada destino',
            icon: '🗺️'
        }
    ],
    auxiliar: [
        {
            id: 'aux_invisible',
            text: 'Mi objetivo es que la tecnología sea invisible para los niños',
            icon: '👻'
        },
        {
            id: 'aux_pitstop',
            text: 'Tengo baterías de repuesto para los "Pit Stops"',
            icon: '🔋'
        },
        {
            id: 'aux_claqueta',
            text: 'Sé usar la Claqueta Digital para marcar videos',
            icon: '🎬'
        },
        {
            id: 'aux_emociometro',
            text: 'Evaluaré cada vuelo con el Emocionómetro al aterrizar',
            icon: '📊'
        }
    ]
};

// ── Emocionómetro Levels ──
export const EMOTION_LEVELS = [
    { score: 1, emoji: '😐', label: 'Nada emocionados', color: '#EF4444', bg: '#FEE2E2' },
    { score: 2, emoji: '🙂', label: 'Poco emocionados', color: '#F97316', bg: '#FFEDD5' },
    { score: 3, emoji: '😊', label: 'Emoción normal', color: '#EAB308', bg: '#FEF9C3' },
    { score: 4, emoji: '😄', label: 'Muy emocionados', color: '#22C55E', bg: '#DCFCE7' },
    { score: 5, emoji: '🤩', label: 'Emoción máxima', color: '#8B5CF6', bg: '#EDE9FE' }
];

// ── Compliance Questions (Emocionómetro extras for Auxiliar) ──
export const COMPLIANCE_QUESTIONS = [
    {
        id: 'nombre_clave_used',
        text: '¿Se usó el Nombre Clave del escuadrón durante el vuelo?',
        icon: '🏷️'
    },
    {
        id: 'narration_quality',
        text: '¿El Piloto narró de forma inmersiva (usó radio/frases de aviación)?',
        icon: '🎙️'
    },
    {
        id: 'captain_participated',
        text: '¿El Capitán participó activamente (abrochó cinturones, eligió destinos)?',
        icon: '🎖️'
    }
];

// ── Timer ──
export const PREFLIGHT_TIMER_SECONDS = 4 * 60; // 4 minutes

// ── Meta Keys (prefixed to avoid collisions) ──
export const META_KEYS = {
    BRIEFING_DONE_PREFIX: 'escuadron_briefing_done_',    // e.g. escuadron_briefing_done_supervisor
    BRIEFING_ALL_DONE: 'escuadron_briefing_all_done',
    BITACORA_CURRENT: 'escuadron_bitacora_current',      // Current flight group's bitacora
    BITACORA_HISTORY: 'escuadron_bitacora_history',      // Array of past bitacoras
    DEBRIEF_DONE: 'escuadron_debrief_done',
    DEBRIEF_DATA: 'escuadron_debrief_data'
};

// ── Local Storage Keys ──
export const LOCAL_KEYS = {
    EMOTION_SCORES: 'flyhigh_escuadron_emotion_scores',  // Array of per-flight scores
    BRIEFING_DONE: 'flyhigh_escuadron_briefing_done'     // Boolean
};
