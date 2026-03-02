'use client';

import { X } from 'lucide-react';

function getExtension(url) {
    const clean = String(url || '').split('?')[0].split('#')[0].trim().toLowerCase();
    const lastDot = clean.lastIndexOf('.');
    if (lastDot === -1) return '';
    return clean.slice(lastDot + 1);
}

function resolveMediaType(url, typeHint = null) {
    const normalizedHint = String(typeHint || '').trim().toLowerCase();
    if (['image', 'audio', 'video'].includes(normalizedHint)) return normalizedHint;

    const extension = getExtension(url);
    const imageExt = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic', 'heif']);
    const audioExt = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'webm']);
    const videoExt = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv', 'ogg', 'mkv']);

    if (imageExt.has(extension)) return 'image';
    if (audioExt.has(extension)) return 'audio';
    if (videoExt.has(extension)) return 'video';

    const lowerUrl = String(url || '').toLowerCase();
    if (lowerUrl.includes('audio')) return 'audio';
    if (lowerUrl.includes('video')) return 'video';
    return 'image';
}

export default function EvidenceViewerModal({
    isOpen,
    evidence,
    onClose
}) {
    if (!isOpen || !evidence?.url) return null;

    const mediaType = resolveMediaType(evidence.url, evidence.typeHint);

    return (
        <div
            className="fixed inset-0 z-[140] bg-slate-950/80 backdrop-blur-[2px] px-4 py-6 flex items-center justify-center"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose && onClose();
            }}
        >
            <div className="w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 shadow-[0_32px_72px_-36px_rgba(2,6,23,0.95)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
                    <div className="min-w-0">
                        <p className="m-0 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Visor de evidencia</p>
                        <p className="mt-0.5 truncate text-sm font-bold text-slate-100">{evidence.label || 'Evidencia operativa'}</p>
                    </div>

                    <button
                        type="button"
                        onClick={() => onClose && onClose()}
                        className="inline-flex size-9 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-slate-200 transition hover:bg-slate-700"
                        aria-label="Cerrar visor"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-4 py-4">
                    {mediaType === 'image' ? (
                        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
                            <img src={evidence.url} alt={evidence.label || 'Evidencia'} className="max-h-[72vh] w-full object-contain" />
                        </div>
                    ) : mediaType === 'video' ? (
                        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-black p-1">
                            <video src={evidence.url} controls className="max-h-[72vh] w-full rounded-xl" />
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-5">
                            <audio src={evidence.url} controls className="w-full" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
