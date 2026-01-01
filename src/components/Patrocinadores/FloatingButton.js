'use client';

import React from 'react';
import { Share2 } from 'lucide-react'; // Using Share2 as a generic action icon or Plus, but input had stacked lines/download icon look. Input was: M12 6v6m0 0v6m0-6h6m-6 0H6 which is a Plus icon.

export default function FloatingButton({ onClick }) {
    return (
        <div className="fixed bottom-8 right-8 z-[150]">
            <button
                onClick={onClick}
                id="fabBtn"
                className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-2xl active:scale-90 transition-transform hover:bg-blue-500"
            >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
            </button>
        </div>
    );
}
