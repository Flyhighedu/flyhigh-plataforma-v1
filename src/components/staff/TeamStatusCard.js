'use client';

import { User, Check, Clock, MapPin, Truck } from 'lucide-react';

const ROLE_LABELS = {
    pilot: 'Piloto',
    teacher: 'Docente',
    assistant: 'Auxiliar'
};

const STATUS_CONFIG = {
    pending: { label: 'Pendiente', color: 'text-slate-400', bg: 'bg-slate-100', icon: Clock },
    en_camino: { label: 'En camino', color: 'text-blue-500', bg: 'bg-blue-50', icon: Truck },
    en_sitio: { label: 'En sitio', color: 'text-green-600', bg: 'bg-green-50', icon: MapPin },
    listo: { label: 'Listo', color: 'text-green-600', bg: 'bg-green-100', icon: Check },
};

export default function TeamStatusCard({ teamStatus = {}, currentUserRole }) {
    // Orden de visualización: Piloto siempre primero, luego los demás
    const roles = ['pilot', 'teacher', 'assistant'];

    return (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider flex items-center gap-2">
                <User size={16} className="text-slate-400" />
                Equipo de Misión
            </h3>

            <div className="space-y-3">
                {roles.map(role => {
                    const statusKey = teamStatus[role] || 'pending';
                    const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
                    const StatusIcon = config.icon;
                    const isMe = role === currentUserRole;

                    return (
                        <div key={role} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100/50">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${role === 'pilot' ? 'bg-indigo-100 text-indigo-600' :
                                        role === 'teacher' ? 'bg-purple-100 text-purple-600' :
                                            'bg-orange-100 text-orange-600'
                                    }`}>
                                    {ROLE_LABELS[role].charAt(0)}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        {ROLE_LABELS[role]}
                                        {isMe && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 rounded-md font-bold">TÚ</span>}
                                    </p>
                                </div>
                            </div>

                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${config.bg} ${config.color}`}>
                                <StatusIcon size={12} strokeWidth={2.5} />
                                {config.label}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
