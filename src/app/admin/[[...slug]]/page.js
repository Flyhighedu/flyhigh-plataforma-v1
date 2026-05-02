'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { supabaseNew } from '@/lib/supabaseClientNew';
import SchoolCombobox from '@/components/admin/SchoolCombobox';
import AdminLayout from '@/components/admin/AdminLayout';
import AnalyticsView from '@/components/admin/AnalyticsView';
import HRCommandCenter from '@/components/admin/HRCommandCenter';
import {
    Plane, Upload, Users, Radio, CheckCircle, AlertCircle, Loader2,
    Globe, Zap, School, Gem, FileText, Database, ArrowLeft,
    MapPin, Camera, Lock, KeyRound, ShieldCheck, Palette,
    Building2, Mail, Eye, EyeOff, Trash2, RefreshCw, Heart, Pencil, X, Calendar,
    ChevronDown, ChevronUp, UserPlus, Shield, ToggleLeft, ToggleRight, Copy, ExternalLink,
    Gamepad2, BookOpen, Package, Settings, Smartphone, DollarSign, Bot, Image
} from 'lucide-react';
import { processBackgroundRemoval } from '@/lib/bgRemover';
import FlyerDownloadModal from '@/components/flyers/FlyerDownloadModal';

import SandboxEscuelasPage from '@/app/sandbox-escuelas/page';
import SandboxVuelosPage from '@/app/sandbox-vuelos/page';
import SandboxCronogramaPage from '@/app/sandbox-cronograma/page';
import SandboxHRPage from '@/app/sandbox-hr/page';
import SandboxPatrocinadoresPage from '@/app/sandbox-patrocinadores/page';
import SandboxCRMPage from '@/app/sandbox-crm/page';
import CRMEscuelasPage from '@/app/admin/crm/page';
import ImprimiblesPage from '@/app/admin/imprimibles/page';
import { useRouter, usePathname } from 'next/navigation';

// Dynamic import to prevent hydration mismatch (DashboardPage uses window.location)
const DashboardPage = dynamic(() => import('@/app/dashboard/page'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-[400px] bg-slate-100">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
    )
});

// Auth is now handled server-side via /api/admin-auth cookie

export default function AdminPage() {
    // ============================================
    // TODOS LOS HOOKS DEBEN IR AL INICIO
    // ============================================
    const router = useRouter();
    const pathname = usePathname();

    const [isMounted, setIsMounted] = useState(false);

    // --- ESTADO DE TABS ---
    const pathParts = pathname.split('/').filter(Boolean);
    const activeTab = pathParts.length > 1 ? pathParts[1] : 'bd';
    const isAuthenticated = true; // Authenticated by layout
    const setIsAuthenticated = () => {};

    const setActiveTab = (tab) => {
        router.push(`/admin/${tab}`);
    };

    // New state for embedded dashboard preview
    const [showDashboardPreview, setShowDashboardPreview] = useState(false);
    // --- ESTADO PARA LA SECCIÓN "BASES DE DATOS" ---
    const [dbView, setDbView] = useState('menu'); // 'menu' | 'catalogo' | 'vuelos'
    const [isExitingDB, setIsExitingDB] = useState(false);

    // --- ESTADO PARA DESCARGA DE FLYERS ---
    const [showFlyerModal, setShowFlyerModal] = useState(false);
    const [flyerSchoolData, setFlyerSchoolData] = useState(null);

    // --- SINCRONIZADOR PIXEL-PERFECT DEL MASCOT AL SCROLL ---
    useEffect(() => {
        if (!isMounted || activeTab !== 'operativos') return;
        
        let frameId;
        const syncMascot = () => {
            const anchor = document.getElementById('operativos-mascot-anchor');
            const mascot = document.getElementById('portal-mascot-container');
            if (anchor && mascot) {
                const rect = anchor.getBoundingClientRect();
                // -250px offset to let it peek down slightly more from the top browser edge.
                mascot.style.transform = `translate3d(${rect.left}px, ${rect.top - 250}px, 0)`;
            }
            frameId = requestAnimationFrame(syncMascot);
        };
        
        syncMascot();
        return () => { if (frameId) cancelAnimationFrame(frameId); };
    }, [isMounted, activeTab]);



    // --- GLOBAL STYLES ---
    const globalStyles = (
        <style dangerouslySetInnerHTML={{
            __html: `
            :root {
                --neu-bg: #f8fafc; /* Ultra White background (slate-50) */
                --neu-surface: #ffffff; /* Pure White components */
                --neu-shadow-light: #ffffff;
                --neu-shadow-dark: #e2e8f0; /* Softer, elegant shadow */
                --neu-text: #1e293b;
                --neu-text-sub: #64748b;
                --neu-accent: #0ea5e9; /* Premium cyan */
            }
            .dark {
                --neu-bg: #0f172a;
                --neu-surface: #1e293b;
                --neu-shadow-light: #00000040;
                --neu-shadow-dark: #00000099;
                --neu-text: #f8fafc;
                --neu-text-sub: #94a3b8;
                --neu-accent: #38bdf8;
            }

            .neu-bg-screen {
                background-color: var(--neu-bg);
                color: var(--neu-text);
            }

            @keyframes premiumFadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(15px) scale(0.99);
                    filter: blur(4px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                    filter: blur(0);
                }
            }
            .animate-premium-in {
                animation: premiumFadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                will-change: opacity, transform, filter;
            }

            @keyframes premiumFadeOutDown {
                from {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                    filter: blur(0);
                }
                to {
                    opacity: 0;
                    transform: translateY(15px) scale(0.99);
                    filter: blur(4px);
                }
            }
            .animate-premium-out {
                animation: premiumFadeOutDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                will-change: opacity, transform, filter;
            }

            /* Container Panels */
            .neu-card {
                background: var(--neu-surface);
                box-shadow: 12px 12px 24px var(--neu-shadow-dark), 
                           -12px -12px 24px var(--neu-shadow-light);
                border-radius: 24px;
                border: 1px solid rgba(255, 255, 255, 0.8);
            }
            .dark .neu-card {
                border: 1px solid rgba(255, 255, 255, 0.05);
            }

            /* Inset Inputs (Hundidos) */
            .neu-input-inset {
                background: var(--neu-bg);
                box-shadow: inset 4px 4px 8px var(--neu-shadow-dark),
                            inset -4px -4px 8px var(--neu-shadow-light);
                border: 1px solid transparent;
                border-radius: 12px;
                color: var(--neu-text);
                transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .neu-input-inset:focus-within, .neu-input-inset:active {
                box-shadow: inset 5px 5px 10px var(--neu-shadow-dark),
                            inset -5px -5px 10px var(--neu-shadow-light);
                border-color: var(--neu-accent);
                outline: none;
            }
            .neu-input-inset::placeholder {
                color: var(--neu-text-sub);
                opacity: 0.7;
            }

            /* List Item Cards (Salidos/Botones suaves) */
            .neu-list-item {
                background: var(--neu-surface);
                box-shadow: 6px 6px 12px var(--neu-shadow-dark),
                           -6px -6px 12px var(--neu-shadow-light);
                border-radius: 16px;
                border: 1px solid rgba(255, 255, 255, 0.8);
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .dark .neu-list-item {
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            .neu-list-item:hover {
                transform: translateY(-4px);
                box-shadow: 10px 10px 20px var(--neu-shadow-dark),
                           -10px -10px 20px var(--neu-shadow-light);
            }
            .neu-list-item:active {
                transform: scale(0.97) translateY(0);
                box-shadow: 2px 2px 5px var(--neu-shadow-dark),
                           -2px -2px 5px var(--neu-shadow-light);
            }

            /* Selectors & Text */
            .neu-action-select {
                appearance: none;
                background: var(--neu-surface);
                box-shadow: inset 2px 2px 5px var(--neu-shadow-dark),
                            inset -2px -2px 5px var(--neu-shadow-light);
                border-radius: 12px;
                padding: 6px 12px;
                font-size: 0.75rem;
                font-weight: 700;
                color: var(--neu-text);
                border: none;
                outline: none;
                cursor: pointer;
            }
            .neu-text {
                color: var(--neu-text);
            }
            .neu-text-sub {
                color: var(--neu-text-sub);
            }
            `
        }} />
    );

    // --- ESTADO DE CRONOGRAMA (Próximas Escuelas) ---
    const [nextSchools, setNextSchools] = useState([]);
    const [nextSchoolForm, setNextSchoolForm] = useState({
        nombre_escuela: '',
        colonia: '',
        fecha_programada: '',
        cct: '',
        turno: '',
        nombre_director: '',
        telefono_director: '',
        numero_ninos: '',
        cuota_alumno: ''
    });
    const [nextSchoolLoading, setNextSchoolLoading] = useState(false);
    const [fetchingNextSchools, setFetchingNextSchools] = useState(false);
    const [editingSchoolId, setEditingSchoolId] = useState(null);

    // --- ESTADO DE FECHAS DISPONIBLES (Bot WhatsApp) ---
    const [availableDates, setAvailableDates] = useState([]);
    const [fetchingDates, setFetchingDates] = useState(false);
    const [newDateForm, setNewDateForm] = useState({ fecha: '', notas: '' });
    const [addingDate, setAddingDate] = useState(false);
    
    // Auto-Scheduler & Filters
    const [dateFilter, setDateFilter] = useState('proximas'); // 'proximas' | 'ganadas' | 'perdidas'
    const [autoScheduleEnabled, setAutoScheduleEnabled] = useState(false);
    const [isAutoScheduling, setIsAutoScheduling] = useState(false);

    // --- ESTADO DEL CATÁLOGO DE ESCUELAS ---
    const [catalogoEscuelas, setCatalogoEscuelas] = useState([]);
    const [catalogoLoading, setCatalogoLoading] = useState(false);
    const [selectedCatalogoSchool, setSelectedCatalogoSchool] = useState(null);

    const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);



    // --- ESTADO DE PATROCINADORES ---
    const [sponsorForm, setSponsorForm] = useState({
        nombre: '',
        email: '',
        password: '',
        aportacion: '', // Nuevo campo para inversión
        logo_url: null,
        mantener_logo_original: false
    });
    const [sponsors, setSponsors] = useState([]);
    const [sponsorLoading, setSponsorLoading] = useState(false);
    const [sponsorMessage, setSponsorMessage] = useState({ type: '', text: '' });
    const [fetchingSponsors, setFetchingSponsors] = useState(true);
    const [showPasswords, setShowPasswords] = useState(false);
    const [editingSponsorId, setEditingSponsorId] = useState(null);
    const [isProcessingLogo, setIsProcessingLogo] = useState(false);
    const [logoProgress, setLogoProgress] = useState("");

    // --- ESTADO DE IMPACTO DE BECAS REMOVIDO (Calculado desde SSoT) ---

    // --- ESTADO DE OPERATIVOS (Staff) ---
    const [staffList, setStaffList] = useState([]);
    const [fetchingStaff, setFetchingStaff] = useState(false);
    const [staffForm, setStaffForm] = useState({ full_name: '', email: '', password: '', role: 'assistant' });
    const [staffLoading, setStaffLoading] = useState(false);
    const [staffMessage, setStaffMessage] = useState({ type: '', text: '' });
    const [resetPassForm, setResetPassForm] = useState({ user_id: null, new_password: '' });
    const [revealedPasswords, setRevealedPasswords] = useState({});
    const [showStaffPasswords, setShowStaffPasswords] = useState(false);
    const [editForm, setEditForm] = useState({ user_id: null, email: '', full_name: '', role: '' });
    const [editLoading, setEditLoading] = useState(false);



    // Fetch staff para que se pueda llamar si es necesario
    const fetchStaffList = async () => {
        setFetchingStaff(true);
        try {
            const res = await fetch('/api/staff/list');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error fetching staff');
            setStaffList(data.staff || []);
        } catch (err) {
            console.error('Error fetching staff:', err);
        } finally {
            setFetchingStaff(false);
        }
    };

    // --- EFFECTS ---
    // Verificar si ya está autenticado (cookie)
    useEffect(() => {
        setIsMounted(true); // Hydration fix
        const hasCookie = document.cookie.includes('flyhigh_admin_auth=');
        if (hasCookie) setIsAuthenticated(true);
        const storedAutopilot = localStorage.getItem('flyhigh_autopilot_fechas');
        if (storedAutopilot === 'true') setAutoScheduleEnabled(true);
    }, []);

    // Fetch tab-specific data on tab switch
    useEffect(() => {
        if (!isAuthenticated) return;
        if (activeTab === 'operativos') {
            fetchStaffList();
        } else if (activeTab === 'cronograma') {
            if (typeof fetchReports === 'function') fetchReports();
        }
    }, [activeTab, isAuthenticated]);



    // Cargar patrocinadores y cronograma al montar
    useEffect(() => {
        if (!isAuthenticated) return;
        fetchSponsors();
        fetchNextSchools();
        fetchCatalogoEscuelas();
        fetchAvailableDates();
    }, [isAuthenticated]);

    // --- EFECTOS PARA PERSISTENCIA (Borrador) ---
    useEffect(() => {
        if (!isMounted) return;
        try {
            const savedData = localStorage.getItem('flyhigh_draft_school_form');
            if (savedData) {
                const parsed = JSON.parse(savedData);
                if (parsed.form) setNextSchoolForm(parsed.form);
                if (parsed.editingId) setEditingSchoolId(parsed.editingId);
            }
        } catch (e) {
            console.warn('Error reading draft from localStorage:', e);
        }
    }, [isMounted]);

    useEffect(() => {
        if (!isMounted) return;
        const hasData = Object.values(nextSchoolForm).some(v => v !== '');
        if (hasData || editingSchoolId) {
            localStorage.setItem('flyhigh_draft_school_form', JSON.stringify({
                form: nextSchoolForm,
                editingId: editingSchoolId
            }));
        } else {
            localStorage.removeItem('flyhigh_draft_school_form');
        }
    }, [nextSchoolForm, editingSchoolId, isMounted]);

    // Restaurar selección en catálogo si la escuela del borrador tiene CCT
    useEffect(() => {
        if (catalogoEscuelas.length > 0 && nextSchoolForm.cct && !selectedCatalogoSchool) {
            const catalogMatch = catalogoEscuelas.find(s => s.cct === nextSchoolForm.cct);
            if (catalogMatch) setSelectedCatalogoSchool(catalogMatch);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catalogoEscuelas, nextSchoolForm.cct]);

    // Fetch catálogo oficial de escuelas
    const fetchCatalogoEscuelas = async () => {
        setCatalogoLoading(true);
        try {
            const res = await fetch('/api/admin/catalogo-escuelas');
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Error fetching catalogo');
            setCatalogoEscuelas(result.data || []);
        } catch (err) {
            console.error('Error fetching catalogo_escuelas:', err);
        } finally {
            setCatalogoLoading(false);
        }
    };



    // Fetch próximas escuelas (via API to bypass RLS)
    const fetchNextSchools = async (silent = false) => {
        if (!silent) setFetchingNextSchools(true);
        try {
            const res = await fetch('/api/admin/list-schools', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }});
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Error fetching schools');
            setNextSchools(result.data || []);
        } catch (err) {
            console.error('Error fetching next schools:', err);
        } finally {
            if (!silent) setFetchingNextSchools(false);
        }
    };

    // Auto-polling para Próximas Misiones en tiempo real
    useEffect(() => {
        if (!isAuthenticated || activeTab !== 'cronograma') return;
        const interval = setInterval(() => { fetchNextSchools(true); fetchAvailableDates(true); }, 2500);
        return () => clearInterval(interval);
    }, [isAuthenticated, activeTab]);

    // --- CRUD FECHAS DISPONIBLES ---
    const fetchAvailableDates = async (silent = false) => {
        if (!silent) setFetchingDates(true);
        try {
            const res = await fetch('/api/sandbox-fechas', { cache: 'no-store' });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Error');
            setAvailableDates(result.data || []);
        } catch (err) {
            console.error('Error fetching available dates:', err);
        } finally {
            if (!silent) setFetchingDates(false);
        }
    };

    const handleAddDate = async (e) => {
        e.preventDefault();
        if (!newDateForm.fecha) return;
        setAddingDate(true);
        try {
            const res = await fetch('/api/sandbox-fechas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fecha: newDateForm.fecha, cupo_maximo: 2, notas: newDateForm.notas || null }),
            });
            if (!res.ok) { const r = await res.json(); throw new Error(r.error); }
            setNewDateForm({ fecha: '', notas: '' });
            fetchAvailableDates();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setAddingDate(false);
        }
    };

    const handleToggleDate = async (id, value, field = 'activa') => {
        try {
            await fetch('/api/sandbox-fechas', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, field, value }),
            });
            fetchAvailableDates();
        } catch (err) {
            console.error('Error toggling date:', err);
        }
    };

    const handleDeleteDate = async (id) => {
        if (!confirm('¿Eliminar este día disponible? Esta acción es irreversible.')) return;
        try {
            const res = await fetch(`/api/sandbox-fechas?id=${id}`, { method: 'DELETE' });
            if (!res.ok) { const r = await res.json(); throw new Error(r.error); }
            fetchAvailableDates();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const runAutoSchedule = async (currentDates = availableDates) => {
        if (isAutoScheduling) return;
        setIsAutoScheduling(true);
        try {
            const today = new Date();
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 21); // Hasta 3 semanas desde HOY.
            
            let dateCursor = new Date(); // Start filling from today
            dateCursor.setHours(12, 0, 0, 0);

            const datesToAdd = [];
            while (dateCursor <= targetDate) {
                const dayOfWeek = dateCursor.getDay(); // 0 = Sunday, 6 = Saturday
                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                    const isoStr = dateCursor.toISOString().split('T')[0];
                    const exists = currentDates.some(d => d.fecha === isoStr);
                    if (!exists) datesToAdd.push(isoStr);
                }
                dateCursor.setDate(dateCursor.getDate() + 1);
            }

            if (datesToAdd.length > 0) {
                console.log('Auto-scheduler inyectando fechas faltantes:', datesToAdd);
                for (const d of datesToAdd) {
                    await fetch('/api/sandbox-fechas', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fecha: d, cupo_maximo: 2, notas: 'Piloto Automático' }),
                    });
                }
                fetchAvailableDates(); // Refrescar todas
            }
        } catch (err) {
            console.error('Error auto-scheduling:', err);
        } finally {
            setIsAutoScheduling(false);
        }
    };

    const handleToggleAutoSchedule = () => {
        const newVal = !autoScheduleEnabled;
        setAutoScheduleEnabled(newVal);
        localStorage.setItem('flyhigh_autopilot_fechas', newVal ? 'true' : 'false');
        if (newVal) runAutoSchedule(availableDates);
    };

    // Monitor AutoSchedule (Bug eliminado: No usar useEffect atado a length)

    const fetchSponsors = async () => {
        setFetchingSponsors(true);
        try {
            const { data, error } = await supabaseNew
                .from('patrocinadores')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                // Si la tabla no existe, no es un error crítico
                if (error.code === '42P01' || error.message?.includes('does not exist')) {
                    console.warn('Tabla patrocinadores no existe aún. Créala en Supabase.');
                    setSponsors([]);
                    return;
                }
                throw error;
            }
            setSponsors(data || []);
        } catch (err) {
            console.warn('Error fetching sponsors (tabla puede no existir):', err);
            setSponsors([]);
        } finally {
            setFetchingSponsors(false);
        }
    };

    // ============================================
    // HANDLERS
    // ============================================

    // Handler de Login — server-side validation via API
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError('');

        try {
            const res = await fetch('/api/admin-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            if (res.ok) {
                setIsAuthenticated(true);
            } else {
                const data = await res.json();
                setLoginError(data.error || 'Contraseña incorrecta. Intenta de nuevo.');
            }
        } catch (err) {
            setLoginError('Error de conexión. Intenta de nuevo.');
        } finally {
            setLoginLoading(false);
        }
    };



    const handleNextSchoolSubmit = async (e) => {
        e.preventDefault();

        // Validate that a school from the catalog is selected
        if (!selectedCatalogoSchool && !editingSchoolId) {
            alert('Selecciona una escuela del catálogo');
            return;
        }

        setNextSchoolLoading(true);
        try {
            const payload = {
                nombre_escuela: selectedCatalogoSchool?.nombre_escuela || nextSchoolForm.nombre_escuela,
                colonia: nextSchoolForm.colonia,
                fecha_programada: nextSchoolForm.fecha_programada,
                cct: selectedCatalogoSchool?.cct || nextSchoolForm.cct || null,
                turno: selectedCatalogoSchool?.turno || nextSchoolForm.turno || null,
                nombre_director: nextSchoolForm.nombre_director || null,
                telefono_director: nextSchoolForm.telefono_director || null,
                numero_ninos: nextSchoolForm.numero_ninos ? parseInt(nextSchoolForm.numero_ninos, 10) : null,
                precio: nextSchoolForm.cuota_alumno ? parseFloat(nextSchoolForm.cuota_alumno) : null,
            };

            if (editingSchoolId) {
                payload.id = editingSchoolId;
            }

            const res = await fetch('/api/admin/save-school', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Error del servidor');

            if (editingSchoolId) {
                setNextSchools(prev => prev.map(s => s.id === editingSchoolId ? result.data : s));
                setEditingSchoolId(null);
                alert('Misión actualizada exitosamente');
            } else {
                setNextSchools(prev => [...prev, result.data]);
                // Offer flyer download for new missions
                const wantsFlyers = confirm('✅ Escuela programada exitosamente.\n\n¿Deseas descargar el material personalizado (flyers) para esta escuela?');
                if (wantsFlyers) {
                    setFlyerSchoolData({
                        nombre_escuela: payload.nombre_escuela,
                        fecha_programada: payload.fecha_programada,
                        cuota_alumno: payload.precio || 50,
                        tarifa_base: 100,
                    });
                    setShowFlyerModal(true);
                }
            }

            setNextSchoolForm({ nombre_escuela: '', colonia: '', fecha_programada: '', cct: '', turno: '', nombre_director: '', telefono_director: '', numero_ninos: '', cuota_alumno: '' });
            setSelectedCatalogoSchool(null);
            localStorage.removeItem('flyhigh_draft_school_form');
        } catch (err) {
            console.error('Error saving next school:', err);
            alert('Error al guardar escuela: ' + (err.message || err));
        } finally {
            setNextSchoolLoading(false);
        }
    };

    const handleEditNextSchool = (school) => {
        setNextSchoolForm({
            nombre_escuela: school.nombre_escuela,
            colonia: school.colonia,
            fecha_programada: school.fecha_programada,
            cct: school.cct || '',
            turno: school.turno || '',
            nombre_director: school.nombre_director || '',
            telefono_director: school.telefono_director || '',
            numero_ninos: school.numero_ninos || '',
            cuota_alumno: school.cuota_alumno || ''
        });
        // Try to find and pre-select the school from catalogo
        if (school.cct) {
            const catalogMatch = catalogoEscuelas.find(s => s.cct === school.cct);
            setSelectedCatalogoSchool(catalogMatch || null);
        } else {
            setSelectedCatalogoSchool(null);
        }
        setEditingSchoolId(school.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleOpenFlyerModalFromCard = async (school) => {
        let updatedSchool = { ...school };
        let needsUpdate = false;

        if (!updatedSchool.nombre_escuela) {
            const val = prompt("Falta: Nombre de la escuela");
            if (!val) return;
            updatedSchool.nombre_escuela = val;
            needsUpdate = true;
        }
        if (!updatedSchool.fecha_programada) {
            const val = prompt("Falta: Fecha programada (YYYY-MM-DD)");
            if (!val) return;
            updatedSchool.fecha_programada = val;
            needsUpdate = true;
        }
        // Use cuota_alumno or precio
        if (updatedSchool.cuota_alumno == null && updatedSchool.precio == null) {
            const val = prompt("Falta: Cuota Alumno/Precio ($)");
            if (!val) return;
            updatedSchool.precio = parseFloat(val) || 50;
            needsUpdate = true;
        }

        if (needsUpdate) {
            try {
                const payload = {
                    id: updatedSchool.id,
                    nombre_escuela: updatedSchool.nombre_escuela,
                    fecha_programada: updatedSchool.fecha_programada,
                    precio: updatedSchool.precio || updatedSchool.cuota_alumno
                };
                
                await fetch('/api/admin/save-school', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                fetchNextSchools(true);
            } catch (e) {
                console.error("Error actualizando datos faltantes", e);
                alert("Error al guardar datos faltantes, pero abriremos el flyer temporalmente.");
            }
        }

        setFlyerSchoolData({
            nombre_escuela: updatedSchool.nombre_escuela,
            fecha_programada: updatedSchool.fecha_programada,
            cuota_alumno: updatedSchool.precio || updatedSchool.cuota_alumno || 50,
            tarifa_base: 100 // Admin dashboard legacy default
        });
        setShowFlyerModal(true);
    };

    const handleCancelNextSchoolEdit = () => {
        setNextSchoolForm({ nombre_escuela: '', colonia: '', fecha_programada: '', cct: '', turno: '', nombre_director: '', telefono_director: '', numero_ninos: '', cuota_alumno: '' });
        setSelectedCatalogoSchool(null);
        setEditingSchoolId(null);
        localStorage.removeItem('flyhigh_draft_school_form');
    };

    const handleCompleteNextSchool = async (id, currentStatus) => {
        // Optimistic UI Update
        const newStatus = currentStatus === 'completada' ? 'pendiente' : 'completada';
        setNextSchools(prev => prev.map(s => s.id === id ? { ...s, estatus: newStatus } : s));

        try {
            const { error } = await supabaseNew
                .from('proximas_escuelas')
                .update({ estatus: newStatus })
                .eq('id', id);

            if (error) throw error;
        } catch (err) {
            console.error('Error updating status:', err);
            // Revert optimistic update
            setNextSchools(prev => prev.map(s => s.id === id ? { ...s, estatus: currentStatus } : s));
        }
    };

    const handleDeleteNextSchool = async (id) => {
        if (!confirm('Tierra Arrasada: ¿Estás seguro de que deseas ELIMINAR permanentemente a esta misión del Cronograma logístico? Esta acción es irreversible.')) return;

        // Optimistic UI Update
        const previousSchools = [...nextSchools];
        setNextSchools(prev => prev.filter(s => s.id !== id));

        try {
            const res = await fetch('/api/admin/delete-school', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Error del servidor');
        } catch (err) {
            console.error('Error deleting school:', err);
            // Revert
            setNextSchools(previousSchools);
            alert('Error al archivar: ' + (err.message || err));
        }
    };



    // Handlers de patrocinadores
    const handleSponsorInputChange = (e) => {
        const { name, value } = e.target;
        setSponsorForm(prev => ({ ...prev, [name]: value }));
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona un archivo de imagen válido.');
            return;
        }

        setIsProcessingLogo(true);
        setLogoProgress("Iniciando...");

        try {
            // 1. Process with AI to remove background and convert to WebP
            const webpBlob = await processBackgroundRemoval(file, setLogoProgress);

            // 2. Upload to Supabase Storage
            setLogoProgress("Subiendo a la nube...");
            
            const filename = `logo_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;

            const { data, error } = await supabaseNew.storage
                .from('sponsor-logos')
                .upload(filename, webpBlob, {
                    contentType: 'image/webp',
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // 3. Get public URL
            const { data: publicUrlData } = supabaseNew.storage
                .from('sponsor-logos')
                .getPublicUrl(filename);
                
            // 4. Update form state
            setSponsorForm(prev => ({ ...prev, logo_url: publicUrlData.publicUrl }));
            setLogoProgress("");

        } catch (err) {
            console.error('Logo process error:', err);
            alert('Error al procesar el logo: ' + err.message);
            setLogoProgress("");
        } finally {
            setIsProcessingLogo(false);
        }
    };

    const handleSponsorSubmit = async (e) => {
        e.preventDefault();
        setSponsorLoading(true);
        setSponsorMessage({ type: '', text: '' });

        try {
            if (editingSponsorId) {
                // MODIFICACIÓN: Actualizar patrocinador existente
                const { error } = await supabaseNew
                    .from('patrocinadores')
                    .update({
                        nombre: sponsorForm.nombre,
                        email: sponsorForm.email,
                        password: sponsorForm.password,
                        aportacion_total: parseFloat(sponsorForm.aportacion) || 0,
                        logo_url: sponsorForm.logo_url || null,
                        mantener_logo_original: sponsorForm.mantener_logo_original
                    })
                    .eq('id', editingSponsorId);

                if (error) throw new Error(`Error actualizando patrocinador: ${error.message}`);
                setSponsorMessage({ type: 'success', text: '¡Patrocinador actualizado exitosamente!' });
            } else {
                // CREACIÓN: Nuevo patrocinador
                const { error } = await supabaseNew
                    .from('patrocinadores')
                    .insert({
                        nombre: sponsorForm.nombre,
                        email: sponsorForm.email,
                        password: sponsorForm.password,
                        aportacion_total: parseFloat(sponsorForm.aportacion) || 0,
                        logo_url: sponsorForm.logo_url || null,
                        mantener_logo_original: sponsorForm.mantener_logo_original
                    });

                if (error) throw new Error(`Error guardando patrocinador: ${error.message}`);
                setSponsorMessage({ type: 'success', text: '¡Patrocinador registrado exitosamente!' });
            }

            setSponsorForm({ nombre: '', email: '', password: '', aportacion: '', logo_url: null, mantener_logo_original: false });
            setEditingSponsorId(null); // Resetear modo edición
            fetchSponsors(); // Recargar lista

        } catch (err) {
            console.error(err);
            setSponsorMessage({ type: 'error', text: err.message });
        } finally {
            setSponsorLoading(false);
        }
    };

    const handleEditSponsor = (sponsor) => {
        setEditingSponsorId(sponsor.id);
        setSponsorForm({
            nombre: sponsor.nombre,
            email: sponsor.email,
            password: sponsor.password,
            aportacion: sponsor.aportacion_total || '',
            logo_url: sponsor.logo_url || null,
            mantener_logo_original: sponsor.mantener_logo_original || false
        });
        setSponsorMessage({ type: '', text: '' });
        // Auto-scroll smooth inmediato a la tarjeta de edición sin cooldown de renderización
        setTimeout(() => {
            const formSection = document.getElementById('sponsor-form-section');
            if (formSection) {
                // block: 'start' para empujar la pantalla arriba garantizando la vista
                formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 10);
    };

    const handleCancelEdit = () => {
        setEditingSponsorId(null);
        setSponsorForm({ nombre: '', email: '', password: '', aportacion: '', logo_url: null, mantener_logo_original: false });
        setSponsorMessage({ type: '', text: '' });
    };

    const handleDeleteSponsor = async (id) => {
        if (!confirm('¿Eliminar este patrocinador?')) return;

        try {
            const { error } = await supabaseNew
                .from('patrocinadores')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchSponsors();
        } catch (err) {
            console.error('Error deleting sponsor:', err);
            alert('Error al eliminar');
        }
    };





    // ============================================
    // RENDER
    // ============================================

    // --- HYDRATION GUARD ---
    if (!isMounted) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--neu-bg)' }}>
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            </div>
        );
    }

    // --- FUNCIONES DE OPERATIVOS ---
    // (Movido hacia arriba para que esté disponible en useEffect)

    const generatePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let pass = '';
        for (let i = 0; i < 10; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
        setStaffForm(prev => ({ ...prev, password: pass }));
    };

    const handleCreateStaff = async (e) => {
        e.preventDefault();
        setStaffLoading(true);
        setStaffMessage({ type: '', text: '' });

        try {
            const res = await fetch('/api/staff/create-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(staffForm)
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error creando usuario');

            setStaffMessage({ type: 'success', text: `✅ ${data.user.full_name} creado exitosamente como ${data.user.role}` });
            setStaffForm({ full_name: '', email: '', password: '', role: 'assistant' });
            fetchStaffList();
        } catch (err) {
            setStaffMessage({ type: 'error', text: err.message });
        } finally {
            setStaffLoading(false);
        }
    };

    const handleResetStaffPassword = async (userId) => {
        const pwd = resetPassForm.new_password;
        if (!pwd || pwd.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        try {
            const res = await fetch('/api/staff/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, new_password: pwd })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert('✅ Contraseña actualizada correctamente');
            setResetPassForm({ user_id: null, new_password: '' });
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const handleToggleStaffActive = async (userId, currentActive) => {
        const action = currentActive ? 'desactivar' : 'activar';
        if (!confirm(`¿Seguro que quieres ${action} este operativo?`)) return;
        try {
            const res = await fetch('/api/staff/set-active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, is_active: !currentActive })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            fetchStaffList();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const handleEditStaff = async () => {
        if (!editForm.user_id) return;
        setEditLoading(true);
        try {
            const payload = { user_id: editForm.user_id };
            if (editForm.email) payload.email = editForm.email;
            if (editForm.full_name) payload.full_name = editForm.full_name;
            if (editForm.role) payload.role = editForm.role;

            const res = await fetch('/api/staff/edit-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert('✅ Perfil actualizado correctamente');
            setEditForm({ user_id: null, email: '', full_name: '', role: '' });
            fetchStaffList();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setEditLoading(false);
        }
    };

    // --- PANEL DE ADMINISTRACIÓN ---
    return (
        <>
            {/* CONTENIDO DE TABS */}
            
            {/* TAB: BASES DE DATOS (IMPORTACIÓN DE SANDBOXES) */}
            {/* All extracted tabs have been removed from here. */}
            {activeTab.startsWith('analytics-') && (
                <AnalyticsView activeTab={activeTab} setActiveTab={setActiveTab} />
            )}

            {/* FOOTER - Hidden for full-canvas tabs */}
            {activeTab !== 'crm' && activeTab !== 'crm-escuelas' && (
                <footer className="max-w-5xl mx-auto mt-12 pb-8 text-center text-slate-500 text-xs">
                    <p>Panel de Administración · Fly High Edu · {new Date().getFullYear()}</p>
                </footer>
            )}

        {/* Flyer Download Modal */}
        {showFlyerModal && flyerSchoolData && (
            <FlyerDownloadModal
                schoolData={flyerSchoolData}
                onClose={() => { setShowFlyerModal(false); setFlyerSchoolData(null); }}
            />
        )}
        </>
    );
}
