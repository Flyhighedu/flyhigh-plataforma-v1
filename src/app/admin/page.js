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

// Dynamic import to prevent hydration mismatch (DashboardPage uses window.location)
const DashboardPage = dynamic(() => import('../dashboard/page'), {
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

    // --- ESTADO DE AUTENTICACIÓN ---
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false); // Fix hydration mismatch

    // --- ESTADO DE TABS ---
    const [activeTab, setActiveTab] = useState('bd'); // Starts on database tab now
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
            <div className="min-h-screen neu-bg-screen flex items-center justify-center p-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            </div>
        );
    }

    // --- PANTALLA DE LOGIN ---
    if (!isAuthenticated) {
        return (
            <main className="min-h-screen neu-bg-screen flex items-center justify-center p-4">
                {globalStyles}
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl shadow-lg shadow-blue-500/30 mb-6">
                            <ShieldCheck className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2 neu-text">
                            Acceso <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Restringido</span>
                        </h1>
                        <p className="neu-text-sub text-sm">Panel de Administración · Fly High Edu</p>
                    </div>

                    <div className="neu-card p-10 max-w-md w-full relative z-10 text-center">
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold neu-text-sub uppercase tracking-wider mb-3">
                                    <KeyRound size={14} /> Contraseña de Administrador
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 neu-text-sub" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        placeholder="Ingresa la contraseña"
                                        className="w-full neu-input-inset pl-12 pr-4 py-4 focus:ring-2 focus:ring-blue-500 transition-all font-mono tracking-widest"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {loginError && (
                                <div className="flex items-center gap-2 p-3 rounded-xl text-sm bg-red-500/20 text-red-300 border border-red-500/30">
                                    <AlertCircle size={16} />
                                    {loginError}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loginLoading || !password}
                                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loginLoading ? (
                                    <><Loader2 size={18} className="animate-spin" /> Verificando...</>
                                ) : (
                                    <><Lock size={18} /> Ingresar al Panel</>
                                )}
                            </button>
                        </form>
                    </div>

                    <p className="text-center text-slate-600 text-xs mt-6">
                        Acceso exclusivo para administradores autorizados.
                    </p>
                </div>
            </main>
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
        <AdminLayout
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isAuthenticated={isAuthenticated}
            onLogout={async () => {
                await fetch('/api/admin-auth', { method: 'DELETE' });
                setIsAuthenticated(false);
                setPassword('');
            }}
        >
            {globalStyles}
            {/* CONTENIDO DE TABS */}
            
            {/* TAB: BASES DE DATOS (IMPORTACIÓN DE SANDBOXES) */}
            {activeTab === 'bd' && (
                <div className="animate-premium-in w-full">
                    {dbView === 'menu' && (
                        <div className="max-w-6xl mx-auto space-y-8">
                            <div className="mb-6">
                                <h1 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                                    <Database className="w-8 h-8 text-rose-500" />
                                    <span>Bases de Datos <span className="text-rose-500">Maestras</span></span>
                                </h1>
                                <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">
                                    Acceso directo a las fuentes de verdad (Catálogos históricos y operacionales).
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 md:gap-8">
                                {/* Catálogo de Escuelas Card */}
                                <button 
                                    onClick={() => setDbView('catalogo')}
                                    className="neu-card group text-left p-8 xl:p-10 relative overflow-hidden transition-all duration-500 hover:-translate-y-3 min-h-[360px] flex flex-col justify-between"
                                    style={{ 
                                        backgroundColor: '#f43f5e',
                                        boxShadow: '12px 12px 24px rgba(0,0,0,0.15), -12px -12px 24px rgba(255,255,255,1)'
                                    }}
                                >
                                    <School className="absolute -right-8 -bottom-8 w-[280px] h-[280px] text-white opacity-[0.12] group-hover:opacity-[0.18] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none" />
                                    
                                    <div className="relative z-10 mt-2">
                                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-4 group-hover:scale-[1.02] origin-left transition-transform">
                                            Catálogo de Escuelas
                                        </h2>
                                        <p className="text-rose-100 text-sm md:text-base font-medium leading-relaxed line-clamp-4 pr-2">
                                            Registros base (CCT) de las instituciones e historial del padrón activo a nivel municipio.
                                        </p>
                                    </div>
                                    
                                    <div className="inline-flex items-center gap-3 text-white font-black text-xs md:text-sm tracking-widest uppercase transition-all transform group-hover:translate-x-2 relative z-10 mt-8">
                                        <span>Explorar</span>
                                        <div className="w-8 h-1 bg-white/40 rounded-full transition-all duration-500 group-hover:w-16 group-hover:bg-white relative flex items-center">
                                            <ArrowLeft className="w-5 h-5 text-white absolute -right-3 rotate-180 opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:-right-5" />
                                        </div>
                                    </div>
                                </button>

                                {/* Historial de Vuelos Card */}
                                <button 
                                    onClick={() => setDbView('vuelos')}
                                    className="neu-card group text-left p-8 xl:p-10 relative overflow-hidden transition-all duration-500 hover:-translate-y-3 min-h-[360px] flex flex-col justify-between"
                                    style={{ 
                                        backgroundColor: '#0ea5e9',
                                        boxShadow: '12px 12px 24px rgba(0,0,0,0.15), -12px -12px 24px rgba(255,255,255,1)'
                                    }}
                                >
                                    <Plane className="absolute -right-8 -bottom-8 w-[280px] h-[280px] text-white opacity-[0.12] group-hover:opacity-[0.18] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none" />
                                    
                                    <div className="relative z-10 mt-2">
                                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-4 group-hover:scale-[1.02] origin-left transition-transform">
                                            Archivo Histórico
                                        </h2>
                                        <p className="text-sky-100 text-sm md:text-base font-medium leading-relaxed line-clamp-4 pr-2">
                                            Desglose maestro de operaciones de vuelo, registros de asistencia y estatus.
                                        </p>
                                    </div>
                                    
                                    <div className="inline-flex items-center gap-3 text-white font-black text-xs md:text-sm tracking-widest uppercase transition-all transform group-hover:translate-x-2 relative z-10 mt-8">
                                        <span>Inspeccionar</span>
                                        <div className="w-8 h-1 bg-white/40 rounded-full transition-all duration-500 group-hover:w-16 group-hover:bg-white relative flex items-center">
                                            <ArrowLeft className="w-5 h-5 text-white absolute -right-3 rotate-180 opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:-right-5" />
                                        </div>
                                    </div>
                                </button>

                                {/* Cronograma Sandbox Card */}
                                <button 
                                    onClick={() => setDbView('cronograma')}
                                    className="neu-card group text-left p-8 xl:p-10 relative overflow-hidden transition-all duration-500 hover:-translate-y-3 min-h-[360px] flex flex-col justify-between"
                                    style={{ 
                                        backgroundColor: '#10b981',
                                        boxShadow: '12px 12px 24px rgba(0,0,0,0.15), -12px -12px 24px rgba(255,255,255,1)'
                                    }}
                                >
                                    <Calendar className="absolute -right-8 -bottom-8 w-[280px] h-[280px] text-white opacity-[0.12] group-hover:opacity-[0.18] group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 pointer-events-none" />
                                    
                                    <div className="relative z-10 mt-2">
                                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-4 group-hover:scale-[1.02] origin-left transition-transform">
                                            Cronograma
                                        </h2>
                                        <p className="text-emerald-100 text-sm md:text-base font-medium leading-relaxed line-clamp-4 pr-2">
                                            Pipeline de vuelos. Visualiza escuelas programadas, completadas y canceladas.
                                        </p>
                                    </div>
                                    
                                    <div className="inline-flex items-center gap-3 text-white font-black text-xs md:text-sm tracking-widest uppercase transition-all transform group-hover:translate-x-2 relative z-10 mt-8">
                                        <span>Desplegar</span>
                                        <div className="w-8 h-1 bg-white/40 rounded-full transition-all duration-500 group-hover:w-16 group-hover:bg-white relative flex items-center">
                                            <ArrowLeft className="w-5 h-5 text-white absolute -right-3 rotate-180 opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:-right-5" />
                                        </div>
                                    </div>
                                </button>

                                {/* Personal HR Sandbox Card */}
                                <button 
                                    onClick={() => setDbView('hr')}
                                    className="neu-card group text-left p-8 xl:p-10 relative overflow-hidden transition-all duration-500 hover:-translate-y-3 min-h-[360px] flex flex-col justify-between"
                                    style={{ 
                                        backgroundColor: '#8b5cf6',
                                        boxShadow: '12px 12px 24px rgba(0,0,0,0.15), -12px -12px 24px rgba(255,255,255,1)'
                                    }}
                                >
                                    <Users className="absolute -right-8 -bottom-8 w-[280px] h-[280px] text-white opacity-[0.12] group-hover:opacity-[0.18] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none" />
                                    
                                    <div className="relative z-10 mt-2">
                                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-4 group-hover:scale-[1.02] origin-left transition-transform">
                                            RH
                                        </h2>
                                        <p className="text-violet-100 text-sm md:text-base font-medium leading-relaxed line-clamp-4 pr-2">
                                            Base de datos dinámica de perfiles operativos. Acceso completo y depuración.
                                        </p>
                                    </div>

                                    
                                    <div className="inline-flex items-center gap-3 text-white font-black text-xs md:text-sm tracking-widest uppercase transition-all transform group-hover:translate-x-2 relative z-10 mt-8">
                                        <span>Administrar</span>
                                        <div className="w-8 h-1 bg-white/40 rounded-full transition-all duration-500 group-hover:w-16 group-hover:bg-white relative flex items-center">
                                            <ArrowLeft className="w-5 h-5 text-white absolute -right-3 rotate-180 opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:-right-5" />
                                        </div>
                                    </div>
                                </button>

                                {/* Padrón Patrocinadores Sandbox Card */}
                                <button 
                                    onClick={() => setDbView('patrocinadores')}
                                    className="neu-card group text-left p-8 xl:p-10 relative overflow-hidden transition-all duration-500 hover:-translate-y-3 min-h-[360px] flex flex-col justify-between"
                                    style={{ 
                                        backgroundColor: '#d946ef',
                                        boxShadow: '12px 12px 24px rgba(0,0,0,0.15), -12px -12px 24px rgba(255,255,255,1)'
                                    }}
                                >
                                    <Building2 className="absolute -right-8 -bottom-8 w-[280px] h-[280px] text-white opacity-[0.12] group-hover:opacity-[0.18] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 pointer-events-none" />
                                    
                                    <div className="relative z-10 mt-2">
                                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-4 group-hover:scale-[1.02] origin-left transition-transform">
                                            Patrocinadores
                                        </h2>
                                        <p className="text-fuchsia-100 text-sm md:text-base font-medium leading-relaxed line-clamp-4 pr-2">
                                            Base de datos financiera. Acceso completo al padrón de inversionistas y control de aportaciones.
                                        </p>
                                    </div>

                                    
                                    <div className="inline-flex items-center gap-3 text-white font-black text-xs md:text-sm tracking-widest uppercase transition-all transform group-hover:translate-x-2 relative z-10 mt-8">
                                        <span>Gestionar</span>
                                        <div className="w-8 h-1 bg-white/40 rounded-full transition-all duration-500 group-hover:w-16 group-hover:bg-white relative flex items-center">
                                            <ArrowLeft className="w-5 h-5 text-white absolute -right-3 rotate-180 opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:-right-5" />
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {(dbView !== 'menu' || isExitingDB) && createPortal(
                        <div className={`fixed inset-0 z-[9999] bg-white dark:bg-[#0f172a] flex flex-col overflow-hidden ${isExitingDB ? 'animate-premium-out' : 'animate-premium-in'}`}>
                            {/* Sticky Header Wrapper para Integración PWA Perfecta */}
                            <div className="shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 px-4 md:px-8 py-4 flex items-center shadow-sm z-10 w-full">
                                <button
                                    onClick={() => {
                                        if (isExitingDB) return;
                                        setIsExitingDB(true);
                                        setTimeout(() => {
                                            setDbView('menu');
                                            setIsExitingDB(false);
                                        }, 400);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-700 dark:text-slate-200 font-bold text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 group"
                                >
                                    <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                                    <span>Volver al Panel</span>
                                </button>
                                <div className="ml-auto flex items-center gap-3">
                                    <span className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        Tiempo Real
                                    </span>
                                </div>
                            </div>

                            {/* Contenedor del componente PWA Edge-to-Edge */}
                            <div className="flex-1 w-full overflow-y-auto override-sandbox-bg">
                                <style>{`
                                    /* Hack CSS para forzar que el background interno de los sandbox se funda con este takeover */
                                    .override-sandbox-bg > div {
                                        background-color: transparent !important;
                                        min-height: auto !important;
                                    }
                                `}</style>
                                {/* El datatable original ahora tiene Todo el lienzo del monitor/ipad */}
                                <div className="max-w-[100vw]">
                                    {dbView === 'catalogo' && <SandboxEscuelasPage />}
                                    {dbView === 'vuelos' && <SandboxVuelosPage />}
                                    {dbView === 'cronograma' && <SandboxCronogramaPage />}
                                    {dbView === 'hr' && <SandboxHRPage />}
                                    {dbView === 'patrocinadores' && <SandboxPatrocinadoresPage />}
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                </div>
            )}


            {/* TAB: CRM Pipeline Principal */}
            {activeTab === 'crm' && (
                <div className="animate-premium-in w-full h-full flex flex-col pt-4 overflow-hidden relative">
                    {/* Hacemos que ocupe todo el ancho igual que las bd */}
                    <div className="max-w-[100vw] flex-1 flex flex-col overflow-hidden relative">
                        <SandboxCRMPage />
                    </div>
                </div>
            )}

            {
                activeTab === 'patrocinadores' && (() => {
                    const activeThemeStyles = [
                        { hex: '#FF6B6B', tx: '#EF4444', btnText: '#FFFFFF', shadow: 'rgba(255, 107, 107, 0.4)' },
                        { hex: '#4EA8DE', tx: '#0284C7', btnText: '#FFFFFF', shadow: 'rgba(78, 168, 222, 0.4)' },
                        { hex: '#FFD166', tx: '#D97706', btnText: '#0f172a', shadow: 'rgba(255, 209, 102, 0.4)' }, // Darker amber text for readability, slate text for btn
                        { hex: '#9D4EDD', tx: '#9333EA', btnText: '#FFFFFF', shadow: 'rgba(157, 78, 221, 0.4)' },
                        { hex: '#06D6A0', tx: '#059669', btnText: '#0f172a', shadow: 'rgba(6, 214, 160, 0.4)' }   // Emerald text for readability, slate text for btn
                    ];
                    let activeTheme = null;
                    if (editingSponsorId) {
                        const idx = sponsors.findIndex(s => s.id === editingSponsorId);
                        if (idx !== -1) activeTheme = activeThemeStyles[idx % activeThemeStyles.length];
                    }

                    return (
                    <div className="max-w-5xl mx-auto space-y-8 animate-premium-in">

                        {/* --- FORMULARIO DE ALTA DE PATROCINADOR --- */}
                        <section id="sponsor-form-section" 
                            className={`neu-card p-6 md:p-8 transition-all duration-700 ${editingSponsorId ? `shadow-2xl scale-[1.02]` : ''}`}
                            style={editingSponsorId && activeTheme ? { 
                                backgroundColor: activeTheme.hex + '0A',
                                boxShadow: `0 25px 50px -12px ${activeTheme.shadow}, 0 0 0 4px ${activeTheme.hex}40`
                            } : {}}
                        >
                            <div className={`flex flex-col items-center gap-4 mb-8 text-center ${!editingSponsorId ? 'md:flex-row md:text-left' : ''}`}>
                                <div 
                                    className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-500 shadow-inner ${editingSponsorId ? 'bg-white shadow-xl scale-110' : 'bg-violet-50/50'}`}
                                >
                                    {editingSponsorId ? (
                                        <Pencil size={28} className="drop-shadow-sm" style={{ color: activeTheme.tx }} />
                                    ) : (
                                        <Building2 size={24} className="text-violet-400" />
                                    )}
                                </div>
                                <div>
                                    {editingSponsorId ? (
                                        <h2 
                                            className="text-2xl md:text-4xl font-black tracking-tight mt-2 uppercase"
                                            style={{ color: activeTheme.tx }}
                                        >
                                            EDITANDO {sponsorForm.nombre || 'PATROCINADOR'}
                                        </h2>
                                    ) : (
                                        <h2 className="text-xl md:text-2xl font-black tracking-tight text-slate-800">
                                            Nuevo Patrocinador
                                        </h2>
                                    )}
                                    <p className="text-slate-400 text-xs md:text-sm mt-1.5 font-medium tracking-wide">
                                        {editingSponsorId ? 'Modifica los valores del inversor de manera centralizada. Los cambios modificarán la plataforma inmediatamente.' : 'Registra una nueva empresa e inicializa su fondo.'}
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handleSponsorSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div>
                                        <label 
                                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2"
                                            style={{ color: editingSponsorId && activeTheme ? activeTheme.tx : '' }}
                                        >
                                            <Building2 size={14} /> Nombre de Empresa
                                        </label>
                                        <input
                                            type="text"
                                            name="nombre"
                                            value={sponsorForm.nombre}
                                            onChange={handleSponsorInputChange}
                                            required
                                            placeholder="Ej: Empresa ABC"
                                            className="w-full neu-input-inset px-4 py-3"
                                        />
                                    </div>

                                    <div>
                                        <label 
                                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2"
                                            style={{ color: editingSponsorId && activeTheme ? activeTheme.tx : '' }}
                                        >
                                            <Mail size={14} /> Correo Electrónico
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={sponsorForm.email}
                                            onChange={handleSponsorInputChange}
                                            required
                                            placeholder="contacto@empresa.com"
                                            className="w-full neu-input-inset px-4 py-3"
                                        />
                                    </div>

                                    <div>
                                        <label 
                                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2"
                                            style={{ color: editingSponsorId && activeTheme ? activeTheme.tx : '' }}
                                        >
                                            <Lock size={14} /> Contraseña
                                        </label>
                                        <input
                                            type="text"
                                            name="password"
                                            value={sponsorForm.password}
                                            onChange={handleSponsorInputChange}
                                            required
                                            placeholder="Contraseña de acceso"
                                            className="w-full neu-input-inset px-4 py-3"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
                                    <div>
                                        <label 
                                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2"
                                            style={{ color: editingSponsorId && activeTheme ? activeTheme.tx : '' }}
                                        >
                                            <DollarSign size={14} /> Aportación Económica ($)
                                        </label>
                                        <input
                                            type="number"
                                            name="aportacion"
                                            value={sponsorForm.aportacion}
                                            onChange={handleSponsorInputChange}
                                            placeholder="Ej: 50000"
                                            className="w-full neu-input-inset px-4 py-3 font-mono"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Visible internamente y para el sponsor.</p>
                                    </div>
                                    
                                    <div>
                                        <label 
                                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2"
                                            style={{ color: editingSponsorId && activeTheme ? activeTheme.tx : '' }}
                                        >
                                            <Camera size={14} /> Logo Inteligente (IA)
                                        </label>
                                        <div className="relative w-full h-[54px] neu-input-inset flex items-center justify-center p-2 rounded-xl border border-dashed border-slate-300 overflow-hidden group">
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                onChange={handleLogoUpload}
                                                disabled={isProcessingLogo}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                                            />
                                            {isProcessingLogo ? (
                                                <div className="flex items-center gap-2 text-blue-500">
                                                    <Loader2 size={16} className="animate-spin" />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider">{logoProgress}</span>
                                                </div>
                                            ) : sponsorForm.logo_url ? (
                                                <div className="w-full h-full flex items-center justify-between px-2 bg-white/50 rounded-lg">
                                                    <img src={sponsorForm.logo_url} alt="Logo preview" className="h-8 w-auto object-contain shrink-0 mix-blend-multiply" />
                                                    <div className="text-right ml-2 flex-1">
                                                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Logo Listo</p>
                                                        <p className="text-[9px] text-slate-400">Cambiar</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-slate-400 group-hover:text-blue-500 transition-colors">
                                                    <Upload size={16} />
                                                    <p className="text-[11px] font-bold uppercase tracking-wider">Subir & Quitar Fondo</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label 
                                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2"
                                            style={{ color: editingSponsorId && activeTheme ? activeTheme.tx : '' }}
                                        >
                                            <Palette size={14} /> Estilo Visual
                                        </label>
                                        <div className="flex gap-2 h-[54px]">
                                            <button
                                                type="button"
                                                onClick={() => setSponsorForm(prev => ({ ...prev, mantener_logo_original: false }))}
                                                className={`flex-1 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wider flex flex-col items-center justify-center transition-all ${
                                                    !sponsorForm.mantener_logo_original
                                                        ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/20'
                                                        : 'neu-input-inset text-slate-400 hover:text-slate-600'
                                                }`}
                                            >
                                                <span className="mb-0.5">Automático</span>
                                                <span className="text-[9px] opacity-70 font-normal normal-case">(Monocromo)</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSponsorForm(prev => ({ ...prev, mantener_logo_original: true }))}
                                                className={`flex-1 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-wider flex flex-col items-center justify-center transition-all ${
                                                    sponsorForm.mantener_logo_original
                                                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30'
                                                        : 'neu-input-inset text-slate-400 hover:text-slate-600'
                                                }`}
                                            >
                                                <span className="mb-0.5">Original</span>
                                                <span className="text-[9px] opacity-70 font-normal normal-case">(Logo a Color)</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {sponsorMessage.text && (
                                    <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${sponsorMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                                        {sponsorMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                        {sponsorMessage.text}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={sponsorLoading}
                                    className={`w-full font-black tracking-wide py-4 text-sm md:text-base rounded-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${editingSponsorId
                                        ? 'hover:-translate-y-1 hover:brightness-110 active:scale-95'
                                        : 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 text-white hover:-translate-y-1'
                                        }`}
                                    style={editingSponsorId && activeTheme ? { 
                                        backgroundColor: activeTheme.hex, 
                                        color: activeTheme.btnText,
                                        boxShadow: `0 10px 25px -5px ${activeTheme.shadow}`
                                    } : {}}
                                >
                                    {sponsorLoading ? (
                                        <><Loader2 size={20} className="animate-spin" /> {editingSponsorId ? 'Procesando Cambios...' : 'Generando Registro...'} </>
                                    ) : (
                                        <>{editingSponsorId ? <RefreshCw size={20} /> : <Building2 size={20} />} {editingSponsorId ? 'Confirmar y Actualizar Datos' : 'Registrar Nuevo Patrocinador'}</>
                                    )}
                                </button>

                                {editingSponsorId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="w-full mt-3 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 border-2 border-slate-100 font-bold tracking-wide py-3.5 rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 shadow-sm hover:shadow active:scale-95"
                                    >
                                        <X size={18} /> Cancelar Edición
                                    </button>
                                )}
                            </form>
                        </section>

                        {/* --- LISTA DE PATROCINADORES --- */}
                        <section className="neu-card p-6 md:p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-fuchsia-500/20 rounded-xl flex items-center justify-center">
                                        <Users className="w-5 h-5 text-fuchsia-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg md:text-xl font-bold">Patrocinadores Registrados</h2>
                                        <p className="text-slate-400 text-xs">{sponsors.length} registros</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setShowPasswords(!showPasswords)}
                                        className="p-2 neu-list-item"
                                        title={showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                                    >
                                        {showPasswords ? <EyeOff size={18} className="text-slate-400" /> : <Eye size={18} className="text-slate-400" />}
                                    </button>
                                    <button
                                        onClick={fetchSponsors}
                                        className="p-2 neu-list-item"
                                        title="Actualizar lista"
                                    >
                                        <RefreshCw size={18} className="text-slate-400" />
                                    </button>
                                </div>
                            </div>

                            {fetchingSponsors ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={32} className="animate-spin text-slate-400" />
                                </div>
                            ) : sponsors.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                    <Building2 size={48} className="mx-auto mb-4 opacity-30" />
                                    <p>No hay patrocinadores registrados</p>
                                </div>
                            ) : (
                                    <div className="space-y-3">
                                        {sponsors.map((sponsor, idx) => {
                                            const themes = [
                                                { bg: '#FF6B6B', text: 'text-white', sub: 'text-rose-100/90', accent: 'bg-white/10 hover:bg-white/30 text-white border border-white/10', iconbg: 'bg-white/20', money: 'text-white', logoLight: true },
                                                { bg: '#4EA8DE', text: 'text-white', sub: 'text-sky-100/90', accent: 'bg-white/10 hover:bg-white/30 text-white border border-white/10', iconbg: 'bg-white/20', money: 'text-white', logoLight: true },
                                                { bg: '#FFD166', text: 'text-slate-900', sub: 'text-amber-900/80', accent: 'bg-black/5 hover:bg-black/15 text-slate-900 border border-black/5', iconbg: 'bg-white/50', money: 'text-slate-900', logoLight: false },
                                                { bg: '#9D4EDD', text: 'text-white', sub: 'text-fuchsia-100/90', accent: 'bg-white/10 hover:bg-white/30 text-white border border-white/10', iconbg: 'bg-white/20', money: 'text-white', logoLight: true },
                                                { bg: '#06D6A0', text: 'text-slate-900', sub: 'text-emerald-900/80', accent: 'bg-black/5 hover:bg-black/15 text-slate-900 border border-black/5', iconbg: 'bg-white/50', money: 'text-slate-900', logoLight: false }
                                            ];
                                            const theme = themes[idx % themes.length];
                                            const isEditingThis = editingSponsorId === sponsor.id;
                                            const isEditingOther = editingSponsorId && editingSponsorId !== sponsor.id;
                                            
                                            return (
                                            <div
                                                key={sponsor.id}
                                                className={`neu-list-item group flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-5 transition-all duration-500 relative ${
                                                    isEditingThis 
                                                        ? 'ring-4 ring-white/60 shadow-2xl scale-[1.02] z-10' 
                                                        : isEditingOther 
                                                            ? 'opacity-40 grayscale-[50%] hover:opacity-75' 
                                                            : 'hover:-translate-y-0.5'
                                                }`}
                                                style={{ background: theme.bg, borderColor: isEditingThis ? '#ffffff' : 'transparent' }}
                                            >
                                                <div className="flex-1 flex items-center gap-4 md:gap-5">
                                                    {/* Logo / Avatar */}
                                                    <div className={`flex-shrink-0 w-11 h-11 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-transform duration-300 overflow-hidden ${isEditingThis ? 'animate-bounce' : 'group-hover:scale-110'}`}>
                                                        {sponsor.logo_url ? (
                                                            <img 
                                                                src={sponsor.logo_url} 
                                                                alt={sponsor.nombre} 
                                                                className="w-full h-full object-contain"
                                                                style={{ filter: sponsor.mantener_logo_original ? 'none' : (theme.logoLight ? 'brightness(0) invert(1)' : 'brightness(0)') }}
                                                            />
                                                        ) : (
                                                            <div className={`w-full h-full rounded-2xl flex items-center justify-center ${theme.iconbg}`}>
                                                                {isEditingThis ? <Pencil size={22} className={theme.text} /> : <Building2 size={22} className={theme.text} />}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Data Grid */}
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-4 items-center min-w-0">
                                                        <div className="min-w-0">
                                                            <p className={`text-[9px] uppercase tracking-wider mb-0.5 font-bold ${theme.sub}`}>Empresa</p>
                                                            <div className="flex items-center gap-1.5">
                                                                <p className={`font-black text-base md:text-lg ${isEditingThis ? 'whitespace-normal' : 'truncate'} ${theme.text}`}>{sponsor.nombre}</p>
                                                                {isEditingThis && (
                                                                    <span className="animate-pulse bg-white/20 text-white backdrop-blur-sm shadow-sm text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center justify-center flex-shrink-0">
                                                                        EDITANDO
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className={`text-[9px] uppercase tracking-wider mb-0.5 font-bold ${theme.sub}`}>Correo</p>
                                                            <p className={`text-xs font-semibold truncate ${theme.text}`}>{sponsor.email}</p>
                                                        </div>
                                                        <div>
                                                            <p className={`text-[9px] uppercase tracking-wider mb-0.5 font-bold ${theme.sub}`}>Contraseña</p>
                                                            <p className={`text-xs font-mono tracking-widest font-black ${theme.text}`}>
                                                                {showPasswords ? sponsor.password : '••••••••'}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className={`text-[9px] uppercase tracking-wider mb-0.5 font-bold ${theme.sub}`}>Inversión</p>
                                                            <div className={`inline-flex items-center px-3 py-1.5 rounded-lg font-black font-mono text-xs shadow-sm ${theme.iconbg} ${theme.money} transition-transform duration-300 group-hover:scale-105`}>
                                                                ${(sponsor.aportacion_total || 0).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex justify-end gap-1.5 mt-3 md:mt-0 pr-1">
                                                    <button
                                                        onClick={() => window.open(`/dashboard?action=test_login&email=${encodeURIComponent(sponsor.email)}&password=${encodeURIComponent(sponsor.password)}`, '_blank')}
                                                        className={`p-2.5 rounded-xl transition-all duration-200 ${theme.accent} hover:scale-110 active:scale-95`}
                                                        title="Probar Login"
                                                    >
                                                        <ExternalLink size={17} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditSponsor(sponsor)}
                                                        className={`p-2.5 rounded-xl transition-all duration-200 ${theme.accent} hover:scale-110 active:scale-95`}
                                                        title="Editar Datos"
                                                    >
                                                        <Pencil size={17} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSponsor(sponsor.id)}
                                                        className={`p-2.5 rounded-xl transition-all duration-200 ${theme.accent} hover:scale-110 active:scale-95 hover:!bg-red-500 hover:!text-white hover:!border-red-500`}
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={17} />
                                                    </button>
                                                </div>
                                            </div>
                                            );
                                        })}
                                </div>
                            )}
                        </section>

                        {/* --- VISTA PREVIA EMBEBIDA --- */}
                        <div className="pt-8 border-t border-white/10 mt-8">
                            <div className="flex justify-center mb-8">
                                <button
                                    onClick={() => setShowDashboardPreview(!showDashboardPreview)}
                                    className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg shadow-xl transition-all transform hover:scale-105 ${showDashboardPreview
                                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:shadow-violet-500/30'
                                        }`}
                                >
                                    {showDashboardPreview ? <EyeOff size={24} /> : <Eye size={24} />}
                                    {showDashboardPreview ? 'Ocultar Vista Previa' : 'Vista Previa del Dashboard'}
                                </button>
                            </div>

                            {showDashboardPreview && (
                                <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-700/50 relative">
                                    <div className="bg-slate-900 text-white text-center py-2 text-xs font-mono uppercase tracking-widest border-b border-white/10">
                                        Modo Vista Previa (Simulación)
                                    </div>
                                    <div className="h-[800px] overflow-y-auto isolate navbar-static-force">
                                        <DashboardPage previewMode={true} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    );
                })()
            }

            {/* CONTENIDO CRONOGRAMA */}
            {
                activeTab === 'cronograma' && (
                    <div className="max-w-5xl mx-auto space-y-8 animate-premium-in">

                        {/* === PANEL: DISPONIBILIDAD BOT WHATSAPP === */}
                        <section className="neu-card p-6 md:p-8 border-2 border-emerald-500/20">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg md:text-xl font-bold neu-text">Disponibilidad Bot WhatsApp</h2>
                                        <p className="text-xs neu-text-sub">Días que el bot puede ofrecer a directores · Máx 2 escuelas/día (1 matutino + 1 vespertino)</p>
                                    </div>
                                </div>
                                <button onClick={() => fetchAvailableDates()} className="p-2 neu-list-item text-slate-400 hover:text-emerald-500 transition-all hover:rotate-180 duration-300">
                                    <RefreshCw size={18} />
                                </button>
                            </div>

                            {/* Mini Form: Abrir nuevo día */}
                            <form onSubmit={handleAddDate} className="flex flex-col sm:flex-row gap-3 mb-6">
                                <div className="flex-1">
                                    <input
                                        type="date"
                                        value={newDateForm.fecha}
                                        onChange={(e) => setNewDateForm(prev => ({ ...prev, fecha: e.target.value }))}
                                        className="w-full neu-input-inset px-4 py-3 uppercase"
                                        required
                                    />
                                </div>
                                <div className="flex-1">
                                    <input
                                        type="text"
                                        value={newDateForm.notas}
                                        onChange={(e) => setNewDateForm(prev => ({ ...prev, notas: e.target.value }))}
                                        placeholder="Nota opcional (ej. Zona Norte)"
                                        className="w-full neu-input-inset px-4 py-3"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={addingDate || !newDateForm.fecha}
                                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                                >
                                    {addingDate ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
                                    Abrir Día
                                </button>
                            </form>

                            {/* Control de Auto-Piloto y Filtros Históricos */}
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                                {/* Pestañas de Histórico */}
                                <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
                                    <button onClick={() => setDateFilter('proximas')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${dateFilter === 'proximas' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                        Próximas
                                    </button>
                                    <button onClick={() => setDateFilter('ganadas')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${dateFilter === 'ganadas' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                        Ganadas
                                    </button>
                                    <button onClick={() => setDateFilter('perdidas')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${dateFilter === 'perdidas' ? 'bg-white dark:bg-slate-700 shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}>
                                        Perdidas
                                    </button>
                                </div>

                                {/* Toggle Auto-Schedule */}
                                <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 pl-4 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <Bot size={16} className={autoScheduleEnabled ? "text-indigo-500" : "text-slate-400"} />
                                        <div className="text-xs">
                                            <p className="font-bold text-slate-700 dark:text-slate-300">Piloto Automático</p>
                                            <p className="text-[10px] text-slate-500">Auto-rellena 3 semanas</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleToggleAutoSchedule}
                                        className={`ml-2 p-1.5 rounded-xl transition-all duration-300 ${autoScheduleEnabled ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                        title={autoScheduleEnabled ? "Desactivar automatización" : "Activar automatización"}
                                    >
                                        {isAutoScheduling ? <Loader2 size={24} className="animate-spin" /> : autoScheduleEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                    </button>
                                </div>
                            </div>

                            {/* Date List */}
                            {fetchingDates && availableDates.length === 0 ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 size={28} className="animate-spin text-slate-400" />
                                </div>
                            ) : (() => {
                                const todayStr = new Date().toISOString().split('T')[0];
                                const filteredDatesList = availableDates.filter(d => {
                                    const isPast = d.fecha < todayStr;
                                    if (dateFilter === 'proximas') return !isPast;
                                    if (dateFilter === 'ganadas') return isPast && d.cupo_usado > 0;
                                    if (dateFilter === 'perdidas') return isPast && d.cupo_usado === 0;
                                    return true;
                                }).sort((a, b) => {
                                    if (dateFilter === 'proximas') return a.fecha.localeCompare(b.fecha);
                                    return b.fecha.localeCompare(a.fecha);
                                });

                                if (filteredDatesList.length === 0) {
                                    return (
                                        <div className="text-center py-8 text-slate-400">
                                            <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                                            <p className="font-medium">No hay fechas en esta vista</p>
                                            <p className="text-xs mt-1">Intenta con otro filtro o agrega fechas.</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-3">
                                        {filteredDatesList.map((d) => {
                                            const dateFormatted = new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
                                        const isFull = d.cupo_usado >= 2;
                                        const isPast = new Date(d.fecha) < new Date(new Date().toISOString().split('T')[0]);

                                        return (
                                            <div
                                                key={d.id}
                                                className={`neu-list-item p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all duration-300 ${
                                                    !d.activa ? 'opacity-50 grayscale' : isPast ? 'opacity-60' : isFull ? 'border-l-4 border-red-400' : 'border-l-4 border-emerald-400'
                                                } hover:-translate-y-0.5`}
                                            >
                                                {/* Date & Status */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-bold neu-text capitalize truncate">{dateFormatted}</p>
                                                        {isPast && <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full">Pasada</span>}
                                                        {!d.activa && <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">Pausada</span>}
                                                        {isFull && d.activa && <span className="text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Lleno</span>}
                                                    </div>
                                                    {d.notas && <p className="text-[11px] neu-text-sub truncate">{d.notas}</p>}
                                                </div>

                                                {/* Turno Slots */}
                                                <div className="flex gap-2 flex-shrink-0">
                                                    {/* Matutino */}
                                                    <button
                                                        onClick={() => handleToggleDate(d.id, !d.matutino_bloqueado, 'matutino_bloqueado')}
                                                        className={`px-3 py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 min-w-[130px] justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer ${
                                                            d.matutino_bloqueado
                                                                ? 'bg-red-500/10 text-red-600 border border-red-500/30 line-through opacity-60'
                                                                : d.matutino
                                                                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                                                        }`}
                                                        title={d.matutino_bloqueado ? 'Click para desbloquear matutino' : d.matutino ? 'Matutino ocupado' : 'Click para bloquear matutino'}
                                                    >
                                                        <span className="text-[9px] uppercase tracking-wider font-semibold opacity-70">Matutino</span>
                                                        <span className="text-[11px]">{d.matutino_bloqueado ? 'Bloqueado' : d.matutino ? d.matutino.nombre.substring(0, 14) : 'Libre'}</span>
                                                    </button>
                                                    {/* Vespertino */}
                                                    <button
                                                        onClick={() => handleToggleDate(d.id, !d.vespertino_bloqueado, 'vespertino_bloqueado')}
                                                        className={`px-3 py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 min-w-[130px] justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer ${
                                                            d.vespertino_bloqueado
                                                                ? 'bg-red-500/10 text-red-600 border border-red-500/30 line-through opacity-60'
                                                                : d.vespertino
                                                                    ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20'
                                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'
                                                        }`}
                                                        title={d.vespertino_bloqueado ? 'Click para desbloquear vespertino' : d.vespertino ? 'Vespertino ocupado' : 'Click para bloquear vespertino'}
                                                    >
                                                        <span className="text-[9px] uppercase tracking-wider font-semibold opacity-70">Vespertino</span>
                                                        <span className="text-[11px]">{d.vespertino_bloqueado ? 'Bloqueado' : d.vespertino ? d.vespertino.nombre.substring(0, 14) : 'Libre'}</span>
                                                    </button>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <button
                                                        onClick={() => handleToggleDate(d.id, !d.activa)}
                                                        className={`p-2 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 ${
                                                            d.activa ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-200'
                                                        }`}
                                                        title={d.activa ? 'Pausar fecha' : 'Activar fecha'}
                                                    >
                                                        {d.activa ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteDate(d.id)}
                                                        className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 hover:scale-110 active:scale-95"
                                                        title="Eliminar día"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                );
                            })()}
                        </section>

                        {/* --- ALTA DE PRÓXIMA MISIÓN --- */}
                        <section className="neu-card p-6 md:p-8">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                                        <School className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg md:text-xl font-bold neu-text">
                                            {editingSchoolId ? 'Editar Misión' : 'Agendar Nueva Misión'}
                                        </h2>
                                        <p className="text-xs neu-text-sub">Programa un vuelo directo al Sandbox Opeacional</p>
                                    </div>
                                </div>
                                {editingSchoolId && (
                                    <button 
                                        type="button" 
                                        onClick={handleCancelNextSchoolEdit}
                                        className="p-2 neu-list-item text-slate-400 hover:text-red-500 transition-colors"
                                        title="Cancelar edición"
                                    >
                                        <X size={18} />
                                    </button>
                                )}
                            </div>

                            <form onSubmit={handleNextSchoolSubmit} className="space-y-5">
                                <div className="space-y-4">
                                    <div className="relative z-20">
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                            <Database size={14} /> Seleccionar Escuela (Catálogo Oficial)
                                        </label>
                                        <SchoolCombobox 
                                            schools={catalogoEscuelas}
                                            value={selectedCatalogoSchool}
                                            onChange={(school) => {
                                                setSelectedCatalogoSchool(school);
                                                if (school) {
                                                    setNextSchoolForm(prev => ({
                                                        ...prev,
                                                        nombre_escuela: school.nombre_escuela,
                                                        cct: school.cct,
                                                        colonia: school.colonia || prev.colonia
                                                    }));
                                                }
                                            }}
                                            loading={catalogoLoading}
                                        />
                                    </div>

                                    {!selectedCatalogoSchool && !editingSchoolId && (
                                        <div className="p-4 neu-card flex items-start gap-3 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                                            <AlertCircle size={16} className="shrink-0 mt-0.5 text-blue-500" />
                                            <p className="text-xs font-medium leading-relaxed">
                                                Al agendar una escuela, se mantendrá pendiente en tu Cronograma. <strong className="text-slate-700 dark:text-slate-300">En cuanto el equipo operativo inicie la misión</strong> en asfalto, esta pasará instantáneamente a formar parte oficial de la bitácora de Sandbox Vuelos.
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-0">
                                        <div>
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                                <MapPin size={14} /> Colonia / Detalles
                                            </label>
                                            <input
                                                type="text"
                                                value={nextSchoolForm.colonia}
                                                onChange={(e) => setNextSchoolForm(prev => ({ ...prev, colonia: e.target.value }))}
                                                placeholder="Ej. Centro..."
                                                className="w-full neu-input-inset px-4 py-3"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                                <Calendar size={14} /> Fecha Programada
                                            </label>
                                            <input
                                                type="date"
                                                value={nextSchoolForm.fecha_programada}
                                                onChange={(e) => setNextSchoolForm(prev => ({ ...prev, fecha_programada: e.target.value }))}
                                                className="w-full neu-input-inset px-4 py-3 uppercase"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                                <CheckCircle size={14} /> Turno
                                            </label>
                                            <select
                                                value={nextSchoolForm.turno}
                                                onChange={(e) => setNextSchoolForm(prev => ({ ...prev, turno: e.target.value }))}
                                                className="w-full neu-input-inset px-4 py-3 appearance-none cursor-pointer bg-white dark:bg-slate-900 font-semibold"
                                            >
                                                <option value="">Infiere del Catálogo</option>
                                                <option value="Matutino">Matutino</option>
                                                <option value="Vespertino">Vespertino</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-0">
                                        <div>
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                                <Users size={14} /> Nombre del Director
                                            </label>
                                            <input
                                                type="text"
                                                value={nextSchoolForm.nombre_director}
                                                onChange={(e) => setNextSchoolForm(prev => ({ ...prev, nombre_director: e.target.value }))}
                                                placeholder="Ej. Prof. Juan Pérez"
                                                className="w-full neu-input-inset px-4 py-3"
                                            />
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                                <Users size={14} /> Tel. Director
                                            </label>
                                            <input
                                                type="tel"
                                                value={nextSchoolForm.telefono_director}
                                                onChange={(e) => setNextSchoolForm(prev => ({ ...prev, telefono_director: e.target.value }))}
                                                placeholder="Ej. 4431234567"
                                                className="w-full neu-input-inset px-4 py-3"
                                            />
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                                <Users size={14} /> Número de Niños
                                            </label>
                                            <input
                                                type="number"
                                                value={nextSchoolForm.numero_ninos}
                                                onChange={(e) => setNextSchoolForm(prev => ({ ...prev, numero_ninos: e.target.value }))}
                                                placeholder="Ej. 150"
                                                className="w-full neu-input-inset px-4 py-3"
                                            />
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                                                <DollarSign size={14} /> Cuota por Alumno
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={nextSchoolForm.cuota_alumno}
                                                onChange={(e) => setNextSchoolForm(prev => ({ ...prev, cuota_alumno: e.target.value }))}
                                                placeholder="Ej. 50"
                                                className="w-full neu-input-inset px-4 py-3"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={nextSchoolLoading || (!selectedCatalogoSchool && !editingSchoolId && !nextSchoolForm.nombre_escuela)}
                                    className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                                        (!selectedCatalogoSchool && !editingSchoolId && !nextSchoolForm.nombre_escuela) || nextSchoolLoading
                                            ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                                            : editingSchoolId
                                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-amber-500/30 hover:shadow-amber-500/50 hover:scale-[1.01]'
                                                : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.01]'
                                    }`}
                                >
                                    {nextSchoolLoading ? (
                                        <><Loader2 size={18} className="animate-spin" /> {editingSchoolId ? 'Actualizando...' : 'Agendando...'} </>
                                    ) : (
                                        <>{editingSchoolId ? <RefreshCw size={18} /> : <Plane size={18} />} {editingSchoolId ? 'Guardar Cambios' : 'Agendar al Cronograma'}</>
                                    )}
                                </button>
                            </form>
                        </section>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                            {/* --- COLUMNA 1: PRÓXIMAS MISIONES --- */}
                            <section className="bg-blue-600 rounded-[2rem] shadow-xl shadow-blue-600/20 p-6 md:p-8 self-start sticky top-24 transition-all duration-500 relative overflow-hidden">
                                {/* Decoración de fondo suave (opcional, para darle más feeling 'playful' y profundidad a la tarjeta azul) */}
                                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none" />
                                <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-blue-400/20 rounded-full blur-2xl pointer-events-none" />

                                <div className="relative flex items-center justify-between mb-6 z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                                            <Calendar className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Próximas Misiones</h2>
                                            <p className="text-blue-100/80 text-xs font-medium mt-0.5">Misiones pendientes por completar</p>
                                        </div>
                                    </div>
                                    <button onClick={() => fetchNextSchools()} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-md transition-all duration-300 hover:rotate-180 active:scale-95">
                                        <RefreshCw size={18} />
                                    </button>
                                </div>

                                {fetchingNextSchools ? (
                                    <div className="flex items-center justify-center py-12 relative z-10">
                                        <Loader2 size={32} className="animate-spin text-white/50" />
                                    </div>
                                ) : nextSchools.filter(s => s.estatus === 'pendiente' && s.fecha_programada >= new Date().toISOString().split('T')[0]).length === 0 ? (
                                    <div className="text-center py-12 text-blue-200/60 relative z-10">
                                        <Calendar size={48} className="mx-auto mb-4 opacity-30" />
                                        <p className="font-medium">No hay misiones próximas pendientes</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 relative z-10">
                                        {nextSchools.filter(s => s.estatus === 'pendiente' && s.fecha_programada >= new Date().toISOString().split('T')[0]).map((school) => {
                                            const isCanceled = school.estatus === 'cancelada';
                                            const isArchived = school.estatus === 'archivado';
                                            const opacityClass = (isCanceled || isArchived) ? 'opacity-60' : 'opacity-100';
                                            
                                            let borderClass = 'border-amber-500';
                                            let pillClass = 'bg-amber-500/10 text-amber-600 border-amber-500/20';
                                            
                                            if (isCanceled) {
                                                borderClass = 'border-red-500';
                                                pillClass = 'bg-red-500/10 text-red-600 border-red-500/20 line-through';
                                            } else if (isArchived) {
                                                borderClass = 'border-slate-400';
                                                pillClass = 'bg-slate-100 text-slate-600 border-slate-300';
                                            }

                                            return (
                                            <div key={school.id} className={`bg-white rounded-2xl flex flex-col gap-2 p-4 border-l-4 ${borderClass} ${opacityClass} group hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 transition-all duration-300 relative overflow-hidden z-10`}>
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                                <div className="flex items-start justify-between relative z-10">
                                                    <div>
                                                        <p className={`font-bold text-slate-800 pr-2 tracking-tight ${isCanceled ? 'line-through' : ''}`}>{school.nombre_escuela}</p>
                                                        <span className={`mt-1 inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border uppercase shadow-sm ${pillClass}`}>
                                                            {school.estatus || 'pendiente'}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Botones de Administración de la Misión */}
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleEditNextSchool(school); }}
                                                            className="p-1.5 rounded-lg hover:bg-amber-500/10 text-slate-400 hover:text-amber-500 transition-all duration-200 hover:scale-110 active:scale-95"
                                                            title="Editar Misión"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteNextSchool(school.id); }}
                                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-all duration-200 hover:scale-110 active:scale-95"
                                                            title="Archivar"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex items-end justify-between mt-2 relative z-10">
                                                    <div className="flex flex-col gap-1.5 text-[11px] text-slate-500 font-medium">
                                                        <span className="flex items-center gap-1">
                                                            <MapPin size={12} className="text-blue-500" /> {school.colonia}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar size={12} className="text-amber-500" /> {school.fecha_programada}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Premium Flyer Button - Bottom Right */}
                                                    {!isCanceled && !isArchived && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleOpenFlyerModalFromCard(school); }}
                                                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-wide py-1.5 px-3 rounded-lg transition-all duration-300 flex items-center gap-1.5 text-[10px] shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5 active:scale-95 group/btn"
                                                        >
                                                            <Image size={12} className="opacity-90 group-hover/btn:opacity-100" />
                                                            Generar Flyers
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )})}
                                    </div>
                                )}
                            </section>

                            {/* --- COLUMNA 2: MISIONES COMPLETADAS --- */}
                            <section className="neu-card p-6 md:p-8 self-start">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                            <CheckCircle className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg md:text-xl font-bold neu-text">Misiones Completadas</h2>
                                            <p className="neu-text-sub text-xs">Aterrizaron con éxito (Consumidas por Sandbox)</p>
                                        </div>
                                    </div>
                                </div>

                                {fetchingNextSchools ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 size={32} className="animate-spin text-slate-400" />
                                    </div>
                                ) : nextSchools.filter(s => s.estatus === 'completada').length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <CheckCircle size={48} className="mx-auto mb-4 opacity-30" />
                                        <p>Aún no hay misiones completadas</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 relative z-10">
                                        {nextSchools.filter(s => s.estatus === 'completada').map((school) => (
                                            <div key={school.id} className="neu-list-item flex flex-col gap-2 p-4 border-l-4 border-emerald-500 opacity-80 group hover:-translate-y-1 hover:opacity-100 hover:shadow-lg transition-all duration-300 relative overflow-hidden">
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                                                <div className="flex items-center justify-between">
                                                    <p className="font-bold neu-text opacity-70 truncate pr-2">{school.nombre_escuela}</p>
                                                    <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase shrink-0">
                                                        COMPLETADA
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs neu-text-sub font-medium opacity-70">
                                                    <span className="flex items-center gap-1">
                                                        <MapPin size={12} className="text-blue-500" /> {school.colonia}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={12} className="text-amber-500" /> {school.fecha_programada}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                )
            }

            {/* FOOTER */}

            {/* TAB: OPERATIVOS */}
            {activeTab === 'operativos' && (
                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 relative z-10 mt-16 md:mt-20 animate-premium-in">
                    
                    {/* ANCLA PARA EL MUÑECO OPERATIVO */}
                    {/* Esta ancla virtualiza la posicion en el grid; el puppet real se portaliza por encima del Header */}
                    <div id="operativos-mascot-anchor" className="absolute top-[0px] left-[55%] -translate-x-1/2 w-0 h-0 z-0 pointer-events-none" />

                    {/* PORTAL MUÑECO: Absolute Tracking - Pinned to Browser Top */}
                    {isMounted && document.body && createPortal(
                        <div id="portal-mascot-container" className="hidden lg:block fixed top-0 left-0 z-[99999] pointer-events-none group will-change-transform">
                            <style>{`
                                @keyframes waveArm {
                                    0% { transform: rotate(0deg); }
                                    25% { transform: rotate(15deg); }
                                    35% { transform: rotate(-10deg); }
                                    50% { transform: rotate(15deg); }
                                    75% { transform: rotate(-10deg); }
                                    100% { transform: rotate(0deg); }
                                }
                                .group:hover .hand-wave {
                                    animation: waveArm 1.5s ease-in-out infinite;
                                    transform-origin: 36px 30px;
                                }
                                @keyframes slideDropIn {
                                    0% { transform: translate(-50%, -150%); opacity: 0; }
                                    50% { transform: translate(-50%, 15px); opacity: 1; }
                                    75% { transform: translate(-50%, -5px); opacity: 1; }
                                    100% { transform: translate(-50%, 0); opacity: 1; }
                                }
                                .animate-slide-drop-in {
                                    animation: slideDropIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                                }
                            `}</style>
                            
                            {/* Slide-in container and hover-bounce translation */}
                            <div className="absolute top-0 left-1/2 pointer-events-auto cursor-pointer animate-slide-drop-in" style={{ transform: 'translateX(-50%)' }}>
                                {/* Float animation layer - NO SHADOW per user request */}
                                <div className="animate-bounce-slow hover:-translate-y-2 transition-transform duration-500 will-change-transform">
                                    <svg viewBox="0 0 160 200" className="w-[150px] h-[190px] overflow-visible">
                                        <g transform="translate(80, 100) rotate(180)">
                                            {/* Endless Drone Body so the entry animation never reveals a cut edge! */}
                                            <rect x="-40" y="0" width="80" height="400" rx="35" fill="#3b82f6" />
                                            {/* Lateral Tech Ticker Lines */}
                                            <path d="M -25 10 L -25 400 M 25 10 L 25 400" stroke="#2563eb" strokeWidth="6" strokeLinecap="round" opacity="0.4" />

                                            {/* Short Tech Neck */}
                                            <rect x="-9" y="-8" width="18" height="15" rx="6" fill="#fcd34d" />
                                            
                                            {/* Left Arm */}
                                            <path d="M -36 30 Q -65 -15 -45 -50" stroke="#60a5fa" strokeWidth="16" strokeLinecap="round" fill="none"/>
                                            <circle cx="-45" cy="-50" r="10" fill="#fde68a" />
                                            
                                            {/* Right Arm (Waving) */}
                                            <g className="hand-wave">
                                                <path d="M 36 30 Q 65 -15 45 -50" stroke="#60a5fa" strokeWidth="16" strokeLinecap="round" fill="none"/>
                                                <circle cx="45" cy="-50" r="10" fill="#fde68a" />
                                            </g>

                                            {/* Head Base */}
                                            <circle cx="0" cy="-36" r="32" fill="#fde68a" />
                                            
                                            {/* Tech Cap */}
                                            <path d="M -32 -36 A 32 32 0 0 1 32 -36 Z" fill="#1e3a8a" />
                                            <line x1="-32" y1="-36" x2="40" y2="-36" stroke="#1e3a8a" strokeWidth="9" strokeLinecap="round" />
                                            
                                            {/* "FLYHIGH" Inscription */}
                                            <text x="0" y="-48" fill="#fcd34d" fontSize="9.8" fontWeight="900" textAnchor="middle" transform="rotate(180 0 -50)" style={{ letterSpacing: '1.5px', fontFamily: 'system-ui, sans-serif' }}>FLYHIGH</text>

                                            {/* Friendly Display Interfaces (Eyes) */}
                                            <circle cx="-12" cy="-20" r="4.5" fill="#475569" />
                                            <circle cx="12" cy="-20" r="4.5" fill="#475569" />
                                            <circle cx="-14" cy="-22" r="1.5" fill="white" opacity="0.6"/>
                                            <circle cx="10" cy="-22" r="1.5" fill="white" opacity="0.6"/>

                                            {/* Cheeks */}
                                            <ellipse cx="-20" cy="-14" rx="6" ry="4" fill="#FCA5A5" opacity="0.8" />
                                            <ellipse cx="20" cy="-14" rx="6" ry="4" fill="#FCA5A5" opacity="0.8" />

                                            {/* Smile */}
                                            <path d="M -10 -9 Q 0 3 10 -9" fill="none" stroke="#475569" strokeWidth="3.5" strokeLinecap="round" />
                                        </g>
                                    </svg>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}

                    {/* CREAR OPERATIVO */}
                    <section className="neu-card p-6 md:p-8 relative overflow-hidden">
                        {/* Background subtle glow for PWA feel */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                        <div className="flex items-center gap-4 mb-6 relative">
                            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-[4px_4px_10px_rgba(37,99,235,0.3),-4px_-4px_10px_rgba(255,255,255,0.8)]">
                                <Smartphone className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
                                    FlyHigh Ops 
                                    <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded-full shadow-inner uppercase tracking-widest font-black">App Shell</span>
                                </h2>
                                <p className="text-slate-400 text-xs">Administra los accesos móviles del equipo en terreno</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreateStaff} className="space-y-5">
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                    <Users size={14} /> Nombre Completo
                                </label>
                                <input
                                    type="text" required
                                    value={staffForm.full_name}
                                    onChange={(e) => setStaffForm(prev => ({ ...prev, full_name: e.target.value }))}
                                    placeholder="Ej: Juan Pérez"
                                    className="w-full neu-input-inset px-4 py-3"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                    <Shield size={14} /> Rol
                                </label>
                                <select
                                    value={staffForm.role}
                                    onChange={(e) => setStaffForm(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full neu-input-inset px-4 py-3"
                                >
                                    <option value="pilot">Piloto</option>
                                    <option value="teacher">Docente</option>
                                    <option value="assistant">Auxiliar</option>
                                    <option value="supervisor">Supervisor</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                    <Mail size={14} /> Email
                                </label>
                                <input
                                    type="email" required
                                    value={staffForm.email}
                                    onChange={(e) => setStaffForm(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="user@flyhighedu.com"
                                    className="w-full neu-input-inset px-4 py-3"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                    <KeyRound size={14} /> Contraseña
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type={showStaffPasswords ? 'text' : 'password'} required
                                        value={staffForm.password}
                                        onChange={(e) => setStaffForm(prev => ({ ...prev, password: e.target.value }))}
                                        placeholder="Mínimo 6 caracteres"
                                        minLength={6}
                                        className="flex-1 neu-input-inset px-4 py-3"
                                    />
                                    <button type="button" onClick={generatePassword}
                                        className="px-3 py-3 neu-input-inset hover:opacity-80 transition-colors whitespace-nowrap"
                                        title="Generar password"
                                    >
                                        <RefreshCw size={16} />
                                    </button>
                                    <button type="button" onClick={() => setShowStaffPasswords(!showStaffPasswords)}
                                        className="px-3 py-3 neu-input-inset hover:opacity-80 transition-colors"
                                    >
                                        {showStaffPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {staffForm.password && (
                                    <button type="button" onClick={() => navigator.clipboard.writeText(staffForm.password)}
                                        className="mt-2 text-xs text-cyan-400 flex items-center gap-1 hover:text-cyan-300 transition-colors"
                                    >
                                        <Copy size={12} /> Copiar contraseña
                                    </button>
                                )}
                            </div>

                            {staffMessage.text && (
                                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm border ${staffMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                                    {staffMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                    {staffMessage.text}
                                </div>
                            )}

                            <button type="submit" disabled={staffLoading}
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 rounded-xl shadow-[4px_4px_10px_rgba(37,99,235,0.3),-4px_-4px_10px_rgba(255,255,255,0.1)] hover:shadow-[6px_6px_15px_rgba(37,99,235,0.4),-6px_-6px_15px_rgba(255,255,255,0.15)] active:scale-97 active:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {staffLoading ? <><Loader2 size={18} className="animate-spin" /> Creando Acceso...</> : <><UserPlus size={18} /> Provisionar Acceso PWA</>}
                            </button>
                        </form>
                    </section>

                    {/* LISTA DE OPERATIVOS */}
                    <div className="relative flex flex-col h-full">                        
                        <section className="neu-card p-6 md:p-8 relative overflow-hidden flex-1 z-10">
                        <div className="flex items-center justify-between mb-8 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-[4px_4px_10px_rgba(0,0,0,0.04),-4px_-4px_10px_rgba(255,255,255,1)] border border-slate-100">
                                    <Users className="w-6 h-6 text-blue-500" />
                                </div>
                                <div className="mt-1">
                                    <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight leading-none">Dispositivos</h2>
                                    <p className="text-slate-500 font-medium text-xs mt-1">{staffList.length} operativos en línea</p>
                                </div>
                            </div>
                            <button onClick={fetchStaffList}
                                className="w-11 h-11 flex items-center justify-center bg-white hover:bg-blue-50 rounded-full shadow-[3px_3px_8px_rgba(0,0,0,0.05),-3px_-3px_8px_rgba(255,255,255,1)] border border-slate-50 transition-all text-slate-400 hover:text-blue-600 active:scale-95"
                                title="Actualizar lista"
                            >
                                <RefreshCw size={18} className={fetchingStaff ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {fetchingStaff ? (
                            <div className="flex items-center justify-center py-12 relative z-10">
                                <Loader2 size={32} className="animate-spin text-slate-400" />
                            </div>
                        ) : staffList.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 relative z-10">
                                <Users size={48} className="mx-auto mb-4 opacity-40 text-blue-300" />
                                <p className="font-medium text-slate-500">No hay operativos listados aún</p>
                                <p className="text-xs mt-1 text-slate-400">Crea el primero usando el formulario</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 relative z-10">
                                {staffList.map((s) => {
                                    const PersonitaAvatar = ({ colorHex, role }) => (
                                        <svg viewBox="0 0 100 100" className="w-[20px] h-[20px]">
                                            <g stroke={colorHex} strokeLinecap="round" strokeLinejoin="round">
                                                <animateTransform attributeName="transform" type="translate" values="0,0; 0,-3; 0,0" dur={`${2 + (s.user_id?.charCodeAt(0) % 3)}s`} repeatCount="indefinite" />
                                                <path d="M 25 85 Q 50 40 75 85" fill={`${colorHex}20`} strokeWidth="12" />
                                                <circle cx="50" cy="35" r="16" fill={colorHex} />
                                                {/* Role specific playful details */}
                                                {role === 'pilot' && <path d="M 32 30 L 68 30" stroke="white" strokeWidth="6" opacity="0.9"/>}
                                                {role === 'teacher' && <rect x="36" y="28" width="28" height="8" rx="2" stroke="white" strokeWidth="3" fill="none"/>}
                                                {role === 'assistant' && <path d="M 35 45 L 65 45 L 50 65 Z" fill={`${colorHex}60`} stroke="none"/>}
                                                {role === 'supervisor' && <circle cx="50" cy="35" r="5" fill="white" />}
                                                {role === 'admin' && <path d="M 30 35 A 20 20 0 0 1 70 35" stroke="white" strokeWidth="4" fill="none"/>}
                                            </g>
                                        </svg>
                                    );

                                    const roleIcons = { 
                                        pilot: <PersonitaAvatar colorHex="#6366f1" role="pilot" />, 
                                        teacher: <PersonitaAvatar colorHex="#10b981" role="teacher" />, 
                                        assistant: <PersonitaAvatar colorHex="#f59e0b" role="assistant" />, 
                                        admin: <PersonitaAvatar colorHex="#3b82f6" role="admin" />, 
                                        supervisor: <PersonitaAvatar colorHex="#8b5cf6" role="supervisor" /> 
                                    };
                                    const roleLabels = { pilot: 'Piloto', teacher: 'Docente', assistant: 'Auxiliar', admin: 'Admin', supervisor: 'Supervisor' };
                                    const isResetting = resetPassForm.user_id === s.user_id;

                                    return (
                                        <div key={s.user_id} className={`neu-list-item p-4 transition-all duration-300 ${s.is_active ? 'hover:-translate-y-0.5' : 'opacity-60 saturate-50'
                                            }`}>
                                            {/* Header: Nombre + Rol + Estado */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 neu-input-inset rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white/5 bg-slate-100 dark:bg-slate-800">
                                                        {roleIcons[s.role] || <UserPlus size={20} />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-extrabold neu-text truncate text-[15px] leading-tight">{s.full_name}</p>
                                                        <p className="neu-text-sub text-[10px] font-bold uppercase tracking-wider">{roleLabels[s.role] || s.role}</p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border shadow-sm ${s.is_active ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'}`}>
                                                        {s.is_active ? 'SYNC OK' : 'OFFLINE'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Email + Copiar */}
                                            {s.email && s.email !== 'N/A' && (
                                                <div className="flex items-center gap-2 mb-2 neu-input-inset px-3 py-2">
                                                    <Mail size={14} className="neu-text-sub flex-shrink-0" />
                                                    <span className="text-xs neu-text-sub font-medium truncate flex-1 select-all">{s.email}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => { navigator.clipboard.writeText(s.email); }}
                                                        className="p-1.5 hover:opacity-70 transition-opacity flex-shrink-0"
                                                        title="Copiar email"
                                                    >
                                                        <Copy size={14} className="text-cyan-500" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Contraseña inicial */}
                                            {s.initial_password && (
                                                <div className="flex items-center gap-2 mb-3 neu-input-inset px-3 py-2">
                                                    <Lock size={14} className="neu-text-sub flex-shrink-0" />
                                                    <span className="text-xs neu-text-sub font-medium truncate flex-1 select-all font-mono tracking-widest">
                                                        {revealedPasswords[s.user_id] ? s.initial_password : '••••••••'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRevealedPasswords(prev => ({ ...prev, [s.user_id]: !prev[s.user_id] }))}
                                                        className="p-1.5 hover:opacity-70 transition-opacity flex-shrink-0"
                                                        title={revealedPasswords[s.user_id] ? 'Ocultar contraseña' : 'Ver contraseña'}
                                                    >
                                                        {revealedPasswords[s.user_id]
                                                            ? <EyeOff size={14} className="text-amber-500" />
                                                            : <Eye size={14} className="text-amber-500" />
                                                        }
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { navigator.clipboard.writeText(s.initial_password); }}
                                                        className="p-1.5 hover:opacity-70 transition-opacity flex-shrink-0"
                                                        title="Copiar contraseña"
                                                    >
                                                        <Copy size={14} className="text-amber-500" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Acciones */}
                                            <div className="flex justify-end pt-2 mt-4 border-t border-slate-700/10 dark:border-slate-700/50">
                                                <select
                                                    className="neu-action-select w-full md:w-auto"
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val === 'preview') window.open(`/staff/preview?as=${s.user_id}`, '_blank');
                                                        if (val === 'edit') {
                                                            setEditForm(prev => prev.user_id === s.user_id
                                                                ? { user_id: null, email: '', full_name: '', role: '' }
                                                                : { user_id: s.user_id, email: s.email || '', full_name: s.full_name || '', role: s.role || '' }
                                                            );
                                                        }
                                                        if (val === 'reset_pass') {
                                                            setResetPassForm(prev => ({
                                                                user_id: prev.user_id === s.user_id ? null : s.user_id,
                                                                new_password: ''
                                                            }));
                                                        }
                                                        if (val === 'toggle_active') handleToggleStaffActive(s.user_id, s.is_active);
                                                        e.target.value = '';
                                                    }}
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>Acciones</option>
                                                    <option value="preview">👁️ Vista Previa</option>
                                                    <option value="edit">✏️ Editar Perfil</option>
                                                    <option value="reset_pass">🔑 Reset Password</option>
                                                    <option value="toggle_active">
                                                        {s.is_active ? '🔴 Desactivar' : '🟢 Activar'}
                                                    </option>
                                                </select>
                                            </div>

                                            {/* Inline Edit Form */}
                                            {editForm.user_id === s.user_id && (
                                                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
                                                    <p className="text-xs font-bold text-amber-400 mb-2">✏️ Editar perfil</p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="text-[10px] text-slate-500 font-bold uppercase">Nombre</label>
                                                            <input
                                                                type="text"
                                                                value={editForm.full_name}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, full_name: e.target.value }))}
                                                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                                placeholder="Nombre completo"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] text-slate-500 font-bold uppercase">Email</label>
                                                            <input
                                                                type="email"
                                                                value={editForm.email}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                                                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                                placeholder="correo@ejemplo.com"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-slate-500 font-bold uppercase">Rol</label>
                                                        <select
                                                            value={editForm.role}
                                                            onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                                                        >
                                                            <option value="pilot">Piloto</option>
                                                            <option value="teacher">Docente</option>
                                                            <option value="assistant">Auxiliar</option>
                                                            <option value="supervisor">Supervisor</option>
                                                            <option value="admin">Admin</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex gap-2 pt-1">
                                                        <button
                                                            onClick={handleEditStaff}
                                                            disabled={editLoading}
                                                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1"
                                                        >
                                                            {editLoading ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : '💾 Guardar cambios'}
                                                        </button>
                                                        <button
                                                            onClick={() => setEditForm({ user_id: null, email: '', full_name: '', role: '' })}
                                                            className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 text-sm font-medium rounded-lg transition-colors"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Reset Password Inline */}
                                            {isResetting && (
                                                <div className="mt-3 pt-3 border-t border-slate-700/50 flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Nueva contraseña"
                                                        value={resetPassForm.new_password}
                                                        onChange={(e) => setResetPassForm(prev => ({ ...prev, new_password: e.target.value }))}
                                                        className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                                                    />
                                                    <button
                                                        onClick={() => handleResetStaffPassword(s.user_id)}
                                                        className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-lg transition-colors"
                                                    >
                                                        Guardar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                    </div>
                </div>
            )}

            {/* FOOTER */}
            <footer className="max-w-5xl mx-auto mt-12 text-center text-slate-500 text-xs">
                <p>Panel de Administración · Fly High Edu · {new Date().getFullYear()}</p>
            </footer>

            
            {activeTab === 'hr' && (
                <HRCommandCenter />
            )}

            {activeTab.startsWith('analytics-') && (
                <AnalyticsView activeTab={activeTab} />
            )}
        </AdminLayout>

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
