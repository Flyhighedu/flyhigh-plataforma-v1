'use client';

import { Loader2, ShieldAlert, Trash2 } from 'lucide-react';

export default function DeleteConfirmationModal({
    isOpen,
    missionLabel,
    password,
    onPasswordChange,
    onCancel,
    onConfirm,
    isSubmitting = false,
    errorMessage = ''
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="w-full max-w-sm rounded-2xl border border-rose-500/40 bg-slate-950 shadow-[0_30px_90px_-20px_rgba(244,63,94,0.45)] overflow-hidden">
                <div className="px-5 py-4 border-b border-rose-500/25 bg-gradient-to-r from-rose-900/40 to-slate-900">
                    <div className="flex items-start gap-3">
                        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/30">
                            <ShieldAlert size={18} className="text-rose-300" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-rose-200/80">Accion protegida</p>
                            <h3 className="mt-1 text-base font-black text-rose-50 leading-tight">Eliminar mision del historial</h3>
                            <p className="mt-1 text-xs text-rose-100/80 truncate">{missionLabel || 'Mision seleccionada'}</p>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4 space-y-3">
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Para confirmar la eliminacion, ingresa tu contrasena de cuenta.
                    </p>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Contrasena</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => onPasswordChange && onPasswordChange(event.target.value)}
                            placeholder="Ingresa tu contrasena"
                            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                            autoFocus
                        />
                    </div>

                    {errorMessage ? (
                        <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                            {errorMessage}
                        </div>
                    ) : null}
                </div>

                <div className="px-5 py-4 border-t border-slate-800 bg-slate-900/70 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-800/75 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-60"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className="flex-1 rounded-xl border border-rose-500/50 bg-rose-600 px-3 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-rose-500 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                    >
                        {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Eliminar mision
                    </button>
                </div>
            </div>
        </div>
    );
}
