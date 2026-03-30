'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Award,
    BarChart3,
    Calendar,
    Camera,
    CheckCircle2,
    ChevronRight,
    Clock,
    Download,
    FileText,
    Loader2,
    MapPin,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Phone,
    Star,
    TrendingUp,
    Upload,
    User,
    Users,
    Sparkles,
    WifiOff,
    XCircle
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { MiniAvatar } from '@/components/ui/MiniAvatar';

/* ═══════════════ CONSTANTS ═══════════════ */
const ROLE_LABELS = {
    pilot: 'Piloto',
    teacher: 'Docente',
    assistant: 'Auxiliar',
    auxiliar: 'Auxiliar',
    admin: 'Administrador'
};

const TABS = [
    { id: 'dashboard', label: 'Mi Dashboard', icon: BarChart3 },
    { id: 'documents', label: 'Documentos', icon: Shield },
    { id: 'payslips', label: 'Recibos', icon: FileText }
];

const DOC_TYPES = [
    { id: 'ine', label: 'Credencial INE', Icon: User, expires: true, description: 'Identificación oficial vigente' },
    { id: 'proof_of_address', label: 'Comprobante de Domicilio', Icon: MapPin, expires: true, description: 'Máximo 3 meses de antigüedad' },
    { id: 'driver_license', label: 'Licencia de Manejo', Icon: FileText, expires: true, description: 'Licencia de conducir vigente' }
];

const STATUS_CONFIG = {
    validated: { label: 'Validado', color: 'emerald', Icon: ShieldCheck },
    pending: { label: 'En revisión', color: 'amber', Icon: Clock },
    rejected: { label: 'Rechazado', color: 'red', Icon: XCircle },
    expired: { label: 'Vencido', color: 'red', Icon: ShieldAlert },
    missing: { label: 'Faltante', color: 'slate', Icon: Upload },
    exempt: { label: 'No Requiere', color: 'slate', Icon: ShieldCheck }
};

const PAYMENT_METHOD_LABELS = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    other: 'Otro'
};

function todayMX() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

function firstDayOfMonthMX() {
    const now = new Date();
    const mx = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    return `${mx.getFullYear()}-${String(mx.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatCurrency(amount) {
    const num = Number(amount);
    if (!Number.isFinite(num)) return '$0.00';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Mexico_City' });
}

function daysUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return null;
    const now = new Date();
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
}

/* ═══════════════ STAT CARD ═══════════════ */
function StatCard({ icon: Icon, label, value, subtext, accentColor = 'blue' }) {
    const iconColors = {
        blue: 'text-blue-600 fill-blue-600/10',
        emerald: 'text-emerald-600 fill-emerald-600/10',
        amber: 'text-amber-500 fill-amber-500/10',
        violet: 'text-violet-600 fill-violet-600/10'
    };

    return (
        <div className="bg-slate-50 rounded-[28px] shadow-[8px_8px_16px_#cbd5e1,-8px_-8px_16px_#ffffff] p-5 pt-6 transition-all">
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-2xl bg-slate-50 shadow-[inset_3px_3px_8px_#cbd5e1,inset_-3px_-3px_8px_#ffffff] ${iconColors[accentColor] || iconColors.blue}`}>
                    <Icon size={22} className="opacity-90" strokeWidth={2.5} />
                </div>
                {subtext && (
                    <span className="text-[10px] font-black text-slate-400/80 uppercase tracking-widest mt-1">{subtext}</span>
                )}
            </div>
            <p className="text-[32px] font-black text-slate-800 tracking-tight leading-none">{value}</p>
            <p className="text-[13px] font-bold text-slate-400 mt-2">{label}</p>
        </div>
    );
}

/* ═══════════════ DOC CARD ═══════════════ */
function DocCard({ docType, existingDoc, onUpload, isUploading, onExempt }) {
    const status = existingDoc ? existingDoc.status : 'missing';

    // Check if expired based on expires_at
    const effectiveStatus = (() => {
        if (status === 'missing') return 'missing';
        if (status === 'exempt') return 'exempt';
        if (existingDoc?.expires_at) {
            const remaining = daysUntil(existingDoc.expires_at);
            if (remaining !== null && remaining < 0) return 'expired';
        }
        return status;
    })();

    const config = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.missing;
    const remaining = existingDoc?.expires_at ? daysUntil(existingDoc.expires_at) : null;

    const badgeColors = {
        emerald: 'bg-slate-50 shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff] text-emerald-600',
        amber: 'bg-slate-50 shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff] text-amber-600',
        red: 'bg-slate-50 shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff] text-red-600',
        slate: 'bg-transparent text-slate-400/60 font-semibold'
    };

    const isExempt = effectiveStatus === 'exempt';
    const isMissing = effectiveStatus === 'missing' || effectiveStatus === 'rejected' || effectiveStatus === 'expired';

    return (
        <div className="bg-slate-50 rounded-[28px] shadow-[6px_6px_16px_#cbd5e1,-6px_-6px_16px_#ffffff] p-6 mb-8 relative group transition-all">
            <div className="flex items-start gap-5">
                <div className="w-14 h-14 rounded-[20px] bg-blue-500 shadow-[inset_4px_4px_8px_rgba(29,78,216,0.3),inset_-4px_-4px_8px_rgba(96,165,250,0.3)] flex items-center justify-center shrink-0">
                    <docType.Icon size={24} className="text-white" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <p className="font-extrabold text-slate-800 tracking-tight">{docType.label}</p>
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest ${config.color === 'slate' ? badgeColors.slate : badgeColors[config.color] + ' font-black'}`}>
                            <config.Icon size={12} strokeWidth={2.5} />
                            {config.label}
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-400/70 mt-0.5 tracking-wide leading-relaxed">{docType.description}</p>

                    {remaining !== null && effectiveStatus === 'validated' && remaining <= 30 && remaining >= 0 && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mt-2">
                            ⚠️ Vence en {remaining} días
                        </p>
                    )}

                    {effectiveStatus === 'rejected' && existingDoc?.rejection_reason && (
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mt-2">
                            Motivo: {existingDoc.rejection_reason}
                        </p>
                    )}

                    {existingDoc?.created_at && !isExempt && (
                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-2">
                            Subido: {formatDate(existingDoc.created_at)}
                        </p>
                    )}
                </div>
            </div>

            {/* Upload / Re-upload button */}
            {!isExempt && (
                <label
                    className={`mt-6 w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-[16px] text-[11px] uppercase tracking-widest font-black transition-all cursor-pointer select-none ${
                        isMissing
                            ? 'bg-slate-50 text-blue-600 shadow-[6px_6px_10px_#cbd5e1,-6px_-6px_10px_#ffffff] active:shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff]'
                            : 'bg-slate-50 text-slate-500 shadow-[4px_4px_10px_#cbd5e1,-4px_-4px_10px_#ffffff] active:shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff]'
                    } ${isUploading ? 'opacity-50 pointer-events-none shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff]' : ''}`}
                >
                    {isUploading ? (
                        <><Loader2 size={16} className="animate-spin" /> Subiendo...</>
                    ) : (
                        <>
                            <Camera size={16} strokeWidth={2.5} />
                            {effectiveStatus === 'missing' ? 'Subir documento' :
                             (effectiveStatus === 'rejected' || effectiveStatus === 'expired') ? 'Subir nuevo' :
                             'Actualizar Requisitos'}
                        </>
                    )}
                    <input
                        type="file"
                        accept="image/*,application/pdf"
                        capture="environment"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) onUpload(docType.id, file);
                            e.target.value = '';
                        }}
                    />
                </label>
            )}

            {/* Exemption Option for Driver License */}
            {docType.id === 'driver_license' && isMissing && !isUploading && (
                <button 
                    onClick={() => onExempt(docType.id)}
                    className="mt-4 w-full text-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors"
                >
                    No cuento con licencia
                </button>
            )}
        </div>
    );
}

/* ═══════════════ PAYSLIP CARD ═══════════════ */
function PayslipCard({ payslip }) {
    return (
        <div className="bg-slate-50 rounded-[28px] shadow-[8px_8px_16px_#cbd5e1,-8px_-8px_16px_#ffffff] p-5 pt-6 transition-all mb-4 border border-white/50">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 shadow-[inset_3px_3px_8px_#cbd5e1,inset_-3px_-3px_8px_#ffffff] flex items-center justify-center shrink-0">
                        <FileText size={22} className="text-emerald-600 opacity-90" strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="font-extrabold text-sm text-slate-800 tracking-tight">{payslip.period_label}</p>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                            {formatDate(payslip.period_start)} — {formatDate(payslip.period_end)}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-black text-xl text-emerald-600 tracking-tight leading-none">{formatCurrency(payslip.amount)}</p>
                    {payslip.payment_method && (
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                            {PAYMENT_METHOD_LABELS[payslip.payment_method] || payslip.payment_method}
                        </p>
                    )}
                </div>
            </div>
            {payslip.concept && (
                <p className="text-[11px] font-bold text-slate-500 mt-3 pt-3 border-t border-slate-200/50">{payslip.concept}</p>
            )}
            {payslip.pdf_url && (
                <a
                    href={payslip.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[16px] bg-slate-50 text-blue-600 text-[11px] uppercase tracking-widest font-black transition-all shadow-[4px_4px_10px_#cbd5e1,-4px_-4px_10px_#ffffff] hover:shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff]"
                >
                    <Download size={14} strokeWidth={2.5} />
                    <span>Descargar Recibo</span>
                </a>
            )}
        </div>
    );
}

/* ═══════════════ MAIN COMPONENT ═══════════════ */
export default function HRHubPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isOnline, setIsOnline] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Profile
    const [profile, setProfile] = useState(null);
    const [userId, setUserId] = useState(null);

    // Stats
    const [stats, setStats] = useState({
        missionsThisMonth: 0,
        missionsTotal: 0,
        studentsThisMonth: 0,
        studentsTotal: 0,
        daysWorkedThisMonth: 0,
        punctualityPct: null
    });

    // Phone Capture
    const [phoneNum, setPhoneNum] = useState('');
    const [isSavingPhone, setIsSavingPhone] = useState(false);

    // Documents
    const [documents, setDocuments] = useState([]);
    const [uploadingDocType, setUploadingDocType] = useState(null);

    // Payslips
    const [payslips, setPayslips] = useState([]);

    // ─── Online/Offline ───
    useEffect(() => {
        setIsOnline(navigator.onLine);
        const on = () => setIsOnline(true);
        const off = () => setIsOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);

    // ─── Load everything ───
    useEffect(() => {
        let cancelled = false;

        async function loadAll() {
            try {
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { router.replace('/staff/login'); return; }
                if (cancelled) return;
                setUserId(user.id);

                // Profile
                const { data: profileData } = await supabase
                    .from('staff_profiles')
                    .select('full_name, role, is_active, created_at, phone, avatar_config')
                    .eq('user_id', user.id)
                    .single();

                if (cancelled) return;
                setProfile(profileData);
                if (profileData?.phone) setPhoneNum(profileData.phone);

                const today = todayMX();
                const monthStart = firstDayOfMonthMX();

                // ─── Stats from existing data ───
                const [
                    { data: journeysThisMonth },
                    { data: journeysAll },
                    { data: checkinEvents },
                    { data: closuresMonth },
                    { data: closuresAll }
                ] = await Promise.all([
                    // Journeys this month where user participated (via events)
                    supabase.from('staff_journeys')
                        .select('id, date, status, route_started_at')
                        .gte('date', monthStart)
                        .lte('date', today)
                        .in('status', ['closed', 'report', 'operation'])
                        .order('date', { ascending: false })
                        .limit(500),
                    // All journeys
                    supabase.from('staff_journeys')
                        .select('id, date, status')
                        .in('status', ['closed', 'report'])
                        .limit(10000),
                    // Check-in events this month for punctuality
                    supabase.from('staff_prep_events')
                        .select('id, created_at, event_type, journey_id')
                        .eq('user_id', user.id)
                        .eq('event_type', 'checkin')
                        .gte('created_at', `${monthStart}T00:00:00`)
                        .order('created_at', { ascending: false })
                        .limit(500),
                    // Closures this month (students)
                    supabase.from('cierres_mision')
                        .select('total_students, total_flights, created_at')
                        .gte('created_at', `${monthStart}T00:00:00`)
                        .limit(500),
                    // All closures
                    supabase.from('cierres_mision')
                        .select('total_students')
                        .limit(10000)
                ]);

                if (cancelled) return;

                // Calculate unique days worked this month (days with a checkin event)
                const uniqueDays = new Set();
                (checkinEvents || []).forEach(ev => {
                    if (ev.created_at) {
                        const dayStr = new Date(ev.created_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
                        uniqueDays.add(dayStr);
                    }
                });

                // Punctuality: check-ins before 7:15 AM / total check-ins
                let onTimeCount = 0;
                let totalCheckins = 0;
                (checkinEvents || []).forEach(ev => {
                    if (!ev.created_at) return;
                    totalCheckins++;
                    const checkinDate = new Date(ev.created_at);
                    const hour = Number(checkinDate.toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Mexico_City' }));
                    const minute = Number(checkinDate.toLocaleString('en-US', { minute: 'numeric', timeZone: 'America/Mexico_City' }));
                    // Default: 7:00 AM + 15 min tolerance = before 7:15
                    if (hour < 7 || (hour === 7 && minute <= 15)) {
                        onTimeCount++;
                    }
                });

                const punctualityPct = totalCheckins > 0 ? Math.round((onTimeCount / totalCheckins) * 100) : null;

                const studentsMonth = (closuresMonth || []).reduce((sum, c) => sum + (Number(c.total_students) || 0), 0);
                const studentsAll = (closuresAll || []).reduce((sum, c) => sum + (Number(c.total_students) || 0), 0);

                setStats({
                    missionsThisMonth: (journeysThisMonth || []).length,
                    missionsTotal: (journeysAll || []).length,
                    studentsThisMonth: studentsMonth,
                    studentsTotal: studentsAll,
                    daysWorkedThisMonth: uniqueDays.size,
                    punctualityPct
                });

                // ─── Documents ───
                const { data: docs } = await supabase
                    .from('hr_documents')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (cancelled) return;
                setDocuments(docs || []);

                // ─── Payslips ───
                const { data: slips } = await supabase
                    .from('hr_payslips')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('period_start', { ascending: false })
                    .limit(50);

                if (cancelled) return;
                setPayslips(slips || []);

            } catch (err) {
                console.error('[HRHub] Load error:', err);
                if (!cancelled) setError(err.message || 'Error al cargar datos');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadAll();
        return () => { cancelled = true; };
    }, [router]);

    // ─── Document Upload ───
    const handleDocUpload = useCallback(async (docType, file) => {
        if (!userId || uploadingDocType) return;
        setUploadingDocType(docType);

        try {
            const supabase = createClient();
            const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
            const safeName = `${userId}/${docType}_${Date.now()}.${ext}`;

            // Upload to storage
            const { error: uploadError } = await supabase.storage
                .from('hr-documents')
                .upload(safeName, file, { upsert: true, contentType: file.type });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('hr-documents')
                .getPublicUrl(safeName);

            const fileUrl = urlData?.publicUrl || safeName;

            // Check if document already exists for this type
            const existing = documents.find(d => d.doc_type === docType);

            if (existing) {
                // Update existing
                const { error: updateError } = await supabase
                    .from('hr_documents')
                    .update({
                        file_url: fileUrl,
                        file_name: file.name,
                        status: 'pending',
                        validated_at: null,
                        validated_by: null,
                        rejection_reason: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (updateError) throw updateError;
            } else {
                // Insert new
                const { error: insertError } = await supabase
                    .from('hr_documents')
                    .insert({
                        user_id: userId,
                        doc_type: docType,
                        file_url: fileUrl,
                        file_name: file.name,
                        status: 'pending'
                    });

                if (insertError) throw insertError;
            }

            // Reload documents
            const { data: freshDocs } = await supabase
                .from('hr_documents')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            setDocuments(freshDocs || []);

        } catch (err) {
            console.error('[HRHub] Upload error:', err);
            alert('Error al subir documento: ' + (err.message || 'Intenta de nuevo'));
        } finally {
            setUploadingDocType(null);
        }
    }, [userId, documents, uploadingDocType]);

    const handleMarkExempt = useCallback(async (docType) => {
        if (!userId) return;
        setUploadingDocType(docType);

        try {
            const supabase = createClient();
            const existing = documents.find(d => d.doc_type === docType);

            if (existing) {
                const { error } = await supabase.from('hr_documents').update({
                    status: 'exempt', file_url: null, file_name: 'No Aplica', rejection_reason: null, updated_at: new Date().toISOString()
                }).eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('hr_documents').insert({
                    user_id: userId, doc_type: docType, status: 'exempt', file_url: null, file_name: 'No Aplica'
                });
                if (error) throw error;
            }

            // Reload documents
            const { data: freshDocs } = await supabase
                .from('hr_documents')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            setDocuments(freshDocs || []);
        } catch (error) {
            console.error('[HRHub] Mark Exempt error:', error);
            alert('Error al actualizar el estado.');
        } finally {
            setUploadingDocType(null);
        }
    }, [userId, documents]);

    // ─── Contact Info ───
    const handleSavePhone = async () => {
        if (!userId) return;
        const cleaned = (phoneNum || '').replace(/\D/g, '');
        if (cleaned.length < 10) {
            alert('Por favor, ingresa al menos 10 dígitos.');
            return;
        }
        setIsSavingPhone(true);
        try {
            const supabase = createClient();
            const { error: updErr } = await supabase
                .from('staff_profiles')
                .update({ phone: cleaned })
                .eq('user_id', userId);
            
            if (updErr) throw updErr;
            setProfile(prev => ({ ...prev, phone: cleaned }));
            setPhoneNum(cleaned);
        } catch (err) {
            console.error('[HRHub] Phone update error:', err);
            alert('Error al guardar el número. ' + err.message);
        } finally {
            setIsSavingPhone(false);
        }
    };

    // ─── Memos ───
    const docsByType = useMemo(() => {
        const map = {};
        documents.forEach(d => {
            // Keep the most recent per type
            if (!map[d.doc_type] || new Date(d.created_at) > new Date(map[d.doc_type].created_at)) {
                map[d.doc_type] = d;
            }
        });
        return map;
    }, [documents]);

    const TOTAL_REQUIREMENTS = DOC_TYPES.length + 1;

    const docCompletionCount = useMemo(() => {
        let count = DOC_TYPES.filter(dt => {
            const doc = docsByType[dt.id];
            return doc && (doc.status === 'validated' || doc.status === 'pending' || doc.status === 'exempt');
        }).length;
        if (profile?.phone) {
            count += 1;
        }
        return count;
    }, [docsByType, profile?.phone]);

    const antiquity = useMemo(() => {
        if (!profile?.created_at) return null;
        const created = new Date(profile.created_at);
        const now = new Date();
        const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
        if (months < 1) return 'Nuevo ingreso';
        if (months === 1) return '1 mes';
        if (months < 12) return `${months} meses`;
        const years = Math.floor(months / 12);
        const rem = months % 12;
        return `${years} año${years > 1 ? 's' : ''}${rem > 0 ? ` ${rem} mes${rem > 1 ? 'es' : ''}` : ''}`;
    }, [profile?.created_at]);

    // ─── Loading ───
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-medium">Cargando tu perfil...</p>
                </div>
            </div>
        );
    }

    // ─── Offline fallback ───
    if (!isOnline && !profile) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
                <WifiOff className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-lg font-bold text-slate-700 mb-1">Sin conexión</p>
                <p className="text-sm text-slate-400 text-center mb-6">
                    Necesitas conexión a internet para ver tu perfil HR.
                </p>
                <button
                    onClick={() => router.back()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
                >
                    Volver al Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50/30">

            {/* ─── Header ─── */}
            <div className="bg-blue-600 text-white relative shadow-[0_12px_30px_rgba(37,99,235,0.15)] rounded-b-[40px] z-20">
                <div className="max-w-lg mx-auto px-5 pt-8 pb-10">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-white/70 hover:text-white font-black tracking-widest text-[11px] uppercase mb-8 transition-colors group"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver
                    </button>

                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[22px] bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/20 shrink-0 overflow-hidden relative">
                            {profile?.avatar_config ? (
                                <MiniAvatar config={profile.avatar_config} size={64} className="scale-[1.25] translate-y-3" />
                            ) : (
                                <User size={32} className="text-white" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-[22px] font-black tracking-tight truncate">
                                {profile?.full_name || 'Operativo'}
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-700/50 text-[11px] font-bold uppercase tracking-widest">
                                    {ROLE_LABELS[profile?.role] || profile?.role || 'Staff'}
                                </span>
                                {antiquity && (
                                    <span className="text-[12px] font-bold text-blue-200">{antiquity}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Quick stat badges */}
                    <div className="flex items-center gap-2 mt-4">
                        <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 backdrop-blur-sm border border-white/5 relative">
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] text-white/60 uppercase tracking-wider font-bold">Documentos</p>
                                {docCompletionCount < TOTAL_REQUIREMENTS && (
                                    <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
                                )}
                            </div>
                            <p className="text-sm font-extrabold">{docCompletionCount}/{TOTAL_REQUIREMENTS}</p>
                        </div>
                        <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 backdrop-blur-sm border border-white/5">
                            <p className="text-[10px] text-white/60 uppercase tracking-wider font-bold">Puntualidad</p>
                            <p className="text-sm font-extrabold">
                                {stats.punctualityPct !== null ? `${stats.punctualityPct}%` : '—'}
                            </p>
                        </div>
                        <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 backdrop-blur-sm border border-white/5">
                            <p className="text-[10px] text-white/60 uppercase tracking-wider font-bold">Este mes</p>
                            <p className="text-sm font-extrabold">{stats.missionsThisMonth} misiones</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Tab Bar ─── */}
            <div className="sticky top-0 z-20 bg-slate-50 pt-2 pb-6 px-4">
                <div className="max-w-lg mx-auto flex gap-3 overflow-x-auto no-scrollbar py-4 -my-4 px-2 -mx-2">
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.id;
                        const TabIcon = tab.icon;
                        const hasAlert = tab.id === 'documents' && docCompletionCount < TOTAL_REQUIREMENTS;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 min-w-[110px] flex items-center justify-center gap-2 px-4 py-3.5 text-[11px] uppercase tracking-widest font-black transition-all rounded-[20px] shrink-0 select-none relative ${
                                    isActive
                                        ? 'bg-slate-50 text-blue-600 shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff]'
                                        : 'bg-slate-50 text-slate-400 shadow-[4px_4px_10px_#cbd5e1,-4px_-4px_10px_#ffffff] hover:shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff] hover:text-slate-500'
                                }`}
                            >
                                <TabIcon size={16} strokeWidth={2.5} className={isActive ? "text-blue-600" : "text-slate-400"} />
                                <span>{tab.label}</span>
                                {hasAlert && (
                                    <span className="absolute top-0 right-0 -m-1 w-3 h-3 rounded-full bg-red-500 shadow-[4px_4px_10px_#cbd5e1,-4px_-4px_10px_#ffffff,inset_2px_2px_4px_rgba(255,255,255,0.4)] animate-pulse" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ─── Tab Content ─── */}
            <div className="max-w-lg mx-auto px-4 py-5 pb-20">

                {/* ═══ DASHBOARD TAB ═══ */}
                {activeTab === 'dashboard' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        
                        {/* ID STUDIO BANNER APP */}
                        {!profile?.avatar_config && (
                            <div className="bg-slate-50 rounded-[28px] shadow-[8px_8px_16px_#cbd5e1,-8px_-8px_16px_#ffffff] p-6 mb-8 text-center animate-in fade-in duration-500 overflow-hidden relative border border-white/50">
                                <div className="absolute -right-4 -top-2 text-slate-200/50 z-0">
                                    <Sparkles size={100} strokeWidth={1} />
                                </div>
                                <div className="relative z-10">
                                    <div className="w-14 h-14 mx-auto bg-blue-500 text-white shadow-[inset_4px_4px_8px_rgba(29,78,216,0.3),inset_-4px_-4px_8px_rgba(96,165,250,0.3)] rounded-[20px] flex items-center justify-center mb-5">
                                        <Camera size={26} strokeWidth={2.5}/>
                                    </div>
                                    <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-widest mb-2 drop-shadow-sm">¡Completa tu Perfil Digital!</h3>
                                    <p className="text-[12px] text-slate-400 font-bold mb-6 px-2 leading-relaxed tracking-wide">
                                        Crea tu ID Virtual para identificarte en toda la plataforma. Solo te tomará 1 minuto.
                                    </p>
                                    <Link href="/staff/id-studio" className="inline-flex items-center justify-center bg-slate-50 text-blue-600 px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-[6px_6px_16px_#cbd5e1,-6px_-6px_16px_#ffffff] hover:shadow-[inset_4px_4px_8px_#cbd5e1,inset_-4px_-4px_8px_#ffffff] transition-all w-full select-none cursor-pointer">
                                        Crear mi ID ahora <ChevronRight size={16} className="ml-1" strokeWidth={3}/>
                                    </Link>
                                </div>
                            </div>
                        )}

                        <div>
                            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <TrendingUp size={14} className="text-blue-500" />
                                Este Mes
                            </h2>
                            <div className="grid grid-cols-2 gap-3">
                                <StatCard
                                    icon={MapPin}
                                    label="Misiones completadas"
                                    value={stats.missionsThisMonth}
                                    accentColor="blue"
                                />
                                <StatCard
                                    icon={Users}
                                    label="Alumnos atendidos"
                                    value={stats.studentsThisMonth.toLocaleString('es-MX')}
                                    accentColor="emerald"
                                />
                                <StatCard
                                    icon={Calendar}
                                    label="Días trabajados"
                                    value={stats.daysWorkedThisMonth}
                                    accentColor="violet"
                                />
                                <StatCard
                                    icon={Clock}
                                    label="Puntualidad"
                                    value={stats.punctualityPct !== null ? `${stats.punctualityPct}%` : '—'}
                                    accentColor="amber"
                                />
                            </div>
                        </div>

                        <div className="mt-6">
                            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Award size={14} className="text-amber-500" />
                                Acumulado Total
                            </h2>
                            <div className="grid grid-cols-2 gap-3">
                                <StatCard
                                    icon={Star}
                                    label="Misiones totales"
                                    value={stats.missionsTotal}
                                    subtext="Histórico"
                                    accentColor="amber"
                                />
                                <StatCard
                                    icon={Users}
                                    label="Alumnos totales"
                                    value={stats.studentsTotal.toLocaleString('es-MX')}
                                    subtext="Histórico"
                                    accentColor="emerald"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ DOCUMENTS TAB ═══ */}
                {activeTab === 'documents' && (
                    <div className="space-y-3 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Shield size={14} className="text-blue-500" />
                                Mis Documentos
                                {docCompletionCount < TOTAL_REQUIREMENTS && (
                                    <span className="w-2 h-2 rounded-full bg-red-500 shadow-[4px_4px_10px_#cbd5e1,-4px_-4px_10px_#ffffff,inset_2px_2px_4px_rgba(255,255,255,0.4)] animate-pulse ml-1" />
                                )}
                            </h2>
                            <span className="text-[11px] font-bold text-slate-400">
                                {docCompletionCount}/{TOTAL_REQUIREMENTS} completos
                            </span>
                        </div>

                        {/* Phone Capture Neumorphic Card */}
                        {/* Phone Capture Neumorphic Card */}
                        {!profile?.phone && (
                            <div className="bg-slate-50/50 rounded-[28px] shadow-[inset_4px_4px_12px_#e2e8f0,inset_-4px_-4px_12px_#ffffff] p-6 mb-8 relative transition-all duration-500 animate-in zoom-in-95">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-slate-50 shadow-[2px_2px_6px_#cbd5e1,-2px_-2px_6px_#ffffff] flex items-center justify-center text-blue-500 shrink-0">
                                            <Phone size={18} strokeWidth={2.5} />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-bold text-slate-800 tracking-tight">Vincular Contacto</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                                                Requisito indispensable para operaciones de vuelo.
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="tel"
                                            placeholder="Ingresa a 10 dígitos"
                                            value={phoneNum}
                                            onChange={(e) => setPhoneNum(e.target.value)}
                                            className="flex-1 bg-transparent px-2 py-2 text-[13px] font-bold text-slate-700 placeholder:text-slate-300 outline-none border-b-2 border-slate-200/60 focus:border-blue-500 transition-colors"
                                        />
                                        <button
                                            onClick={handleSavePhone}
                                            disabled={isSavingPhone || !phoneNum || phoneNum.replace(/\D/g, '').length < 10}
                                            className="px-6 py-3 bg-blue-500 text-white shadow-[4px_4px_10px_rgba(59,130,246,0.25),-4px_-4px_10px_#ffffff] rounded-[14px] text-[11px] font-black tracking-widest uppercase transition-all hover:bg-blue-600 disabled:opacity-50 disabled:shadow-none disabled:bg-slate-200 disabled:text-slate-400 active:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.2)] flex items-center justify-center min-w-[110px]"
                                        >
                                            {isSavingPhone ? <Loader2 size={16} className="animate-spin" /> : 'Guardar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Completion bar */}
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
                                style={{ width: `${(docCompletionCount / TOTAL_REQUIREMENTS) * 100}%` }}
                            />
                        </div>

                        <div className="pt-2">
                            {DOC_TYPES.map(dt => (
                                <DocCard
                                    key={dt.id}
                                    docType={dt}
                                    existingDoc={docsByType[dt.id] || null}
                                    onUpload={handleDocUpload}
                                    onExempt={handleMarkExempt}
                                    isUploading={uploadingDocType === dt.id}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* ═══ PAYSLIPS TAB ═══ */}
                {activeTab === 'payslips' && (
                    <div className="space-y-3 animate-in fade-in duration-300">
                        <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <FileText size={14} className="text-emerald-500" />
                            Mis Recibos de Pago
                        </h2>

                        {payslips.length === 0 ? (
                            <div className="text-center py-12">
                                <FileText size={40} className="text-slate-200 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-500">Sin recibos todavía</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    Tus recibos de pago aparecerán aquí cuando el administrador los genere.
                                </p>
                            </div>
                        ) : (
                            payslips.map(slip => (
                                <PayslipCard key={slip.id} payslip={slip} />
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
