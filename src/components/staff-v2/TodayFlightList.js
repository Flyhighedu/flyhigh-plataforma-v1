'use client';

import { CheckCircle2, Clock, Users, Coffee, AlertTriangle, Pause } from 'lucide-react';

export default function TodayFlightList({ flights, pauses = [] }) {
    // Combine flights and pauses into a single timeline
    const flightItems = (flights || []).map(f => ({ ...f, itemType: 'flight', timestamp: f.endTime }));
    const pauseItems = (pauses || []).map(p => ({
        ...p,
        itemType: 'pause',
        timestamp: p.endTime || p.startTime
    }));

    const allItems = [...flightItems, ...pauseItems].sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    if (allItems.length === 0) return null;

    const flightCount = flightItems.length;
    const pauseCount = pauseItems.filter(p => p.endTime).length; // Only count completed pauses

    // Calculate pause duration
    const formatPauseDuration = (startTime, endTime) => {
        if (!startTime || !endTime) return '--';
        const seconds = Math.floor((new Date(endTime) - new Date(startTime)) / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

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
                {allItems.map((item, idx) => {
                    // PAUSE CARD
                    if (item.itemType === 'pause') {
                        const isReceso = item.type === 'receso';
                        return (
                            <div
                                key={item.pauseId || `pause-${idx}`}
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
                                            {isReceso ? 'Receso' : 'Pausa'} • {formatPauseDuration(item.startTime, item.endTime)}
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                                            {!isReceso && item.reason && (
                                                <span>{reasonLabels[item.reason] || item.reason}</span>
                                            )}
                                            {isReceso && <span>☕ Mantenimiento</span>}
                                            <span className="text-slate-300">|</span>
                                            <span>{new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    // FLIGHT CARD (original)
                    const flightNumber = flightItems.filter(f =>
                        new Date(f.timestamp) <= new Date(item.timestamp)
                    ).length;

                    return (
                        <div key={item.id || idx} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                                    {flightNumber}
                                </div>
                                <div>
                                    <div className="text-slate-900 font-bold flex items-center gap-2">
                                        <Clock size={14} className="text-slate-400" />
                                        {Math.floor(item.durationSeconds / 60)}m {item.durationSeconds % 60}s
                                        {item.synced && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full border border-green-200">Sync</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                                        <span className="flex items-center gap-1"><Users size={12} /> {item.studentCount} Niños</span>
                                        <span className="text-slate-300">|</span>
                                        <span>{new Date(item.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                </div>
                            </div>
                            {item.incidents && item.incidents.length > 0 && (
                                <div className="px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-lg border border-red-200">
                                    {item.incidents.length} falla(s)
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
