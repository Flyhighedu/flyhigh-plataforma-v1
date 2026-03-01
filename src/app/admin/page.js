'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { supabaseNew } from '@/lib/supabaseClientNew';
import {
    Plane, Upload, Users, Radio, CheckCircle, AlertCircle, Loader2,
    School, MapPin, FileText, Camera, Lock, KeyRound, ShieldCheck,
    Building2, Mail, Eye, EyeOff, Trash2, RefreshCw, Heart, Pencil, X, Calendar,
    ChevronDown, ChevronUp, UserPlus, Shield, ToggleLeft, ToggleRight, Copy, ExternalLink
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
    const [isMounted, setIsMounted] = useState(false); // Fix hydration mismatch

    // --- ESTADO DE TABS ---
    const [activeTab, setActiveTab] = useState('vuelos'); // 'vuelos' | 'patrocinadores' | 'cronograma' | 'operativos'
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
    const [becasLoading, setBecasLoading] = useState(false);
    const [becasMessage, setBecasMessage] = useState({ type: '', text: '' });
    const [fetchingBecas, setFetchingBecas] = useState(true);

    // --- ESTADO DE REPORTES DE MISIÓN ---
    const [reports, setReports] = useState({}); // Map: mission_id -> report
    const [selectedReport, setSelectedReport] = useState(null);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [loadingReportDetails, setLoadingReportDetails] = useState(false);
    const [reportDetails, setReportDetails] = useState({ logs: [] });
    const [unlinkedReports, setUnlinkedReports] = useState([]);

    // --- EFFECTS ---
    // Verificar si ya está autenticado (sessionStorage)
    useEffect(() => {
        setIsMounted(true); // Hydration fix
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
        fetchExtraSchools();
        fetchReports();
    }, [isAuthenticated]);

    // Fetch Reportes de Misión
    const fetchReports = async () => {
        try {
            const { data, error } = await supabaseNew
                .from('cierres_mision')
                .select('*');

            if (error) throw error;

            console.log('Reportes fetched:', data);

            // Map mission_id to report object for easy lookup
            const reportMap = {};
            data.forEach(report => {
                // Normalizar mission_id si es necesario (asegurar string)
                if (report.mission_id) {
                    reportMap[String(report.mission_id)] = report;
                }
            });
            setReports(reportMap);

            const { data: currentSchools } = await supabaseNew
                .from('proximas_escuelas')
                .select('id');

            const linkedSchoolIds = new Set((currentSchools || []).map((school) => String(school.id)));
            const unlinked = data.filter((report) => {
                const reportSchoolId = report.school_id ?? (/^\d+$/.test(String(report.mission_id || '')) ? Number(report.mission_id) : null);
                if (!reportSchoolId) return true;
                return !linkedSchoolIds.has(String(reportSchoolId));
            });
            setUnlinkedReports(unlinked);
        } catch (err) {
            console.error('Error fetching reports:', err);
        }
    };

    const handleLinkReport = async (reportId, schoolId) => {
        if (!confirm(`¿Vincular este reporte a la escuela con ID ${schoolId} sin alterar la historia original?`)) return;

        try {
            const selectedSchool = nextSchools.find((school) => String(school.id) === String(schoolId));

            let { error: e1 } = await supabaseNew
                .from('cierres_mision')
                .update({
                    school_id: Number(schoolId),
                    school_name_snapshot: selectedSchool?.nombre_escuela || null
                })
                .eq('id', reportId);

            if (e1 && /column/i.test(e1.message || '')) {
                const fallback = await supabaseNew
                    .from('cierres_mision')
                    .update({ school_id: Number(schoolId) })
                    .eq('id', reportId);

                e1 = fallback.error;
            }

            if (e1) throw e1;

            alert('Reporte vinculado para visualización sin modificar registros históricos.');
            fetchReports();
        } catch (err) {
            console.error('Error linking report:', err);
            alert('Error vinculando reporte (sin alterar historial): ' + err.message);
        }
    };

    const handleViewReport = async (missionId) => {
        // Find basic report data from state
        const summary = reports[missionId];
        if (!summary) return;

        setSelectedReport(summary);
        setReportModalOpen(true);
        setLoadingReportDetails(true);
        setReportDetails({ logs: [] }); // Reset previous logs

        try {
            // Fetch detailed flight logs
            const { data: logs, error } = await supabaseNew
                .from('bitacora_vuelos')
                .select('*')
                .eq('mission_id', missionId)
                .order('start_time', { ascending: true });

            if (error) throw error;

            setReportDetails({ logs: logs || [] });
        } catch (err) {
            console.error('Error fetching report details:', err);
            alert('Error cargando detalles del reporte');
        } finally {
            setLoadingReportDetails(false);
        }
    };

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
                .neq('estatus', 'archivado')
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
        if (!confirm('¿Archivar esta escuela? No se eliminará de forma permanente.')) return;

        // Optimistic UI Update
        const previousSchools = [...nextSchools];
        setNextSchools(prev => prev.filter(s => s.id !== id));

        try {
            const archivePayload = {
                estatus: 'archivado',
                is_archived: true,
                archived_at: new Date().toISOString()
            };

            let { error } = await supabaseNew
                .from('proximas_escuelas')
                .update(archivePayload)
                .eq('id', id);

            if (error && /column/i.test(error.message || '')) {
                const fallback = await supabaseNew
                    .from('proximas_escuelas')
                    .update({ estatus: 'archivado' })
                    .eq('id', id);
                error = fallback.error;
            }

            if (error) throw error;
        } catch (err) {
            console.error('Error deleting school:', err);
            // Revert
            setNextSchools(previousSchools);
            alert('Error al archivar');
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

    // --- HYDRATION GUARD ---
    if (!isMounted) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            </div>
        );
    }

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

    // --- FUNCIONES DE OPERATIVOS ---
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
                        onClick={() => { setActiveTab('cronograma'); fetchReports(); }}
                        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all ${activeTab === 'cronograma'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Calendar size={18} />
                        Cronograma
                    </button>
                    <button
                        onClick={() => { setActiveTab('operativos'); fetchStaffList(); }}
                        className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all ${activeTab === 'operativos'
                            ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Shield size={18} />
                        Operativos
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
                                                    {/* Botón Ver Reporte (si existe) */}
                                                    {reports[String(school.id)] && (
                                                        <button
                                                            onClick={() => handleViewReport(String(school.id))}
                                                            className="p-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl hover:bg-blue-500/30 transition-colors"
                                                            title="Ver Reporte de Misión"
                                                        >
                                                            <FileText size={18} />
                                                        </button>
                                                    )}

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

                                {/* SECCIÓN DIAGNÓSTICA: REPORTES SIN VINCULAR */}
                                {unlinkedReports.length > 0 && (
                                    <div className="mt-12 p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                                                <AlertCircle className="w-4 h-4 text-amber-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-amber-200">Reportes sin vincular ({unlinkedReports.length})</h3>
                                                <p className="text-xs text-amber-500/70">Misiones cerradas que no coinciden con un ID del cronograma</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {unlinkedReports.map((report) => (
                                                <div key={report.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-white/5">
                                                    <div>
                                                        <p className="text-xs font-mono text-slate-400">ID: {report.mission_id}</p>
                                                        <p className="text-[10px] text-slate-500 truncate">
                                                            {new Date(report.end_time).toISOString().split('T')[0]} {new Date(report.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <button
                                                            onClick={() => handleViewReport(report.mission_id)}
                                                            className="px-3 py-1.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-lg hover:bg-amber-500/30 transition-colors"
                                                        >
                                                            Ver Reporte
                                                        </button>
                                                        <select
                                                            onChange={(e) => {
                                                                if (e.target.value) handleLinkReport(report.id, e.target.value);
                                                                e.target.value = '';
                                                            }}
                                                            className="bg-slate-800 text-[10px] text-white border border-white/10 rounded-lg px-2 py-1 outline-none"
                                                        >
                                                            <option value="">Vincular a...</option>
                                                            {nextSchools.filter(s => s.estatus === 'completado').map(s => (
                                                                <option key={s.id} value={s.id}>{s.nombre_escuela}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="mt-4 text-[10px] text-amber-500/50 italic text-center">
                                            Tip: Si ves un reporte aquí, es porque se cerró como &quot;Misión Manual&quot;.
                                        </p>
                                    </div>
                                )}
                            </section>
                        </div>
                    </>
                )
            }

            {/* FOOTER */}

            {/* TAB: OPERATIVOS */}
            {activeTab === 'operativos' && (
                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                    {/* CREAR OPERATIVO */}
                    <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center">
                                <UserPlus className="w-5 h-5 text-rose-400" />
                            </div>
                            <div>
                                <h2 className="text-lg md:text-xl font-bold">Nuevo Operativo</h2>
                                <p className="text-slate-400 text-xs">Crea una cuenta de acceso para staff</p>
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
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                                />
                            </div>

                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                    <Shield size={14} /> Rol
                                </label>
                                <select
                                    value={staffForm.role}
                                    onChange={(e) => setStaffForm(prev => ({ ...prev, role: e.target.value }))}
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                                >
                                    <option value="pilot">🎮 Piloto</option>
                                    <option value="teacher">📚 Docente</option>
                                    <option value="assistant">📦 Auxiliar</option>
                                    <option value="supervisor">👁️ Supervisor</option>
                                    <option value="admin">⚙️ Admin</option>
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
                                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
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
                                        className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                                    />
                                    <button type="button" onClick={generatePassword}
                                        className="px-3 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold text-slate-300 transition-colors whitespace-nowrap"
                                        title="Generar password"
                                    >
                                        <RefreshCw size={16} />
                                    </button>
                                    <button type="button" onClick={() => setShowStaffPasswords(!showStaffPasswords)}
                                        className="px-3 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-300 transition-colors"
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
                                className="w-full bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-rose-500/30 hover:shadow-rose-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {staffLoading ? <><Loader2 size={18} className="animate-spin" /> Creando...</> : <><UserPlus size={18} /> Crear Operativo</>}
                            </button>
                        </form>
                    </section>

                    {/* LISTA DE OPERATIVOS */}
                    <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-pink-500/20 rounded-xl flex items-center justify-center">
                                    <Users className="w-5 h-5 text-pink-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg md:text-xl font-bold">Equipo</h2>
                                    <p className="text-slate-400 text-xs">{staffList.length} operativos registrados</p>
                                </div>
                            </div>
                            <button onClick={fetchStaffList}
                                className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                            >
                                <RefreshCw size={18} className={fetchingStaff ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {fetchingStaff ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={32} className="animate-spin text-slate-400" />
                            </div>
                        ) : staffList.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <Users size={48} className="mx-auto mb-4 opacity-30" />
                                <p>No hay operativos registrados aún</p>
                                <p className="text-xs mt-1">Crea el primero con el formulario</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                                {staffList.map((s) => {
                                    const roleEmojis = { pilot: '🎮', teacher: '📚', assistant: '📦', admin: '⚙️', supervisor: '👁️' };
                                    const roleLabels = { pilot: 'Piloto', teacher: 'Docente', assistant: 'Auxiliar', admin: 'Admin', supervisor: 'Supervisor' };
                                    const isResetting = resetPassForm.user_id === s.user_id;

                                    return (
                                        <div key={s.user_id} className={`p-4 rounded-xl border transition-colors ${s.is_active ? 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/50' : 'bg-red-900/10 border-red-900/30 opacity-60'
                                            }`}>
                                            {/* Header: Nombre + Rol + Estado */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-lg">{roleEmojis[s.role] || '👤'}</span>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-200 truncate">{s.full_name}</p>
                                                        <p className="text-xs text-slate-500">{roleLabels[s.role] || s.role}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {s.is_active ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Email + Copiar */}
                                            {s.email && s.email !== 'N/A' && (
                                                <div className="flex items-center gap-2 mb-2 bg-slate-900/40 rounded-lg px-3 py-1.5">
                                                    <Mail size={12} className="text-slate-500 flex-shrink-0" />
                                                    <span className="text-xs text-slate-400 truncate flex-1 select-all">{s.email}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => { navigator.clipboard.writeText(s.email); }}
                                                        className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                                                        title="Copiar email"
                                                    >
                                                        <Copy size={12} className="text-cyan-400" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Contraseña inicial */}
                                            {s.initial_password && (
                                                <div className="flex items-center gap-2 mb-3 bg-slate-900/40 rounded-lg px-3 py-1.5">
                                                    <Lock size={12} className="text-slate-500 flex-shrink-0" />
                                                    <span className="text-xs text-slate-400 truncate flex-1 select-all font-mono">
                                                        {revealedPasswords[s.user_id] ? s.initial_password : '••••••••'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setRevealedPasswords(prev => ({ ...prev, [s.user_id]: !prev[s.user_id] }))}
                                                        className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                                                        title={revealedPasswords[s.user_id] ? 'Ocultar contraseña' : 'Ver contraseña'}
                                                    >
                                                        {revealedPasswords[s.user_id]
                                                            ? <EyeOff size={12} className="text-amber-400" />
                                                            : <Eye size={12} className="text-amber-400" />
                                                        }
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { navigator.clipboard.writeText(s.initial_password); }}
                                                        className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                                                        title="Copiar contraseña"
                                                    >
                                                        <Copy size={12} className="text-amber-400" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Acciones */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button
                                                    onClick={() => window.open(`/staff/preview?as=${s.user_id}`, '_blank')}
                                                    className="text-xs px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg text-cyan-400 font-medium transition-colors flex items-center gap-1"
                                                    title="Ver como este operativo"
                                                >
                                                    <ExternalLink size={12} /> Vista previa
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditForm(prev => prev.user_id === s.user_id
                                                            ? { user_id: null, email: '', full_name: '', role: '' }
                                                            : { user_id: s.user_id, email: s.email || '', full_name: s.full_name || '', role: s.role || '' }
                                                        );
                                                    }}
                                                    className="text-xs px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg text-amber-400 font-medium transition-colors flex items-center gap-1"
                                                >
                                                    <Pencil size={12} /> Editar
                                                </button>
                                                <button
                                                    onClick={() => setResetPassForm(prev => ({
                                                        user_id: prev.user_id === s.user_id ? null : s.user_id,
                                                        new_password: ''
                                                    }))}
                                                    className="text-xs px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-slate-300 font-medium transition-colors flex items-center gap-1"
                                                >
                                                    <KeyRound size={12} /> Reset Pass
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStaffActive(s.user_id, s.is_active)}
                                                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1 ${s.is_active
                                                        ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                                                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                                                        }`}
                                                >
                                                    {s.is_active ? <><ToggleRight size={12} /> Desactivar</> : <><ToggleLeft size={12} /> Activar</>}
                                                </button>
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
                                                            <option value="pilot">🎮 Piloto</option>
                                                            <option value="teacher">📚 Docente</option>
                                                            <option value="assistant">📦 Auxiliar</option>
                                                            <option value="supervisor">👁️ Supervisor</option>
                                                            <option value="admin">⚙️ Admin</option>
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
            )}

            {/* FOOTER */}
            <footer className="max-w-5xl mx-auto mt-12 text-center text-slate-500 text-xs">
                <p>Panel de Administración · Fly High Edu · {new Date().getFullYear()}</p>
            </footer>
            {/* MODAL DE REPORTE */}
            {reportModalOpen && selectedReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        {/* Header Modal */}
                        <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Reporte de Misión</h2>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                                        {nextSchools.find(s => String(s.id) === String(selectedReport.mission_id))?.nombre_escuela || `Escuela ID: ${selectedReport.mission_id}`}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setReportModalOpen(false)}
                                className="p-2 hover:bg-slate-700 rounded-xl transition-colors"
                            >
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Content Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">

                            {/* Resumen KPIs */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Total Vuelos</p>
                                    <p className="text-2xl font-black text-white">{selectedReport.total_flights}</p>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Total Alumnos</p>
                                    <p className="text-2xl font-black text-emerald-400">{selectedReport.total_students}</p>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Docentes</p>
                                    <p className="text-2xl font-black text-blue-400">
                                        {reportDetails.logs ? reportDetails.logs.reduce((acc, log) => acc + (log.staff_count || 0), 0) : 0}
                                    </p>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Promedio Vuelo</p>
                                    <p className="text-2xl font-black text-amber-400">
                                        {reportDetails.logs && reportDetails.logs.length > 0
                                            ? Math.round(reportDetails.logs.reduce((acc, log) => acc + (log.duration_seconds || 0), 0) / reportDetails.logs.length)
                                            : 0} seg
                                    </p>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                                    <p className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Verificación Prep</p>
                                    <p className={`text-xl font-black ${selectedReport.checklist_verified ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {selectedReport.checklist_verified ? 'Completada' : 'Pendiente'}
                                    </p>
                                </div>
                            </div>

                            {/* Evidencias Visuales */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                                        <Users size={16} /> Foto Grupal
                                    </h3>
                                    {selectedReport.group_photo_url ? (
                                        <div className="rounded-2xl overflow-hidden border border-slate-700 aspect-video relative group">
                                            <img
                                                src={selectedReport.group_photo_url}
                                                alt="Grupo"
                                                className="w-full h-full object-cover"
                                            />
                                            <a
                                                href={selectedReport.group_photo_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <ExternalLink className="text-white" />
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="h-32 bg-slate-800/50 rounded-2xl flex items-center justify-center border border-dashed border-slate-700 text-slate-500 text-xs">
                                            Sin foto grupal
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                                        <Pencil size={16} /> Firma Docente
                                    </h3>
                                    {selectedReport.signature_url ? (
                                        <div className="rounded-2xl overflow-hidden border border-slate-700 aspect-video bg-white relative group">
                                            <img
                                                src={selectedReport.signature_url}
                                                alt="Firma"
                                                className="w-full h-full object-contain"
                                            />
                                            <a
                                                href={selectedReport.signature_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <ExternalLink className="text-black" />
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="h-32 bg-slate-800/50 rounded-2xl flex items-center justify-center border border-dashed border-slate-700 text-slate-500 text-xs">
                                            Sin firma
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bitácora de Vuelos DETALLADA */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                                    <Plane size={16} /> Bitácora de Vuelos ({reportDetails.logs.length})
                                </h3>

                                {loadingReportDetails ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 size={24} className="animate-spin text-blue-500" />
                                    </div>
                                ) : reportDetails.logs.length === 0 ? (
                                    <p className="text-center text-slate-500 py-4 text-xs">No hay vuelos registrados en esta misión.</p>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-slate-700">
                                        <table className="w-full text-left text-xs text-slate-400">
                                            <thead className="bg-slate-800 text-slate-200 uppercase font-bold">
                                                <tr>
                                                    <th className="px-4 py-3">Hora</th>
                                                    <th className="px-4 py-3">Duración</th>
                                                    <th className="px-4 py-3 text-center">Alumnos</th>
                                                    <th className="px-4 py-3">Incidentes</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-700 bg-slate-800/30">
                                                {reportDetails.logs.map((log, idx) => (
                                                    <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                                                        <td className="px-4 py-3 font-mono text-white">
                                                            {new Date(log.start_time).toISOString().split('T')[1].substring(0, 5)}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {log.duration_seconds} seg
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-bold text-emerald-400">
                                                            {log.student_count}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {log.incidents && log.incidents.length > 0 ? (
                                                                <div className="flex flex-col gap-1">
                                                                    {log.incidents.map((inc, i) => (
                                                                        <span key={i} className="inline-flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 w-fit">
                                                                            <AlertCircle size={10} /> {inc.type}: {inc.description}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-600">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </main >
    );
}
