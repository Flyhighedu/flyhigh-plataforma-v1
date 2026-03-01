'use client';

import { Loader2, MapPin, Navigation, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { STAFF_CONFIG } from '@/config/staffConfig'; // Asegúrate de tener esto importado si lo usas, o pasa por props

export default function LocationStatusCard({
    distance,
    accuracy,
    status, // 'idle', 'locating', 'success', 'error', 'denied'
    isWithinRange,
    onRetry
}) {
    const maxRange = STAFF_CONFIG.GEOFENCE_RADIUS_METERS || 100;

    // Configuración visual por estado
    const config = {
        idle: {
            bg: 'bg-slate-50',
            border: 'border-slate-100',
            icon: <Navigation size={20} className="text-slate-400" />,
            title: 'Esperando ubicación...',
            message: 'Iniciando GPS...'
        },
        locating: {
            bg: 'bg-blue-50',
            border: 'border-blue-100',
            icon: <Loader2 size={20} className="text-blue-500 animate-spin" />,
            title: 'Buscando señal GPS...',
            message: 'Calculando distancia a la oficina'
        },
        success: {
            bg: isWithinRange ? 'bg-green-50' : 'bg-amber-50',
            border: isWithinRange ? 'border-green-100' : 'border-amber-100',
            icon: isWithinRange
                ? <CheckCircle2 size={20} className="text-green-600" />
                : <MapPin size={20} className="text-amber-600" />,
            title: isWithinRange ? 'Estás en la oficina' : 'Fuera de rango',
            message: isWithinRange
                ? 'Ubicación confirmada para check-in'
                : `Acércate a menos de ${maxRange}m`
        },
        error: {
            bg: 'bg-red-50',
            border: 'border-red-100',
            icon: <XCircle size={20} className="text-red-500" />,
            title: 'Error de ubicación',
            message: 'No se pudo obtener tu posición'
        },
        denied: {
            bg: 'bg-red-50',
            border: 'border-red-100',
            icon: <AlertTriangle size={20} className="text-red-500" />,
            title: 'Permiso denegado',
            message: 'Activa el GPS en tu navegador'
        }
    };

    const currentConfig = config[status] || config.idle;

    // Colores dinámicos
    const iconWrapperBg = status === 'success' && isWithinRange ? 'bg-green-100' :
        status === 'success' && !isWithinRange ? 'bg-amber-100' :
            status === 'error' || status === 'denied' ? 'bg-red-100' : 'bg-slate-100';

    return (
        <div className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 ${currentConfig.bg} ${currentConfig.border}`}>
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl shadow-sm shrink-0 border border-white/50 ${iconWrapperBg}`}>
                    {currentConfig.icon}
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="font-bold text-slate-900 text-[15px] leading-tight mb-1">
                        {currentConfig.title}
                    </h3>
                    <p className="text-xs font-medium text-slate-500 leading-relaxed">
                        {currentConfig.message}
                    </p>

                    {/* Detalles técnicos si hay éxito */}
                    {status === 'success' && distance !== null && (
                        <div className="mt-4 flex items-center justify-between border-t border-slate-200/50 pt-3">
                            <div>
                                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Distancia</p>
                                <p className={`text-xl font-black tabular-nums tracking-tight ${isWithinRange ? 'text-green-600' : 'text-amber-600'}`}>
                                    {distance}m
                                </p>
                            </div>
                            {accuracy && (
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Precisión</p>
                                    <p className="text-sm font-bold text-slate-600 tabular-nums">
                                        ±{Math.round(accuracy)}m
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Botón de reintento para errores */}
                    {(status === 'error' || status === 'denied') && (
                        <button
                            onClick={onRetry}
                            className="mt-4 w-full text-xs font-bold text-blue-600 bg-white border border-blue-100 px-4 py-2.5 rounded-xl shadow-sm active:bg-blue-50 transition-colors uppercase tracking-wide"
                        >
                            Reintentar GPS
                        </button>
                    )}
                </div>
            </div>

            {/* Barra de progreso visual para rango */}
            {status === 'success' && !isWithinRange && distance && (
                <div className="mt-4 h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, Math.max(5, (maxRange / distance) * 100))}%` }}
                    />
                </div>
            )}
        </div>
    );
}
