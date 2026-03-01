'use client';

import { Camera, QrCode, Keyboard, AlertTriangle, ArrowRight } from 'lucide-react';
import { useRef, useState } from 'react';

export default function CheckInFallback({ onFallbackCheckIn, isOffline }) {
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

    const handlePhotoCapture = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        // Simular proceso de carga/compresión
        setTimeout(() => {
            if (onFallbackCheckIn) {
                onFallbackCheckIn({ type: 'photo', file });
            }
            setIsUploading(false);
        }, 1000);
    };

    return (
        <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100">
            <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                    <AlertTriangle size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-900">
                        {isOffline ? 'Sin conexión a internet' : 'Problemas con tu ubicación'}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        No te preocupes. Usa una de estas opciones para registrar tu llegada y sincronizaremos cuando sea posible.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {/* Opción 1: Foto (Principal) */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex items-center justify-between p-4 bg-white border border-orange-200 rounded-xl shadow-sm active:scale-[0.98] transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-700">
                            <Camera size={20} />
                        </div>
                        <div className="text-left">
                            <span className="block text-sm font-bold text-slate-900">Tomar foto de evidencia</span>
                            <span className="block text-[10px] text-slate-500 font-medium">Recomendado</span>
                        </div>
                    </div>
                    {isUploading ? (
                        <div className="text-xs font-bold text-orange-600">Procesando...</div>
                    ) : (
                        <ArrowRight size={18} className="text-slate-300" />
                    )}
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoCapture}
                />

                {/* Opción 2: QR (Placeholder) */}
                <button
                    className="flex items-center gap-3 p-4 bg-white/50 border border-orange-100/50 rounded-xl opacity-60 cursor-not-allowed"
                    disabled
                >
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                        <QrCode size={18} />
                    </div>
                    <div className="text-left">
                        <span className="block text-sm font-bold text-slate-500">Escanear QR de oficina</span>
                        <span className="block text-[10px] text-slate-400">Próximamente</span>
                    </div>
                </button>

                {/* Opción 3: Código (Placeholder) */}
                <button
                    className="flex items-center gap-3 p-4 bg-white/50 border border-orange-100/50 rounded-xl opacity-60 cursor-not-allowed"
                    disabled
                >
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                        <Keyboard size={18} />
                    </div>
                    <div className="text-left">
                        <span className="block text-sm font-bold text-slate-500">Ingresar código manual</span>
                        <span className="block text-[10px] text-slate-400">Próximamente</span>
                    </div>
                </button>
            </div>
        </div>
    );
}
