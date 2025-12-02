'use client';
import React, { useEffect, useState } from 'react';
import { supabaseNew } from '../lib/supabaseClientNew';

const NewImpactCounter = () => {
    const [count, setCount] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCount = async () => {
            console.log('URL detectada:', process.env.NEXT_PUBLIC_SUPABASE_URL);

            const { count, error } = await supabaseNew
                .from('stats')
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.error('Error fetching count:', error);
                setError(error.message);
            } else {
                setCount(count);
            }
        };

        fetchCount();
    }, []);

    if (error) return <div className="text-red-500 p-4 text-center">Error: {error}</div>;
    if (count === null) return <div className="p-4 text-center">Cargando contador...</div>;

    return (
        <div className="w-full max-w-md mx-auto my-10 p-8 bg-white rounded-2xl shadow-xl text-center border border-slate-100">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Impacto en Tiempo Real</h2>
            <div className="text-6xl font-black text-cyan-600 mb-2">
                {count}
            </div>
            <p className="text-slate-400 uppercase tracking-widest text-xs font-bold">Niños Apadrinados</p>
        </div>
    );
};

export default NewImpactCounter;
