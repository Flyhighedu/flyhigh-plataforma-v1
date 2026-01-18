'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabaseNew } from '@/lib/supabaseClientNew';
import {
    Plane, Upload, Users, Radio, CheckCircle, AlertCircle, Loader2,
    School, MapPin, FileText, Camera, Lock, KeyRound, ShieldCheck,
    Building2, Mail, Eye, EyeOff, Trash2, RefreshCw, Heart, Pencil, X, Calendar,
    ChevronDown, ChevronUp
} from 'lucide-react';

// Dynamic import to prevent hydration mismatch (DashboardPage uses window.location)
const DashboardPage = dynamic(() => import('../dashboard/page'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-[400px] bg-slate-100">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
    )
});

// Contraseña fija (en producción, usar autenticación real)
const ADMIN_PASSWORD = 'Flyhigh2026';

export default function AdminPage() {
    // ============================================
    // TODOS LOS HOOKS DEBEN IR AL INICIO
    // ============================================

    // --- ESTADO DE AUTENTICACIÓN ---
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);

    // --- ESTADO DE TABS ---
    const [activeTab, setActiveTab] = useState('vuelos'); // 'vuelos' | 'patrocinadores' | 'cronograma'
    // New state for embedded dashboard preview
    const [showDashboardPreview, setShowDashboardPreview] = useState(false);

    // --- ESTADO DEL FORMULARIO DE VUELO ---
    const [flightForm, setFlightForm] = useState({
        nombreEscuela: '',
        ninosSesion: '',
        colonia: ''
    });
    const [actaFile, setActaFile] = useState(null);
    const [fotoFile, setFotoFile] = useState(null);
    const [flightLoading, setFlightLoading] = useState(false);
    const [flightMessage, setFlightMessage] = useState({ type: '', text: '' });
    const [editingFlightId, setEditingFlightId] = useState(null);

    const [flightsList, setFlightsList] = useState([]);
    const [fetchingFlights, setFetchingFlights] = useState(false);

    // --- ESTADO DE CRONOGRAMA (Próximas Escuelas) ---
    const [nextSchools, setNextSchools] = useState([]);
    const [nextSchoolForm, setNextSchoolForm] = useState({
        nombre_escuela: '',
        colonia: '',
        fecha_programada: ''
    });
    const [nextSchoolLoading, setNextSchoolLoading] = useState(false); // <--- Added this line
    const [fetchingNextSchools, setFetchingNextSchools] = useState(false);
    const [editingSchoolId, setEditingSchoolId] = useState(null);

    // --- ESTADO DE ESCUELAS EXTRAS (Históricas/Manuales) ---
    const [extraSchools, setExtraSchools] = useState([]);
    const [extraSchoolForm, setExtraSchoolForm] = useState({ nombre: '' });
    const [extraSchoolLoading, setExtraSchoolLoading] = useState(false);
    const [fetchingExtraSchools, setFetchingExtraSchools] = useState(false);

    const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);

    // --- ESTADO DEL PANEL DE IMPACTO ---
    const [impactData, setImpactData] = useState({
        ninosVoladosAcumulado: 0,
        vueloEnVivo: false
    });
    const [impactLoading, setImpactLoading] = useState(false);
    const [impactMessage, setImpactMessage] = useState({ type: '', text: '' });
    const [fetchingImpact, setFetchingImpact] = useState(true);

    // --- ESTADO DE PATROCINADORES ---
    const [sponsorForm, setSponsorForm] = useState({
        nombre: '',
        email: '',
        password: '',
        aportacion: '' // Nuevo campo para inversión
    });
    const [sponsors, setSponsors] = useState([]);
    const [sponsorLoading, setSponsorLoading] = useState(false);
    const [sponsorMessage, setSponsorMessage] = useState({ type: '', text: '' });
    const [fetchingSponsors, setFetchingSponsors] = useState(true);
    const [showPasswords, setShowPasswords] = useState(false);
    const [editingSponsorId, setEditingSponsorId] = useState(null);

    // --- ESTADO DE IMPACTO DE BECAS (tabla estadísticas) ---
    const [ninosPatrocinados, setNinosPatrocinados] = useState(0);
    const [becasLoading, setBecasLoading] = useState(false);
    const [becasMessage, setBecasMessage] = useState({ type: '', text: '' });
    const [fetchingBecas, setFetchingBecas] = useState(true);

    // --- EFFECTS ---
    // Verificar si ya está autenticado (sessionStorage)
    useEffect(() => {
        const authStatus = sessionStorage.getItem('flyHighAdminAuth');
        if (authStatus === 'authenticated') {
            setIsAuthenticated(true);
        }
    }, []);

    // Cargar datos de impacto al montar (solo si está autenticado)
    useEffect(() => {
        if (!isAuthenticated) return;

        fetchFlightsList(); // Cargar lista de vuelos

        const fetchImpactData = async () => {
            try {
                const { data, error } = await supabaseNew
                    .from('impacto_global')
                    .select('*')
                    .limit(1)
                    .single();

                if (error) throw error;

                if (data) {
                    setImpactData({
                        ninosVoladosAcumulado: data.niños_volados_acumulado || data.ninos_volados_acumulado || 0,
                        vueloEnVivo: data.vuelo_en_vivo || false
                    });
                }
            } catch (err) {
                console.error('Error fetching impact data:', err);
                setImpactMessage({ type: 'error', text: 'Error al cargar datos de impacto.' });
            } finally {
                setFetchingImpact(false);
            }
        };

        fetchImpactData();
    }, [isAuthenticated]);

    // Cargar patrocinadores y cronograma al montar
    useEffect(() => {
        if (!isAuthenticated) return;
        fetchSponsors();
        fetchBecasData();
        fetchNextSchools();
        fetchSponsors();
        fetchBecasData();
        fetchNextSchools();
        fetchExtraSchools();
    }, [isAuthenticated]);

    // Fetch Escuelas Extras
    const fetchExtraSchools = async () => {
        setFetchingExtraSchools(true);
        try {
            const { data, error } = await supabaseNew
                .from('escuelas_extras')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                if (error.code === '42P01') {
                    console.warn('Tabla escuelas_extras no existe.');
                    return;
                }
                throw error;
            }
            setExtraSchools(data || []);
        } catch (err) {
            console.error('Error fetching extra schools:', err);
        } finally {
            setFetchingExtraSchools(false);
        }
    };

    // Fetch próximas escuelas
    const fetchNextSchools = async () => {
        setFetchingNextSchools(true);
        try {
            const { data, error } = await supabaseNew
                .from('proximas_escuelas')
                .select('*')
                .order('fecha_programada', { ascending: true });

            if (error) {
                if (error.code === '42P01') {
                    console.warn('Tabla proximas_escuelas no existe.');
                    return;
                }
                throw error;
            }
            setNextSchools(data || []);
        } catch (err) {
            console.error('Error fetching next schools:', err);
        } finally {
            setFetchingNextSchools(false);
        }
    };

    // Cargar datos de becas
    // Cargar datos de becas
    const fetchBecasData = async () => {
        setFetchingBecas(true);
        try {
            // NOMBRE REAL (Confirmado por imagen): tabla "stats", columna "total_sponsored_kids"
            let { data, error } = await supabaseNew
                .from('stats')
                .select('*')
                .limit(1)
                .single();

            if (error) {
                console.warn('Error fetching stats:', error);
                // Fallback por si acaso sigue existiendo la tabla anterior
                if (error.code === 'PGRST205') {
                    console.log('Intentando fallback a "estadísticas"...');
                    const res = await supabaseNew.from('estadísticas').select('*').limit(1).single();
                    if (res.data) data = res.data;
                } else {
                    return;
                }
            }

            if (data) {
                // Columna correcta confirmada: total_sponsored_kids
                const val = data['total_sponsored_kids'] || data['niños patrocinados'] || 0;
                setNinosPatrocinados(val);
            }
        } catch (err) {
            console.error('Error fetching becas data:', err);
        } finally {
            setFetchingBecas(false);
        }
    };

    const fetchFlightsList = async () => {
        setFetchingFlights(true);
        try {
            const { data, error } = await supabaseNew
                .from('historial_vuelos')
                .select('*')
                .order('fecha', { ascending: false });

            if (error) throw error;
            setFlightsList(data || []);
        } catch (err) {
            console.error('Error fetching flights:', err);
        } finally {
            setFetchingFlights(false);
        }
    };

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

    // Handler de Login
    const handleLogin = (e) => {
        e.preventDefault();
        setLoginLoading(true);
        setLoginError('');

        setTimeout(() => {
            if (password === ADMIN_PASSWORD) {
                sessionStorage.setItem('flyHighAdminAuth', 'authenticated');
                setIsAuthenticated(true);
            } else {
                setLoginError('Contraseña incorrecta. Intenta de nuevo.');
            }
            setLoginLoading(false);
        }, 500);
    };

    // Handlers de formulario de vuelo
    const handleFlightInputChange = (e) => {
        const { name, value } = e.target;
        setFlightForm(prev => ({ ...prev, [name]: value }));
    };

    const handleActaChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setActaFile(e.target.files[0]);
        }
    };

    const handleFotoChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFotoFile(e.target.files[0]);
        }
    };

    const handleFlightSubmit = async (e) => {
        e.preventDefault();
        setFlightLoading(true);
        setFlightMessage({ type: '', text: '' });

        try {
            let actaUrl = null;
            let fotoUrl = null;
            const timestamp = Date.now();

            // Subir Acta si hay nuevo archivo
            if (actaFile) {
                const actaPath = `acta_${timestamp}_${actaFile.name}`;
                const { error: actaError } = await supabaseNew.storage
                    .from('actas-vuelos')
                    .upload(actaPath, actaFile);

                if (actaError) throw new Error(`Error subiendo acta: ${actaError.message}`);

                const { data: actaPublicUrl } = supabaseNew.storage
                    .from('actas-vuelos')
                    .getPublicUrl(actaPath);
                actaUrl = actaPublicUrl.publicUrl;
            }

            // Subir Foto si hay nuevo archivo
            if (fotoFile) {
                const fotoPath = `foto_${timestamp}_${fotoFile.name}`;
                const { error: fotoError } = await supabaseNew.storage
                    .from('fotos-impacto')
                    .upload(fotoPath, fotoFile);

                if (fotoError) throw new Error(`Error subiendo foto: ${fotoError.message}`);

                const { data: fotoPublicUrl } = supabaseNew.storage
                    .from('fotos-impacto')
                    .getPublicUrl(fotoPath);
                fotoUrl = fotoPublicUrl.publicUrl;
            }

            if (editingFlightId) {
                // UPDATE
                const updates = {
                    nombre_escuela: flightForm.nombreEscuela,
                    ninos_sesion: parseInt(flightForm.ninosSesion) || 0,
                    colonia: flightForm.colonia,
                };
                if (actaUrl) updates.acta_url = actaUrl;
                if (fotoUrl) updates.foto_url = fotoUrl;

                const { error: updateError } = await supabaseNew
                    .from('historial_vuelos')
                    .update(updates)
                    .eq('id', editingFlightId);

                if (updateError) throw updateError;

                setFlightMessage({ type: 'success', text: 'Vuelo actualizado con éxito' });
                setEditingFlightId(null);
            } else {
                // INSERT
                const { error: insertError } = await supabaseNew
                    .from('historial_vuelos')
                    .insert({
                        nombre_escuela: flightForm.nombreEscuela,
                        ninos_sesion: parseInt(flightForm.ninosSesion) || 0,
                        colonia: flightForm.colonia,
                        acta_url: actaUrl,
                        foto_url: fotoUrl,
                        fecha: new Date().toISOString()
                    });

                if (insertError) throw insertError;
                setFlightMessage({ type: 'success', text: 'Vuelo registrado con éxito' });
            }

            // Reset form
            setFlightForm({ nombreEscuela: '', ninosSesion: '', colonia: '' });
            setActaFile(null);
            setFotoFile(null);
            // Refresh list if it exists (need to implement fetchFlightsList)
            if (typeof fetchFlightsList === 'function') fetchFlightsList();

        } catch (err) {
            console.error('Error saving flight:', err);
            setFlightMessage({ type: 'error', text: err.message });
        } finally {
            setFlightLoading(false);
        }
    };

    const handleEditFlight = (flight) => {
        setFlightForm({
            nombreEscuela: flight.nombre_escuela,
            ninosSesion: flight.ninos_sesion,
            colonia: flight.colonia
        });
        setEditingFlightId(flight.id);
        setFlightMessage({ type: 'info', text: 'Editando vuelo. Sube archivos solo si deseas cambiarlos.' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEditFlight = () => {
        setFlightForm({ nombreEscuela: '', ninosSesion: '', colonia: '' });
        setEditingFlightId(null);
        setFlightMessage({ type: '', text: '' });
        setActaFile(null);
        setFotoFile(null);
    };

    const handleDeleteFlight = async (id) => {
        if (!confirm('¿Estás seguro de eliminar este vuelo? Esta acción no se puede deshacer.')) return;

        // Optimistic UI
        const originalList = [...flightsList];
        setFlightsList(prev => prev.filter(f => f.id !== id));

        try {
            const { error } = await supabaseNew
                .from('historial_vuelos')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (err) {
            console.error('Error deleting flight:', err);
            alert('Error al eliminar vuelo');
            setFlightsList(originalList); // Rollback
        }
    };

    // Handlers de panel de impacto
    const handleImpactChange = (e) => {
        const { name, value, type, checked } = e.target;
        setImpactData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleNextSchoolSubmit = async (e) => {
        e.preventDefault();
        setNextSchoolLoading(true);
        try {
            const schoolData = {
                nombre_escuela: nextSchoolForm.nombre_escuela,
                colonia: nextSchoolForm.colonia,
                fecha_programada: nextSchoolForm.fecha_programada,
            };

            if (editingSchoolId) {
                // UPDATE (Editar)
                const { data, error } = await supabaseNew
                    .from('proximas_escuelas')
                    .update(schoolData)
                    .eq('id', editingSchoolId)
                    .select()
                    .single();

                if (error) throw error;

                setNextSchools(prev => prev.map(s => s.id === editingSchoolId ? data : s));
                setEditingSchoolId(null);
                alert('Misión actualizada exitosamente');
            } else {
                // INSERT (Crear)
                const { data, error } = await supabaseNew
                    .from('proximas_escuelas')
                    .insert({ ...schoolData, estatus: 'pendiente' })
                    .select()
                    .single();

                if (error) throw error;

                setNextSchools(prev => [...prev, data]);
                alert('Escuela programada exitosamente');
            }

            setNextSchoolForm({ nombre_escuela: '', colonia: '', fecha_programada: '' });
        } catch (err) {
            console.error('Error saving next school:', err);
            alert('Error al guardar escuela');
        } finally {
            setNextSchoolLoading(false);
        }
    };

    const handleEditNextSchool = (school) => {
        setNextSchoolForm({
            nombre_escuela: school.nombre_escuela,
            colonia: school.colonia,
            fecha_programada: school.fecha_programada
        });
        setEditingSchoolId(school.id);
        // Scroll to form if needed? Not strictly necessary but good UX.
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelNextSchoolEdit = () => {
        setNextSchoolForm({ nombre_escuela: '', colonia: '', fecha_programada: '' });
        setEditingSchoolId(null);
    };

    const handleCompleteNextSchool = async (id, currentStatus) => {
        // Optimistic UI Update
        const newStatus = currentStatus === 'completado' ? 'pendiente' : 'completado';
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
        if (!confirm('¿Estás seguro de eliminar este registro permanentemente?')) return;

        // Optimistic UI Update
        const previousSchools = [...nextSchools];
        setNextSchools(prev => prev.filter(s => s.id !== id));

        try {
            const { error } = await supabaseNew
                .from('proximas_escuelas')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (err) {
            console.error('Error deleting school:', err);
            // Revert
            setNextSchools(previousSchools);
            alert('Error al eliminar');
        }
    };

    const handleImpactSubmit = async (e) => {
        e.preventDefault();
        setImpactLoading(true);
        setImpactMessage({ type: '', text: '' });

        try {
            const updatePayload = {
                vuelo_en_vivo: impactData.vueloEnVivo
            };

            const { data: schemaCheck } = await supabaseNew
                .from('impacto_global')
                .select('*')
                .limit(1)
                .single();

            if (schemaCheck && 'niños_volados_acumulado' in schemaCheck) {
                updatePayload['niños_volados_acumulado'] = parseInt(impactData.ninosVoladosAcumulado) || 0;
            } else {
                updatePayload['ninos_volados_acumulado'] = parseInt(impactData.ninosVoladosAcumulado) || 0;
            }

            const { error } = await supabaseNew
                .from('impacto_global')
                .update(updatePayload)
                .eq('id', 1);

            if (error) throw new Error(`Error actualizando impacto: ${error.message}`);

            setImpactMessage({ type: 'success', text: '¡Impacto global actualizado!' });

        } catch (err) {
            console.error(err);
            setImpactMessage({ type: 'error', text: err.message });
        } finally {
            setImpactLoading(false);
        }
    };

    // Handlers de patrocinadores
    const handleSponsorInputChange = (e) => {
        const { name, value } = e.target;
        setSponsorForm(prev => ({ ...prev, [name]: value }));
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
                        aportacion_total: parseFloat(sponsorForm.aportacion) || 0
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
                        aportacion_total: parseFloat(sponsorForm.aportacion) || 0
                    });

                if (error) throw new Error(`Error guardando patrocinador: ${error.message}`);
                setSponsorMessage({ type: 'success', text: '¡Patrocinador registrado exitosamente!' });
            }

            setSponsorForm({ nombre: '', email: '', password: '', aportacion: '' });
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
            aportacion: sponsor.aportacion_total || ''
        });
        setSponsorMessage({ type: '', text: '' });
        // Scroll hacia arriba para ver el formulario
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingSponsorId(null);
        setSponsorForm({ nombre: '', email: '', password: '', aportacion: '' });
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

    // Handlers de Escuelas Extras
    const handleExtraSchoolSubmit = async (e) => {
        e.preventDefault();
        setExtraSchoolLoading(true);
        try {
            const { data, error } = await supabaseNew
                .from('escuelas_extras')
                .insert({ nombre: extraSchoolForm.nombre })
                .select()
                .single();

            if (error) throw error;

            setExtraSchools(prev => [data, ...prev]);
            setExtraSchoolForm({ nombre: '' });
            alert('Escuela extra agregada exitosamente');
        } catch (err) {
            console.error('Error saving extra school:', err);
            alert('Error al guardar escuela extra');
        } finally {
            setExtraSchoolLoading(false);
        }
    };

    const handleDeleteExtraSchool = async (id) => {
        if (!confirm('¿Eliminar esta escuela extra?')) return;

        // Optimistic
        const prevList = [...extraSchools];
        setExtraSchools(prev => prev.filter(s => s.id !== id));

        try {
            const { error } = await supabaseNew
                .from('escuelas_extras')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (err) {
            console.error('Error deleting extra school:', err);
            setExtraSchools(prevList);
            alert('Error al eliminar');
        }
    };

    // Handler para actualizar niños patrocinados (Impacto de Becas)
    const handleBecasUpdate = async () => {
        setBecasLoading(true);
        setBecasMessage({ type: '', text: '' });

        try {
            // Update en tabla REAL: 'stats'
            let { error } = await supabaseNew
                .from('stats')
                .update({ 'total_sponsored_kids': parseInt(ninosPatrocinados) || 0 })
                .eq('id', 1);

            if (error) throw new Error(`Error actualizando: ${error.message}`);

            setBecasMessage({ type: 'success', text: '¡Impacto de becas actualizado!' });

        } catch (err) {
            console.error(err);
            setBecasMessage({ type: 'error', text: err.message });
        } finally {
            setBecasLoading(false);
        }
    };

    // ============================================
    // RENDER
    // ============================================

    // --- PANTALLA DE LOGIN ---
    if (!isAuthenticated) {
        return (
            <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white font-sans flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl shadow-lg shadow-blue-500/30 mb-6">
                            <ShieldCheck className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2">
                            Acceso <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Restringido</span>
                        </h1>
                        <p className="text-slate-400 text-sm">Panel de Administración · Fly High Edu</p>
                    </div>

                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                                    <KeyRound size={14} /> Contraseña de Administrador
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        placeholder="Ingresa la contraseña"
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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

    // --- PANEL DE ADMINISTRACIÓN ---
    return (
        <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white font-sans p-4 md:p-8">
            {/* HEADER */}
            <header className="max-w-5xl mx-auto mb-8 relative">
                {/* Logout Button - Mobile & Desktop */}
                <div className="flex justify-end mb-4 md:absolute md:top-0 md:right-0 md:mb-0">
                    <button
                        onClick={() => {
                            sessionStorage.removeItem('flyHighAdminAuth');
                            setIsAuthenticated(false);
                            setPassword('');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors text-sm font-bold"
                    >
                        <Lock size={16} /> Cerrar Sesión
                    </button>
                </div>

                <div className="text-center">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <Plane className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-2xl md:text-4xl font-black tracking-tight">
                            Panel de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Administración</span>
                        </h1>
                    </div>
                    <p className="text-slate-400 text-sm md:text-base">Gestiona los vuelos, patrocinadores e impacto de Fly High Edu</p>
                </div>
            </header>

            {/* TABS */}
            {/* TABS */}
            <div className="max-w-5xl mx-auto mb-8">
                <div className="flex flex-wrap gap-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2">
                    <button
                        onClick={() => setActiveTab('vuelos')}
                        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all ${activeTab === 'vuelos'
                            ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Plane size={18} />
                        Vuelos & Impacto
                    </button>
                    <button
                        onClick={() => setActiveTab('patrocinadores')}
                        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all ${activeTab === 'patrocinadores'
                            ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Building2 size={18} />
                        Patrocinadores
                    </button>
                    <button
                        onClick={() => setActiveTab('cronograma')}
                        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all ${activeTab === 'cronograma'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Calendar size={18} />
                        Cronograma
                    </button>
                </div>
            </div>

            {/* CONTENIDO DE TABS */}
            {activeTab === 'vuelos' && (
                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                    {/* --- TARJETA: REGISTRO DE VUELO --- */}
                    <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                <Plane className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-lg md:text-xl font-bold">Registrar Vuelo</h2>
                                <p className="text-slate-400 text-xs">Añade una nueva sesión de vuelo</p>
                            </div>
                        </div>

                        <form onSubmit={handleFlightSubmit} className="space-y-5">
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                    <School size={14} /> Nombre de la Escuela
                                </label>
                                <input
                                    type="text"
                                    name="nombreEscuela"
                                    value={flightForm.nombreEscuela}
                                    onChange={handleFlightInputChange}
                                    required
                                    placeholder="Ej: Escuela Primaria Benito Juárez"
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                    <Users size={14} /> Niños en esta Sesión
                                </label>
                                <input
                                    type="number"
                                    name="ninosSesion"
                                    value={flightForm.ninosSesion}
                                    onChange={handleFlightInputChange}
                                    required
                                    min="1"
                                    placeholder="Ej: 25"
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                    <MapPin size={14} /> Colonia
                                </label>
                                <input
                                    type="text"
                                    name="colonia"
                                    value={flightForm.colonia}
                                    onChange={handleFlightInputChange}
                                    required
                                    placeholder="Ej: Centro"
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                        <FileText size={14} /> Acta de Vuelo
                                    </label>
                                    <label className="flex flex-col items-center justify-center w-full h-24 bg-slate-800/50 border border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-blue-500 transition-colors group">
                                        <Upload size={20} className="text-slate-400 group-hover:text-blue-400 mb-1 transition-colors" />
                                        <span className="text-xs text-slate-400 group-hover:text-blue-400 transition-colors">
                                            {actaFile ? actaFile.name.slice(0, 20) + '...' : 'Seleccionar archivo'}
                                        </span>
                                        <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.png" onChange={handleActaChange} />
                                    </label>
                                </div>

                                <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                        <Camera size={14} /> Foto de Impacto
                                    </label>
                                    <label className="flex flex-col items-center justify-center w-full h-24 bg-slate-800/50 border border-dashed border-slate-600 rounded-xl cursor-pointer hover:border-pink-500 transition-colors group">
                                        <Upload size={20} className="text-slate-400 group-hover:text-pink-400 mb-1 transition-colors" />
                                        <span className="text-xs text-slate-400 group-hover:text-pink-400 transition-colors">
                                            {fotoFile ? fotoFile.name.slice(0, 20) + '...' : 'Seleccionar imagen'}
                                        </span>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleFotoChange} />
                                    </label>
                                </div>
                            </div>

                            {flightMessage.text && (
                                <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${flightMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                                    {flightMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                    {flightMessage.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={flightLoading}
                                className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${editingFlightId
                                    ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-orange-500/30 hover:shadow-orange-500/50 text-white'
                                    : 'bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-emerald-500/30 hover:shadow-emerald-500/50 text-white'
                                    }`}
                            >
                                {flightLoading ? (
                                    <><Loader2 size={18} className="animate-spin" /> {editingFlightId ? 'Actualizando...' : 'Guardando...'} </>
                                ) : (
                                    <>{editingFlightId ? <RefreshCw size={18} /> : <Plane size={18} />} {editingFlightId ? 'Actualizar Vuelo' : 'Guardar Vuelo'}</>
                                )}
                            </button>

                            {editingFlightId && (
                                <button
                                    type="button"
                                    onClick={handleCancelEditFlight}
                                    className="w-full mt-3 bg-slate-700 text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <X size={18} /> Cancelar Edición
                                </button>
                            )}
                        </form>
                    </section>

                    {/* --- TARJETA: PANEL DE IMPACTO GLOBAL --- */}
                    <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                                <Radio className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-lg md:text-xl font-bold">Impacto Global</h2>
                                <p className="text-slate-400 text-xs">Actualiza los contadores públicos</p>
                            </div>
                        </div>

                        {fetchingImpact ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={32} className="animate-spin text-slate-400" />
                            </div>
                        ) : (
                            <form onSubmit={handleImpactSubmit} className="space-y-6">
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                        <Users size={14} /> Niños Volados Acumulado
                                    </label>
                                    <input
                                        type="number"
                                        name="ninosVoladosAcumulado"
                                        value={impactData.ninosVoladosAcumulado}
                                        onChange={handleImpactChange}
                                        min="0"
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-4 text-3xl font-black text-center text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                                    />
                                    <p className="text-xs text-slate-500 mt-2 text-center">Este número se muestra en la página principal.</p>
                                </div>

                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${impactData.vueloEnVivo ? 'bg-red-500 animate-pulse' : 'bg-slate-600'}`}></div>
                                            <div>
                                                <p className="font-bold text-white">Vuelo en Vivo</p>
                                                <p className="text-xs text-slate-400">Activa el indicador de transmisión</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                name="vueloEnVivo"
                                                checked={impactData.vueloEnVivo}
                                                onChange={handleImpactChange}
                                                className="sr-only peer"
                                            />
                                            <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500"></div>
                                        </label>
                                    </div>
                                </div>

                                {impactMessage.text && (
                                    <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${impactMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                                        {impactMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                        {impactMessage.text}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={impactLoading}
                                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {impactLoading ? (
                                        <><Loader2 size={18} className="animate-spin" /> Actualizando...</>
                                    ) : (
                                        <><Radio size={18} /> Actualizar Impacto</>
                                    )}
                                </button>
                            </form>
                        )}
                    </section>

                    {/* --- TARJETA: LISTA DE VUELOS --- */}
                    <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl lg:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg md:text-xl font-bold">Historial de Vuelos</h2>
                                    <p className="text-slate-400 text-xs">{flightsList.length} registros encontrados</p>
                                </div>
                            </div>
                            <button
                                onClick={fetchFlightsList}
                                className="p-2 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-700/50 transition-colors"
                            >
                                <RefreshCw size={18} className="text-slate-400" />
                            </button>
                        </div>

                        {fetchingFlights ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={32} className="animate-spin text-slate-400" />
                            </div>
                        ) : flightsList.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <Plane size={48} className="mx-auto mb-4 opacity-30" />
                                <p>No hay vuelos registrados aún.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {flightsList.map((flight) => (
                                    <div key={flight.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 hover:bg-slate-800/50 transition-all flex flex-col justify-between group">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-mono text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
                                                    {new Date(flight.fecha).toLocaleDateString()}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleEditFlight(flight)}
                                                        className="p-1.5 text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors"
                                                        title="Editar"
                                                    >
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteFlight(flight.id)}
                                                        className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                            <h3 className="font-bold text-white mb-1 line-clamp-1" title={flight.nombre_escuela}>
                                                {flight.nombre_escuela}
                                            </h3>
                                            <p className="text-xs text-slate-400 flex items-center gap-1 mb-3">
                                                <MapPin size={12} /> {flight.colonia}
                                            </p>
                                        </div>

                                        <div className="pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1 text-slate-300">
                                                <Users size={12} /> <span className="font-bold">{flight.ninos_sesion}</span> niños
                                            </div>
                                            <div className="flex gap-2">
                                                {flight.acta_url && (
                                                    <a href={flight.acta_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Acta</a>
                                                )}
                                                {flight.foto_url && (
                                                    <a href={flight.foto_url} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:underline">Foto</a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

            )
            }

            {
                activeTab === 'patrocinadores' && (
                    <div className="max-w-5xl mx-auto space-y-8">
                        {/* --- SECCIÓN: IMPACTO DE BECAS --- */}
                        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-fuchsia-500/20 rounded-xl flex items-center justify-center">
                                    <Heart className="w-5 h-5 text-fuchsia-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg md:text-xl font-bold">Impacto de Becas</h2>
                                    <p className="text-slate-400 text-xs">Tabla: estadísticas · Columna: niños patrocinados</p>
                                </div>
                            </div>

                            {fetchingBecas ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-fuchsia-500" />
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                            <Users size={14} /> Niños Patrocinados
                                        </label>
                                        <input
                                            type="number"
                                            value={ninosPatrocinados}
                                            onChange={(e) => setNinosPatrocinados(e.target.value)}
                                            min="0"
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white text-2xl font-bold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent transition-all"
                                        />
                                        <p className="text-slate-500 text-xs mt-2">Este valor se muestra en Homepage y Dashboard de patrocinadores.</p>
                                    </div>

                                    {becasMessage.text && (
                                        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${becasMessage.type === 'success'
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                                            }`}>
                                            {becasMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                            {becasMessage.text}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleBecasUpdate}
                                        disabled={becasLoading}
                                        className="w-full bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-fuchsia-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {becasLoading ? (
                                            <><Loader2 size={18} className="animate-spin" /> Actualizando...</>
                                        ) : (
                                            <><RefreshCw size={18} /> Actualizar Impacto</>
                                        )}
                                    </button>
                                </div>
                            )}
                        </section>

                        {/* --- FORMULARIO DE ALTA DE PATROCINADOR --- */}
                        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-violet-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg md:text-xl font-bold">Nuevo Patrocinador</h2>
                                    <p className="text-slate-400 text-xs">Registra una nueva empresa patrocinadora</p>
                                </div>
                            </div>

                            <form onSubmit={handleSponsorSubmit} className="space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                            <Building2 size={14} /> Nombre de Empresa
                                        </label>
                                        <input
                                            type="text"
                                            name="nombre"
                                            value={sponsorForm.nombre}
                                            onChange={handleSponsorInputChange}
                                            required
                                            placeholder="Ej: Empresa ABC"
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                            <Mail size={14} /> Correo Electrónico
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={sponsorForm.email}
                                            onChange={handleSponsorInputChange}
                                            required
                                            placeholder="contacto@empresa.com"
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                            <Lock size={14} /> Contraseña
                                        </label>
                                        <input
                                            type="text"
                                            name="password"
                                            value={sponsorForm.password}
                                            onChange={handleSponsorInputChange}
                                            required
                                            placeholder="Contraseña de acceso"
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Nueva fila para Aportación */}
                                <div>
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                        <span className="text-emerald-400">💲</span> Aportación Económica ($)
                                    </label>
                                    <input
                                        type="number"
                                        name="aportacion"
                                        value={sponsorForm.aportacion}
                                        onChange={handleSponsorInputChange}
                                        placeholder="Ej: 50000"
                                        className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all font-mono"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Esta cifra será visible solo para este patrocinador.</p>
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
                                    className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${editingSponsorId
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/30 hover:shadow-amber-500/50 text-white'
                                        : 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/30 hover:shadow-emerald-500/50 text-white'
                                        }`}
                                >
                                    {sponsorLoading ? (
                                        <><Loader2 size={18} className="animate-spin" /> {editingSponsorId ? 'Actualizando...' : 'Guardando...'} </>
                                    ) : (
                                        <>{editingSponsorId ? <RefreshCw size={18} /> : <Building2 size={18} />} {editingSponsorId ? 'Actualizar Datos' : 'Registrar Patrocinador'}</>
                                    )}
                                </button>

                                {editingSponsorId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="w-full mt-3 bg-slate-700 text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <X size={18} /> Cancelar Edición
                                    </button>
                                )}
                            </form>
                        </section>

                        {/* --- LISTA DE PATROCINADORES --- */}
                        <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
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
                                        className="p-2 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-700/50 transition-colors"
                                        title={showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                                    >
                                        {showPasswords ? <EyeOff size={18} className="text-slate-400" /> : <Eye size={18} className="text-slate-400" />}
                                    </button>
                                    <button
                                        onClick={fetchSponsors}
                                        className="p-2 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-700/50 transition-colors"
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
                                    {sponsors.map((sponsor) => (
                                        <div
                                            key={sponsor.id}
                                            className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:bg-slate-800/50 transition-colors"
                                        >
                                            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Empresa</p>
                                                    <p className="font-bold text-white">{sponsor.nombre}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Correo</p>
                                                    <p className="text-slate-300">{sponsor.email}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Contraseña</p>
                                                    <p className="text-slate-300 font-mono">
                                                        {showPasswords ? sponsor.password : '••••••••'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Inversión</p>
                                                    <p className="text-emerald-400 font-bold font-mono">
                                                        ${(sponsor.aportacion_total || 0).toLocaleString()} MXN
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-row md:flex-col gap-2 justify-end mt-4 md:mt-0">
                                                <button
                                                    onClick={() => window.open(`/dashboard?action=test_login&email=${encodeURIComponent(sponsor.email)}&password=${encodeURIComponent(sponsor.password)}`, '_blank')}
                                                    className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded-xl hover:bg-violet-500/20 transition-colors"
                                                    title="Probar Login y Ver Dashboard"
                                                >
                                                    <Eye size={16} /> <span className="text-xs font-bold">Test</span>
                                                </button>
                                                <button
                                                    onClick={() => handleEditSponsor(sponsor)}
                                                    className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition-colors"
                                                    title="Editar datos"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSponsor(sponsor.id)}
                                                    className="p-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors"
                                                    title="Eliminar patrocinador"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
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
                )
            }

            {/* CONTENIDO CRONOGRAMA */}
            {
                activeTab === 'cronograma' && (
                    <>
                        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                            {/* --- TARJETA: PROGRAMAR ESCUELA --- */}
                            <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                                        <Calendar className="w-5 h-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg md:text-xl font-bold">Programar Misión</h2>
                                        <p className="text-slate-400 text-xs">Agendar próxima visita a escuela</p>
                                    </div>
                                </div>

                                <form onSubmit={handleNextSchoolSubmit} className="space-y-5">
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                            <School size={14} /> Nombre de la Escuela
                                        </label>
                                        <input
                                            type="text"
                                            value={nextSchoolForm.nombre_escuela}
                                            onChange={(e) => setNextSchoolForm({ ...nextSchoolForm, nombre_escuela: e.target.value })}
                                            required
                                            placeholder="Ej: Primaria Lázaro Cárdenas"
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                            <MapPin size={14} /> Colonia / Ubicación
                                        </label>
                                        <input
                                            type="text"
                                            value={nextSchoolForm.colonia}
                                            onChange={(e) => setNextSchoolForm({ ...nextSchoolForm, colonia: e.target.value })}
                                            required
                                            placeholder="Ej: Col. La Charanda"
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                            <Calendar size={14} /> Fecha Programada
                                        </label>
                                        <input
                                            type="date"
                                            value={nextSchoolForm.fecha_programada}
                                            onChange={(e) => setNextSchoolForm({ ...nextSchoolForm, fecha_programada: e.target.value })}
                                            required
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={nextSchoolLoading}
                                        className={`w-full font-bold py-4 rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${editingSchoolId
                                            ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-orange-500/30 hover:shadow-orange-500/50 text-white'
                                            : 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/30 hover:shadow-amber-500/50 text-white'
                                            }`}
                                    >
                                        {nextSchoolLoading ? (
                                            <><Loader2 size={18} className="animate-spin" /> {editingSchoolId ? 'Actualizando...' : 'Guardando...'} </>
                                        ) : (
                                            <>{editingSchoolId ? <RefreshCw size={18} /> : <Calendar size={18} />} {editingSchoolId ? 'Actualizar Misión' : 'Agendar Visita'}</>
                                        )}
                                    </button>

                                    {editingSchoolId && (
                                        <button
                                            type="button"
                                            onClick={handleCancelNextSchoolEdit}
                                            className="w-full mt-3 bg-slate-700 text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <X size={18} /> Cancelar Edición
                                        </button>
                                    )}
                                </form>
                            </section>

                            {/* --- LISTA DE PRÓXIMAS ESCUELAS --- */}
                            <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                            <Plane className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg md:text-xl font-bold">Lista de Misiones</h2>
                                            <p className="text-slate-400 text-xs">{nextSchools.length} programadas</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={fetchNextSchools}
                                        className="p-2 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-700/50 transition-colors"
                                    >
                                        <RefreshCw size={18} className="text-slate-400" />
                                    </button>
                                </div>

                                {fetchingNextSchools ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 size={32} className="animate-spin text-slate-400" />
                                    </div>
                                ) : nextSchools.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <Calendar size={48} className="mx-auto mb-4 opacity-30" />
                                        <p>No hay misiones programadas</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {nextSchools.map((school) => (
                                            <div
                                                key={school.id}
                                                className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${school.estatus === 'completado'
                                                    ? 'bg-emerald-500/10 border-emerald-500/30'
                                                    : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50'
                                                    }`}
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className={`font-bold ${school.estatus === 'completado' ? 'text-emerald-400 line-through' : 'text-white'}`}>
                                                            {school.nombre_escuela}
                                                        </p>
                                                        {school.estatus === 'completado' && (
                                                            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">REALIZADA</span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-4 text-xs text-slate-400">
                                                        <span className="flex items-center gap-1">
                                                            <MapPin size={12} /> {school.colonia}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar size={12} /> {school.fecha_programada}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 self-end md:self-center">
                                                    <button
                                                        onClick={() => handleEditNextSchool(school)}
                                                        className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition-colors"
                                                        title="Editar detalles"
                                                    >
                                                        <Pencil size={18} />
                                                    </button>

                                                    <button
                                                        onClick={() => handleCompleteNextSchool(school.id, school.estatus)}
                                                        className={`p-2 rounded-xl border transition-colors ${school.estatus === 'completado'
                                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                                                            : 'bg-slate-700/50 text-slate-400 border-slate-600/50 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/30'
                                                            }`}
                                                        title={school.estatus === 'completado' ? "Marcar como pendiente" : "Marcar como realizada"}
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteNextSchool(school.id)}
                                                        className="p-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors"
                                                        title="Eliminar misión"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* --- SECCIÓN: ESCUELAS EXTRAS / HISTÓRICAS --- */}
                        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 mt-12 pt-8 border-t border-white/10">
                            {/* FORMULARIO EXTRAS */}
                            <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
                                        <School className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg md:text-xl font-bold">Escuelas Extras</h2>
                                        <p className="text-slate-400 text-xs">Agrega manualmente escuelas pasadas o especiales</p>
                                    </div>
                                </div>

                                {/* Disclaimer */}
                                {/* Disclaimer Collapsible */}
                                <button
                                    type="button"
                                    onClick={() => setIsDisclaimerOpen(!isDisclaimerOpen)}
                                    className={`w-full text-left bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl mb-6 transition-all hover:bg-amber-500/15 group ${isDisclaimerOpen ? 'shadow-lg shadow-amber-900/10' : ''}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="shrink-0 w-5 h-5 text-amber-500 mt-0.5" />
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <p className="font-bold text-amber-500 text-sm">Nota Importante</p>
                                                {isDisclaimerOpen ? <ChevronUp size={16} className="text-amber-500/70" /> : <ChevronDown size={16} className="text-amber-500/70" />}
                                            </div>

                                            <div className={`overflow-hidden transition-all duration-300 ${isDisclaimerOpen ? 'max-h-40 mt-2 opacity-100' : 'max-h-0 opacity-0'}`}>
                                                <div className="text-xs text-amber-200/80 leading-relaxed">
                                                    Estas escuelas <span className="text-white font-bold">SOLO</span> se reflejarán en los sitios de testimonios (Carrusel de la Home). <br />
                                                    <span className="opacity-70">No afectarán las métricas ni aparecerán en los Dashboards de los Patrocinadores.</span>
                                                </div>
                                            </div>

                                            {!isDisclaimerOpen && (
                                                <p className="text-xs text-amber-200/60 mt-0.5 truncate max-w-[250px] md:max-w-none">
                                                    Estas escuelas solo son para testimonios...
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </button>

                                <form onSubmit={handleExtraSchoolSubmit} className="space-y-5">
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                            <School size={14} /> Nombre de la Escuela
                                        </label>
                                        <input
                                            type="text"
                                            value={extraSchoolForm.nombre}
                                            onChange={(e) => setExtraSchoolForm({ nombre: e.target.value })}
                                            required
                                            placeholder="Ej: Instituto Histórico 2023"
                                            className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={extraSchoolLoading}
                                        className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {extraSchoolLoading ? (
                                            <><Loader2 size={18} className="animate-spin" /> Guardando...</>
                                        ) : (
                                            <><School size={18} /> Agregar a Lista Extra</>
                                        )}
                                    </button>
                                </form>
                            </section>

                            {/* LISTA EXTRAS */}
                            <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-700/50 rounded-xl flex items-center justify-center">
                                            <FileText className="w-5 h-5 text-slate-300" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg md:text-xl font-bold">Lista Manual</h2>
                                            <p className="text-slate-400 text-xs">{extraSchools.length} registros extra</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={fetchExtraSchools}
                                        className="p-2 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-700/50 transition-colors"
                                    >
                                        <RefreshCw size={18} className="text-slate-400" />
                                    </button>
                                </div>

                                {fetchingExtraSchools ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 size={32} className="animate-spin text-slate-400" />
                                    </div>
                                ) : extraSchools.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        <School size={48} className="mx-auto mb-4 opacity-30" />
                                        <p>No hay escuelas extra registradas</p>
                                    </div>
                                ) : (
                                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                                        {extraSchools.map((school) => (
                                            <div key={school.id} className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:bg-slate-800/50 transition-colors group">
                                                <span className="font-bold text-slate-200">{school.nombre}</span>
                                                <button
                                                    onClick={() => handleDeleteExtraSchool(school.id)}
                                                    className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    </>
                )
            }

            {/* FOOTER */}
            <footer className="max-w-5xl mx-auto mt-12 text-center text-slate-500 text-xs">
                <p>Panel de Administración · Fly High Edu · {new Date().getFullYear()}</p>
            </footer>
        </main >
    );
}
