const DISMANTLING_FLAG_ALIASES = Object.freeze({
    auxAdWallDismantled: ['aux_adwall_dismantled', 'closure_ad_wall_dismantle_done'],
    pilotDronesStored: ['pilot_drones_stored', 'global_drone_storage_done'],
    globalGlassesStored: ['global_glasses_stored', 'global_glasses_storage_done'],
    globalHeadphonesStored: ['global_headphones_stored', 'global_headphones_storage_done'],
    globalSeatsFolded: ['global_seats_folded', 'global_seat_folding_done'],
    auxVehiclePositioned: ['aux_vehicle_positioned', 'closure_vehicle_positioning_done'],
    globalEquipmentLoaded: ['global_equipment_loaded', 'global_container_loading_done', 'pilot_containers_loaded'],
    auxReturnRouteStarted: ['aux_return_route_started', 'closure_return_route_done'],
    auxArrivalNotified: ['aux_arrival_notified', 'arrival_notified', 'closure_arrival_notification_done'],
    globalEquipmentUnloaded: ['global_equipment_unloaded', 'closure_equipment_unload_done'],
    pilotReturnInventoryDone: ['pilot_return_inventory_done', 'closure_return_inventory_done'],
    pilotElectronicsCharged: ['pilot_electronics_charged', 'closure_electronics_charging_done'],
    auxRecordingCharged: ['aux_recording_charging_done', 'closure_recording_charging_done'],
    auxFinalParkingChecklistDone: ['aux_final_parking_checklist_done', 'aux_final_parking_done', 'closure_final_parking_done'],
    auxFinalParkingDone: ['aux_final_parking_done', 'closure_final_parking_done'],
    auxKeyDropDone: ['aux_key_drop_done', 'closure_key_drop_done']
});

export const DISMANTLING_ROUTE_IDS = Object.freeze({
    AD_WALL_DISMANTLE: 'ad_wall_dismantle',
    DRONE_STORAGE: 'drone_storage',
    GLASSES_STORAGE: 'glasses_storage',
    HEADPHONES_STORAGE: 'headphones_storage',
    SEAT_FOLDING: 'seat_folding',
    VEHICLE_POSITIONING: 'vehicle_positioning',
    GLOBAL_LOADING: 'global_loading',
    CONTAINER_LOADING: 'container_loading',
    RETURN_ROUTE: 'return_route',
    ARRIVAL_NOTIFICATION: 'arrival_notification',
    APOYO_BODEGA: 'apoyo_bodega',
    EQUIPMENT_UNLOAD: 'equipment_unload',
    RETURN_INVENTORY: 'return_inventory',
    ELECTRONICS_CHARGING: 'electronics_charging',
    AUX_RECORDING_CHARGING: 'aux_recording_charging',
    FINAL_PARKING: 'final_parking',
    CHECKOUT: 'checkout'
});

export const DISMANTLING_SCREEN_LABELS = Object.freeze({
    [DISMANTLING_ROUTE_IDS.AD_WALL_DISMANTLE]: 'Desmontar muro publicitario',
    [DISMANTLING_ROUTE_IDS.DRONE_STORAGE]: 'Resguardar dron',
    [DISMANTLING_ROUTE_IDS.GLASSES_STORAGE]: 'Guardar gafas',
    [DISMANTLING_ROUTE_IDS.HEADPHONES_STORAGE]: 'Guardar audífonos',
    [DISMANTLING_ROUTE_IDS.SEAT_FOLDING]: 'Pliegue de asientos',
    [DISMANTLING_ROUTE_IDS.VEHICLE_POSITIONING]: 'Acomodar vehículo',
    [DISMANTLING_ROUTE_IDS.GLOBAL_LOADING]: 'Cargar equipo',
    [DISMANTLING_ROUTE_IDS.CONTAINER_LOADING]: 'Cargar equipo',
    [DISMANTLING_ROUTE_IDS.RETURN_ROUTE]: 'Retorno a base',
    [DISMANTLING_ROUTE_IDS.ARRIVAL_NOTIFICATION]: 'Notificar llegada',
    [DISMANTLING_ROUTE_IDS.APOYO_BODEGA]: 'Apoyo en bodega',
    [DISMANTLING_ROUTE_IDS.EQUIPMENT_UNLOAD]: 'Descarga de equipo',
    [DISMANTLING_ROUTE_IDS.RETURN_INVENTORY]: 'Inventario de retorno',
    [DISMANTLING_ROUTE_IDS.ELECTRONICS_CHARGING]: 'Estación de carga',
    [DISMANTLING_ROUTE_IDS.AUX_RECORDING_CHARGING]: 'Carga de audiovisuales',
    [DISMANTLING_ROUTE_IDS.FINAL_PARKING]: 'Estacionamiento final',
    [DISMANTLING_ROUTE_IDS.CHECKOUT]: 'Checkout final'
});

export function normalizeDismantlingRole(role) {
    const normalized = String(role || '').trim().toLowerCase();
    if (normalized === 'auxiliar' || normalized === 'aux' || normalized === 'assistant') return 'assistant';
    if (normalized === 'docente' || normalized === 'teacher') return 'teacher';
    if (normalized === 'pilot') return 'pilot';
    return normalized;
}

function isDismantlingFlagDone(value) {
    return value === true || value === 'true' || value === 1 || value === '1';
}

function hasDismantlingMetaFlag(meta, aliases) {
    return aliases.some((key) => isDismantlingFlagDone(meta?.[key]));
}

function normalizeDismantlingMeta(meta) {
    if (!meta) return Object.create(null);

    if (typeof meta === 'string') {
        try {
            const parsed = JSON.parse(meta);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return Object.create(null);
            }
            return parsed;
        } catch {
            return Object.create(null);
        }
    }

    if (typeof meta === 'object' && !Array.isArray(meta)) {
        return meta;
    }

    return Object.create(null);
}

export function getDismantlingFlags(meta) {
    const safeMeta = normalizeDismantlingMeta(meta);

    return {
        auxAdWallDismantled: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.auxAdWallDismantled),
        pilotDronesStored: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.pilotDronesStored),
        globalGlassesStored: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.globalGlassesStored),
        globalHeadphonesStored: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.globalHeadphonesStored),
        globalSeatsFolded: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.globalSeatsFolded),
        auxVehiclePositioned: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.auxVehiclePositioned),
        globalEquipmentLoaded: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.globalEquipmentLoaded),
        auxReturnRouteStarted: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.auxReturnRouteStarted),
        auxArrivalNotified: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.auxArrivalNotified),
        globalEquipmentUnloaded: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.globalEquipmentUnloaded),
        pilotReturnInventoryDone: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.pilotReturnInventoryDone),
        pilotElectronicsCharged: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.pilotElectronicsCharged),
        auxRecordingCharged: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.auxRecordingCharged),
        auxFinalParkingChecklistDone: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.auxFinalParkingChecklistDone),
        auxFinalParkingDone: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.auxFinalParkingDone),
        auxKeyDropDone: hasDismantlingMetaFlag(safeMeta, DISMANTLING_FLAG_ALIASES.auxKeyDropDone)
    };
}

function getPendingGlobalDismantlingTask(flags, role) {
    if (!flags.globalGlassesStored) return DISMANTLING_ROUTE_IDS.GLASSES_STORAGE;
    if (!flags.globalHeadphonesStored) return DISMANTLING_ROUTE_IDS.HEADPHONES_STORAGE;
    if (role === 'assistant') return null;
    if (!flags.globalSeatsFolded) return DISMANTLING_ROUTE_IDS.SEAT_FOLDING;
    return null;
}

export function resolveDismantlingRoute(role, meta) {
    const normalizedRole = normalizeDismantlingRole(role);
    const flags = getDismantlingFlags(meta);
    const pendingGlobalTask = getPendingGlobalDismantlingTask(flags, normalizedRole);

    if (normalizedRole === 'assistant') {
        if (!flags.auxAdWallDismantled) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.AD_WALL_DISMANTLE, routeKey: 'assistant:ad_wall_dismantle' };
        }

        if (pendingGlobalTask) {
            return { kind: 'screen', screen: pendingGlobalTask, routeKey: `assistant:${pendingGlobalTask}` };
        }

        if (!flags.auxVehiclePositioned) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.VEHICLE_POSITIONING, routeKey: 'assistant:vehicle_positioning' };
        }

        if (!flags.globalEquipmentLoaded) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.GLOBAL_LOADING, routeKey: 'assistant:global_loading' };
        }

        if (!flags.auxArrivalNotified) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.RETURN_ROUTE, routeKey: 'assistant:return_route' };
        }

        if (!flags.globalEquipmentUnloaded) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.EQUIPMENT_UNLOAD, routeKey: 'assistant:equipment_unload' };
        }

        if (!flags.auxFinalParkingDone || !flags.auxKeyDropDone) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.FINAL_PARKING, routeKey: 'assistant:final_parking' };
        }

        if (!flags.pilotReturnInventoryDone) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.APOYO_BODEGA, routeKey: 'assistant:apoyo_bodega' };
        }

        if (!flags.auxRecordingCharged) {
            return {
                kind: 'screen',
                screen: DISMANTLING_ROUTE_IDS.AUX_RECORDING_CHARGING,
                routeKey: 'assistant:aux_recording_charging'
            };
        }

        if (!flags.pilotElectronicsCharged) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.APOYO_BODEGA, routeKey: 'assistant:apoyo_bodega_wait_pilot_charging' };
        }

        return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.CHECKOUT, routeKey: 'assistant:checkout' };
    }

    if (normalizedRole === 'pilot') {
        if (!flags.pilotDronesStored) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.DRONE_STORAGE, routeKey: 'pilot:drone_storage' };
        }

        if (pendingGlobalTask) {
            return { kind: 'screen', screen: pendingGlobalTask, routeKey: `pilot:${pendingGlobalTask}` };
        }

        if (!flags.globalEquipmentLoaded) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.GLOBAL_LOADING, routeKey: 'pilot:global_loading' };
        }

        if (!flags.auxArrivalNotified) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.RETURN_ROUTE, routeKey: 'pilot:return_route' };
        }

        if (!flags.globalEquipmentUnloaded) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.EQUIPMENT_UNLOAD, routeKey: 'pilot:equipment_unload' };
        }

        if (!flags.pilotReturnInventoryDone) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.RETURN_INVENTORY, routeKey: 'pilot:return_inventory' };
        }

        if (!flags.pilotElectronicsCharged) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.ELECTRONICS_CHARGING, routeKey: 'pilot:electronics_charging' };
        }

        if (!flags.auxFinalParkingDone || !flags.auxKeyDropDone) {
            const waitingForKeyDrop = flags.auxFinalParkingChecklistDone && !flags.auxKeyDropDone;
            return {
                kind: 'wait',
                routeKey: waitingForKeyDrop ? 'pilot:wait_aux_key_drop' : 'pilot:wait_aux_parking',
                waitChip: 'En espera del auxiliar',
                waitMessage: waitingForKeyDrop
                    ? 'Esperando resguardo de llaves del auxiliar...'
                    : 'Esperando a que el auxiliar complete estacionamiento final...'
            };
        }

        if (!flags.auxRecordingCharged) {
            return {
                kind: 'wait',
                routeKey: 'pilot:wait_aux_recording_charging',
                waitChip: 'En espera del auxiliar',
                waitMessage: 'Esperando a que el auxiliar conecte el equipo de grabación...'
            };
        }

        return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.CHECKOUT, routeKey: 'pilot:checkout' };
    }

    if (normalizedRole === 'teacher') {
        if (pendingGlobalTask) {
            return { kind: 'screen', screen: pendingGlobalTask, routeKey: `teacher:${pendingGlobalTask}` };
        }

        if (!flags.globalEquipmentLoaded) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.GLOBAL_LOADING, routeKey: 'teacher:global_loading' };
        }

        if (!flags.auxArrivalNotified) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.RETURN_ROUTE, routeKey: 'teacher:return_route' };
        }

        if (!flags.globalEquipmentUnloaded) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.EQUIPMENT_UNLOAD, routeKey: 'teacher:equipment_unload' };
        }

        if (
            !flags.pilotReturnInventoryDone ||
            !flags.pilotElectronicsCharged ||
            !flags.auxRecordingCharged ||
            !flags.auxFinalParkingDone ||
            !flags.auxKeyDropDone
        ) {
            return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.APOYO_BODEGA, routeKey: 'teacher:apoyo_bodega' };
        }

        return { kind: 'screen', screen: DISMANTLING_ROUTE_IDS.CHECKOUT, routeKey: 'teacher:checkout' };
    }

    return {
        kind: 'wait',
        routeKey: `${normalizedRole || 'unknown'}:wait_team`,
        waitChip: 'En espera del equipo',
        waitMessage: 'Esperando al equipo para continuar...'
    };
}

function waitingCopyByRole(roleLabel) {
    return `En espera de ${roleLabel}`;
}

export function getDismantlingSyncBadge(role, meta) {
    const normalizedRole = normalizeDismantlingRole(role);
    const flags = getDismantlingFlags(meta);
    const route = resolveDismantlingRoute(normalizedRole, meta);

    if (!normalizedRole || normalizedRole === 'unknown') {
        return { chipText: 'En espera del equipo', route, flags };
    }

    if (route.kind === 'wait') {
        if (route.routeKey.includes('aux')) {
            return { chipText: waitingCopyByRole('Auxiliar'), route, flags };
        }
        if (route.routeKey.includes('teacher')) {
            return { chipText: waitingCopyByRole('Docente'), route, flags };
        }
        if (route.routeKey.includes('pilot')) {
            return { chipText: waitingCopyByRole('Piloto'), route, flags };
        }
        return { chipText: 'En espera del equipo', route, flags };
    }

    if (route.screen === DISMANTLING_ROUTE_IDS.APOYO_BODEGA) {
        if (!flags.globalEquipmentUnloaded) {
            return { chipText: 'En espera del equipo', route, flags };
        }
        if (!flags.pilotReturnInventoryDone) {
            return normalizedRole === 'pilot'
                ? { chipText: 'Te esperan', route, flags }
                : { chipText: waitingCopyByRole('Piloto'), route, flags };
        }
        if (!flags.auxRecordingCharged) {
            return normalizedRole === 'assistant'
                ? { chipText: 'Te esperan', route, flags }
                : { chipText: waitingCopyByRole('Auxiliar'), route, flags };
        }
        if (!flags.pilotElectronicsCharged) {
            return normalizedRole === 'pilot'
                ? { chipText: 'Te esperan', route, flags }
                : { chipText: waitingCopyByRole('Piloto'), route, flags };
        }
        if (!flags.auxFinalParkingDone || !flags.auxKeyDropDone) {
            return normalizedRole === 'assistant'
                ? { chipText: 'Te esperan', route, flags }
                : { chipText: waitingCopyByRole('Auxiliar'), route, flags };
        }
        return { chipText: 'En espera del equipo', route, flags };
    }

    if (route.screen === DISMANTLING_ROUTE_IDS.RETURN_ROUTE) {
        return normalizedRole === 'teacher'
            ? { chipText: 'Te esperan', route, flags }
            : { chipText: waitingCopyByRole('Docente'), route, flags };
    }

    if (route.screen === DISMANTLING_ROUTE_IDS.GLOBAL_LOADING || route.screen === DISMANTLING_ROUTE_IDS.CONTAINER_LOADING) {
        return normalizedRole === 'assistant'
            ? { chipText: 'Te esperan', route, flags }
            : { chipText: waitingCopyByRole('Auxiliar'), route, flags };
    }

    if (route.screen === DISMANTLING_ROUTE_IDS.RETURN_INVENTORY || route.screen === DISMANTLING_ROUTE_IDS.ELECTRONICS_CHARGING) {
        return normalizedRole === 'pilot'
            ? { chipText: 'Te esperan', route, flags }
            : { chipText: waitingCopyByRole('Piloto'), route, flags };
    }

    if (
        route.screen === DISMANTLING_ROUTE_IDS.VEHICLE_POSITIONING ||
        route.screen === DISMANTLING_ROUTE_IDS.AUX_RECORDING_CHARGING ||
        route.screen === DISMANTLING_ROUTE_IDS.FINAL_PARKING
    ) {
        return normalizedRole === 'assistant'
            ? { chipText: 'Te esperan', route, flags }
            : { chipText: waitingCopyByRole('Auxiliar'), route, flags };
    }

    if (route.screen === DISMANTLING_ROUTE_IDS.EQUIPMENT_UNLOAD) {
        if (normalizedRole === 'teacher') {
            return { chipText: 'En espera del equipo', route, flags };
        }
        return { chipText: 'Te esperan', route, flags };
    }

    return { chipText: null, route, flags };
}
