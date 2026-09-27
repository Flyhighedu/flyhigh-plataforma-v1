export function poiCategory(poi) {
    if (poi?.is_general_topic || (poi?.latitude == null && poi?.longitude == null)) return { emoji: '💡', label: 'Tema' };
    const text = `${poi?.description || ''} ${poi?.name || ''} ${poi?.category || ''}`;
    if (/museo/i.test(text)) return { emoji: '🏛️', label: 'Museo' };
    if (/templo|iglesia|culto|capilla|parroquia/i.test(text)) return { emoji: '⛪', label: 'Templo' };
    if (/río|lago|presa|cascada|agua|laguna/i.test(text)) return { emoji: '💧', label: 'Agua' };
    if (/parque|reserva|bosque|natural|área/i.test(text)) return { emoji: '🌿', label: 'Natural' };
    if (/cerro|volcán|montaña|elevación|peak/i.test(text)) return { emoji: '⛰️', label: 'Cerro' };
    if (/universidad|biblioteca|educativa|teatro|college/i.test(text)) return { emoji: '📚', label: 'Educativo' };
    if (/planta|fábrica|infraestructura|estación|tratadora/i.test(text)) return { emoji: '🏭', label: 'Industrial' };
    if (/aeropuerto|aeródromo/i.test(text)) return { emoji: '✈️', label: 'Aeropuerto' };
    if (/deportiv|estadio/i.test(text)) return { emoji: '⚽', label: 'Deportivo' };
    if (/monument|históric|arqueológ/i.test(text)) return { emoji: '🏺', label: 'Histórico' };
    if (/mirador|viewpoint/i.test(text)) return { emoji: '👁️', label: 'Mirador' };
    if (/zoológico|acuario/i.test(text)) return { emoji: '🐾', label: 'Fauna' };
    return { emoji: '📍', label: 'Lugar' };
}
