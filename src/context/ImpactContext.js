'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

import { supabaseNew as supabase } from '../lib/supabaseClientNew';

const ImpactContext = createContext();

export const ImpactProvider = ({ children }) => {
    const [serverTotal, setServerTotal] = useState(null);
    const [localDonation, setLocalDonation] = useState(0);

    // 1. Fetch Initial Data & Subscribe to Realtime
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/sandbox-dashboards');
                const json = await res.json();
                if (json?.impacto?.totalStudents !== undefined) {
                    setServerTotal(json.impacto.totalStudents);
                }
            } catch (err) {
                console.error('Error fetching SSoT impact:', err);
            }
        };

        fetchStats();

        const channel = supabase
            .channel('cierres-updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cierres_mision' },
                () => {
                    // Refetch all to recalculate sum
                    fetchStats();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'bitacora_vuelos' },
                () => {
                    // Refetch all to recalculate sum
                    fetchStats();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Derived state for display
    const totalImpact = serverTotal === null ? null : serverTotal + localDonation;

    return (
        <ImpactContext.Provider value={{ totalImpact, setLocalDonation }}>
            {children}
        </ImpactContext.Provider>
    );
};

export const useImpact = () => useContext(ImpactContext);
