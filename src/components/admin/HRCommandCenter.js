'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabaseNew } from '@/lib/supabaseClientNew';
import {
    Users, FileText, Clock, Shield, CheckCircle, AlertCircle,
    ChevronRight, Loader2, Calendar, Eye, XCircle, AlertTriangle, 
    RefreshCw, Search, Phone, Mail, Award, Activity,
    Shirt, BadgeCheck, Smartphone, User, Fingerprint
} from 'lucide-react';
import { MiniAvatar } from '@/components/ui/MiniAvatar';

// ── CONSTANTS ──
const DOC_TYPES = [
    { key: 'ine', label: 'Identificación Oficial', expires: true },
    { key: 'proof_of_address', label: 'Comprobante de Domicilio', expires: true },
    { key: 'driver_license', label: 'Licencia de Conducir', expires: true },
];

const ROLE_LABELS = {
    pilot: 'Piloto',
    teacher: 'Docente',
    assistant: 'Auxiliar',
    auxiliar: 'Auxiliar',
    admin: 'Administrador',
};

const STATUS_CFG = {
    validated: { label: 'Validado', color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: CheckCircle },
    pending: { label: 'Por Revisar', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: Clock },
    rejected: { label: 'Rechazado', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: XCircle },
    expired: { label: 'Vencido', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: AlertTriangle },
    missing: { label: 'Faltante', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: AlertCircle },
    expiring_soon: { label: 'Por Vencer', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: AlertTriangle },
};

export default function HRCommandCenter() {
    const [loading, setLoading] = useState(true);
    const [staffList, setStaffList] = useState([]);
    const [hrDocs, setHrDocs] = useState([]);
    const [prepEvents, setPrepEvents] = useState([]);
    const [cierres, setCierres] = useState([]);
    
    // UI State
    const [expandedStaff, setExpandedStaff] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeView, setActiveView] = useState('directory'); // directory | attendance
    const [validatingDoc, setValidatingDoc] = useState(null);
    const [animatingDoc, setAnimatingDoc] = useState(null); // Para micro-interacciones de éxito

    // ── FETCH ALL DATA ──
    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            // Staff
            const staffRes = await fetch('/api/staff/list');
            const staffData = await staffRes.json();
            if (staffRes.ok) setStaffList(staffData.staff || []);

            // 2. Obtener data segura (Docs, Eventos y Cierres) vía backend para bypass RLS
            const hrRes = await fetch('/api/admin/hr/data');
            if (hrRes.ok) {
                const hrData = await hrRes.json();
                setHrDocs(hrData.docs || []);
                setPrepEvents(hrData.events || []);
                setCierres(hrData.closures || []);
            } else {
                setHrDocs([]);
                setPrepEvents([]);
                setCierres([]);
            }
        } catch (err) {
            console.error('HR fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── COMPUTED DATA FUNCIONALITY ──
    const getDocsForUser = (userId) => {
        const userDocs = hrDocs.filter(d => d.user_id === userId);
        return DOC_TYPES.map(dt => {
            const doc = userDocs.find(d => d.doc_type === dt.key);
            if (!doc) return { ...dt, status: 'missing', doc: null };

            if (dt.expires && doc.expires_at) {
                const daysLeft = Math.ceil((new Date(doc.expires_at) - new Date()) / (1000 * 60 * 60 * 24));
                if (daysLeft < 0) return { ...dt, status: 'expired', doc, daysLeft };
                if (daysLeft <= 30) return { ...dt, status: 'expiring_soon', doc, daysLeft };
            }
            return { ...dt, status: doc.status, doc };
        });
    };

    const getComplianceScore = (userId) => {
        const docs = getDocsForUser(userId);
        const validated = docs.filter(d => d.status === 'validated').length;
        return Math.round((validated / DOC_TYPES.length) * 100);
    };

    const getAttendanceStats = (userId) => {
        const checkins = prepEvents.filter(e => e.user_id === userId && e.event_type === 'checkin');
        const uniqueDays = new Set(checkins.map(e => new Date(e.created_at).toDateString()));
        let onTime = 0;
        checkins.forEach(e => {
            const d = new Date(e.created_at);
            const localHour = d.getHours();
            const localMin = d.getMinutes();
            if (localHour < 7 || (localHour === 7 && localMin <= 15)) onTime++;
        });
        return {
            daysWorked: uniqueDays.size,
            totalCheckins: checkins.length,
            onTimeDays: onTime,
            punctuality: checkins.length > 0 ? Math.round((onTime / checkins.length) * 100) : 0,
        };
    };

    const getOperationalCompliance = (userId) => {
        const checks = prepEvents.filter(e => e.event_type === 'team_check' && e.payload?.target_user_id === userId);
        
        let offenses = { uniforme: 0, gafete: 0, app: 0 };
        let totalChecks = 0;

        checks.forEach(e => {
            const type = e.payload?.check_type;
            const status = e.payload?.status;
            if (type && (status === 'OK' || status === 'EXCEPTION')) {
                totalChecks++;
                if (status === 'EXCEPTION') offenses[type]++;
            }
        });

        const totalOffenses = offenses.uniforme + offenses.gafete + offenses.app;
        const compliancePercentage = totalChecks === 0 ? 100 : Math.round(((totalChecks - totalOffenses) / totalChecks) * 100);

        return {
            totalChecks,
            totalOffenses,
            compliancePercentage,
            offenses
        };
    };

    const handleValidateDoc = async (docId, newStatus) => {
        setValidatingDoc(docId);
        try {
            const res = await fetch('/api/admin/hr/validate-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docId, status: newStatus }),
            });
            if (!res.ok) {
                // Fallback direct
                const { error } = await supabaseNew
                    .from('hr_documents')
                    .update({
                        status: newStatus,
                        validated_at: newStatus === 'validated' ? new Date().toISOString() : null,
                    })
                    .eq('id', docId);
                if (error) throw error;
            }
            
            // Animación de recompensa si es validado
            if (newStatus === 'validated') {
                setAnimatingDoc(docId);
                setTimeout(() => setAnimatingDoc(null), 1500);
            }
            
            await fetchAll();
        } catch (err) {
            alert('Error al procesar documento: ' + err.message);
        } finally {
            setValidatingDoc(null);
        }
    };

    const getAvatarStyles = (index) => {
        // Colores Tailwind Sólidos (Garantía Cero Repetición)
        const bgColors = [
            'bg-blue-500 dark:bg-blue-400',
            'bg-emerald-500 dark:bg-emerald-400',
            'bg-amber-500 dark:bg-amber-400',
            'bg-violet-600 dark:bg-violet-500',
            'bg-rose-500 dark:bg-rose-400',
            'bg-cyan-500 dark:bg-cyan-400',
            'bg-indigo-500 dark:bg-indigo-400',
            'bg-fuchsia-500 dark:bg-fuchsia-400',
            'bg-orange-500 dark:bg-orange-400',
            'bg-teal-500 dark:bg-teal-400'
        ];
        
        const idx = index % bgColors.length;
        
        return { 
            text: 'text-white', 
            bg: bgColors[idx], 
            innerShadow: 'shadow-[inset_2px_4px_8px_rgba(0,0,0,0.2),inset_-2px_-2px_6px_rgba(255,255,255,0.2)]', 
            border: 'border-white/20 shadow-sm' 
        };
    };

    const filteredStaff = staffList.filter(s =>
        s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.role?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ── GLOBALS ──
    const activeOperatives = staffList.filter(s => s.is_active !== false).length;

    // ── LOADER ──
    if (loading && staffList.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-6 animate-pulse">
                    <div className="relative w-20 h-20 mx-auto">
                        <div className="absolute inset-0 border-4 border-slate-100 rounded-full dark:border-slate-800"></div>
                        <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
                        <Users className="absolute inset-0 m-auto text-emerald-500/50" size={24} />
                    </div>
                    <p className="text-sm font-black tracking-widest text-slate-400 uppercase">INICIALIZANDO PLATAFORMA HR...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-premium-in relative">
            
            {/* ── AMIGABLE SVG DECORATION (MÚLTIPLES CURVAS PREMIUM) ── */}
            <div className="absolute top-0 right-0 opacity-[0.10] dark:opacity-[0.05] pointer-events-none z-0 transform translate-x-[15%] -translate-y-20" aria-hidden="true">
                <svg width="600" height="600" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#3B82F6" d="M48.1,-73.4C63.1,-63.9,76.5,-51.7,85.1,-36.4C93.6,-21.2,97.3,-2.9,94.1,14.2C90.9,31.3,80.7,47.2,67.3,59.3C53.9,71.4,37.3,79.7,20,83.9C2.7,88.1,-15.3,88.2,-31.6,82.7C-47.9,77.3,-62.4,66.4,-73.4,52.3C-84.4,38.1,-91.8,20.8,-92.5,3.3C-93.1,-14.2,-87,-31.9,-76.3,-46.5C-65.7,-61.2,-50.5,-72.8,-34.5,-79.8C-18.4,-86.8,-1.5,-89.2,14.6,-86.3C30.7,-83.4,46.1,-75.2,48.1,-73.4Z" transform="translate(100 100) scale(1.1)" />
                    <path fill="#F59E0B" d="M38.1,-66.4C48.1,-56.9,56.5,-44.7,65.1,-31.4C73.6,-18.2,82.3,-3.9,78.1,7.2C73.9,18.3,56.7,26.2,42.3,31.3C27.9,36.4,16.3,38.7,-0.7,39.9C-17.7,41.1,-40.5,41.2,-52.6,33.7C-64.7,26.2,-66.4,11.4,-65.4,-3.3C-64.4,-18,-60,-31.9,-51.3,-40.5C-42.7,-49.2,-29.5,-52.8,-17.5,-54.8C-5.4,-56.8,5.5,-57.2,16.6,-59.3C27.7,-61.4,39,-65.2,38.1,-66.4Z" transform="translate(100 100) scale(0.9)" />
                </svg>
            </div>

            {/* ── HEADER EXECUTIVE DASHBOARD ── */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 relative z-10">
                <div>
                     <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-2 flex items-center gap-4">
                        Talento & <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">Cultura</span>
                    </h1>
                    <p className="text-sm md:text-base font-medium text-slate-500 dark:text-slate-400 max-w-xl">
                        Gestión humana integral. Monitorea rendimiento, asisencia y expedientes del núcleo operativo en una vista ultra premium.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Búsqueda Integrada */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search size={16} className="text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar operativo..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white dark:bg-slate-800 border-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] rounded-full pl-11 pr-5 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/50 w-full md:w-64 transition-all"
                        />
                    </div>
                    {/* Refrescar */}
                    <button
                        onClick={fetchAll}
                        className="bg-white dark:bg-slate-800 p-3.5 rounded-full shadow-sm hover:shadow-md text-slate-400 hover:text-emerald-500 transition-all duration-300 transform hover:rotate-180 flex-shrink-0"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </header>

            {/* ── NAVIGATION SLIDER PILL (PERFECT NEUMORPHIC TOGGLE) ── */}
            <div className="flex justify-center md:justify-start mb-8">
                <div className="relative bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-[20px] inline-flex backdrop-blur-xl shadow-[inset_4px_4px_10px_#d1d5db,inset_-4px_-4px_10px_#ffffff] dark:shadow-[inset_2px_2px_8px_rgba(0,0,0,0.5)] border border-white/60 dark:border-slate-700/50">
                    
                    {/* The Sliding White Pill */}
                    <div 
                        className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-slate-50 dark:bg-slate-700 shadow-[4px_4px_10px_#cbd5e1,-4px_-4px_10px_#ffffff] dark:shadow-slate-900 rounded-[14px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                            activeView === 'directory' ? 'left-1.5' : 'left-[calc(50%+4.5px)]'
                        }`}
                    />

                    <button
                        onClick={() => setActiveView('directory')}
                        className={`relative z-10 w-40 md:w-44 py-2.5 rounded-[14px] text-xs font-black tracking-widest uppercase transition-colors duration-500 flex items-center justify-center gap-2 ${
                            activeView === 'directory' 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
                        }`}
                    >
                        <Users size={16} strokeWidth={2.5} /> Directorio
                        {activeView === 'directory' && <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>}
                    </button>

                    <button
                        onClick={() => setActiveView('attendance')}
                        className={`relative z-10 w-40 md:w-44 py-2.5 rounded-[14px] text-xs font-black tracking-widest uppercase transition-colors duration-500 flex items-center justify-center gap-2 ${
                            activeView === 'attendance' 
                            ? 'text-amber-600 dark:text-amber-400' 
                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
                        }`}
                    >
                        <Calendar size={16} strokeWidth={2.5} /> Asistencia
                    </button>
                </div>
            </div>

            {/* ── MAIN DIRECTORY VIEW ── */}
            {activeView === 'directory' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 md:gap-10">
                    {filteredStaff.map((staff, index) => {
                        const docs = getDocsForUser(staff.user_id);
                        const compliance = getComplianceScore(staff.user_id);
                        const attendance = getAttendanceStats(staff.user_id);
                        const isExpanded = expandedStaff === staff.user_id;
                        
                        // Computes
                        const isMissingDocs = compliance < 100;
                        const avatarStyles = getAvatarStyles(index);
                        const isActive = staff.is_active !== false;

                        return (
                            <div 
                                key={`staff-${staff.user_id || index}`} 
                                className={`group relative bg-white dark:bg-slate-800 rounded-[2.5rem] transition-all duration-700 overflow-hidden outline-none cursor-pointer ${
                                    isExpanded 
                                    ? 'col-span-1 lg:col-span-2 xl:col-span-3 border border-emerald-500/30 dark:border-emerald-500/20 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)]' 
                                    : 'border border-slate-100 dark:border-slate-700 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1.5'
                                }`}
                                onClick={() => setExpandedStaff(isExpanded ? null : staff.user_id)}
                            >
                                {/* Clicable Card Header Area - Pure Neumorphism, Spacious */}
                                <div className="p-8 md:p-10 flex flex-col gap-6 relative z-10 w-full">
                                    
                                    {/* Top Area: Clean transparent avatar & Names */}
                                    <div className="flex items-start md:items-center gap-6 w-full relative">
                                        
                                        {/* Playful/STEAM Solid Color Box con Neumorfismo Hundido o Avatar Real */}
                                        <div className="relative shrink-0">
                                            <div className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] flex items-center justify-center transition-all duration-500 group-hover:scale-[1.05] border overflow-hidden ${avatarStyles.bg} ${avatarStyles.innerShadow} ${avatarStyles.border}`}>
                                                {staff.avatar_config ? (
                                                    <MiniAvatar config={staff.avatar_config} size={80} className={`scale-[1.25] translate-y-3 ${!isActive ? 'grayscale opacity-50' : ''}`} />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
                                                        {/* Avatar Silhouette Teaser - Neutral Spiky Hair (Frizzle) */}
                                                        <MiniAvatar 
                                                            config={{
                                                                top: 'frizzle',
                                                                hairColor: '000000',
                                                                skinColor: '000000',
                                                                clothing: 'shirtCrewNeck',
                                                                clothesColor: '000000',
                                                                facialHair: 'none',
                                                                eyes: 'default',
                                                                mouth: 'default'
                                                            }} 
                                                            size={80} 
                                                            className="scale-[1.25] translate-y-3 brightness-0 invert opacity-40 drop-shadow-sm transition-opacity duration-500 group-hover:opacity-50" 
                                                        />

                                                        {/* Chip-less Neumorphic Watermark "PENDIENTE" */}
                                                        <div className="absolute bottom-3 inset-x-0 text-center z-10 pointer-events-none">
                                                            <span className="text-[7.5px] font-black uppercase tracking-[0.35em] text-white/70 mix-blend-overlay drop-shadow-sm ml-[2px]">
                                                                Pendiente
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Spacious Info Column - Full Name NO truncate */}
                                        <div className="flex-1 min-w-0 pr-12">
                                            <h3 className={`text-xl md:text-2xl font-black leading-tight tracking-tight mb-2 ${!isActive ? 'text-slate-400' : 'text-slate-800 dark:text-white group-hover:bg-clip-text group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-slate-800 group-hover:to-slate-600 transition-all duration-500'}`}>
                                                {staff.full_name}
                                            </h3>
                                            
                                            {/* Pills row cleanly styled (No pastels) */}
                                            <div className="flex flex-wrap items-center gap-3">
                                                <span className="px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800 shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff] text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                                    {ROLE_LABELS[staff.role] || staff.role}
                                                </span>
                                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 dark:bg-slate-800 shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff] text-[11px] font-bold tracking-widest uppercase text-slate-500">
                                                    <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
                                                    <span>{isActive ? 'Activo' : 'Inactivo'}</span>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Neumorphic Arrow (Playful/STEAM) */}
                                        <div className={`absolute top-0 right-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${isExpanded ? 'rotate-90 bg-slate-50 text-emerald-600 shadow-[inset_3px_3px_6px_#cbd5e1,inset_-3px_-3px_6px_#ffffff]' : 'bg-slate-50 text-slate-400 shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] hover:shadow-[1px_1px_2px_#cbd5e1,-1px_-1px_2px_#ffffff] hover:text-emerald-600 hover:scale-95'}`}>
                                            <ChevronRight size={20} strokeWidth={2.5} />
                                        </div>
                                    </div>

                                    {/* Mini Stats Divorced from Header (Clean Bottom Row) */}
                                    {!isExpanded && (
                                        <div className="flex items-center gap-6 mt-2 pt-6 border-t border-slate-100 dark:border-slate-700/50 w-full animate-fade-in">
                                            
                                            {/* Punctuality Block */}
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-50 shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff] ${attendance.punctuality >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>
                                                    <Clock size={16} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-0.5">Puntualidad</p>
                                                    <p className={`text-base font-black tracking-tight ${attendance.punctuality >= 80 ? 'text-emerald-600' : 'text-amber-500'}`}>
                                                        {attendance.punctuality}%
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Divider */}
                                            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 shadow-inner"></div>
                                            
                                            {/* Compliance Block */}
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-50 shadow-[inset_2px_2px_5px_#cbd5e1,inset_-2px_-2px_5px_#ffffff] ${isMissingDocs ? 'text-rose-500' : 'text-blue-600'}`}>
                                                    <Shield size={16} strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-0.5">Docs</p>
                                                    <p className={`text-base font-black tracking-tight ${isMissingDocs ? 'text-rose-500' : 'text-blue-600'}`}>
                                                        {compliance}%
                                                    </p>
                                                </div>
                                            </div>

                                        </div>
                                    )}
                                </div>

                                {/* ── EXPANDED DOSSIER (360 VIEW) ── */}
                                <div className={`overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.34,1.2,0.64,1)] ${isExpanded ? 'max-h-[1200px] opacity-100 border-t border-slate-100 dark:border-slate-700' : 'max-h-0 opacity-0'}`}>
                                    <div className="p-8 md:p-10 bg-slate-50/80 dark:bg-slate-900/50">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                                            
                                            {/* Column 1: Info & Performance */}
                                            <div className="space-y-6">
                                                <div>
                                                    <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                                                        <Activity size={14} /> Performance (30 Días)
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                                                            <div className="text-slate-400 mb-1"><Calendar size={18} /></div>
                                                            <div className="text-2xl font-black text-slate-800 dark:text-white">{attendance.daysWorked}</div>
                                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Días Laborados</div>
                                                        </div>
                                                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 relative overflow-hidden">
                                                            <div className="absolute right-0 top-0 -mr-4 -mt-4 w-16 h-16 rounded-full bg-emerald-500/10 blur-xl"></div>
                                                            <div className={attendance.punctuality >= 80 ? 'text-emerald-500 mb-1' : 'text-amber-500 mb-1'}><Clock size={18} /></div>
                                                            <div className={`text-xl font-black tracking-tight ${attendance.punctuality >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                                {attendance.onTimeDays} de {attendance.totalCheckins} 
                                                                <span className="text-[10px] ml-1 opacity-70">({attendance.punctuality}%)</span>
                                                            </div>
                                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Días Puntual</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
                                                        <Phone size={14} /> Contacto
                                                    </h4>
                                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-3">
                                                        <div className="flex items-center gap-3 text-sm">
                                                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-400"><Mail size={14} /></div>
                                                            <span className="font-semibold text-slate-600 dark:text-slate-300 truncate">{staff.email || 'No registrado'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-sm">
                                                            <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-slate-400"><Phone size={14} /></div>
                                                            <span className="font-semibold text-slate-600 dark:text-slate-300">{staff.phone || 'No registrado'}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-4 mt-6">
                                                        <CheckCircle size={14} /> Control de Gafete y Uniforme
                                                    </h4>
                                                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 space-y-3">
                                                        {(() => {
                                                            const opComp = getOperationalCompliance(staff.user_id);
                                                            if (opComp.totalChecks === 0) {
                                                                return (
                                                                    <div className="text-center py-4 px-2">
                                                                        <div className="w-10 h-10 mx-auto bg-slate-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-3">
                                                                            <Shield size={16} className="text-slate-300 dark:text-slate-500" />
                                                                        </div>
                                                                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">Sin Revisiones de Equipo</span>
                                                                        <span className="block text-[10px] text-slate-400 font-medium leading-relaxed">
                                                                            No hay registros de revisión en los últimos 30 días. Los datos aparecerán automáticamente cuando el talento se presente a una misión y sea evaluado en su <span className="font-bold text-blue-500">Pase de Lista</span>.
                                                                        </span>
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <>
                                                                    <div className="flex justify-between items-end mb-2">
                                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tasa de Cumplimiento</span>
                                                                        <span className={`text-lg font-black ${opComp.compliancePercentage === 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                                            {opComp.compliancePercentage}%
                                                                        </span>
                                                                    </div>
                                                                    {/* Uniforme */}
                                                                    <div className="flex items-center justify-between text-sm py-1 border-b border-slate-50 dark:border-slate-700">
                                                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                                                            <Shirt size={14} className="text-blue-500" /> <span className="font-semibold">Uniforme</span>
                                                                        </div>
                                                                        <span className={`font-bold ${opComp.offenses.uniforme > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                                            {opComp.offenses.uniforme > 0 ? `${opComp.offenses.uniforme} faltas` : 'Impecable'}
                                                                        </span>
                                                                    </div>
                                                                    {/* Gafete */}
                                                                    <div className="flex items-center justify-between text-sm py-1 border-b border-slate-50 dark:border-slate-700">
                                                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                                                            <BadgeCheck size={14} className="text-purple-500" /> <span className="font-semibold">Gafete</span>
                                                                        </div>
                                                                        <span className={`font-bold ${opComp.offenses.gafete > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                                            {opComp.offenses.gafete > 0 ? `${opComp.offenses.gafete} faltas` : 'Impecable'}
                                                                        </span>
                                                                    </div>
                                                                    {/* App / Batería */}
                                                                    <div className="flex items-center justify-between text-sm py-1">
                                                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                                                                            <Smartphone size={14} className="text-emerald-500" /> <span className="font-semibold">Pila/App</span>
                                                                        </div>
                                                                        <span className={`font-bold ${opComp.offenses.app > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                                            {opComp.offenses.app > 0 ? `${opComp.offenses.app} faltas` : 'Impecable'}
                                                                        </span>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Column 2 & 3: Compliance & Documents */}
                                            <div className="lg:col-span-2">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                                                        <Shield size={14} /> Documentación de Talento
                                                    </h4>
                                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${compliance === 100 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20'}`}>
                                                        {compliance}% Cumplimiento
                                                    </div>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                                    {docs.map((d, i) => {
                                                        const cfg = STATUS_CFG[d.status] || STATUS_CFG.missing;
                                                        const StatusIcon = cfg.icon;
                                                        const isSuccessAnim = animatingDoc === d.doc?.id;

                                                        return (
                                                            <div 
                                                                key={i} 
                                                                className={`relative flex flex-col justify-between p-4 rounded-2xl border transition-all duration-300 ${isSuccessAnim ? 'bg-emerald-50 border-emerald-200' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm'}`}
                                                            >
                                                                <div className="flex items-start gap-3 mb-4">
                                                                    <div 
                                                                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${isSuccessAnim ? 'scale-110' : ''}`}
                                                                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                                                                    >
                                                                        <StatusIcon size={20} className={isSuccessAnim ? 'animate-bounce' : ''} />
                                                                    </div>
                                                                    <div>
                                                                        <h5 className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight mb-1">{d.label}</h5>
                                                                        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cfg.color }}>
                                                                            {cfg.label} {d.daysLeft !== undefined && `• ${d.daysLeft} Días`}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                {/* Admin Actions */}
                                                                <div className="flex items-center gap-2 mt-auto">
                                                                    {d.doc?.file_url ? (
                                                                        <a
                                                                            href={d.doc.file_url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors border border-slate-200 dark:border-slate-600"
                                                                        >
                                                                            <Eye size={14} /> Ver PDF
                                                                        </a>
                                                                    ) : (
                                                                        <div className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-xs font-semibold rounded-lg text-center border border-dashed border-slate-200 dark:border-slate-700">
                                                                            Sin adjunto
                                                                        </div>
                                                                    )}

                                                                    {/* Validation Controls (Only if pending) */}
                                                                    {d.status === 'pending' && d.doc && (
                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleValidateDoc(d.doc.id, 'rejected'); }}
                                                                                disabled={validatingDoc === d.doc.id}
                                                                                className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20 hover:border-red-200 rounded-lg transition-all"
                                                                                title="Rechazar"
                                                                            >
                                                                                <XCircle size={16} />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleValidateDoc(d.doc.id, 'validated'); }}
                                                                                disabled={validatingDoc === d.doc.id}
                                                                                className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 hover:border-emerald-200 shadow-sm rounded-lg transition-all disabled:opacity-50"
                                                                                title="Validar"
                                                                            >
                                                                                {validatingDoc === d.doc.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filteredStaff.length === 0 && (
                        <div className="col-span-full text-center py-20 bg-white/50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search size={32} className="text-slate-300" />
                            </div>
                            <h3 className="text-lg font-black text-slate-700 dark:text-slate-200 mb-1">Sin coincidencias</h3>
                            <p className="text-slate-500 text-sm font-medium">No se encontraron operativos con esos parámetros.</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── ATTENDANCE VIEW (Simplified grid) ── */}
            {activeView === 'attendance' && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-white">Grid Punctuality</h2>
                            <p className="text-sm text-slate-500">Visualización rápida de asistencia semanal.</p>
                        </div>
                    </div>
                    {/* Contenido a escalar según necesidad futura */}
                    <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                        <Award size={40} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-black text-slate-600 dark:text-slate-300">Construcción Premium en Proceso</h3>
                        <p className="text-slate-500 text-sm">Esta grilla será migrada a un Chart de tremor interactivo en la Fase 3.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
