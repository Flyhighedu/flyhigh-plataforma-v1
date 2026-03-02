'use client';

// =====================================================
// Staff Preview — Modo solo lectura para admins
// URL: /staff/preview?as=<user_id>
// NO ESCRIBE NADA. Solo visualización.
// =====================================================

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, Plane, FileText, Loader2, AlertCircle, MapPin, Eye, X, Briefcase } from 'lucide-react';
import PrepChecklist from '@/components/staff/PrepChecklist';
import ClosureLegacy from '@/components/staff/ClosureLegacy';
import StaffOperationLegacy from '@/components/staff/StaffOperationLegacy';
import MissionBrief from '@/components/staff/MissionBrief';
import WaitingAuxLoad from '@/components/staff/WaitingAuxLoad';
import AuxWaitingScreen from '@/components/staff/AuxWaitingScreen';
import AuxVehicleChecklist from '@/components/staff/AuxVehicleChecklist';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { Suspense } from 'react';
import { createClient } from '@/utils/supabase/client';

const STEPS = [
    { id: 'brief', label: 'Informe', icon: Briefcase },
    { id: 'prep', label: 'Montaje', icon: ClipboardList },
    { id: 'operation', label: 'Operación', icon: Plane },
    { id: 'report', label: 'Reporte', icon: FileText },
];

function PreviewContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const targetUserId = searchParams.get('as');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [targetProfile, setTargetProfile] = useState(null);
    const [todaySchool, setTodaySchool] = useState(null);
    const [waitingForAux, setWaitingForAux] = useState(false);
    const [auxFlowState, setAuxFlowState] = useState(null); // 'waiting' | 'checklist' | null

    useEffect(() => {
        const init = async () => {
            try {
                if (!targetUserId) {
                    setError('Falta el parámetro ?as=<user_id>');
                    setLoading(false);
                    return;
                }

                // Fetch via API route (bypasses RLS with service role)
                const res = await fetch(`/api/staff/preview-profile?user_id=${targetUserId}`);
                const data = await res.json();

                if (!res.ok) {
                    setError(data.error || 'No se encontró el perfil del operativo.');
                    setLoading(false);
                    return;
                }

                setTargetProfile(data.profile);

                if (data.school) {
                    setTodaySchool(data.school);
                } else {
                    // Demo fallback — so preview always works for design iteration
                    setTodaySchool({
                        id: 'demo-preview',
                        school_name: 'Primaria Ejemplo (Demo)',
                        colonia: 'Col. Centro, Uruapan',
                    });
                }

            } catch (e) {
                console.error('Preview init error:', e);
                setError('Error al inicializar preview.');
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [targetUserId]);

    const handleExit = () => {
        window.close();
        // Fallback si window.close() no funciona
        setTimeout(() => router.push('/admin'), 200);
    };

    // --- Loading ---
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto" />
                    <p className="text-slate-500 font-medium">Cargando preview...</p>
                </div>
            </div>
        );
    }

    // --- Error ---
    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[60vh] px-4">
                <div className="max-w-sm text-center space-y-4">
                    <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                    <p className="text-slate-700 font-medium">{error}</p>
                    <button onClick={handleExit} className="text-sm text-blue-500 underline">Volver</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ===== PREVIEW BANNER ===== */}
            <div className="sticky top-0 z-50 bg-amber-500 text-black px-4 py-2.5 shadow-lg">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Eye size={18} className="flex-shrink-0" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider">Modo Preview</p>
                            <p className="text-[10px] font-medium opacity-80">No se guardará nada · Solo visualización</p>
                        </div>
                    </div>
                    <button
                        onClick={handleExit}
                        className="flex items-center gap-1 bg-black/20 hover:bg-black/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                    >
                        <X size={14} /> Salir
                    </button>
                </div>
            </div>

            {/* Pilot: Waiting for Aux screen (preview mode) */}
            {waitingForAux && targetProfile?.role === 'pilot' && (
                <WaitingAuxLoad
                    journeyId="preview"
                    userId={targetUserId}
                    profile={targetProfile}
                    missionInfo={{ ...todaySchool, profile: targetProfile }}
                    onAuxConfirmed={() => {
                        setWaitingForAux(false);
                        setCurrentStep(2);
                    }}
                    preview={true}
                />
            )}

            {/* Assistant: Waiting for pilot (preview mode) */}
            {auxFlowState === 'waiting' && targetProfile?.role === 'assistant' && (
                <AuxWaitingScreen
                    journeyId="preview"
                    userId={targetUserId}
                    profile={targetProfile}
                    missionInfo={{ ...todaySchool, profile: targetProfile }}
                    onPilotReady={() => setAuxFlowState('checklist')}
                    preview={true}
                />
            )}

            {/* Assistant: Vehicle Checklist (preview mode) */}
            {auxFlowState === 'checklist' && targetProfile?.role === 'assistant' && (
                <div className="min-h-screen" style={{ backgroundColor: '#F8F9FB' }}>
                    <AuxVehicleChecklist
                        journeyId="preview"
                        userId={targetUserId}
                        onComplete={() => {
                            setAuxFlowState(null);
                            setCurrentStep(2);
                        }}
                        missionInfo={{ ...todaySchool, profile: targetProfile }}
                        preview={true}
                    />
                </div>
            )}

            {/* Render Dashboard Layout only if NOT in special full-screen states */}
            {!waitingForAux && !auxFlowState && currentStep > 0 && !(currentStep === 1 && targetProfile?.role === 'pilot') && (
                <>
                    {/* Top Bar — muestra info del operativo objetivo */}
                    <div className="bg-white border-b border-slate-100 px-4 py-3">
                        <div className="max-w-lg mx-auto flex items-center gap-3">
                            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                                <Eye size={16} className="text-amber-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate text-sm">
                                    {targetProfile?.full_name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {ROLE_LABELS[targetProfile?.role] || targetProfile?.role}
                                    {todaySchool && ` • ${todaySchool.school_name}`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Stepper Indicator */}
                    <div className="bg-white border-b border-slate-100 px-4 py-3">
                        <div className="max-w-lg mx-auto flex items-center gap-2">
                            {STEPS.map((step, idx) => {
                                const Icon = step.icon;
                                const isActive = idx === currentStep;
                                const isCompleted = idx < currentStep;

                                return (
                                    <button
                                        key={step.id}
                                        onClick={() => setCurrentStep(idx)}
                                        className="flex-1 flex flex-col items-center gap-1 cursor-pointer"
                                    >
                                        <div className={`w-full h-1.5 rounded-full transition-colors ${isCompleted ? 'bg-green-500' : isActive ? 'bg-blue-500' : 'bg-slate-200'
                                            }`} />
                                        <div className="flex items-center gap-1.5">
                                            <Icon size={14} className={`${isCompleted ? 'text-green-500' : isActive ? 'text-blue-600' : 'text-slate-400'
                                                }`} />
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isCompleted ? 'text-green-600' : isActive ? 'text-blue-600' : 'text-slate-400'
                                                }`}>{step.label}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* School Info Bar */}
                    {todaySchool && (
                        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2">
                            <div className="max-w-lg mx-auto flex items-center gap-2 text-sm">
                                <MapPin size={14} className="text-blue-500" />
                                <span className="font-medium text-blue-700 truncate">{todaySchool.school_name}</span>
                                {todaySchool.colonia && (
                                    <span className="text-blue-400 text-xs truncate">• {todaySchool.colonia}</span>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Step Content — hide when in special states */}
            {!waitingForAux && !auxFlowState && (
                <div className="max-w-lg mx-auto px-4 py-6">
                    {/* PASO 0: Mission Brief (preview) */}
                    {currentStep === 0 && (
                        <MissionBrief
                            profile={targetProfile}
                            school={todaySchool}
                            journeyId="preview"
                            userId={targetUserId}
                            onCheckedIn={() => setCurrentStep(1)}
                            preview={true}
                        />
                    )}

                    {/* PASO 1: Montaje (preview) */}
                    {currentStep === 1 && (
                        <div>
                            {targetProfile?.role !== 'pilot' && (
                                <>
                                    <h2 className="text-xl font-bold text-slate-900 mb-1">Pre-Jornada</h2>
                                    <p className="text-sm text-slate-500 mb-6">Vista previa del checklist de {targetProfile?.full_name}.</p>
                                </>
                            )}

                            {targetProfile && (
                                <PrepChecklist
                                    role={targetProfile.role}
                                    journeyId="preview"
                                    userId={targetUserId}
                                    onComplete={async () => {
                                        if (targetProfile?.role === 'pilot') {
                                            // Broadcast for preview interaction
                                            const supabase = createClient();
                                            await supabase.channel('preview_channel').send({
                                                type: 'broadcast',
                                                event: 'pilot_done',
                                                payload: { userId: targetUserId }
                                            });

                                            setWaitingForAux(true);
                                        } else if (targetProfile?.role === 'assistant') {
                                            setAuxFlowState('waiting');
                                        } else {
                                            setCurrentStep(2);
                                        }
                                    }}
                                    preview={true}
                                    missionInfo={{ ...todaySchool, profile: targetProfile }}
                                />
                            )}
                        </div>
                    )}

                    {/* PASO 2: Operación (preview) */}
                    {currentStep === 2 && (
                        <div>
                            <StaffOperationLegacy
                                initialMission={todaySchool ? {
                                    id: `preview-${targetUserId}`,
                                    school_name: todaySchool.school_name,
                                    colonia: todaySchool.colonia,
                                    scheduled_id: todaySchool.id
                                } : null}
                                onCloseDay={() => setCurrentStep(3)}
                                hideMenu={false}
                                preview={true}
                            />
                        </div>
                    )}

                    {/* PASO 3: Reporte (preview) */}
                    {currentStep === 3 && (
                        <div>
                            <ClosureLegacy
                                onComplete={() => alert('Preview: Esta acción no se ejecuta en modo preview.')}
                                preview={true}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function StaffPreviewPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            </div>
        }>
            <PreviewContent />
        </Suspense>
    );
}
