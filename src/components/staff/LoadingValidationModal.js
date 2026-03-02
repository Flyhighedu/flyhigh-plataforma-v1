'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, ShieldCheck, X } from 'lucide-react';
import { getPrimaryCtaClasses } from './ui/primaryCtaClasses';
import CameraCapture from './ui/CameraCapture';

const CHECKLIST_ITEMS = [
    {
        id: 'containers_onboard',
        label: 'Todos los contenedores están arriba'
    },
    {
        id: 'structures_onboard',
        label: 'Estructuras y accesorios también están arriba'
    },
    {
        id: 'roof_secured',
        label: 'El equipo que va en el toldo del vehículo está bien asegurado'
    }
];

function buildInitialChecks() {
    return CHECKLIST_ITEMS.reduce((acc, item) => {
        acc[item.id] = false;
        return acc;
    }, Object.create(null));
}

export default function LoadingValidationModal({
    onClose,
    onConfirm,
    isSubmitting = false
}) {
    const [checks, setChecks] = useState(() => buildInitialChecks());
    const [containersPhotoFile, setContainersPhotoFile] = useState(null);
    const [roofPhotoFile, setRoofPhotoFile] = useState(null);
    const [containersPreviewUrl, setContainersPreviewUrl] = useState('');
    const [roofPreviewUrl, setRoofPreviewUrl] = useState('');

    useEffect(() => {
        return () => {
            if (containersPreviewUrl) URL.revokeObjectURL(containersPreviewUrl);
            if (roofPreviewUrl) URL.revokeObjectURL(roofPreviewUrl);
        };
    }, [containersPreviewUrl, roofPreviewUrl]);

    const allChecksDone = useMemo(
        () => CHECKLIST_ITEMS.every((item) => checks[item.id] === true),
        [checks]
    );

    const canSubmit = allChecksDone && Boolean(containersPhotoFile) && Boolean(roofPhotoFile) && !isSubmitting;

    const handleToggleCheck = (id) => {
        if (isSubmitting) return;
        setChecks((prev) => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleCaptureFile = (event, setFile, setPreview) => {
        const file = event.target.files?.[0] || null;
        event.target.value = '';
        if (!file) return;

        setPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
        setFile(file);
    };

    const handleSubmit = async () => {
        if (!canSubmit || typeof onConfirm !== 'function') return;

        await onConfirm({
            checks,
            containersPhotoFile,
            roofPhotoFile
        });
    };

    return (
        <div
            className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4 md:items-center"
            onClick={isSubmitting ? undefined : onClose}
        >
            <div
                className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 md:px-6 md:pb-5 md:pt-6">
                    <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                            <p className="m-0 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-700">
                                <ShieldCheck size={13} />
                                Validacion de carga
                            </p>
                            <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
                                Confirmar carga completa
                            </h3>
                            <p className="mt-1 text-sm font-medium text-slate-500">
                                Completa checklist y evidencia antes de iniciar retorno.
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

                    <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4">
                        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                            Checklist de seguridad
                        </p>
                        <div className="space-y-2.5">
                            {CHECKLIST_ITEMS.map((item) => {
                                const checked = checks[item.id] === true;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleToggleCheck(item.id)}
                                        disabled={isSubmitting}
                                        className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-150 ${
                                            checked
                                                ? 'border-sky-200 bg-sky-50'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                        } disabled:cursor-not-allowed disabled:opacity-70`}
                                    >
                                        <span
                                            className={`mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                                                checked
                                                    ? 'border-sky-600 bg-sky-600 text-white'
                                                    : 'border-slate-300 bg-white text-transparent'
                                            }`}
                                        >
                                            <CheckCircle2 size={12} />
                                        </span>
                                        <span className="text-sm font-semibold leading-snug text-slate-700">
                                            {item.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <CameraCapture
                            label="Evidencia: Contenedores dentro"
                            file={containersPhotoFile}
                            previewUrl={containersPreviewUrl}
                            onSelect={(event) => handleCaptureFile(event, setContainersPhotoFile, setContainersPreviewUrl)}
                            onClear={() => {
                                setContainersPhotoFile(null);
                                setContainersPreviewUrl('');
                            }}
                            disabled={isSubmitting}
                            heightClass="h-36"
                        />

                        <CameraCapture
                            label="Evidencia: Toldo asegurado"
                            file={roofPhotoFile}
                            previewUrl={roofPreviewUrl}
                            onSelect={(event) => handleCaptureFile(event, setRoofPhotoFile, setRoofPreviewUrl)}
                            onClear={() => {
                                setRoofPhotoFile(null);
                                setRoofPreviewUrl('');
                            }}
                            disabled={isSubmitting}
                            heightClass="h-36"
                        />
                    </div>
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
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className={getPrimaryCtaClasses(!canSubmit)}
                        >
                            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                            Iniciar retorno a base
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
