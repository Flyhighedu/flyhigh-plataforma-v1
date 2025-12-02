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
            const { data, error } = await supabase
                .from('stats')
                .select('total_sponsored_kids')
                .single();

            if (error) {
                console.log('Error Supabase:', error);
            }

            if (data) {
                setServerTotal(data.total_sponsored_kids);
            }
        };

        fetchStats();

        // Realtime Subscription
        const channel = supabase
            .channel('stats-updates')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'stats' },
                (payload) => {
                    if (payload.new && payload.new.total_sponsored_kids) {
                        setServerTotal(payload.new.total_sponsored_kids);
                    }
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
