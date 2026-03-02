'use client';

import { useRef } from 'react';
import { Camera, CheckCircle2, X } from 'lucide-react';

export default function CameraCapture({
    label,
    file,
    previewUrl,
    onSelect,
    onClear,
    disabled = false,
    heightClass = 'h-44'
}) {
    const inputRef = useRef(null);

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

            <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className={`group relative flex w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all duration-200 ${heightClass} ${
                    file
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-sky-200 bg-white hover:border-sky-300 hover:bg-sky-50'
                } disabled:cursor-not-allowed disabled:opacity-60`}
            >
                {previewUrl ? (
                    <div
                        className="h-full w-full bg-cover bg-center"
                        role="img"
                        aria-label={label}
                        style={{ backgroundImage: `url(${previewUrl})` }}
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-sky-700">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100">
                            <Camera size={18} />
                        </div>
                        <p className="m-0 text-sm font-semibold">Tomar foto</p>
                    </div>
                )}

                {file ? (
                    <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-1 text-[11px] font-semibold text-white shadow">
                        <CheckCircle2 size={12} />
                        Capturada
                    </div>
                ) : null}
            </button>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onSelect}
                disabled={disabled}
            />
        </div>
    );
}
