'use client';

import { useState } from 'react';
import { Coffee, AlertTriangle, X, Check } from 'lucide-react';

const MAINTENANCE_CHECKS = [
    { id: 'resguardo', label: 'Aeronave en zona de resguardo' },
    { id: 'bateria', label: 'Cambio de batería preventivo' },
    { id: 'control', label: 'Cambio de control y re-vinculación' }
];

const PAUSE_REASONS = [
    { id: 'clima', label: 'Clima', icon: '🌧️' },
    { id: 'evento', label: 'Evento Escolar', icon: '🎉' },
    { id: 'falla', label: 'Falla Técnica', icon: '⚠️' },
    { id: 'otro', label: 'Otro', icon: '📝' }
];

export default function PauseMenu({ isOpen, onClose, onStartPause }) {
    const [step, setStep] = useState('menu'); // 'menu' | 'receso' | 'prolongada'
    const [checks, setChecks] = useState({});
    const [selectedReason, setSelectedReason] = useState(null);

    const toggleCheck = (id) => {
        setChecks(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const allChecksComplete = MAINTENANCE_CHECKS.every(c => checks[c.id]);

    const handleStartReceso = () => {
        if (!allChecksComplete) return;
        onStartPause({
            type: 'receso',
            reason: null,
            maintenanceChecklist: checks
        });
        resetAndClose();
    };

    const handleStartProlongada = () => {
        if (!selectedReason) return;
        onStartPause({
            type: 'prolongada',
            reason: selectedReason,
            maintenanceChecklist: {}
        });
        resetAndClose();
    };

    const resetAndClose = () => {
        setStep('menu');
        setChecks({});
        setSelectedReason(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-amber-500 text-white p-5 relative">
                    <button onClick={resetAndClose} className="absolute top-4 right-4 p-1 hover:bg-white/20 rounded-full">
                        <X size={20} />
                    </button>
                    <h2 className="text-xl font-black">
                        {step === 'menu' && '⏸️ Iniciar Pausa'}
                        {step === 'receso' && '☕ Receso Escolar'}
                        {step === 'prolongada' && '⚠️ Pausa Prolongada'}
                    </h2>
                    <p className="text-amber-100 text-sm mt-1">
                        {step === 'menu' && 'Selecciona el tipo de pausa'}
                        {step === 'receso' && 'Completa el checklist de mantenimiento'}
                        {step === 'prolongada' && 'Selecciona la razón'}
                    </p>
                </div>

                {/* Content */}
                <div className="p-5">
                    {/* Menu Step */}
                    {step === 'menu' && (
                        <div className="space-y-3">
                            <button
                                onClick={() => setStep('receso')}
                                className="w-full p-4 bg-amber-50 hover:bg-amber-100 border-2 border-amber-200 rounded-xl text-left flex items-center gap-4 transition-all group"
                            >
                                <div className="w-12 h-12 bg-amber-500 text-white rounded-xl flex items-center justify-center">
                                    <Coffee size={24} />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800">Receso Escolar</div>
                                    <div className="text-xs text-slate-500">Pausa programada con mantenimiento</div>
                                </div>
                            </button>

                            <button
                                onClick={() => setStep('prolongada')}
                                className="w-full p-4 bg-red-50 hover:bg-red-100 border-2 border-red-200 rounded-xl text-left flex items-center gap-4 transition-all group"
                            >
                                <div className="w-12 h-12 bg-red-500 text-white rounded-xl flex items-center justify-center">
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800">Pausa Prolongada</div>
                                    <div className="text-xs text-slate-500">Incidencia o evento no programado</div>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Receso Step - Maintenance Checklist */}
                    {step === 'receso' && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600 font-medium">
                                Confirma el protocolo de mantenimiento antes de iniciar el receso:
                            </p>
                            <div className="space-y-2">
                                {MAINTENANCE_CHECKS.map((item) => (
                                    <label
                                        key={item.id}
                                        className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${checks[item.id]
                                                ? 'bg-green-50 border-green-300'
                                                : 'bg-slate-50 border-slate-200 hover:border-amber-300'
                                            }`}
                                    >
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${checks[item.id] ? 'bg-green-500 border-green-500' : 'border-slate-300'
                                            }`}>
                                            {checks[item.id] && <Check size={14} className="text-white" />}
                                        </div>
                                        <span className="text-slate-700 font-medium text-sm">{item.label}</span>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={checks[item.id] || false}
                                            onChange={() => toggleCheck(item.id)}
                                        />
                                    </label>
                                ))}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setStep('menu')}
                                    className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600"
                                >
                                    Atrás
                                </button>
                                <button
                                    onClick={handleStartReceso}
                                    disabled={!allChecksComplete}
                                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors"
                                >
                                    Iniciar Receso
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Prolongada Step - Reason Selector */}
                    {step === 'prolongada' && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600 font-medium">
                                ¿Cuál es la razón de la pausa?
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {PAUSE_REASONS.map((reason) => (
                                    <button
                                        key={reason.id}
                                        onClick={() => setSelectedReason(reason.id)}
                                        className={`p-4 rounded-xl border-2 text-center transition-all ${selectedReason === reason.id
                                                ? 'bg-red-50 border-red-400'
                                                : 'bg-slate-50 border-slate-200 hover:border-red-300'
                                            }`}
                                    >
                                        <div className="text-2xl mb-1">{reason.icon}</div>
                                        <div className="text-sm font-bold text-slate-700">{reason.label}</div>
                                    </button>
                                ))}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setStep('menu')}
                                    className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600"
                                >
                                    Atrás
                                </button>
                                <button
                                    onClick={handleStartProlongada}
                                    disabled={!selectedReason}
                                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors"
                                >
                                    Iniciar Pausa
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
