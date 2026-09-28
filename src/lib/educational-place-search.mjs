import { parseCulturalPois } from './cultural-pois.mjs';
import { findExistingPlace } from './narration-catalog.mjs';

// Keep the preparation map and the official narration editor on the same radar.
export async function discoverEducationalPlaces(center, saved, { fetcher = fetch, onPartial } = {}) {
    const collected = [];
    let successfulScans = 0;
    let lastError;
    let places = [];
    for (const range of ['near', 'wide']) {
        try {
            const response = await fetcher('/api/staff/map-search', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind: 'preparation-cultural', center, range })
            });
            const data = await response.json();
            if (!response.ok || !Array.isArray(data.elements)) throw new Error(data.error || 'No se pudo consultar el mapa.');
            collected.push(...data.elements);
            successfulScans++;
            places = parseCulturalPois(collected, center, saved, 5000)
                .filter(poi => !findExistingPlace(saved, poi));
            onPartial?.(places, range);
        } catch (error) {
            lastError = error;
        }
    }
    if (!successfulScans) throw lastError || new Error('No se pudo consultar el mapa.');
    return { places, partial: successfulScans < 2 };
}
