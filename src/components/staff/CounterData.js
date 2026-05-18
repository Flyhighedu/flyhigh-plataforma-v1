'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

export default function CounterData({ label, value, onChange, color = "blue", isPeripheralActive = false }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);

    // Color maps
    const colors = {
        blue: "bg-blue-500 border-blue-600 text-white",
        indigo: "bg-indigo-500 border-indigo-600 text-white",
        emerald: "bg-emerald-500 border-emerald-600 text-white",
    };
    const btnColor = colors[color] || colors.blue;

    const handleIncrement = () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
        onChange(value + 1);
    };
    
    const handleDecrement = () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
        onChange(Math.max(0, value - 1));
    };

    const handleManualEdit = () => {
        setTempValue(value);
        setIsEditing(true);
    };

    const handleManualSave = () => {
        const num = parseInt(tempValue, 10);
        onChange(isNaN(num) ? 0 : Math.max(0, num));
        setIsEditing(false);
    };

    return (
        <div className="flex flex-col items-center justify-center p-2 bg-white/5 rounded-3xl border border-slate-200/50 backdrop-blur-sm">
            <span className={`text-[12px] font-black uppercase tracking-widest mb-1 ${isPeripheralActive ? 'text-white/60' : 'text-slate-400'}`}>
                {label}
            </span>
            
            <div className="flex items-center justify-center relative my-0.5">
                {isEditing ? (
                    <input
                        type="number"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={handleManualSave}
                        autoFocus
                        className={`w-20 text-center text-4xl font-black focus:outline-none bg-transparent transition-colors ${isPeripheralActive ? 'text-white' : 'text-slate-800'}`}
                    />
                ) : (
                    <div onClick={handleManualEdit} className="cursor-pointer select-none">
                        <span className={`text-[48px] font-black tracking-tighter leading-none transition-colors ${isPeripheralActive ? 'text-white' : 'text-slate-800'}`}>
                            {value}
                        </span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3 mt-1">
                <button
                    onClick={handleDecrement}
                    className={`h-12 w-12 rounded-full flex items-center justify-center transition-transform active:scale-90 ${value === 0 ? 'bg-slate-100 text-slate-300' : isPeripheralActive ? 'bg-white/10 text-white' : 'bg-white shadow-sm border border-slate-200 text-slate-600'}`}
                    disabled={value === 0}
                >
                    <Minus size={24} strokeWidth={3} />
                </button>
                <button
                    onClick={handleIncrement}
                    className={`h-12 w-12 rounded-full flex items-center justify-center transition-transform active:scale-90 ${isPeripheralActive ? 'bg-white/20 text-white' : 'bg-blue-50 border border-blue-100 text-blue-600'}`}
                >
                    <Plus size={24} strokeWidth={3} />
                </button>
            </div>
        </div>
    );
}
