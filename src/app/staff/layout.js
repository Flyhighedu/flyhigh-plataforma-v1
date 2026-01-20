import Link from 'next/link';
import { Wifi, WifiOff } from 'lucide-react';
// import { createClient } from '@/utils/supabase/server'; // Will implement later with middleware

export default function StaffLayout({ children }) {

    // Placeholder for connectivity check logic
    // In a real implementation, we'd use a hook to check useOnlineStatus
    const isOnline = true;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
            {/* Top Bar Minimalista */}
            <header className="bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4 sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-lg tracking-tight text-blue-900">FlyHigh<span className="text-blue-500">Ops</span></span>
                </div>

                <div className="flex items-center gap-3">
                    {/* Status Indicator */}
                    <div className={`p-1.5 rounded-full ${isOnline ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {isOnline ? <Wifi size={18} /> : <WifiOff size={18} />}
                    </div>
                    {/* User Avatar Placeholder */}
                    <div className="w-8 h-8 bg-slate-200 rounded-full border border-slate-300 flex items-center justify-center text-xs font-medium text-slate-600">
                        ST
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-md mx-auto p-4 pb-20">
                {children}
            </main>
        </div>
    );
}
