"use client";

import { useState, useEffect } from "react";
import { Bell, X, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminAlarms() {
    const [alarms, setAlarms] = useState([]);
    const [dismissedIDs, setDismissedIDs] = useState([]);
    const router = useRouter();

    useEffect(() => {
        // Poll every 30 seconds
        const fetchAlarms = async () => {
            try {
                const res = await fetch("/api/crm-alarms");
                if (!res.ok) return;
                const { data } = await res.json();
                
                if (data && data.length > 0) {
                    setAlarms(prev => {
                        const newAlarms = data.filter(a => !alarms.some(old => old.id === a.id));
                        // Play sound on new alarms that aren't dismissed
                        if (newAlarms.some(a => !dismissedIDs.includes(a.id))) {
                            const audio = new Audio('/sys/notifications/plucky.mp3');
                            audio.play().catch(e => console.log('Audio autoplay blocked', e));
                        }
                        return data;
                    });
                } else {
                    setAlarms([]);
                }
            } catch (err) {
                console.error("Failed to fetch alarms", err);
            }
        };

        fetchAlarms();
        const intv = setInterval(fetchAlarms, 30000);
        return () => clearInterval(intv);
    }, [alarms, dismissedIDs]);

    const activeAlarms = alarms.filter(a => !dismissedIDs.includes(a.id));

    if (activeAlarms.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full">
            {activeAlarms.map((alarm) => (
                <div key={alarm.id} className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 shadow-2xl rounded-2xl p-4 overflow-hidden relative group animate-in slide-in-from-bottom-5">
                    {/* Pulsing indicator */}
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 animate-pulse"></div>
                    
                    <div className="flex items-start justify-between gap-3 ml-2">
                        <div className="shrink-0 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 p-2 rounded-xl">
                            <Bell size={20} className="animate-bounce" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-[14px] font-black tracking-tight text-slate-800 dark:text-slate-100 truncate">
                                {alarm.school_name}
                            </h4>
                            <p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                                {alarm.contact_name || alarm.phone_number}
                            </p>
                            {alarm.reminder_note && (
                                <p className="text-[13px] text-slate-600 dark:text-slate-300 mt-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700 leading-snug">
                                    {alarm.reminder_note}
                                </p>
                            )}

                            <div className="mt-3 flex items-center gap-2">
                                <button 
                                    onClick={() => {
                                        // Navigate to CRM and select this contact
                                        // Using a query param or localStorage might be needed to auto-open, but navigating to CRM is good enough
                                        router.push('/sandbox-crm');
                                    }}
                                    className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#2563eb] bg-blue-50 dark:bg-[#1e3a8a] dark:text-[#93c5fd] px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                                >
                                    Abrir CRM <ExternalLink size={12} />
                                </button>
                                <button
                                    onClick={() => setDismissedIDs(prev => [...prev, alarm.id])}
                                    className="text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-1.5 transition-colors"
                                >
                                    OCULTAR
                                </button>
                            </div>
                        </div>
                        <button 
                            onClick={() => setDismissedIDs(prev => [...prev, alarm.id])}
                            className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
