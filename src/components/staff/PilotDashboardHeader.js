'use client';

import { ChevronLeft, Flame, Award, MapPin, Zap, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MiniAvatar } from '@/components/ui/MiniAvatar';

export default function PilotDashboardHeader({
    userName = 'Piloto',
    avatarConfig = null,
    totalPoints = 0,
    nextLevelTarget = 5,
    progressPercent = 0,
    studyReadyCount = 0
}) {
    const router = useRouter();

    // Determine current title based on points
    let rankTitle = 'Cadete';
    if (totalPoints >= 5) rankTitle = 'Explorador';
    if (totalPoints >= 10) rankTitle = 'Navegante';
    if (totalPoints >= 20) rankTitle = 'Capitán';

    return (
        <div className="bg-slate-50 flex flex-col font-sans">
            {/* ═══ BLUE HERO HEADER (EDGE TO EDGE) ═══ */}
            <div className="bg-gradient-to-br from-[#2563eb] to-[#4338ca] pt-12 pb-8 px-5 relative overflow-hidden shadow-[0_12px_30px_rgba(37,99,235,0.25)] rounded-b-[40px] z-20">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-white opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-400 opacity-20 rounded-full blur-2xl translate-y-1/4 -translate-x-1/4 pointer-events-none"></div>

                {/* Nav & Big Title */}
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <button 
                        onClick={() => router.push('/staff/dashboard')}
                        className="p-2.5 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 active:scale-95 transition-all shadow-sm border border-white/10"
                    >
                        <ChevronLeft size={24} strokeWidth={3} />
                    </button>
                    <h1 className="text-2xl font-black text-white/90 tracking-tight uppercase">Academia</h1>
                    <div className="w-10" />
                </div>

                {/* Left Content + Avatar */}
                <div className="relative z-10 flex flex-col justify-center max-w-[65%] mt-2">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Shield size={14} className="text-blue-300" strokeWidth={2.5} />
                        <span className="text-blue-200 font-black tracking-widest text-[10px] uppercase">{rankTitle}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                    </div>
                    <h2 className="text-4xl font-black text-white leading-none mb-3 drop-shadow-md tracking-tight">
                        Hola, <br/>{userName.split(' ')[0]}
                    </h2>

                    {/* Stats Pills — compact, inline with greeting */}
                    <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                            <Flame size={11} className="text-orange-300" />
                            <span className="text-white font-bold text-[11px]">3</span>
                            <span className="text-white/50 font-medium text-[9px]">días</span>
                        </div>
                        <div className="flex items-center gap-1 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                            <Zap size={11} className="text-blue-300" />
                            <span className="text-white font-bold text-[11px]">{studyReadyCount}</span>
                            <span className="text-white/50 font-medium text-[9px]">fichas</span>
                        </div>
                        <div className="flex items-center gap-1 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                            <MapPin size={11} className="text-emerald-300" />
                            <span className="text-white font-bold text-[11px]">{totalPoints}</span>
                            <span className="text-white/50 font-medium text-[9px]">puntos</span>
                        </div>
                    </div>
                </div>

                {/* Giant Avatar (Floating, no circle) */}
                <div className="absolute right-[-30px] bottom-[-20px] w-[240px] h-[240px] z-10 pointer-events-none flex items-end justify-center">
                    {avatarConfig && (
                        <MiniAvatar config={avatarConfig} size={220} className="drop-shadow-2xl translate-y-2 animate-in fade-in duration-500" />
                    )}
                </div>
            </div>

            {/* ═══ XP PROGRESS BAR ═══ */}
            <div className="px-5 pt-5 pb-2 relative z-10">
                <div className="bg-white rounded-[28px] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center">
                                <Award size={14} className="text-indigo-500" />
                            </div>
                            <p className="text-[12px] font-black text-slate-700 uppercase tracking-wider">Próximo Rango</p>
                        </div>
                        <div className="bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                            <p className="text-[12px] font-black text-indigo-600">{totalPoints} <span className="text-slate-400">/ {nextLevelTarget}</span></p>
                        </div>
                    </div>
                    
                    {/* Modern Progress Bar */}
                    <div className="w-full bg-slate-100 h-3.5 rounded-full overflow-hidden p-[2px]">
                        <div 
                            className="bg-gradient-to-r from-[#2563eb] to-[#4338ca] h-full rounded-full transition-all duration-1000 ease-out relative shadow-sm"
                            style={{ width: `${progressPercent}%` }}
                        >
                            <div className="absolute top-0 right-0 bottom-0 w-8 bg-white/20 skew-x-12 animate-[shimmer_2s_infinite]"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
