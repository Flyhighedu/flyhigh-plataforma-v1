'use client';

// =====================================================
// PilotPrepChecklist — v3 Premium iOS Layout
// Diseño: Header con logo + rol, tarjeta de misión,
//         checklist con progreso, CTA sticky
// =====================================================

import { useState } from 'react';
import {
    ChevronDown, ChevronUp, Plus, Minus, Check,
    HelpCircle, X, Loader2,
    Plane, Battery, Box
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { ROLE_LABELS } from '@/config/prepChecklistConfig';
import { PILOT_PREP_BLOCKS, PILOT_BLOCK_CHECK_MAP } from '@/config/operationalChecklists';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatShortDate() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    return `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_NAMES[now.getMonth()]}`;
}

const PILOT_GROUPS = PILOT_PREP_BLOCKS;

const NAV_STEPS = [
    { id: 'informe', label: 'INFORME', icon: 'check', status: 'completed' },
    { id: 'preparacion', label: 'MONTAJE', icon: 'assignment', status: 'active' },
    { id: 'operacion', label: 'OPERACIÓN', icon: 'flight', status: 'pending' },
    { id: 'reporte', label: 'REPORTE', icon: 'description', status: 'pending' }
];

import SyncHeader from './SyncHeader';

export default function PilotPrepChecklist({ journeyId, userId, onComplete, preview = false, missionInfo, onRefresh }) {
    const [counts, setCounts] = useState(() => {
        const initial = {};
        PILOT_GROUPS.forEach(g => g.items.forEach(i => initial[i.id] = i.defaultQty));
        return initial;
    });
    const [completedBlocks, setCompletedBlocks] = useState({});
    const [expandedBlock, setExpandedBlock] = useState(null);
    const [showHelp, setShowHelp] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showConfirmToast, setShowConfirmToast] = useState(false);

    const persistBlockProgress = async (blockId) => {
        if (preview || !journeyId || !userId) return;

        const mappedChecks = PILOT_BLOCK_CHECK_MAP[blockId] || [];
        if (mappedChecks.length === 0) return;

        try {
            const supabase = createClient();
            const timestamp = new Date().toISOString();
            const inserts = mappedChecks.map((itemId) => ({
                journey_id: journeyId,
                user_id: userId,
                event_type: 'check',
                payload: {
                    item_id: itemId,
                    value: true,
                    source: 'pilot_block_confirm',
                    block_id: blockId,
                    timestamp
                }
            }));

            await supabase.from('staff_prep_events').insert(inserts);
        } catch (error) {
            console.warn('No se pudo persistir avance incremental del piloto:', error.message || error);
        }
    };

    const allBlocksDone = PILOT_GROUPS.every(g => completedBlocks[g.id]);
    const completedCount = PILOT_GROUPS.filter(g => completedBlocks[g.id]).length;

    const getGroupProgress = (groupId) => {
        if (completedBlocks[groupId]) return 100;
        if (expandedBlock === groupId) return 50;
        return 0;
    };

    const updateCount = (itemId, delta, max = 10) => {
        setCounts(prev => ({
            ...prev,
            [itemId]: Math.max(0, Math.min(max, (prev[itemId] || 0) + delta))
        }));
    };

    const toggleBlock = (blockId) => {
        if (completedBlocks[blockId]) return; // don't reopen completed
        setExpandedBlock(prev => prev === blockId ? null : blockId);
    };

    const confirmBlock = (blockId) => {
        setCompletedBlocks(prev => ({ ...prev, [blockId]: true }));
        persistBlockProgress(blockId);
        setExpandedBlock(null);
        const nextBlock = PILOT_GROUPS.find(g => g.id !== blockId && !completedBlocks[g.id]);
        if (nextBlock) setTimeout(() => setExpandedBlock(nextBlock.id), 300);
    };

    const handleFinalSubmit = async () => {

        if (preview) { if (onComplete) onComplete(); return; }
        setSaving(true);
        try {
            const supabase = createClient();
            const promises = [];
            PILOT_GROUPS.forEach(group => {
                group.items.forEach(item => {
                    promises.push(
                        supabase.from('staff_prep_events').insert({
                            journey_id: journeyId, user_id: userId,
                            event_type: 'check_qty',
                            payload: { item_id: item.id, quantity: counts[item.id], category: group.id }
                        })
                    );
                });
            });
            await Promise.all(promises);

            await supabase.from('staff_prep_events').insert({
                journey_id: journeyId, user_id: userId,
                event_type: 'prep_complete',
                payload: { role: 'pilot', timestamp: new Date().toISOString() }
            });

        } catch (e) {
            console.error('Error saving pilot prep:', e);
        } finally {
            setSaving(false);

            setShowConfirmToast(true);
            setTimeout(() => {

                if (onComplete) onComplete();
            }, 1000);
        }
    };

    const firstName = missionInfo?.profile?.full_name?.split(' ')[0] || 'Piloto';
    const roleName = ROLE_LABELS[missionInfo?.profile?.role] || 'Piloto';

    return (
        <div style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            backgroundColor: '#F8F9FB', color: '#0f172a',
            WebkitFontSmoothing: 'antialiased',
            minHeight: '100vh', display: 'flex', flexDirection: 'column'
        }}>
            <SyncHeader
                firstName={firstName}
                roleName={roleName}
                role={missionInfo?.profile?.role}
                navSteps={NAV_STEPS}
                journeyId={journeyId}
                userId={userId}
                missionInfo={missionInfo}
                missionState={missionInfo?.mission_state}
                isWaitScreen={false}
                onDemoStart={onRefresh}
            />

            {/* ════════════ MAIN CONTENT ════════════ */}
            <main style={{ flex: 1, padding: '24px 20px 160px', display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* ──── Mission Card ──── */}
                <div style={{
                    backgroundColor: '#0066FF', borderRadius: 20,
                    padding: '20px 22px',
                    boxShadow: '0 20px 40px -12px rgba(0,102,255,0.35)',
                    position: 'relative', overflow: 'hidden'
                }}>
                    {/* Decorative blurs */}
                    <div style={{
                        position: 'absolute', right: -30, top: -30,
                        width: 100, height: 100,
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderRadius: '50%', filter: 'blur(24px)'
                    }} />
                    <div style={{
                        position: 'absolute', left: -20, bottom: -20,
                        width: 60, height: 60,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: '50%', filter: 'blur(16px)'
                    }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <span style={{
                            fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                            letterSpacing: '0.15em', color: 'white',
                            backgroundColor: 'rgba(255,255,255,0.18)',
                            padding: '4px 10px', borderRadius: 8,
                            backdropFilter: 'blur(8px)'
                        }}>
                            Misión del día
                        </span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                            {formatShortDate()}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                            height: 52, width: 52, flexShrink: 0,
                            backgroundColor: 'white', borderRadius: 14,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)'
                        }}>
                            <span className="material-symbols-outlined" style={{
                                fontSize: 28, color: '#0066FF',
                                fontVariationSettings: "'FILL' 0, 'wght' 300"
                            }}>
                                school
                            </span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h3 style={{
                                fontSize: 17, fontWeight: 700, color: 'white',
                                lineHeight: 1.25, margin: 0
                            }}>
                                {missionInfo?.school_name || 'Escuela del día'}
                            </h3>
                            {missionInfo?.colonia && (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    marginTop: 4, color: 'rgba(255,255,255,0.75)'
                                }}>
                                    <span className="material-symbols-outlined" style={{
                                        fontSize: 14, fontVariationSettings: "'FILL' 0, 'wght' 300"
                                    }}>
                                        location_on
                                    </span>
                                    <span style={{ fontSize: 11, fontWeight: 500 }}>{missionInfo.colonia}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ──── Section title ──── */}
                <div>
                    <h1 style={{
                        fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
                        color: '#0f172a', lineHeight: 1.2, margin: 0
                    }}>
                        Verificación de equipo
                    </h1>
                    <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, marginTop: 4, margin: '4px 0 0' }}>
                        {completedCount}/{PILOT_GROUPS.length} categorías completadas
                    </p>
                </div>

                {/* ──── Checklist Categories ──── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {PILOT_GROUPS.map(group => {
                        const isCompleted = completedBlocks[group.id];
                        const isOpen = expandedBlock === group.id;
                        const progress = getGroupProgress(group.id);
                        const itemCount = group.items.length;

                        return (
                            <div key={group.id} style={{
                                backgroundColor: 'white',
                                borderRadius: 16,
                                border: isOpen ? `1.5px solid ${group.color}20` : '1px solid #f1f5f9',
                                boxShadow: isOpen
                                    ? `0 8px 24px -4px ${group.color}12`
                                    : '0 1px 3px rgba(0,0,0,0.03)',
                                transition: 'all 0.2s ease',
                                overflow: 'hidden'
                            }}>
                                {/* Card Header */}
                                <button
                                    onClick={() => toggleBlock(group.id)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                                        padding: '16px 18px', textAlign: 'left',
                                        background: 'none', border: 'none', cursor: isCompleted ? 'default' : 'pointer'
                                    }}
                                >
                                    <div style={{
                                        height: 44, width: 44, flexShrink: 0,
                                        backgroundColor: isCompleted ? '#dcfce7' : group.bgColor,
                                        borderRadius: 12,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {isCompleted ? (
                                            <Check size={22} style={{ color: '#22c55e' }} strokeWidth={3} />
                                        ) : (
                                            <span className="material-symbols-outlined" style={{
                                                fontSize: 22, color: group.color,
                                                fontVariationSettings: "'FILL' 0, 'wght' 400"
                                            }}>
                                                {group.icon}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <h4 style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>
                                                {group.label}
                                            </h4>
                                            <span style={{
                                                fontSize: 10, fontWeight: 700,
                                                color: isCompleted ? '#22c55e' : '#94a3b8'
                                            }}>
                                                {isCompleted ? '✓' : `${itemCount} items`}
                                            </span>
                                        </div>
                                        {/* Progress bar */}
                                        <div style={{
                                            marginTop: 8, height: 3,
                                            backgroundColor: '#f1f5f9', borderRadius: 99, overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                height: '100%', borderRadius: 99,
                                                backgroundColor: isCompleted ? '#22c55e' : group.color,
                                                width: `${progress}%`,
                                                transition: 'width 0.4s ease'
                                            }} />
                                        </div>
                                    </div>
                                    {!isCompleted && (
                                        isOpen
                                            ? <ChevronUp size={18} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                                            : <ChevronDown size={18} style={{ color: '#cbd5e1', flexShrink: 0 }} />
                                    )}
                                </button>

                                {/* Expanded Items */}
                                {isOpen && (
                                    <div style={{
                                        padding: '0 18px 18px',
                                        borderTop: '1px solid #f8fafc'
                                    }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {group.items.map(item => (
                                                <div key={item.id} style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '10px 0',
                                                    borderBottom: '1px solid #f8fafc'
                                                }}>
                                                    <span style={{ fontSize: 14, fontWeight: 500, color: '#334155' }}>
                                                        {item.label}
                                                    </span>
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', gap: 2,
                                                        backgroundColor: '#f8fafc', borderRadius: 10, padding: 3
                                                    }}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); updateCount(item.id, -1, item.max); }}
                                                            disabled={counts[item.id] <= 0}
                                                            style={{
                                                                width: 30, height: 30,
                                                                backgroundColor: 'white', borderRadius: 8,
                                                                border: 'none', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                                                color: '#475569',
                                                                opacity: counts[item.id] <= 0 ? 0.3 : 1
                                                            }}
                                                        >
                                                            <Minus size={14} />
                                                        </button>
                                                        <span style={{
                                                            width: 28, textAlign: 'center',
                                                            fontWeight: 700, fontSize: 15, color: '#0f172a'
                                                        }}>
                                                            {counts[item.id]}
                                                        </span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); updateCount(item.id, 1, item.max); }}
                                                            disabled={counts[item.id] >= item.max}
                                                            style={{
                                                                width: 30, height: 30,
                                                                backgroundColor: 'white', borderRadius: 8,
                                                                border: 'none', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                                                color: group.color,
                                                                opacity: counts[item.id] >= item.max ? 0.3 : 1
                                                            }}
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            onClick={(e) => { e.stopPropagation(); confirmBlock(group.id); }}
                                            style={{
                                                width: '100%', marginTop: 16,
                                                padding: '13px 0',
                                                backgroundColor: group.color, color: 'white',
                                                borderRadius: 12, fontWeight: 700, fontSize: 13,
                                                border: 'none', cursor: 'pointer',
                                                boxShadow: `0 8px 20px -4px ${group.color}40`,
                                                transition: 'transform 0.1s ease',
                                                letterSpacing: '-0.01em'
                                            }}
                                        >
                                            Confirmar {group.label}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* ════════════ STICKY FOOTER CTA ════════════ */}
            <footer style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                padding: '24px 20px 24px',
                background: 'linear-gradient(to top, #F8F9FB 80%, transparent)',
                zIndex: 40
            }}>
                <button
                    onClick={handleFinalSubmit}
                    disabled={!allBlocksDone || saving}
                    style={{
                        width: '100%',
                        backgroundColor: allBlocksDone ? '#0f172a' : '#e2e8f0',
                        color: allBlocksDone ? 'white' : '#94a3b8',
                        fontWeight: 700, padding: '18px 0', borderRadius: 16,
                        fontSize: 15, letterSpacing: '-0.01em',
                        boxShadow: allBlocksDone ? '0 16px 32px -8px rgba(15,23,42,0.15)' : 'none',
                        transition: 'all 0.2s ease',
                        border: 'none',
                        cursor: allBlocksDone ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                >
                    {saving ? (
                        <Loader2 size={22} className="animate-spin" />
                    ) : allBlocksDone ? (
                        <>
                            <Check size={18} strokeWidth={3} />
                            Listo: iniciar carga en vehículo
                        </>
                    ) : (
                        `Completa ${PILOT_GROUPS.length - completedCount} sección${(PILOT_GROUPS.length - completedCount) !== 1 ? 'es' : ''}`
                    )}
                </button>
            </footer>

            {/* ════════════ HELP MODAL ════════════ */}
            {showHelp && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 50,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
                    backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: 20,
                        width: '100%', maxWidth: 340, padding: 24,
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                        position: 'relative'
                    }}>
                        <button
                            onClick={() => setShowHelp(false)}
                            style={{
                                position: 'absolute', top: 14, right: 14,
                                color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer'
                            }}
                        >
                            <X size={22} />
                        </button>

                        <div style={{
                            width: 44, height: 44, borderRadius: '50%',
                            backgroundColor: '#dbeafe', color: '#2563eb',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: 16
                        }}>
                            <HelpCircle size={22} />
                        </div>

                        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>
                            Ayuda Rápida
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {[
                                { title: '¿Qué es esta pantalla?', body: 'Confirmas que todo el equipo (drones, baterías, VR) está completo y seguro.' },
                                { title: '¿Cuándo usar +/-?', body: 'Si llevas más o menos cantidad de lo estándar (ej. 4 baterías en lugar de 6).' },
                                { title: 'Algo falta o está roto', body: 'No inicies la misión. Contacta a Soporte Operativo inmediatamente.' }
                            ].map(item => (
                                <div key={item.title}>
                                    <h4 style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', margin: 0 }}>{item.title}</h4>
                                    <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, margin: '4px 0 0' }}>{item.body}</p>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setShowHelp(false)}
                            style={{
                                width: '100%', marginTop: 20, padding: '11px 0',
                                backgroundColor: '#f1f5f9', color: '#334155',
                                fontWeight: 700, borderRadius: 12,
                                fontSize: 13, border: 'none', cursor: 'pointer'
                            }}
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            {/* ════════════ SUCCESS TOAST ════════════ */}
            {showConfirmToast && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 50,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(34,197,94,0.92)',
                    backdropFilter: 'blur(8px)', color: 'white'
                }}>
                    <div className="animate-bounce" style={{
                        backgroundColor: 'white', color: '#22c55e',
                        borderRadius: '50%', padding: 20, marginBottom: 20,
                        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15)'
                    }}>
                        <Check size={44} strokeWidth={4} />
                    </div>
                    <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>¡Equipo verificado!</h2>
                    <p style={{ fontSize: 16, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Todo listo para la misión</p>
                </div>
            )}
        </div>
    );
}
