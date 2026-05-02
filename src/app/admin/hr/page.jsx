'use client';

import React from 'react';
import HRCommandCenter from '@/components/admin/HRCommandCenter';

export default function AdminHRPage() {
    return (
        <div className="w-full h-full flex flex-col pt-4 overflow-y-auto overflow-x-hidden relative animate-premium-in">
            <HRCommandCenter />
        </div>
    );
}
