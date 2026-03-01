'use client';
import { useState, useEffect } from 'react';
import { Check, AlertTriangle, ChevronDown, ChevronUp, User, Smartphone, BadgeCheck, Shirt, Camera, X, Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { TEACHER_TEAM_CHECK_TYPES } from '@/config/operationalChecklists';

const ICON_BY_NAME = {
    shirt: Shirt,
    'badge-check': BadgeCheck,
    smartphone: Smartphone
};

const CHECK_TYPES = TEACHER_TEAM_CHECK_TYPES.map((item) => ({
    id: item.id,
    label: item.label,
    icon: ICON_BY_NAME[item.icon] || User,
    color: item.colorClass
}));

export default function TeacherTeamChecklist({
    journeyId,
    userId,
    missionInfo,
    onUpdate,
    // New props for Evidence integration
    evidenceItem,
    hasPhoto,
    photoUrl,
    onPhotoCapture,
    uploadingItem,
    onRetakePhoto
}) {
    const [team, setTeam] = useState([]);
    const [checks, setChecks] = useState({}); // { `${userId}_${type}`: { status: 'OK' | 'EXCEPTION', ... } }
    const [loading, setLoading] = useState(true);
    const [showExceptionModal, setShowExceptionModal] = useState(null); // { userId, type }

    useEffect(() => {
        const fetchTeam = async () => {
            // Hardcoded fallback structure
            const teamMembers = [
                { id: missionInfo?.pilot_id || 'pilot_placeholder', name: 'Farid', role: 'Piloto' },
                { id: missionInfo?.aux_id || 'aux_placeholder', name: 'Osvaldo', role: 'Auxiliar' },
                { id: userId, name: 'Isa', role: 'Docente' }
            ];
            setTeam(teamMembers);

            // Fetch existing checks
            const supabase = createClient();
            const { data } = await supabase
                .from('staff_prep_events')
                .select('*')
                .eq('journey_id', journeyId)
                .eq('event_type', 'team_check');

            const loadedChecks = {};
            data?.forEach(event => {
                const { target_user_id, check_type, status, reason } = event.payload;
                const key = `${target_user_id}_${check_type}`;
                loadedChecks[key] = { status, reason };
            });
            setChecks(loadedChecks);
            setLoading(false);
            onUpdate(loadedChecks, { totalSlots: teamMembers.length * CHECK_TYPES.length });
        };
        fetchTeam();
    }, [journeyId, userId, missionInfo]);


    const handleToggle = async (memberId, typeId) => {
        const key = `${memberId}_${typeId}`;
        const currentStatus = checks[key]?.status;

        // If exception, we allow toggling to OK? Or clearing? 
        // User didn't specify, but "Mark OK" usually overrides or clears.
        // Let's make it toggle: Empty -> OK -> Empty.
        // If Exception -> OK.

        let newStatus = currentStatus === 'OK' ? null : 'OK';

        const newChecks = { ...checks, [key]: { status: newStatus } };
        if (!newStatus) delete newChecks[key];

        setChecks(newChecks);
        onUpdate(newChecks, { totalSlots: team.length * CHECK_TYPES.length });

        const supabase = createClient();
        // Insert event
        await supabase.from('staff_prep_events').insert({
            journey_id: journeyId,
            user_id: userId,
            event_type: 'team_check',
            payload: {
                target_user_id: memberId,
                check_type: typeId,
                status: newStatus || 'CLEARED'
            }
        });
    };

    const handleOpenException = (memberId, typeId, e) => {
        e.stopPropagation();
        setShowExceptionModal({ memberId, typeId });
    };

    const saveException = async (reason, note) => {
        const { memberId, typeId } = showExceptionModal;
        const key = `${memberId}_${typeId}`;

        const newChecks = { ...checks, [key]: { status: 'EXCEPTION', reason, note } };
        setChecks(newChecks);
        onUpdate(newChecks, { totalSlots: team.length * CHECK_TYPES.length });
        setShowExceptionModal(null);

        const supabase = createClient();
        await supabase.from('staff_prep_events').insert({
            journey_id: journeyId,
            user_id: userId,
            event_type: 'team_check',
            payload: {
                target_user_id: memberId,
                check_type: typeId,
                status: 'EXCEPTION',
                reason,
                note
            }
        });
    };

    // Calculate Stats
    const totalChecks = team.length * 3;
    const okCount = Object.values(checks).filter(c => c.status === 'OK').length;
    const exceptionCount = Object.values(checks).filter(c => c.status === 'EXCEPTION').length;
    const totalDone = okCount + exceptionCount;

    // Header Chip Text
    // “7/9 · 2 incidencias · Selfie ✅”
    // “0/9 · Selfie pendiente”
    let statsText = `${totalDone}/${totalChecks}`;
    if (exceptionCount > 0) statsText += ` · ${exceptionCount} incidencias`;
    statsText += ` · Selfie ${hasPhoto ? '✅' : 'pendiente'}`;

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-purple-600" /></div>;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-50 bg-slate-50/50">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">Revisión de personal</h3>
                        <p className="text-xs text-slate-500 mt-1">Marca por persona. Si algo falta, regístralo como incidencia.</p>
                    </div>
                    {/* Compact Status Chip */}
                    <div className="flex flex-col items-end">
                        <span className={`text-[10px] font-bold px-2 py-1.5 rounded-md border ${totalDone === totalChecks && hasPhoto
                                ? 'bg-green-50 text-green-700 border-green-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                            {statsText}
                        </span>
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-1/4">Equipo</th>
                            {CHECK_TYPES.map(type => (
                                <th key={type.id} className="p-4 text-center w-1/4">
                                    <div className="flex flex-col items-center gap-1">
                                        <type.icon size={18} className={type.color} />
                                        <span className="text-[10px] font-bold text-slate-600">{type.label}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {team.map((member, idx) => (
                            <tr key={member.id} className={idx !== team.length - 1 ? 'border-b border-slate-50' : ''}>
                                <td className="p-4">
                                    <div className="font-bold text-slate-700 text-sm">{member.name}</div>
                                    <div className="text-[10px] text-slate-400 font-medium uppercase">{member.role}</div>
                                </td>
                                {CHECK_TYPES.map(type => {
                                    const key = `${member.id}_${type.id}`;
                                    const state = checks[key];
                                    const isOk = state?.status === 'OK';
                                    const isException = state?.status === 'EXCEPTION';

                                    return (
                                        <td key={type.id} className="p-2 text-center h-24 align-top">
                                            <div className="relative w-full h-full flex flex-col items-center gap-2">
                                                {/* Main Toggle Button */}
                                                <button
                                                    onClick={() => handleToggle(member.id, type.id)}
                                                    className={`
                                                        w-14 h-14 rounded-xl flex flex-col items-center justify-center transition-all relative
                                                        ${isOk ? 'bg-green-100/50 border-2 border-green-500 text-green-600' : ''}
                                                        ${isException ? 'bg-amber-50 border-2 border-amber-400 text-amber-600' : ''}
                                                        ${!isOk && !isException ? 'bg-slate-50 border-2 border-slate-200 text-slate-300 hover:border-purple-200' : ''}
                                                    `}
                                                >
                                                    {isOk && <Check size={24} strokeWidth={3} />}
                                                    {isException && (
                                                        <>
                                                            <AlertTriangle size={20} strokeWidth={2.5} className="mb-0.5" />
                                                            <span className="text-[9px] font-bold leading-none">Incidencia</span>
                                                        </>
                                                    )}
                                                </button>

                                                {/* "Registrar falta" Pill Button */}
                                                {!isOk && !isException && (
                                                    <button
                                                        onClick={(e) => handleOpenException(member.id, type.id, e)}
                                                        className="px-2 py-1 bg-white border border-slate-200 rounded-full shadow-sm text-[10px] font-bold text-slate-500 hover:text-amber-600 hover:border-amber-200 transition-colors whitespace-nowrap z-10"
                                                    >
                                                        Registrar falta
                                                    </button>
                                                )}

                                                {/* Optional: Edit logic for exception? For now, we hide the button as requested */}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Evidence Block (Integrated) */}
            <div className="p-5 border-t border-slate-100 bg-slate-50/30">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h4 className="font-bold text-slate-800 text-sm">Evidencia (Selfie grupal)</h4>
                        <p className="text-xs text-slate-500 mt-1">Obligatoria para cerrar Revisión de personal.</p>
                    </div>
                </div>

                {hasPhoto ? (
                    <div className="relative rounded-xl overflow-hidden h-48 bg-slate-100 border border-slate-200">
                        <img src={photoUrl} alt="Selfie" className="w-full h-full object-cover" />
                        <button
                            onClick={onRetakePhoto}
                            className="absolute top-3 right-3 bg-white text-red-500 rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm hover:bg-red-50"
                        >
                            Repetir
                        </button>
                        <div className="absolute bottom-3 left-3 bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-sm pointer-events-none">
                            Selfie guardada ✅
                        </div>
                    </div>
                ) : (
                    <div>
                        <button
                            onClick={() => onPhotoCapture(evidenceItem.id)}
                            disabled={uploadingItem === evidenceItem.id}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-4 flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {uploadingItem === evidenceItem.id ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <Camera size={20} />
                            )}
                            <span className="font-bold text-sm">
                                {uploadingItem === evidenceItem.id ? 'Guardando...' : 'Tomar selfie'}
                            </span>
                        </button>
                    </div>
                )}
            </div>

            {/* Exception Modal */}
            {showExceptionModal && (
                <ExceptionModal
                    data={showExceptionModal}
                    team={team}
                    CHECK_TYPES={CHECK_TYPES}
                    onClose={() => setShowExceptionModal(null)}
                    onSave={saveException}
                />
            )}
        </div>
    );
}

function ExceptionModal({ data, team, CHECK_TYPES, onClose, onSave }) {
    const member = team.find(m => m.id === data.memberId);
    const type = CHECK_TYPES.find(t => t.id === data.typeId);
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');

    const REASONS = {
        uniforme: ['Incompleto', 'Olvidado', 'En mal estado', 'Otro'],
        gafete: ['No trae', 'Olvidado', 'Dañado', 'Otro'],
        app: ['Sin batería', 'Sin datos', 'No trae celular', 'Otro']
    };

    const options = REASONS[type.id] || ['Otro'];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[24px] p-6 shadow-2xl animate-in slide-in-from-bottom-10">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Registrar Excepción</h3>
                    <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={18} /></button>
                </div>

                <div className="flex items-center gap-4 mb-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <div className="font-bold text-slate-800">{member?.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                            Falta: <span className="font-bold text-amber-700">{type?.label}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Motivo</label>
                        <div className="grid grid-cols-2 gap-2">
                            {options.map(opt => (
                                <button
                                    key={opt}
                                    onClick={() => setReason(opt)}
                                    className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${reason === opt ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Nota (Opcional)</label>
                        <input
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Detalles adicionales..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                        />
                    </div>
                </div>

                <button
                    onClick={() => {
                        if (reason) onSave(reason, note);
                    }}
                    disabled={!reason}
                    className="w-full mt-6 bg-slate-900 text-white font-bold py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black transition-colors"
                >
                    Guardar Excepción
                </button>
            </div>
        </div>
    );
}
