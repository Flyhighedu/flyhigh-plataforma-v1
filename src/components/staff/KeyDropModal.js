'use client';

import { useEffect, useState } from 'react';
import { ImagePlus, Loader2, ShieldCheck, X } from 'lucide-react';
import CameraCapture from './ui/CameraCapture';
import { getPrimaryCtaClasses } from './ui/primaryCtaClasses';

export default function KeyDropModal({
    isOpen,
    onClose,
    onConfirm,
    isSubmitting = false
}) {
    const [photoFile, setPhotoFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    if (!isOpen) return null;

    const canSubmit = Boolean(photoFile) && !isSubmitting;

    const handleCapture = (event) => {
        const file = event.target.files?.[0] || null;
        event.target.value = '';
        if (!file) return;

        setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
        setPhotoFile(file);
    };

    const handleConfirm = async () => {
        if (!canSubmit || typeof onConfirm !== 'function') return;
        await onConfirm({ keyDropPhotoFile: photoFile });
    };

    return (
        <div
            className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4 md:items-center"
            onClick={isSubmitting ? undefined : onClose}
        >
            <div
                className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 md:px-6 md:pb-5 md:pt-6">
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <p className="m-0 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-700">
                                <ShieldCheck size={13} />
                                Resguardo final
                            </p>
                            <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
                                Resguardo de Llaves
                            </h3>
                            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500">
                                Para concluir tu ruta, deposita las llaves en el lugar asignado por la empresa y captura una fotografía.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <CameraCapture
                        label="Evidencia de entrega de llaves"
                        file={photoFile}
                        previewUrl={previewUrl}
                        onSelect={handleCapture}
                        onClear={() => {
                            setPhotoFile(null);
                            setPreviewUrl((prev) => {
                                if (prev) URL.revokeObjectURL(prev);
                                return '';
                            });
                        }}
                        disabled={isSubmitting}
                    />
                </div>

                <div className="border-t border-slate-200 bg-white/95 px-4 pb-4 pt-3 md:px-6 md:pb-6 md:pt-4">
                    <div className="flex flex-col gap-2 md:flex-row md:justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={!canSubmit}
                            className={getPrimaryCtaClasses(!canSubmit)}
                        >
                            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                            Llaves resguardadas
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
