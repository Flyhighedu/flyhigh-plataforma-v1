'use client';

/**
 * DualPhotoUpload — Premium dual-button photo upload component.
 *
 * Provides two options:
 *  1. "Tomar foto" → opens native camera (capture="environment")
 *  2. "Subir de galería" → opens file picker (no capture)
 *
 * Includes EXIF date validation: rejects photos not taken today.
 *
 * Props:
 *   onFileSelected(file: File) — called when a valid file is chosen
 *   onError(message: string) — called when validation fails
 *   disabled?: boolean
 *   label?: string — optional label above buttons
 *   compact?: boolean — use smaller buttons
 */

import { useRef, useState } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import { validatePhotoDate } from '@/utils/validatePhotoDate';

export default function DualPhotoUpload({ onFileSelected, onError, disabled = false, label, compact = false }) {
    const cameraRef = useRef(null);
    const galleryRef = useRef(null);
    const [showRejection, setShowRejection] = useState(false);

    const handleFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate date — only for gallery picks (camera photos are always fresh)
        const isGallery = e.target === galleryRef.current;
        if (isGallery) {
            const result = validatePhotoDate(file);
            if (!result.valid) {
                // Clear input
                e.target.value = '';
                setShowRejection(true);
                setTimeout(() => setShowRejection(false), 4000);
                onError?.(result.message);
                return;
            }
        }

        onFileSelected?.(file);
        // Clear input so same file can be re-selected
        e.target.value = '';
    };

    const btnBase = compact
        ? 'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95'
        : 'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95';

    return (
        <div className="space-y-2">
            {label && (
                <p className="text-xs font-semibold text-slate-600">{label}</p>
            )}

            <div className="flex gap-2">
                {/* Button 1: Native Camera */}
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => cameraRef.current?.click()}
                    className={`${btnBase} bg-blue-500 text-white shadow-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <Camera size={compact ? 14 : 16} />
                    Tomar foto
                </button>

                {/* Button 2: Gallery */}
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => galleryRef.current?.click()}
                    className={`${btnBase} bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    <ImagePlus size={compact ? 14 : 16} />
                    Galería
                </button>
            </div>

            {/* Helper text */}
            <p className="text-[10px] text-slate-400 text-center">
                Galería recomendado para celulares de gama baja
            </p>

            {/* Rejection toast */}
            {showRejection && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl animate-in fade-in slide-in-from-top-1">
                    <span className="text-red-500 text-xs">⚠️</span>
                    <p className="text-xs font-medium text-red-700">
                        Evidencia rechazada: La foto debe haber sido tomada el día de hoy.
                    </p>
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
            />
            <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
            />
        </div>
    );
}
