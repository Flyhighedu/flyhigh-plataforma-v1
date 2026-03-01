'use client';

import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';

export default function WelcomeTransition({ profile, onComplete }) {
    const [timeLeft, setTimeLeft] = useState(2);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        const timeout = setTimeout(() => {
            onComplete();
        }, 2000);

        return () => {
            clearInterval(timer);
            clearTimeout(timeout);
        };
    }, [onComplete]);

    const firstName = profile?.full_name?.split(' ')[0] || 'Docente';

    return (
        <div className="fixed inset-0 z-50 bg-white font-display flex flex-col items-center justify-center text-slate-900 p-6 overflow-hidden">

            <main className="flex flex-col items-center justify-center w-full max-w-sm flex-1 animate-in fade-in zoom-in duration-500">
                <div className="relative mb-8">
                    {/* Glow effect matching brand primary blue */}
                    <div className="absolute inset-0 bg-blue-100 rounded-full blur-3xl opacity-60 animate-pulse"></div>

                    <div className="relative bg-white p-8 rounded-full shadow-2xl shadow-blue-500/10 flex items-center justify-center border border-blue-100">
                        <div className="bg-blue-50 p-4 rounded-full">
                            <CheckCircle size={64} className="text-[#137fec]" />
                        </div>
                    </div>
                </div>

                <div className="text-center space-y-2 px-4">
                    <h1 className="text-4xl font-black tracking-tight leading-tight bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 bg-[length:200%_auto] text-transparent bg-clip-text animate-text-shimmer pb-1">
                        ¡Hola, {firstName}!
                    </h1>
                    <p className="text-lg text-slate-500 font-medium">
                        Todo listo para hoy
                    </p>
                </div>

                {/* Progress Indicators - Brand Blue */}
                <div className="mt-12 flex space-x-2 justify-center items-center">
                    <div className="h-1.5 w-1.5 bg-blue-200 rounded-full"></div>
                    <div className="h-1.5 w-6 bg-[#137fec] rounded-full transition-all duration-1000"></div>
                    <div className="h-1.5 w-1.5 bg-blue-200 rounded-full"></div>
                </div>
            </main>

            {/* Background Effects - Subtle Blue Ambient */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 opacity-40">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-50 via-white to-cyan-50 rounded-full blur-[100px]"></div>
            </div>
        </div>
    );
}
