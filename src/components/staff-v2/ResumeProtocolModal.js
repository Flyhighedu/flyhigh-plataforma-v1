'use client';

import { useState } from 'react';
import { Shield, Check, X, AlertCircle } from 'lucide-react';

const RESUME_CHECKS = [
    { id: 'vinculado', label: 'Control y dron vinculados correctamente' },
    { id: 'bateria', label: 'Dron con batería al 100%' },
    { id: 'despegue', label: 'Dron en área de despegue' },
    { id: 'area_libre', label: 'Área libre de alumnos y obstáculos' }
];

export default function ResumeProtocolModal({ isOpen, onClose, onConfirmResume }) {
    const [checks, setChecks] = useState({});

    const toggleCheck = (id) => {
        setChecks(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const allChecksComplete = RESUME_CHECKS.every(c => checks[c.id]);

    const handleConfirm = () => {
        if (!allChecksComplete) return;
        onConfirmResume(checks);
        setChecks({});
    };

    const handleCancel = () => {
        setChecks({});
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-blue-600 text-white p-5 relative">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <Shield size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black">Protocolo de Seguridad</h2>
                            <p className="text-blue-200 text-sm">Verificación antes de reanudar</p>
                        </div>
                    </div>
                </div>

                {/* Warning Banner */}
                <div className="bg-amber-50 border-b border-amber-100 px-5 py-3 flex items-center gap-3">
                    <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-700 font-medium">
                        Confirma cada punto antes de reanudar vuelos
                    </p>
                </div>

                {/* Checklist */}
                <div className="p-5 space-y-3">
                    {RESUME_CHECKS.map((item, idx) => (
                        <label
                            key={item.id}
                            className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${checks[item.id]
                                    ? 'bg-green-50 border-green-400'
                                    : 'bg-slate-50 border-slate-200 hover:border-blue-300'
                                }`}
                        >
                            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checks[item.id] ? 'bg-green-500 border-green-500' : 'border-slate-300'
                                }`}>
                                {checks[item.id] && <Check size={16} className="text-white" />}
                            </div>
                            <div>
                                <span className="text-xs text-slate-400 font-bold uppercase">Check {idx + 1}</span>
                                <p className="text-slate-700 font-medium text-sm leading-tight">{item.label}</p>
                            </div>
                            <input
                                type="checkbox"
                                className="hidden"
                                checked={checks[item.id] || false}
                                onChange={() => toggleCheck(item.id)}
                            />
                        </label>
                    ))}
                </div>

                {/* Actions */}
                <div className="p-5 pt-0 flex gap-3">
                    <button
                        onClick={handleCancel}
                        className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
                    >
                        <X size={18} /> Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!allChecksComplete}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        <Check size={18} /> Reanudar
                    </button>
                </div>
            </div>
        </div>
    );
}
