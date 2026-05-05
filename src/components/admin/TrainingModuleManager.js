'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    BookOpen, Plus, Loader2, Trash2, CheckCircle, XCircle,
    ChevronRight, Sparkles, Eye, EyeOff, Send, AlertTriangle,
    GraduationCap, Shield, Cog, RotateCcw, Edit3, Save, X, Zap, Target
} from 'lucide-react';

const CARD_TYPE_CFG = {
    knowledge: { label: 'Conocimiento', color: '#6366F1', bg: 'rgba(99,102,241,0.1)', icon: BookOpen },
    procedure: { label: 'Procedimiento', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)', icon: Cog },
    safety: { label: 'Seguridad', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', icon: Shield },
};

const DIFFICULTY_LABELS = { 1: 'Básico', 2: 'Intermedio', 3: 'Avanzado' };
const DIFFICULTY_COLORS = { 1: '#10b981', 2: '#f59e0b', 3: '#ef4444' };

const MODULE_ICONS = ['📋', '🛫', '🔧', '📚', '🎓', '⚙️', '🗺️', '🧭', '🔐', '📡'];

export default function TrainingModuleManager() {
    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedModule, setExpandedModule] = useState(null);
    const [moduleCards, setModuleCards] = useState({});
    const [generating, setGenerating] = useState(null);
    
    // UI State
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showQuickCardForm, setShowQuickCardForm] = useState(false);

    // Forms State
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newText, setNewText] = useState('');
    const [newIcon, setNewIcon] = useState('🎓');
    const [creating, setCreating] = useState(false);

    const [manualCardData, setManualCardData] = useState({ question: '', answer: '', card_type: 'knowledge', difficulty: 1, module_id: '' });
    const [creatingManual, setCreatingManual] = useState(false);
    const [savingCard, setSavingCard] = useState(null);

    const fetchModules = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/training/modules');
            if (res.ok) {
                const data = await res.json();
                setModules(data.modules || []);
            }
        } catch (err) {
            console.error('Error fetching modules:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchModules(); }, [fetchModules]);

    const fetchCards = async (moduleId) => {
        try {
            const res = await fetch(`/api/admin/training/cards?module_id=${moduleId}`);
            if (res.ok) {
                const data = await res.json();
                setModuleCards(prev => ({ ...prev, [moduleId]: data.cards || [] }));
            }
        } catch (err) {
            console.error('Error fetching cards:', err);
        }
    };

    const handleExpand = async (moduleId) => {
        if (expandedModule === moduleId) {
            setExpandedModule(null);
            return;
        }
        setExpandedModule(moduleId);
        if (!moduleCards[moduleId]) await fetchCards(moduleId);
    };

    const handleCreate = async () => {
        if (!newTitle.trim() || !newText.trim()) return;
        setCreating(true);
        try {
            const res = await fetch('/api/admin/training/modules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle, description: newDesc, source_text: newText, icon: newIcon })
            });
            if (res.ok) {
                setShowCreateForm(false);
                setNewTitle(''); setNewDesc(''); setNewText(''); setNewIcon('🎓');
                await fetchModules();
            }
        } catch (err) {
            alert('Error creando módulo: ' + err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleGenerateCards = async (mod) => {
        setGenerating(mod.id);
        try {
            const res = await fetch('/api/admin/training/generate-cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ module_id: mod.id, source_text: mod.source_text, title: mod.title })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            await fetchCards(mod.id);
            await fetchModules();
        } catch (err) {
            alert('Error generando fichas: ' + err.message);
        } finally {
            setGenerating(null);
        }
    };

    const handleCardAction = async (cardId, status) => {
        setSavingCard(cardId);
        try {
            await fetch('/api/admin/training/cards', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cardId, status })
            });
            await fetchCards(expandedModule);
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSavingCard(null);
        }
    };

    const handleDeleteCard = async (cardId) => {
        setSavingCard(cardId);
        try {
            await fetch(`/api/admin/training/cards?id=${cardId}`, { method: 'DELETE' });
            await fetchCards(expandedModule);
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSavingCard(null);
        }
    };

    const handleCreateQuickCard = async () => {
        if (!manualCardData.question.trim() || !manualCardData.answer.trim() || !manualCardData.module_id) return;
        setCreatingManual(true);
        try {
            const res = await fetch('/api/admin/training/cards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(manualCardData)
            });
            if (res.ok) {
                setManualCardData({ question: '', answer: '', card_type: 'knowledge', difficulty: 1, module_id: '' });
                setShowQuickCardForm(false);
                if (expandedModule === manualCardData.module_id) {
                    await fetchCards(manualCardData.module_id);
                }
            } else {
                const data = await res.json();
                throw new Error(data.error);
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setCreatingManual(false);
        }
    };

    const handlePublish = async (mod) => {
        const cards = moduleCards[mod.id] || [];
        const approved = cards.filter(c => c.status === 'approved').length;
        if (approved === 0) { alert('Aprueba al menos 1 ficha antes de publicar.'); return; }
        try {
            await fetch('/api/admin/training/modules', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: mod.id, status: 'published' })
            });
            await fetchModules();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const handleDeleteModule = async (modId) => {
        if (!confirm('¿Eliminar este módulo y todas sus fichas?')) return;
        try {
            await fetch(`/api/admin/training/modules?id=${modId}`, { method: 'DELETE' });
            setExpandedModule(null);
            await fetchModules();
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[40vh]">
                <div className="text-center space-y-4 animate-pulse">
                    <div className="w-16 h-16 mx-auto bg-indigo-50 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <GraduationCap size={28} className="text-indigo-400" />
                    </div>
                    <p className="text-sm font-bold text-slate-400">Cargando módulos...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20 w-full max-w-6xl mx-auto">
            {/* Header Limpio Integrado al Lienzo */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <GraduationCap size={32} className="text-indigo-500" />
                        Módulos de Capacitación
                    </h2>
                    <p className="text-base text-slate-500 mt-2 font-medium max-w-2xl">
                        Sube manuales operativos y usa nuestra IA para transformarlos automáticamente en tarjetas interactivas de estudio para el personal.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <button
                        onClick={() => {
                            setShowCreateForm(false);
                            if(modules.length > 0 && !manualCardData.module_id) {
                                setManualCardData(p => ({ ...p, module_id: modules[0].id }));
                            }
                            setShowQuickCardForm(!showQuickCardForm);
                        }}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${showQuickCardForm ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 dark:bg-slate-900 dark:border-indigo-500/30 dark:hover:bg-indigo-500/10'}`}
                    >
                        {showQuickCardForm ? <X size={18} /> : <Plus size={18} />} 
                        Añadir Ficha Rápida
                    </button>
                    
                    <button
                        onClick={() => {
                            setShowQuickCardForm(false);
                            setShowCreateForm(!showCreateForm);
                        }}
                        className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${showCreateForm ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-none'}`}
                    >
                        {showCreateForm ? <X size={18} /> : <Sparkles size={18} />} 
                        Nuevo Módulo con IA
                    </button>
                </div>
            </div>

            {/* Inline Form: Añadir Ficha Rápida */}
            {showQuickCardForm && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-700 animate-fade-in">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center">
                            <Plus size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white">Añadir Ficha Rápida</h3>
                            <p className="text-sm text-slate-500">Agrega un concepto directamente a un módulo existente sin usar IA.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Módulo Destino</label>
                                <select 
                                    value={manualCardData.module_id}
                                    onChange={e => setManualCardData(p => ({ ...p, module_id: e.target.value }))}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                                >
                                    <option value="" disabled>Selecciona el Módulo...</option>
                                    {modules.map(m => <option key={m.id} value={m.id}>{m.icon} {m.title}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Categoría</label>
                                    <select 
                                        value={manualCardData.card_type}
                                        onChange={e => setManualCardData(p => ({ ...p, card_type: e.target.value }))}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                                    >
                                        <option value="knowledge">Conocimiento</option>
                                        <option value="procedure">Procedimiento</option>
                                        <option value="safety">Seguridad</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Dificultad</label>
                                    <select 
                                        value={manualCardData.difficulty}
                                        onChange={e => setManualCardData(p => ({ ...p, difficulty: Number(e.target.value) }))}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                                    >
                                        <option value={1}>1 - Básico</option>
                                        <option value={2}>2 - Intermedio</option>
                                        <option value={3}>3 - Avanzado</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Pregunta o Concepto</label>
                                <input 
                                    value={manualCardData.question} 
                                    onChange={e => setManualCardData(p => ({ ...p, question: e.target.value }))}
                                    placeholder="Escribe el concepto..."
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-colors" 
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Respuesta o Definición</label>
                                <textarea 
                                    value={manualCardData.answer} 
                                    onChange={e => setManualCardData(p => ({ ...p, answer: e.target.value }))}
                                    placeholder="Desarrolla la explicación..."
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 outline-none focus:border-indigo-500 transition-colors resize-none h-24 custom-scrollbar" 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button 
                            onClick={handleCreateQuickCard} 
                            disabled={creatingManual || !manualCardData.question.trim() || !manualCardData.module_id || !manualCardData.answer.trim()}
                            className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white font-black text-sm rounded-xl shadow-md hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {creatingManual ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} 
                            Guardar Ficha
                        </button>
                    </div>
                </div>
            )}

            {/* Inline Form: Crear Módulo con IA */}
            {showCreateForm && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl p-6 md:p-8 border border-slate-100 dark:border-slate-700 animate-fade-in">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white">Nuevo Módulo de Capacitación</h3>
                            <p className="text-sm text-slate-500 font-medium">Pega el documento y la IA creará automáticamente un mazo de estudio interactivo.</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-2 space-y-6">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Título del Módulo</label>
                                    <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ej: Manual de Seguridad Operacional"
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-4 text-base font-bold text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Descripción Breve (Opcional)</label>
                                    <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Resumen de qué trata este módulo..."
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 outline-none focus:border-indigo-500 transition-colors" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Icono Identificador</label>
                                <div className="grid grid-cols-5 gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                                    {MODULE_ICONS.map(icon => (
                                        <button key={icon} onClick={() => setNewIcon(icon)}
                                            className={`aspect-square rounded-lg text-2xl flex items-center justify-center transition-all ${newIcon === icon ? 'bg-indigo-50 dark:bg-indigo-500/20 scale-110 ring-2 ring-indigo-500 z-10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                        >{icon}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Documento Fuente para la IA</label>
                            <textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder="Pega aquí todo el texto del procedimiento, guía o manual que deseas transformar..."
                                rows={8} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 text-sm font-medium text-slate-600 dark:text-slate-300 outline-none focus:border-indigo-500 resize-none transition-colors custom-scrollbar" />
                        </div>

                        <div className="flex justify-end pt-4">
                            <button onClick={handleCreate} disabled={creating || !newTitle.trim() || !newText.trim()}
                                className="w-full md:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-wide rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:active:scale-100">
                                {creating ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />} 
                                {creating ? 'Analizando con IA...' : 'Crear Módulo con IA'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modules Dashboard */}
            <div>
                {modules.length === 0 ? (
                    <div className="text-center py-20 px-4 bg-slate-50 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                            <BookOpen size={32} className="text-slate-300" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No hay módulos creados</h3>
                        <p className="text-slate-500 text-sm max-w-sm mx-auto">
                            Comienza creando tu primer módulo para organizar las capacitaciones del equipo.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {modules.map(mod => {
                            const isExpanded = expandedModule === mod.id;
                            const cards = moduleCards[mod.id] || [];
                            const approved = cards.filter(c => c.status === 'approved').length;
                            const draft = cards.filter(c => c.status === 'draft').length;
                            const isPublished = mod.status === 'published';
                            const isGenerating = generating === mod.id;
                            const progress = cards.length > 0 ? Math.round((approved / cards.length) * 100) : 0;

                            return (
                                <div key={mod.id} className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-slate-300 dark:border-slate-600 shadow-xl' : 'border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md'}`}>
                                    
                                    {/* Module Header Card */}
                                    <div onClick={() => handleExpand(mod.id)} className="flex flex-col sm:flex-row sm:items-center gap-6 p-6 cursor-pointer group">
                                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                            {mod.icon || '🎓'}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1">
                                                <h3 className="font-bold text-slate-800 dark:text-white text-xl truncate">{mod.title}</h3>
                                                {isPublished && (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                                                        Activo
                                                    </span>
                                                )}
                                                {!isPublished && draft > 0 && (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                                                        Revisión Pendiente
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 truncate">{mod.description || 'Sin descripción'}</p>
                                            
                                            {/* Minimalist Progress Bar */}
                                            <div className="flex items-center gap-3 max-w-sm">
                                                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full transition-all duration-1000 ${isPublished ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 w-8">{progress}%</span>
                                            </div>
                                        </div>
                                        
                                        <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-transparent group-hover:bg-slate-50 dark:group-hover:bg-slate-800 text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-colors">
                                            <ChevronRight size={20} className={`transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                                        </div>
                                    </div>

                                    {/* Expanded: Learning Studio */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-6 md:p-8 animate-fade-in">
                                            
                                            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                                                <h4 className="text-base font-bold text-slate-800 dark:text-white">
                                                    Fichas de Estudio ({cards.length})
                                                </h4>
                                                
                                                <div className="flex items-center gap-3 w-full md:w-auto">
                                                    {!isPublished && (
                                                        <button onClick={() => handleGenerateCards(mod)} disabled={isGenerating}
                                                            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all shadow-sm">
                                                            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="text-indigo-500" />} 
                                                            Extraer Más con IA
                                                        </button>
                                                    )}
                                                    {!isPublished && approved > 0 && draft === 0 && (
                                                        <button onClick={() => handlePublish(mod)}
                                                            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95">
                                                            <Send size={16} /> Publicar Módulo
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {cards.length === 0 ? (
                                                <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                    <Sparkles size={24} className="text-indigo-400 mx-auto mb-3 opacity-50" />
                                                    <h5 className="font-bold text-slate-800 dark:text-white mb-1">Aún no hay fichas</h5>
                                                    <p className="text-slate-500 text-sm max-w-sm mx-auto">
                                                        Usa la IA para extraer fichas automáticamente o añade una Ficha Rápida desde el botón superior.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-10">
                                                    {draft > 0 && (
                                                        <div className="space-y-4">
                                                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                                                                <AlertTriangle size={16} />
                                                                <h4 className="text-sm font-bold uppercase tracking-wider">Por Revisar ({draft})</h4>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                                                {cards.filter(c => c.status === 'draft').map(card => (
                                                                    <FlashCardItem key={card.id} card={card} onAction={handleCardAction} onDelete={handleDeleteCard} isSaving={savingCard === card.id} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {approved > 0 && (
                                                        <div className="space-y-4">
                                                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
                                                                <CheckCircle size={16} />
                                                                <h4 className="text-sm font-bold uppercase tracking-wider">Fichas Listas ({approved})</h4>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                                                {cards.filter(c => c.status === 'approved').map(card => (
                                                                    <FlashCardItem key={card.id} card={card} onAction={handleCardAction} onDelete={handleDeleteCard} isSaving={savingCard === card.id} />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="mt-8 flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                                                <button onClick={() => handleDeleteModule(mod.id)} className="text-xs font-bold text-rose-500/70 hover:text-rose-600 transition-colors flex items-center gap-1">
                                                    <Trash2 size={14} /> Eliminar Módulo Completo
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

        </div>
    );
}

// Subcomponente de Ficha Interactiva (Flip Card)
function FlashCardItem({ card, onAction, onDelete, isSaving }) {
    const [isFlipped, setIsFlipped] = useState(false);
    const typeCfg = CARD_TYPE_CFG[card.card_type] || CARD_TYPE_CFG.knowledge;
    const TypeIcon = typeCfg.icon;

    return (
        <div 
            className={`group perspective-1000 h-64 w-full cursor-pointer rounded-2xl relative ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={() => setIsFlipped(!isFlipped)}
        >
            <div className={`relative w-full h-full transition-transform duration-700 preserve-3d shadow-sm hover:shadow-lg rounded-2xl ${isFlipped ? 'rotate-y-180' : ''}`}>
                
                {/* Front (Concept) */}
                <div className={`absolute inset-0 backface-hidden rounded-2xl p-6 border flex flex-col items-center justify-center text-center bg-white dark:bg-slate-800 ${card.status === 'approved' ? 'border-emerald-200 dark:border-emerald-500/30' : 'border-slate-200 dark:border-slate-700'}`}>
                    <div className="absolute top-4 left-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-50 dark:bg-slate-700 text-slate-500">
                            <TypeIcon size={14} />
                        </div>
                    </div>
                    <div className="absolute top-4 right-4">
                        <span className="text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-widest bg-slate-50 dark:bg-slate-700 text-slate-500 border border-slate-100 dark:border-slate-600">
                            Nivel {card.difficulty}
                        </span>
                    </div>
                    
                    <h5 className="text-lg font-bold text-slate-800 dark:text-white leading-tight px-4 mt-6">
                        {card.question}
                    </h5>
                    
                    <div className="absolute bottom-5 inset-x-0 text-center">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 group-hover:text-indigo-500 transition-colors">
                            <RotateCcw size={12} /> Voltear
                        </span>
                    </div>
                </div>

                {/* Back (Definition & Actions) */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-500/30 bg-slate-50 dark:bg-slate-900 flex flex-col justify-between">
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex items-center justify-center">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed text-center w-full">
                            {card.answer}
                        </p>
                    </div>
                    
                    {/* Admin Actions Overlay (Only visible on back) */}
                    <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700 flex gap-2" onClick={e => e.stopPropagation()}>
                        {card.status === 'draft' ? (
                            <button onClick={() => onAction(card.id, 'approved')} className="flex-1 bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-sm">
                                <CheckCircle size={14} /> Aprobar
                            </button>
                        ) : (
                            <button onClick={() => onAction(card.id, 'draft')} className="flex-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-1.5 active:scale-95">
                                <RotateCcw size={14} /> Deshacer
                            </button>
                        )}
                        <button onClick={() => onDelete(card.id)} className="w-10 h-10 shrink-0 flex items-center justify-center text-rose-500 bg-white dark:bg-slate-800 border border-rose-100 dark:border-rose-500/20 rounded-xl hover:bg-rose-50 transition-all active:scale-95">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
