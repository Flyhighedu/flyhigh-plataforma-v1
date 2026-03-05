'use client';

import { useState } from 'react';
import { CheckCircle2, Clock, Users, Coffee, AlertTriangle, Pause, Pencil, ChevronDown } from 'lucide-react';

function toEpochMs(value) {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber;

    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizePositiveInt(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Math.floor(parsed);
}

function formatDurationShort(seconds) {
    const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins}m ${secs}s`;
}

function formatClock(value) {
    const ms = toEpochMs(value);
    if (!ms) return '--:--';
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function safeText(value, fallback = '--') {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'bigint') return String(value);
    return fallback;
}

function safeCount(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
}

const VISIBLE_WINDOW = 4; // Max items shown before "show all" toggle

export default function TodayFlightList({ flights, pauses = [], activeFlight = null, onRequestEditFlight = null }) {
    const [showAll, setShowAll] = useState(false);
    const flightKeyUsage = new Map();

    const flightsNormalized = (flights || [])
        .filter((flight) => flight && typeof flight === 'object')
        .map((flight) => {
            const startTime = flight.startTime || flight.start_time || null;
            const endTime = flight.endTime || flight.end_time || flight.created_at || startTime;

            const startMs = toEpochMs(startTime);
            const endMs = toEpochMs(endTime) || startMs;
            const flightNumber = normalizePositiveInt(flight.flightNumber ?? flight.flight_number);
            const durationSeconds = Number(flight.durationSeconds ?? flight.duration_seconds ?? 0);
            const rawKey = String(flight.flightId || flight.id || `flight-${startMs}-${endMs}`);
            const keyCount = flightKeyUsage.get(rawKey) || 0;
            flightKeyUsage.set(rawKey, keyCount + 1);
            const key = keyCount === 0 ? rawKey : `${rawKey}__dup_${keyCount}`;

            return {
                ...flight,
                key,
                startTime,
                endTime,
                startMs,
                endMs,
                timestampMs: endMs || startMs,
                durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0
                    ? durationSeconds
                    : Math.max(0, Math.floor((endMs - startMs) / 1000)),
                flightNumber,
                incidents: Array.isArray(flight.incidents) ? flight.incidents : []
            };
        })
        .filter((flight) => flight.timestampMs > 0);

    const flightsAsc = [...flightsNormalized].sort((a, b) => {
        const aAnchor = a.startMs || a.endMs;
        const bAnchor = b.startMs || b.endMs;
        return aAnchor - bAnchor;
    });

    const flightsWithNumbersAsc = flightsAsc.map((flight, idx) => ({
        ...flight,
        flightNumber: flight.flightNumber || (idx + 1)
    }));

    const flightByKey = new Map(flightsWithNumbersAsc.map((flight) => [flight.key, flight]));

    const flightItems = flightsWithNumbersAsc
        .map((flight) => ({
            ...flight,
            itemType: 'flight',
            timestampMs: flight.timestampMs
        }));

    const interFlightItems = [];
    for (let idx = 1; idx < flightsWithNumbersAsc.length; idx += 1) {
        const olderFlight = flightsWithNumbersAsc[idx - 1];
        const newerFlight = flightsWithNumbersAsc[idx];

        const intervalStartMs = olderFlight.endMs || olderFlight.timestampMs;
        const intervalEndMs = newerFlight.startMs || newerFlight.timestampMs;

        if (!intervalStartMs || !intervalEndMs || intervalEndMs <= intervalStartMs) {
            continue;
        }

        interFlightItems.push({
            itemType: 'interflight',
            key: `interflight-${olderFlight.key}-${newerFlight.key}`,
            timestampMs: intervalEndMs,
            durationSeconds: Math.max(0, Math.floor((intervalEndMs - intervalStartMs) / 1000)),
            fromFlightNumber: olderFlight.flightNumber,
            toFlightNumber: newerFlight.flightNumber,
            startTime: new Date(intervalStartMs).toISOString(),
            endTime: new Date(intervalEndMs).toISOString()
        });
    }

    const activeFlightStartMs = toEpochMs(activeFlight?.startedAt || activeFlight?.start_time || activeFlight?.startTime);
    const activeFlightNumber = normalizePositiveInt(activeFlight?.flightNumber ?? activeFlight?.flight_number);
    const lastCompletedFlight = flightsWithNumbersAsc[flightsWithNumbersAsc.length - 1] || null;

    if (lastCompletedFlight && activeFlightStartMs > 0) {
        const intervalStartMs = lastCompletedFlight.endMs || lastCompletedFlight.timestampMs;
        const intervalEndMs = activeFlightStartMs;

        if (intervalStartMs > 0 && intervalEndMs > intervalStartMs) {
            interFlightItems.push({
                itemType: 'interflight',
                key: `interflight-live-${lastCompletedFlight.key}-${intervalEndMs}`,
                timestampMs: intervalEndMs,
                durationSeconds: Math.max(0, Math.floor((intervalEndMs - intervalStartMs) / 1000)),
                fromFlightNumber: lastCompletedFlight.flightNumber,
                toFlightNumber: activeFlightNumber || (lastCompletedFlight.flightNumber + 1),
                startTime: new Date(intervalStartMs).toISOString(),
                endTime: new Date(intervalEndMs).toISOString()
            });
        }
    }

    const pauseItems = (pauses || []).map(p => ({
        ...p,
        itemType: 'pause',
        timestampMs: toEpochMs(p.endTime || p.startTime)
    }));

    const typePriority = {
        flight: 3,
        interflight: 2,
        pause: 1
    };

    const allItems = [...flightItems, ...interFlightItems, ...pauseItems]
        .filter((item) => item.timestampMs > 0)
        .sort((a, b) => {
            if (b.timestampMs !== a.timestampMs) return b.timestampMs - a.timestampMs;
            return (typePriority[b.itemType] || 0) - (typePriority[a.itemType] || 0);
        });

    if (allItems.length === 0) return null;

    // [RAM DIET] Only render recent items by default to reduce DOM nodes
    const visibleItems = showAll || allItems.length <= VISIBLE_WINDOW
        ? allItems
        : allItems.slice(0, VISIBLE_WINDOW);
    const hiddenCount = allItems.length - visibleItems.length;

    const flightCount = flightsWithNumbersAsc.length;
    const pauseCount = pauseItems.filter(p => p.endTime).length; // Only count completed pauses

    const reasonLabels = {
        clima: '🌧️ Clima',
        evento: '🎉 Evento',
        falla: '⚠️ Falla',
        otro: '📝 Otro'
    };

    return (
        <div className="space-y-3 animate-in slide-in-from-bottom-5 duration-500">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 size={16} /> Actividad del Día ({flightCount} vuelos{pauseCount > 0 ? `, ${pauseCount} pausas` : ''})
            </h3>

            <div className="space-y-2">
                {visibleItems.map((item, idx) => {
                    // PAUSE CARD
                    if (item.itemType === 'pause') {
                        const isReceso = item.type === 'receso';
                        const pauseDuration = toEpochMs(item.endTime) > 0
                            ? Math.floor((toEpochMs(item.endTime) - toEpochMs(item.startTime)) / 1000)
                            : 0;
                        const reasonLabel = typeof item.reason === 'string'
                            ? (reasonLabels[item.reason] || item.reason)
                            : 'Sin detalle';

                        return (
                            <div
                                key={`pause-${safeText(item.pauseId, 'no-id')}-${idx}`}
                                className={`border rounded-xl p-4 flex items-center justify-between shadow-sm ${isReceso
                                    ? 'bg-amber-50 border-amber-200'
                                    : 'bg-red-50 border-red-200'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isReceso ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'
                                        }`}>
                                        {isReceso ? <Coffee size={16} /> : <AlertTriangle size={16} />}
                                    </div>
                                    <div>
                                        <div className={`font-bold flex items-center gap-2 ${isReceso ? 'text-amber-800' : 'text-red-800'
                                            }`}>
                                            <Pause size={14} />
                                            {isReceso ? 'Receso' : 'Pausa'} • {formatDurationShort(pauseDuration)}
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                                            {!isReceso && item.reason && (
                                                <span>{reasonLabel}</span>
                                            )}
                                            {isReceso && <span>☕ Mantenimiento</span>}
                                            <span className="text-slate-300">|</span>
                                            <span>{formatClock(item.startTime)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    if (item.itemType === 'interflight') {
                        return (
                            <div
                                key={`inter-${safeText(item.key, 'no-key')}-${idx}`}
                                className="mx-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 flex items-center justify-between"
                            >
                                <div>
                                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Tiempo entre vuelos</p>
                                    <p className="text-[11px] text-slate-500">Entre vuelo #{item.fromFlightNumber} y vuelo #{item.toFlightNumber}</p>
                                </div>
                                <p className="text-sm font-black text-slate-700 tabular-nums">{formatDurationShort(item.durationSeconds)}</p>
                            </div>
                        );
                    }

                    const normalizedFlight = flightByKey.get(item.key) || item;
                    const incidentsCount = Array.isArray(normalizedFlight.incidents) ? normalizedFlight.incidents.length : 0;
                    const flightNumber = normalizePositiveInt(normalizedFlight.flightNumber);
                    const studentCount = safeCount(normalizedFlight.studentCount);

                    return (
                        <div key={`flight-${safeText(item.key || item.id, 'no-key')}-${idx}`} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                                    {flightNumber || '--'}
                                </div>
                                <div>
                                    <div className="text-slate-900 font-bold flex items-center gap-2">
                                        <Clock size={14} className="text-slate-400" />
                                        Vuelo #{flightNumber || '--'} • {formatDurationShort(normalizedFlight.durationSeconds)}
                                        {normalizedFlight.synced && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full border border-green-200">Sync</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                                        <span className="flex items-center gap-1"><Users size={12} /> {studentCount} Niños</span>
                                        <span className="text-slate-300">|</span>
                                        <span>{formatClock(normalizedFlight.endTime || normalizedFlight.startTime)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {incidentsCount > 0 && (
                                    <div className="px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-lg border border-red-200 whitespace-nowrap">
                                        {incidentsCount} falla(s)
                                    </div>
                                )}
                                {typeof onRequestEditFlight === 'function' && (
                                    <button
                                        onClick={() => onRequestEditFlight(normalizedFlight)}
                                        className="px-2 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-[11px] font-bold inline-flex items-center gap-1 hover:bg-blue-100 transition-colors whitespace-nowrap"
                                    >
                                        <Pencil size={12} />
                                        Editar alumnos
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* [RAM DIET] Show toggle when items are hidden */}
            {hiddenCount > 0 && (
                <button
                    onClick={() => setShowAll(true)}
                    className="w-full mt-2 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 flex items-center justify-center gap-1.5 hover:bg-slate-100 transition-colors"
                >
                    <ChevronDown size={14} />
                    Ver todos ({hiddenCount} más)
                </button>
            )}
        </div>
    );
}
