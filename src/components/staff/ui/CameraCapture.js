'use client';

import { useRef, useState } from 'react';
import { Camera, CheckCircle2, X, ImagePlus } from 'lucide-react';
import { validatePhotoDate } from '@/utils/validatePhotoDate';

export default function CameraCapture({
    label,
    file,
    previewUrl,
    onSelect,
    onClear,
    disabled = false,
    heightClass = 'h-44'
}) {
    const cameraRef = useRef(null);
    const galleryRef = useRef(null);
    const [rejection, setRejection] = useState(null);

    const handleFile = (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Validate date for gallery picks (camera photos are always fresh)
        const isGallery = e.target === galleryRef.current;
        if (isGallery) {
            const result = validatePhotoDate(selectedFile);
            if (!result.valid) {
                e.target.value = '';
                setRejection(result.message);
                setTimeout(() => setRejection(null), 4000);
                return;
            }
        }

        onSelect?.(e);
        e.target.value = '';
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
                <p className="m-0 text-xs font-bold uppercase tracking-wide text-slate-500">
                    {label}
                </p>
                {file ? (
                    <button
                        type="button"
                        onClick={onClear}
                        disabled={disabled}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <X size={12} />
                        Limpiar
                    </button>
                ) : null}
            </div>

            {previewUrl ? (
                /* Preview area when photo exists */
                <div className={`relative flex w-full items-center justify-center overflow-hidden rounded-xl border-2 border-emerald-300 bg-emerald-50 ${heightClass}`}>
                    <div
                        className="h-full w-full bg-cover bg-center"
                        role="img"
                        aria-label={label}
                        style={{ backgroundImage: `url(${previewUrl})` }}
                    />
                    <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-1 text-[11px] font-semibold text-white shadow">
                        <CheckCircle2 size={12} />
                        Capturada
                    </div>
                </div>
            ) : (
                /* Dual Upload Buttons */
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => cameraRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500 text-white text-sm font-semibold shadow-sm hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Camera size={16} />
                            Tomar foto
                        </button>
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => galleryRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ImagePlus size={16} />
                            Galería
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 text-center">
                        Galería recomendado para celulares de gama baja
                    </p>
                </div>
            )}

            {/* Rejection toast */}
            {rejection && (
                <div className="flex items-center gap-2 px-3 py-2 mt-2 bg-red-50 border border-red-200 rounded-xl">
                    <span className="text-red-500 text-xs">⚠️</span>
                    <p className="text-xs font-medium text-red-700 m-0">{rejection}</p>
                </div>
            )}

            {/* Hidden file inputs */}
            <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFile}
                disabled={disabled}
            />
            <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
                disabled={disabled}
            />
        </div>
    );
}
