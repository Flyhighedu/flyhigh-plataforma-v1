// src/constants/staffSteps.js
// Central source of truth for all mission phases in the staff dashboard.

export const STAFF_STEPS = [
    {
        id: 'informe',
        label: 'INFORME',
        states: ['prep', 'PILOT_PREP', 'MISSION_BRIEF'],
    },
    {
        id: 'preparacion',
        label: 'PREPARACIÓN',
        states: ['CHECKIN_DONE', 'PREP_DONE', 'AUX_PREP_DONE', 'TEACHER_SUPPORTING_PILOT'],
    },
    {
        id: 'carga',
        label: 'CARGA',
        states: ['PILOT_READY_FOR_LOAD', 'WAITING_AUX_VEHICLE_CHECK', 'AUX_CONTAINERS_DONE'],
    },
    {
        id: 'en_ruta',
        label: 'EN RUTA',
        states: ['ROUTE_READY', 'IN_ROUTE'],
    },
    {
        id: 'llegada',
        label: 'LLEGADA',
        states: ['waiting_dropzone', 'waiting_unload_assignment'],
    },
    {
        id: 'descarga',
        label: 'DESCARGA',
        states: ['unload', 'post_unload_coordination'],
    },
    {
        id: 'asientos',
        label: 'ASIENTOS',
        states: ['seat_deployment'],
    },
    {
        id: 'operacion',
        label: 'OPERACIÓN',
        states: ['OPERATION', 'ARRIVAL_PHOTO_DONE', 'PILOT_OPERATION'],
    },
    {
        id: 'reporte',
        label: 'REPORTE',
        states: ['SHUTDOWN', 'POST_MISSION_REPORT', 'CLOSURE'],
    }
];
