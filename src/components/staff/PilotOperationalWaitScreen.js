'use client';

import { Loader2 } from 'lucide-react';
import SyncHeader from './SyncHeader';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { parseMeta } from '@/utils/metaHelpers';

export default function PilotOperationalWaitScreen({
    journeyId,
    userId,
    profile,
    missionInfo,
    missionState,
    onRefresh
}) {
    const meta = parseMeta(missionInfo?.meta);
    const auxReady = meta.aux_ready_seat_deployment === true;
    const teacherReady = meta.teacher_civic_notified === true;

    const chipText = !auxReady
        ? 'En espera del auxiliar'
        : !teacherReady
            ? 'En espera del docente'
            : 'En espera del equipo';

    const firstName = profile?.full_name?.split(' ')[0] || 'Piloto';
    const roleName = ROLE_LABELS[profile?.role] || 'Piloto';

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            background: 'linear-gradient(180deg, #1EA1FF 0%, #007AFF 100%)',
            color: 'white',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            WebkitFontSmoothing: 'antialiased'
        }}>
            <SyncHeader
                firstName={firstName}
                roleName={roleName}
                role={profile?.role}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionState}
                isWaitScreen={true}
                waitPhase="load"
                chipOverride={chipText}
                onDemoStart={onRefresh}
            />

            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '0 28px'
            }}>
                <div style={{
                    width: 92,
                    height: 92,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 18
                }}>
                    <Loader2 className="animate-spin" size={40} />
                </div>

                <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
                    En espera…
                </h1>
                <p style={{ fontSize: 17, opacity: 0.9, lineHeight: 1.5, maxWidth: 320, marginBottom: 12 }}>
                    El equipo está finalizando logística.
                </p>
                <p style={{ fontSize: 13, opacity: 0.8 }}>
                    Siguiente: Despliegue de asientos.
                </p>
            </main>
        </div>
    );
}
