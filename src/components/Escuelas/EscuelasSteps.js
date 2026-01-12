"use client";
import React from 'react';
import { UserPlus, ClipboardList, Package, Rocket, CheckCircle2 } from 'lucide-react';

export default function EscuelasSteps() {
    const steps = [
        {
            icon: <UserPlus className="w-6 h-6" />,
            title: "Registro Simple",
            desc: "Inicia el proceso en 2 minutos. Aseguramos tu lugar en la lista de espera para la próxima temporada.",
            color: "bg-blue-500",
            lightColor: "bg-blue-100",
            textColor: "text-blue-600"
        },
        {
            icon: <ClipboardList className="w-6 h-6" />,
            title: "Planificación",
            desc: "Nuestro equipo te contacta para definir fechas y logística. Recibes el Kit Digital para padres.",
            color: "bg-emerald-500",
            lightColor: "bg-emerald-100",
            textColor: "text-emerald-600"
        },
        {
            icon: <Package className="w-6 h-6" />,
            title: "Recepción de Materiales",
            desc: "Llegan a tu escuela los kits de construcción de cohetes y materiales didácticos previos al evento.",
            color: "bg-purple-500",
            lightColor: "bg-purple-100",
            textColor: "text-purple-600"
        },
        {
            icon: <Rocket className="w-6 h-6" />,
            title: "Día del Despegue",
            desc: "El equipo de Fly High Edu aterriza en tu patio. Montamos la feria, el control de misión y ¡a volar!",
            color: "bg-orange-500",
            lightColor: "bg-orange-100",
            textColor: "text-orange-600"
        }
    ];

    return (
        <section className="py-24 bg-white relative overflow-hidden">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">

                <div className="text-center mb-16">
                    <span className="inline-block py-1 px-3 rounded-full bg-slate-100 text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">
                        Proceso Simplificado
                    </span>
                    <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tight">
                        Tu Ruta al Despegue
                    </h2>
                    <p className="mt-4 text-slate-500 max-w-xl mx-auto">
                        Nos encargamos de la logística pesada. Tú encárgate de inspirar.
                    </p>
                </div>

                <div className="relative">
                    {/* Connecting Line (Desktop) */}
                    <div className="hidden md:block absolute top-[2.25rem] left-0 w-full h-1 bg-slate-100 -z-10 rounded-full">
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-500 via-purple-500 to-orange-500 opacity-20" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                        {steps.map((step, idx) => (
                            <div key={idx} className="relative flex flex-col items-center text-center group">
                                {/* Step Number Badge */}
                                <div className="absolute -top-12 opacity-10 text-6xl font-black text-slate-300 pointer-events-none group-hover:scale-110 transition-transform duration-300">
                                    0{idx + 1}
                                </div>

                                {/* Icon Circle */}
                                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-200 mb-6 relative z-10 transition-transform duration-300 group-hover:-translate-y-2 ${step.color}`}>
                                    {step.icon}
                                    {/* Pulse Effect */}
                                    <div className={`absolute inset-0 rounded-2xl ${step.color} opacity-0 group-hover:opacity-40 animate-ping duration-1000 -z-10`} />
                                </div>

                                <h3 className="text-lg font-bold text-slate-800 mb-3">{step.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                                    {step.desc}
                                </p>

                                {/* Checkmark for completed feel */}
                                <div className={`mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${step.textColor}`}>
                                    <CheckCircle2 size={16} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </section>
    );
}
