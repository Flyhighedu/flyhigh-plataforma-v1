'use client';

import React, { useState } from 'react';
import { CheckCircle, School as SchoolIcon, User, Phone, MapPin, Loader2, ArrowLeft } from 'lucide-react';
import { formatFlyerDate, formatMoney } from '@/utils/flyerUtils';

export default function SalesRegistrationForm({ data, onBack, onSuccess }) {
    const [director, setDirector] = useState('');
    const [telefono, setTelefono] = useState('');
    const [colonia, setColonia] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/staff/sales-register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre_escuela: data.school.nombre_escuela,
                    cct: data.cct,
                    turno: data.turno,
                    fecha_programada: data.fecha,
                    cuota_alumno: data.cuota,
                    numero_ninos: data.numNinos,
                    nombre_director: director,
                    telefono_director: telefono,
                    colonia: colonia
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error al registrar la escuela');
            }

            onSuccess(result.data);
        } catch (err) {
            console.error('Registration error:', err);
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isReady = director.trim() !== '' && telefono.trim().length >= 10;

    return (
        <div className="w-full max-w-lg mx-auto flex flex-col min-h-[80vh] pb-12 animate-in fade-in slide-in-from-right-4 duration-500">
            
            <div className="flex items-center mb-6">
                <button 
                    onClick={onBack}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/40 text-slate-600 hover:bg-white/60 transition-colors shadow-sm"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="flex-1 text-center pr-10">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-2 shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff]">
                        <CheckCircle size={24} />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Registro Final</h2>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                
                {/* Pre-populated Readonly Info */}
                <div className="bg-slate-100/50 rounded-[24px] p-5 border border-slate-200/50 opacity-80">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                        Datos del Acuerdo (Fijos)
                    </h3>
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 text-sm">
                            <SchoolIcon size={14} className="text-slate-400" />
                            <span className="font-bold text-slate-700">{data.school.nombre_escuela}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <CheckCircle size={14} className="text-slate-400" />
                            <span className="font-medium text-slate-600">Fecha: {formatFlyerDate(data.fecha)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <CheckCircle size={14} className="text-slate-400" />
                            <span className="font-medium text-slate-600">Cuota: {formatMoney(data.cuota)} / alumno</span>
                        </div>
                    </div>
                </div>

                {/* Additional Inputs */}
                <div className="bg-white/40 backdrop-blur-md rounded-[28px] p-6 shadow-[8px_8px_16px_#cbd5e1,-8px_-8px_16px_#ffffff] border border-white/50 space-y-5">
                    
                    <div>
                        <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                            <User size={14} /> Nombre del Director(a) *
                        </label>
                        <input
                            type="text"
                            value={director}
                            onChange={(e) => setDirector(e.target.value)}
                            placeholder="Ej. Prof. Juan Pérez"
                            required
                            className="w-full bg-slate-50 rounded-xl px-4 py-3 text-slate-700 font-medium shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] border-none focus:ring-2 focus:ring-emerald-400/50 transition-all placeholder:text-slate-400"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                            <Phone size={14} /> Teléfono del Director(a) *
                        </label>
                        <input
                            type="tel"
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value)}
                            placeholder="Ej. 452 123 4567"
                            required
                            minLength={10}
                            className="w-full bg-slate-50 rounded-xl px-4 py-3 text-slate-700 font-medium shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] border-none focus:ring-2 focus:ring-emerald-400/50 transition-all placeholder:text-slate-400"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 ml-1">Para enviarles material y coordinar logística.</p>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                            <MapPin size={14} /> Colonia / Dirección
                        </label>
                        <input
                            type="text"
                            value={colonia}
                            onChange={(e) => setColonia(e.target.value)}
                            placeholder="Ubicación de la escuela"
                            className="w-full bg-slate-50 rounded-xl px-4 py-3 text-slate-700 font-medium shadow-[inset_2px_2px_4px_#cbd5e1,inset_-2px_-2px_4px_#ffffff] border-none focus:ring-2 focus:ring-emerald-400/50 transition-all placeholder:text-slate-400"
                        />
                    </div>

                </div>

                {error && (
                    <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100 text-center">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={!isReady || isSubmitting}
                    className={`w-full flex items-center justify-center gap-3 px-8 py-4 rounded-full font-black text-white transition-all duration-300 ${
                        !isReady 
                        ? 'bg-slate-300 opacity-50 cursor-not-allowed' 
                        : isSubmitting
                            ? 'bg-emerald-600'
                            : 'bg-emerald-500 hover:bg-emerald-400 hover:scale-[1.02] active:scale-95 shadow-[0_8px_24px_rgba(16,185,129,0.4)]'
                    }`}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 size={20} className="animate-spin" /> Registrando...
                        </>
                    ) : (
                        <>
                            <CheckCircle size={20} /> Agendar en el Cronograma
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
