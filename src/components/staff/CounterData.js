'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

export default function CounterData({ label, value, onChange, color = "blue" }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);

    // Color maps
    const colors = {
        blue: "bg-blue-600 active:bg-blue-700 text-white",
        indigo: "bg-indigo-600 active:bg-indigo-700 text-white",
        emerald: "bg-emerald-600 active:bg-emerald-700 text-white",
    };
    const btnColor = colors[color] || colors.blue;

    const handleIncrement = () => onChange(value + 1);
    const handleDecrement = () => onChange(Math.max(0, value - 1));

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
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <h3 className="text-sm font-medium text-slate-500 mb-3 text-center uppercase tracking-wider">{label}</h3>

            <div className="flex items-center justify-between gap-4">
                <button
                    onClick={handleDecrement}
                    className={`h-14 w-14 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-95 ${value === 0 ? 'bg-slate-100 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}
                    disabled={value === 0}
                >
                    <Minus size={28} strokeWidth={3} />
                </button>

                {isEditing ? (
                    <input
                        type="number"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={handleManualSave}
                        autoFocus
                        className="w-20 text-center text-4xl font-bold text-slate-800 border-b-2 border-blue-500 focus:outline-none bg-transparent"
                    />
                ) : (
                    <div onClick={handleManualEdit} className="flex-1 text-center cursor-pointer">
                        <span className="text-5xl font-extrabold text-slate-800 tracking-tight leading-none">{value}</span>
                    </div>
                )}

                <button
                    onClick={handleIncrement}
                    className={`h-14 w-14 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 transition-transform active:scale-90 ${btnColor}`}
                >
                    <Plus size={28} strokeWidth={3} />
                </button>
            </div>
        </div>
    );
}
