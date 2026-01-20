'use client';

import { useState, useRef } from 'react';
import { Camera, X, Check, AlertTriangle } from 'lucide-react';

const INCIDENT_TYPES = [
    { id: 'bateria', label: 'Batería' },
    { id: 'helices', label: 'Hélices' },
    { id: 'conexion', label: 'Conexión' },
    { id: 'clima', label: 'Clima' },
    { id: 'otro', label: 'Otro' },
];

export default function IncidentReporter({ onClose, onSave }) {
    const [type, setType] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState(null); // base64 or blob
    const fileInputRef = useRef(null);

    const handleImageCapture = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Basic compression logic placeholder
            // Ideally we'd resize to max 1024px here
            const reader = new FileReader();
            reader.onload = (ev) => setImage(ev.target.result);
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = () => {
        if (!type) return;
        onSave({ type, description, image, timestamp: new Date().toISOString() });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-red-600 flex items-center gap-2">
                        <AlertTriangle size={20} /> Reportar Falla
                    </h3>
                    <button onClick={onClose} className="p-2 bg-white rounded-full text-slate-400 hover:text-slate-700">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    {/* Type Selection */}
                    <div className="grid grid-cols-2 gap-3">
                        {INCIDENT_TYPES.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setType(t.id)}
                                className={`p-3 rounded-lg border text-sm font-medium transition-all ${type === t.id
                                    ? 'bg-red-50 border-red-500 text-red-700 shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-red-200'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Camera */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl h-32 flex flex-col items-center justify-center cursor-pointer transition-colors ${image ? 'border-red-400 bg-red-50' : 'border-slate-300 hover:border-slate-400 bg-slate-50'
                            }`}
                    >
                        {image ? (
                            <div className="relative w-full h-full p-2">
                                <img src={image} alt="Evidencia" className="w-full h-full object-cover rounded-lg" decoding="async" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white font-medium opacity-0 hover:opacity-100 transition-opacity">
                                    Cambiar Foto
                                </div>
                            </div>
                        ) : (
                            <>
                                <Camera size={32} className="text-slate-400 mb-2" />
                                <span className="text-sm text-slate-500 font-medium">Adjuntar Evidencia</span>
                            </>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleImageCapture}
                        />
                    </div>

                    {/* Description */}
                    <textarea
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
                        rows={3}
                        placeholder="Detalles adicionales (opcional)..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100">
                    <button
                        onClick={handleSubmit}
                        disabled={!type}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                    >
                        <Check size={20} /> Registrar Falla
                    </button>
                </div>
            </div>
        </div>
    );
}
