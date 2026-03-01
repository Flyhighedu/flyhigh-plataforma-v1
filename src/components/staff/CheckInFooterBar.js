'use client';

import { Loader2, ArrowRight, LogIn } from 'lucide-react';

export default function CheckInFooterBar({
    onCheckIn,
    isDisabled,
    isLoading,
    status, // 'idle', 'locating', 'success', 'error', 'denied'
    isWithinRange
}) {
    // Texto y estado del botón según la situación
    const getButtonConfig = () => {
        if (isLoading) return { text: 'Procesando...', icon: <Loader2 className="animate-spin" /> };

        if (status === 'locating') return { text: 'Buscando ubicación...', icon: <Loader2 className="animate-spin" /> };

        if (status === 'success') {
            if (isWithinRange) return { text: 'Deslizar para Check-in', icon: <ArrowRight /> };
            return { text: 'Acércate a la oficina', icon: <LogIn /> };
        }

        if (status === 'error' || status === 'denied') return { text: 'Usar check-in manual', icon: <ArrowRight /> };

        return { text: 'Hacer Check-in', icon: <LogIn /> };
    };

    const config = getButtonConfig();

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 p-4 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
            <div className="max-w-md mx-auto">
                <button
                    onClick={onCheckIn}
                    disabled={isDisabled && status !== 'error' && status !== 'denied'} // Permitir click en error/denied para activar fallback
                    className={`w-full py-4 rounded-xl font-bold text-[16px] shadow-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98]
                        ${(isDisabled && status !== 'error' && status !== 'denied')
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-[#101922] text-white hover:bg-[#1a2632] shadow-blue-900/10'
                        }
                    `}
                >
                    {config.icon}
                    {config.text}
                </button>

                {status === 'success' && !isWithinRange && (
                    <p className="text-center text-xs text-amber-600 font-medium mt-3">
                        Debes estar a menos de 100m para realizar el check-in automático.
                    </p>
                )}
            </div>
        </div>
    );
}
