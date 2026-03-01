'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';

const BRIDGE_DURATION_MS = 1200;

function safeText(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

function firstName(fullName, fallback = 'Operativo') {
    const normalized = safeText(fullName).trim();
    if (!normalized) return fallback;
    const [first] = normalized.split(/\s+/);
    return first || fallback;
}

export default function OperationStartBridgeScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const [isCommitting, setIsCommitting] = useState(false);
    const isCommittingRef = useRef(false);

    const meta = parseMeta(missionInfo?.meta);
    const bridgeAtMs = useMemo(() => Date.parse(meta.operation_start_bridge_at || ''), [meta.operation_start_bridge_at]);
    const first = firstName(profile?.full_name, 'Operativo');
    const roleName = ROLE_LABELS[profile?.role] || 'Operativo';

    const finalizeOperation = useCallback(async () => {
        if (!journeyId || isCommittingRef.current) return;

        isCommittingRef.current = true;
        setIsCommitting(true);

        try {
            const supabase = createClient();
            const now = new Date().toISOString();

            const { data: currentData, error: readError } = await supabase
                .from('staff_journeys')
                .select('mission_state, meta')
                .eq('id', journeyId)
                .single();

            if (readError) throw readError;

            if (currentData?.mission_state === 'OPERATION') {
                onRefresh && onRefresh();
                return;
            }

            const currentMeta = parseMeta(currentData?.meta);
            if (!currentMeta.operation_start_bridge_at) {
                onRefresh && onRefresh();
                return;
            }

            const nextMeta = {
                ...currentMeta,
                operation_started_at: currentMeta.operation_started_at || now
            };

            const { error: updateError } = await supabase
                .from('staff_journeys')
                .update({
                    mission_state: 'OPERATION',
                    meta: nextMeta,
                    updated_at: now
                })
                .eq('id', journeyId)
                .eq('mission_state', 'seat_deployment');

            if (updateError) throw updateError;

            onRefresh && onRefresh();
        } catch (error) {
            console.error('Error finalizing synchronized operation start:', error);
            onRefresh && onRefresh();
        } finally {
            isCommittingRef.current = false;
            setIsCommitting(false);
        }
    }, [journeyId, onRefresh]);

    useEffect(() => {
        const elapsed = Number.isFinite(bridgeAtMs) ? Date.now() - bridgeAtMs : BRIDGE_DURATION_MS;
        const waitMs = Math.max(0, BRIDGE_DURATION_MS - elapsed);

        const timer = setTimeout(() => {
            finalizeOperation();
        }, waitMs);

        return () => clearTimeout(timer);
    }, [bridgeAtMs, finalizeOperation]);

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            backgroundColor: '#F3F4F6',
            color: '#1F2937',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            WebkitFontSmoothing: 'antialiased',
            position: 'relative'
        }}>
            <SyncHeader
                firstName={first}
                roleName={roleName}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                onDemoStart={onRefresh}
            />

            <main style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px'
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: 380,
                    borderRadius: 24,
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    boxShadow: '0 20px 42px -22px rgba(15, 23, 42, 0.5)',
                    padding: 24,
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: 66,
                        height: 66,
                        borderRadius: '50%',
                        backgroundColor: '#EFF6FF',
                        color: '#2563EB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 14px'
                    }}>
                        <Loader2 size={30} className="animate-spin" />
                    </div>

                    <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
                        Todo listo
                    </h2>
                    <p style={{ margin: '8px 0 0', fontSize: 15, color: '#475569', lineHeight: 1.45 }}>
                        Iniciamos operacion.
                    </p>

                    <div style={{ marginTop: 16, height: 6, borderRadius: 999, backgroundColor: '#DBEAFE', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: '100%',
                            borderRadius: 999,
                            backgroundColor: '#2563EB',
                            animation: 'bridge-progress 1.2s linear'
                        }} />
                    </div>

                    {isCommitting && (
                        <p style={{ margin: '10px 0 0', fontSize: 12, color: '#64748B' }}>
                            Sincronizando equipo...
                        </p>
                    )}
                </div>
            </main>

            <style>{`
                @keyframes bridge-progress {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}
