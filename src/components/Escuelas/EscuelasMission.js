"use client";
import React from 'react';
import { HandHeart, Users } from 'lucide-react';

export default function EscuelasMission() {
    const sponsors = [
        { logo: "/img/strong plastic.png", name: "Strong Plastic" },
        { logo: "/img/bonanza.png", name: "La Bonanza" },
        // Add more placeholders if needed for visual balance, or keep these two
    ];

    return (
        <section className="py-24 bg-slate-900 text-white relative overflow-hidden" id="mission">
            {/* Background Details */}
            <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-1/2 h-full bg-fuchsia-600/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
                <div className="grid lg:grid-cols-2 gap-16 items-center">

                    {/* Left: Content */}
                    <div className="space-y-8 text-left">
                        <div className="inline-flex items-center gap-2 text-fuchsia-400 font-black text-xs uppercase tracking-[0.2em]">
                            <HandHeart size={16} /> Filosofía Fly High
                        </div>

                        <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-[0.9]">
                            Ningún Niño <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400">Se Queda en Tierra</span>
                        </h2>

                        <div className="space-y-6 text-lg text-slate-300 font-medium leading-relaxed">
                            <p>
                                Creemos firmemente que el código postal de un niño no debería determinar la altura de sus sueños.
                            </p>
                            <p>
                                Por eso, hemos forjado una <strong className="text-white">Alianza de Titanes</strong>. Empresas líderes de Uruapan que han decidido invertir en el futuro, <span className="text-fuchsia-400">subsidiando masivamente</span> el costo de esta experiencia tecnológica.
                            </p>
                            <p className="border-l-4 border-fuchsia-500 pl-6 italic text-white/80">
                                "El dinero nunca será una barrera. Si un niño quiere volar, nosotros le damos las alas."
                            </p>
                        </div>

                        <div className="pt-8">
                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-4">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-xs font-bold text-slate-500">
                                            <Users size={16} />
                                        </div>
                                    ))}
                                </div>
                                <div className="text-sm font-bold uppercase tracking-wide text-slate-400">
                                    <span className="text-white block text-lg leading-none">30,000+</span>
                                    Niños Impactados
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Sponsors Grid */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-tr from-fuchsia-500/20 to-blue-500/20 rounded-[3rem] blur-xl" />
                        <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-[2.5rem] relative">
                            <h3 className="text-center text-xs font-black uppercase tracking-[0.3em] text-white/40 mb-10">Patrocinadores Oficiales</h3>

                            <div className="grid grid-cols-1 gap-8 items-center justify-items-center">
                                {sponsors.map((sponsor, index) => (
                                    <div key={index} className="group relative w-full h-32 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center transition-all duration-500 p-6">
                                        <img
                                            src={sponsor.logo}
                                            alt={sponsor.name}
                                            className="max-w-full max-h-full object-contain filter brightness-0 invert group-hover:brightness-100 group-hover:invert-0 transition-all duration-500 opacity-60 group-hover:opacity-100 transform group-hover:scale-110"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 text-center">
                                <p className="text-xs text-slate-400 font-medium">Gracias a ellos, su escuela ahorra miles de pesos.</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
