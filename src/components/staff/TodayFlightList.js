'use client';

import { CheckCircle2, Clock, Users } from 'lucide-react';

export default function TodayFlightList({ flights }) {
    if (!flights || flights.length === 0) return null;

    return (
        <div className="space-y-3 animate-in slide-in-from-bottom-5 duration-500">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 size={16} /> Vuelos Realizados ({flights.length})
            </h3>

            <div className="space-y-2">
                {flights.slice().reverse().map((flight, idx) => (
                    <div key={flight.id || idx} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                                {flights.length - idx}
                            </div>
                            <div>
                                <div className="text-slate-900 font-bold flex items-center gap-2">
                                    <Clock size={14} className="text-slate-400" />
                                    {Math.floor(flight.durationSeconds / 60)}m {flight.durationSeconds % 60}s
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                                    <span className="flex items-center gap-1"><Users size={12} /> {flight.studentCount} Niños</span>
                                    <span className="text-slate-300">|</span>
                                    <span>{new Date(flight.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </div>
                        </div>
                        {flight.incidents && flight.incidents.length > 0 && (
                            <div className="px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-lg border border-red-200">
                                {flight.incidents.length} falla(s)
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
