import { coordinates } from './narration-preparation.mjs';

export function coordinateSearchResult(query) {
    const match = /^\s*([+-]?\d{1,2}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/.exec(query);
    if (!match) return null;
    const point = coordinates(Number(match[1]), Number(match[2]));
    if (!point) return null;
    return { id: `coordinates:${point.join(',')}`, name: `${point[0]}, ${point[1]}`, lat: point[0], lng: point[1], zoom: 17 };
}
