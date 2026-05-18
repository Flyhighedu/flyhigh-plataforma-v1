'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Music, Upload, Trash2, GripVertical, Play, Pause, Loader2, CheckCircle, AlertCircle, Plane, Users, X, ChevronDown } from 'lucide-react';

const TRACK_TYPE_LABELS = {
    boarding: { label: 'Abordaje', emoji: '🎵', color: '#38bdf8', description: 'Música de sala de espera' },
    in_flight: { label: 'Vuelo Activo', emoji: '🚀', color: '#a78bfa', description: 'Música durante el vuelo' }
};

const ALLOWED_EXTENSIONS = ['.mp3', '.m4a'];
const REJECTED_EXTENSIONS = ['.wav', '.flac', '.ogg', '.aac', '.wma'];

function formatFileSize(bytes) {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDuration(seconds) {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SoundtrackManager() {
    const [soundtracks, setSoundtracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [selectedType, setSelectedType] = useState('boarding');
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [pendingFile, setPendingFile] = useState(null);
    const [rejectionTooltip, setRejectionTooltip] = useState(null);
    const [playingId, setPlayingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [sortDragId, setSortDragId] = useState(null);

    const fileInputRef = useRef(null);
    const audioPreviewRef = useRef(null);

    // ── Fetch Soundtracks ──
    const fetchSoundtracks = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/soundtracks');
            if (res.ok) {
                const { soundtracks: data } = await res.json();
                setSoundtracks(data || []);
            }
        } catch (err) {
            console.warn('Failed to fetch soundtracks:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSoundtracks();
    }, [fetchSoundtracks]);

    // ── File Selection ──
    const handleFileSelect = (file) => {
        if (!file) return;

        const ext = '.' + file.name.split('.').pop().toLowerCase();

        if (REJECTED_EXTENSIONS.includes(ext)) {
            setRejectionTooltip(`❌ El formato ${ext.toUpperCase()} no es compatible. Los archivos .WAV y .FLAC son demasiado pesados para transmisión móvil. Por favor convierte tu pista a .MP3 antes de subirla.`);
            setTimeout(() => setRejectionTooltip(null), 6000);
            return;
        }

        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            setRejectionTooltip(`❌ Formato no soportado: ${ext}. Solo se permiten archivos .MP3 y .M4A.`);
            setTimeout(() => setRejectionTooltip(null), 5000);
            return;
        }

        if (file.size > 15 * 1024 * 1024) {
            setRejectionTooltip(`❌ Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 15MB.`);
            setTimeout(() => setRejectionTooltip(null), 5000);
            return;
        }

        setPendingFile(file);
        setRejectionTooltip(null);
        setUploadError(null);
        setUploadSuccess(false);

        // Auto-fill title from filename
        if (!title) {
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            setTitle(nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1));
        }
    };

    // ── Drag & Drop Handlers ──
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOver(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);

        const files = e.dataTransfer?.files;
        if (files?.length > 0) {
            handleFileSelect(files[0]);
        }
    };

    // ── Upload ──
    const handleUpload = async () => {
        if (!pendingFile || !title.trim()) return;

        setUploading(true);
        setUploadProgress(0);
        setUploadError(null);
        setUploadSuccess(false);

        // Simulate progress while uploading
        const progressTimer = setInterval(() => {
            setUploadProgress(prev => Math.min(prev + Math.random() * 15, 90));
        }, 300);

        try {
            const formData = new FormData();
            formData.append('file', pendingFile);
            formData.append('title', title.trim());
            formData.append('artist', artist.trim());
            formData.append('track_type', selectedType);

            const res = await fetch('/api/admin/upload-soundtrack', {
                method: 'POST',
                body: formData
            });

            clearInterval(progressTimer);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al subir');
            }

            setUploadProgress(100);
            setUploadSuccess(true);
            setPendingFile(null);
            setTitle('');
            setArtist('');
            if (fileInputRef.current) fileInputRef.current.value = '';

            // Refresh list
            await fetchSoundtracks();

            setTimeout(() => {
                setUploadSuccess(false);
                setUploadProgress(0);
            }, 3000);

        } catch (err) {
            clearInterval(progressTimer);
            setUploadProgress(0);
            setUploadError(err.message);
        } finally {
            setUploading(false);
        }
    };

    // ── Delete ──
    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar esta pista permanentemente?')) return;
        setDeletingId(id);
        try {
            const res = await fetch('/api/admin/soundtracks', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, hard: true })
            });
            if (res.ok) {
                await fetchSoundtracks();
            }
        } catch (err) {
            console.warn('Delete failed:', err);
        } finally {
            setDeletingId(null);
        }
    };

    // ── Preview Audio ──
    const togglePreview = (track) => {
        if (playingId === track.id) {
            audioPreviewRef.current?.pause();
            setPlayingId(null);
        } else {
            if (audioPreviewRef.current) {
                audioPreviewRef.current.pause();
            }
            const audio = new Audio(track.public_url);
            audio.volume = 0.5;
            audio.onended = () => setPlayingId(null);
            audio.onerror = () => setPlayingId(null);
            audio.play().catch(() => setPlayingId(null));
            audioPreviewRef.current = audio;
            setPlayingId(track.id);
        }
    };

    // ── Sort Drag & Drop ──
    const handleSortDragStart = (e, trackId) => {
        setSortDragId(trackId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleSortDragOver = (e, index) => {
        e.preventDefault();
        setDragOverIndex(index);
    };

    const handleSortDrop = async (e, targetIndex) => {
        e.preventDefault();
        setDragOverIndex(null);
        if (!sortDragId) return;

        const filtered = soundtracks.filter(t => t.track_type === selectedType);
        const sourceIndex = filtered.findIndex(t => t.id === sortDragId);
        if (sourceIndex === -1 || sourceIndex === targetIndex) {
            setSortDragId(null);
            return;
        }

        // Reorder locally
        const reordered = [...filtered];
        const [moved] = reordered.splice(sourceIndex, 1);
        reordered.splice(targetIndex, 0, moved);

        // Update sort_order
        const items = reordered.map((t, idx) => ({ id: t.id, sort_order: idx }));
        
        // Optimistic update
        const updatedAll = soundtracks.map(t => {
            const item = items.find(i => i.id === t.id);
            return item ? { ...t, sort_order: item.sort_order } : t;
        });
        setSoundtracks(updatedAll);

        // Persist
        try {
            await fetch('/api/admin/soundtracks', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });
        } catch (err) {
            console.warn('Reorder failed:', err);
            await fetchSoundtracks();
        }

        setSortDragId(null);
    };

    // ── Cleanup ──
    useEffect(() => {
        return () => {
            if (audioPreviewRef.current) {
                audioPreviewRef.current.pause();
                audioPreviewRef.current = null;
            }
        };
    }, []);

    const filteredTracks = soundtracks
        .filter(t => t.track_type === selectedType)
        .sort((a, b) => a.sort_order - b.sort_order);

    const boardingCount = soundtracks.filter(t => t.track_type === 'boarding').length;
    const inFlightCount = soundtracks.filter(t => t.track_type === 'in_flight').length;

    return (
        <div className="space-y-8 animate-premium-in">
            {/* ── HEADER ── */}
            <div className="flex items-center gap-4">
                <div 
                    className="w-14 h-14 rounded-[1.25rem] flex items-center justify-center"
                    style={{ 
                        boxShadow: 'inset 4px 4px 8px var(--neu-shadow-dark), inset -4px -4px 8px var(--neu-shadow-light)',
                        color: '#a78bfa'
                    }}
                >
                    <Music size={24} strokeWidth={2.5} />
                </div>
                <div>
                    <h2 className="text-2xl font-black tracking-tight neu-text">Bandas Sonoras</h2>
                    <p className="text-sm font-semibold neu-text-sub">
                        {soundtracks.length} pista{soundtracks.length !== 1 ? 's' : ''} · {boardingCount} abordaje · {inFlightCount} vuelo
                    </p>
                </div>
            </div>

            {/* ── UPLOAD ZONE ── */}
            <div className="neu-card p-6 space-y-5">
                <h3 className="text-sm font-black uppercase tracking-widest neu-text-sub flex items-center gap-2">
                    <Upload size={14} /> Subir Nueva Pista
                </h3>

                {/* Drag & Drop Area */}
                <div
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-500 ${
                        dragOver 
                            ? 'border-violet-400 bg-violet-500/10 scale-[1.01] shadow-[0_0_30px_rgba(167,139,250,0.3)]' 
                            : pendingFile 
                                ? 'border-emerald-400/50 bg-emerald-500/5' 
                                : 'border-gray-300 dark:border-gray-600 hover:border-violet-300 hover:bg-violet-500/5'
                    }`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".mp3,.m4a,audio/mpeg,audio/mp4"
                        onChange={(e) => handleFileSelect(e.target.files?.[0])}
                        className="hidden"
                    />

                    {pendingFile ? (
                        <div className="flex items-center justify-center gap-3">
                            <CheckCircle size={20} className="text-emerald-500" />
                            <div className="text-left">
                                <p className="text-sm font-bold neu-text">{pendingFile.name}</p>
                                <p className="text-xs neu-text-sub">{formatFileSize(pendingFile.size)}</p>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setPendingFile(null); setTitle(''); }}
                                className="ml-2 p-1 rounded-full hover:bg-red-500/20 text-red-400 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Music size={32} className={`mx-auto transition-all duration-300 ${dragOver ? 'text-violet-400 scale-125' : 'neu-text-sub opacity-50'}`} />
                            <p className="text-sm font-bold neu-text">
                                Arrastra un archivo de audio aquí
                            </p>
                            <p className="text-xs neu-text-sub">
                                o haz clic para seleccionar · Solo .MP3 y .M4A · Máx 15MB
                            </p>
                        </div>
                    )}
                </div>

                {/* Rejection Tooltip */}
                {rejectionTooltip && (
                    <div className="flex items-start gap-2 p-3 rounded-xl text-sm bg-red-500/15 text-red-400 border border-red-500/20 animate-premium-in">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span className="font-semibold">{rejectionTooltip}</span>
                    </div>
                )}

                {/* Metadata Fields */}
                {pendingFile && (
                    <div className="space-y-4 animate-premium-in">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider neu-text-sub mb-2">
                                    Título de la Pista *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: Aventura Galáctica"
                                    className="w-full neu-input-inset px-4 py-3 text-sm font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider neu-text-sub mb-2">
                                    Artista (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={artist}
                                    onChange={(e) => setArtist(e.target.value)}
                                    placeholder="Ej: FlyHigh Music"
                                    className="w-full neu-input-inset px-4 py-3 text-sm font-semibold"
                                />
                            </div>
                        </div>

                        {/* Track Type Selector */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider neu-text-sub mb-2">
                                Tipo de Pista *
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(TRACK_TYPE_LABELS).map(([key, config]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => setSelectedType(key)}
                                        className={`p-4 rounded-2xl border-2 text-left transition-all duration-300 active:scale-[0.97] ${
                                            selectedType === key 
                                                ? 'border-violet-400 bg-violet-500/10 shadow-[0_0_20px_rgba(167,139,250,0.15)]' 
                                                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                                        }`}
                                        style={{ 
                                            boxShadow: selectedType === key 
                                                ? undefined 
                                                : 'inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light)'
                                        }}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">{config.emoji}</span>
                                            <span className="text-sm font-black neu-text">{config.label}</span>
                                        </div>
                                        <p className="text-[11px] font-semibold neu-text-sub">{config.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Upload Button */}
                        <button
                            onClick={handleUpload}
                            disabled={uploading || !title.trim()}
                            className="w-full py-4 rounded-xl font-bold text-white text-sm tracking-wide bg-gradient-to-r from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Subiendo... {Math.round(uploadProgress)}%
                                </>
                            ) : uploadSuccess ? (
                                <>
                                    <CheckCircle size={16} />
                                    ¡Pista Subida Exitosamente!
                                </>
                            ) : (
                                <>
                                    <Upload size={16} />
                                    Subir Pista
                                </>
                            )}
                        </button>

                        {/* Upload Progress Bar */}
                        {(uploading || uploadSuccess) && (
                            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--neu-bg)' }}>
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ease-out ${uploadSuccess ? 'bg-emerald-500' : 'bg-gradient-to-r from-violet-500 to-purple-600'}`}
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        )}

                        {uploadError && (
                            <div className="flex items-center gap-2 p-3 rounded-xl text-sm bg-red-500/15 text-red-400 border border-red-500/20">
                                <AlertCircle size={14} />
                                <span className="font-semibold">{uploadError}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── TRACK LIST ── */}
            <div className="neu-card p-6 space-y-5">
                {/* Type Tabs */}
                <div className="flex gap-2">
                    {Object.entries(TRACK_TYPE_LABELS).map(([key, config]) => {
                        const count = soundtracks.filter(t => t.track_type === key).length;
                        return (
                            <button
                                key={key}
                                onClick={() => setSelectedType(key)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 active:scale-[0.96] ${
                                    selectedType === key
                                        ? 'text-white shadow-lg'
                                        : 'neu-text-sub hover:neu-text'
                                }`}
                                style={{
                                    background: selectedType === key ? `linear-gradient(135deg, ${config.color}, ${config.color}cc)` : undefined,
                                    boxShadow: selectedType === key 
                                        ? `0 4px 15px ${config.color}40` 
                                        : 'inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light)'
                                }}
                            >
                                <span>{config.emoji}</span>
                                {config.label}
                                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${selectedType === key ? 'bg-white/20' : 'opacity-60'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Track Items */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin neu-text-sub" />
                    </div>
                ) : filteredTracks.length === 0 ? (
                    <div className="text-center py-12">
                        <Music size={40} className="mx-auto mb-3 neu-text-sub opacity-30" />
                        <p className="text-sm font-bold neu-text-sub">
                            No hay pistas de {TRACK_TYPE_LABELS[selectedType]?.label || selectedType}
                        </p>
                        <p className="text-xs neu-text-sub opacity-60 mt-1">Sube una pista usando el panel de arriba</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredTracks.map((track, index) => (
                            <div
                                key={track.id}
                                draggable
                                onDragStart={(e) => handleSortDragStart(e, track.id)}
                                onDragOver={(e) => handleSortDragOver(e, index)}
                                onDrop={(e) => handleSortDrop(e, index)}
                                onDragEnd={() => { setSortDragId(null); setDragOverIndex(null); }}
                                className={`neu-list-item p-4 flex items-center gap-3 cursor-grab active:cursor-grabbing transition-all duration-300 ${
                                    sortDragId === track.id ? 'opacity-50 scale-[0.97]' : ''
                                } ${dragOverIndex === index ? 'ring-2 ring-violet-400/50 scale-[1.01]' : ''}`}
                            >
                                {/* Drag Handle */}
                                <div className="shrink-0 neu-text-sub opacity-40 hover:opacity-80 transition-opacity">
                                    <GripVertical size={16} />
                                </div>

                                {/* Play/Pause Button */}
                                <button
                                    onClick={() => togglePreview(track)}
                                    className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-90 ${
                                        playingId === track.id 
                                            ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30' 
                                            : ''
                                    }`}
                                    style={playingId !== track.id ? {
                                        boxShadow: 'inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light)'
                                    } : undefined}
                                >
                                    {playingId === track.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                                </button>

                                {/* Track Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate neu-text">{track.title}</p>
                                    <p className="text-[11px] font-semibold neu-text-sub truncate">
                                        {track.artist || 'Sin artista'} · {formatFileSize(track.file_size_bytes)} · {formatDuration(track.duration_seconds)}
                                    </p>
                                </div>

                                {/* Sort Order Badge */}
                                <span className="text-[10px] font-black neu-text-sub opacity-40">
                                    #{index + 1}
                                </span>

                                {/* Delete */}
                                <button
                                    onClick={() => handleDelete(track.id)}
                                    disabled={deletingId === track.id}
                                    className="shrink-0 p-2 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-300 active:scale-90 disabled:opacity-30"
                                >
                                    {deletingId === track.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
