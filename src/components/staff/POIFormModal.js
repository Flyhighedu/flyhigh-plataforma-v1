'use client';

// =====================================================
// POIFormModal.js
// Bottom-sheet modal to create/edit a Point of Interest.
// Captures name, description, category from user;
// lat/lng are pre-filled from the map click event.
// =====================================================

import { useState, useEffect, useRef } from 'react';
import { X, Star, MapPin, Loader2, Trash2 } from 'lucide-react';

const CATEGORIES = [
    { id: 'school',   emoji: '🏫', label: 'Escuela',          color: '#3B82F6' },
    { id: 'parking',  emoji: '🅿️', label: 'Estacionamiento', color: '#8B5CF6' },
    { id: 'hazard',   emoji: '⚠️', label: 'Peligro',         color: '#EF4444' },
    { id: 'landmark', emoji: '📍', label: 'Referencia',       color: '#10B981' },
    { id: 'refuel',   emoji: '⛽', label: 'Gasolinera',       color: '#F59E0B' },
    { id: 'general',  emoji: '📌', label: 'General',          color: '#64748B' }
];

export { CATEGORIES };

export default function POIFormModal({
    isOpen,
    onClose,
    onSave,
    onDelete,
    latitude,
    longitude,
    editingPoi = null,
    isSaving = false
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('general');
    const [isFavorite, setIsFavorite] = useState(false);
    const nameRef = useRef(null);

    // Reset form when opening / changing edit target
    useEffect(() => {
        if (isOpen) {
            if (editingPoi) {
                setName(editingPoi.name || '');
                setDescription(editingPoi.description || '');
                setCategory(editingPoi.category || 'general');
                setIsFavorite(editingPoi.is_favorite || false);
            } else {
                setName('');
                setDescription('');
                setCategory('general');
                setIsFavorite(false);
            }
            // Auto-focus name field after animation
            setTimeout(() => nameRef.current?.focus(), 350);
        }
    }, [isOpen, editingPoi]);

    const handleSubmit = () => {
        const trimmed = name.trim();
        if (trimmed.length < 2 || isSaving) return;

        onSave({
            name: trimmed,
            description: description.trim() || null,
            category,
            is_favorite: isFavorite,
            latitude: editingPoi?.latitude ?? latitude,
            longitude: editingPoi?.longitude ?? longitude,
            ...(editingPoi?.id ? { id: editingPoi.id } : {})
        });
    };

    if (!isOpen) return null;

    const lat = editingPoi?.latitude ?? latitude;
    const lng = editingPoi?.longitude ?? longitude;
    const isValid = name.trim().length >= 2;

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                padding: '0 0 0 0'
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                style={{
                    background: '#0F172A',
                    borderRadius: '28px 28px 0 0',
                    padding: '24px 20px 32px',
                    width: '100%', maxWidth: 440,
                    boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
                    animation: 'poiSlideUp 0.3s ease'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 800, color: '#06B6D4', textTransform: 'uppercase', letterSpacing: '0.14em', margin: '0 0 2px' }}>
                            {editingPoi ? 'Editar Punto' : 'Nuevo Punto de Interés'}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <MapPin size={14} style={{ color: '#94A3B8' }} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', fontFamily: 'monospace' }}>
                                {typeof lat === 'number' ? lat.toFixed(5) : '—'}, {typeof lng === 'number' ? lng.toFixed(5) : '—'}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: 36, height: 36, borderRadius: 12,
                            border: '1px solid #334155', background: '#1E293B',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#94A3B8'
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Name */}
                    <label style={{ display: 'block' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Nombre *
                        </span>
                        <input
                            ref={nameRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej. Escuela Benito Juárez"
                            maxLength={100}
                            style={{
                                width: '100%', marginTop: 6,
                                padding: '12px 14px', borderRadius: 14,
                                border: '2px solid #334155', background: '#1E293B',
                                fontSize: 15, fontWeight: 600, color: '#F1F5F9',
                                outline: 'none', boxSizing: 'border-box',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#06B6D4'}
                            onBlur={(e) => e.target.style.borderColor = '#334155'}
                        />
                    </label>

                    {/* Description */}
                    <label style={{ display: 'block' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Nota (opcional)
                        </span>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Ej. Entrada por la calle lateral..."
                            maxLength={300}
                            rows={2}
                            style={{
                                width: '100%', marginTop: 6,
                                padding: '10px 14px', borderRadius: 14,
                                border: '2px solid #334155', background: '#1E293B',
                                fontSize: 13, fontWeight: 500, color: '#F1F5F9',
                                outline: 'none', boxSizing: 'border-box',
                                resize: 'none', transition: 'border-color 0.2s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#06B6D4'}
                            onBlur={(e) => e.target.style.borderColor = '#334155'}
                        />
                    </label>

                    {/* Category Selector */}
                    <div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>
                            Categoría
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                            {CATEGORIES.map(cat => {
                                const isSelected = category === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setCategory(cat.id)}
                                        style={{
                                            padding: '10px 6px',
                                            borderRadius: 14,
                                            border: `2px solid ${isSelected ? cat.color : '#334155'}`,
                                            background: isSelected ? `${cat.color}15` : '#1E293B',
                                            cursor: 'pointer',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                                        <span style={{ fontSize: 9, fontWeight: 800, color: isSelected ? cat.color : '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {cat.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Favorite Toggle */}
                    <button
                        type="button"
                        onClick={() => setIsFavorite(!isFavorite)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', borderRadius: 14,
                            border: `2px solid ${isFavorite ? '#F59E0B' : '#334155'}`,
                            background: isFavorite ? '#F59E0B10' : '#1E293B',
                            cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        <Star size={18} fill={isFavorite ? '#F59E0B' : 'none'} style={{ color: isFavorite ? '#F59E0B' : '#64748B' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: isFavorite ? '#F59E0B' : '#94A3B8' }}>
                            {isFavorite ? 'Favorito ★' : 'Marcar como favorito'}
                        </span>
                    </button>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    {editingPoi && onDelete && (
                        <button
                            onClick={() => onDelete(editingPoi.id)}
                            disabled={isSaving}
                            style={{
                                width: 48, height: 48, borderRadius: 14,
                                border: '1px solid #7F1D1D', background: '#450A0A',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: '#FCA5A5',
                                opacity: isSaving ? 0.5 : 1
                            }}
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={!isValid || isSaving}
                        style={{
                            flex: 1, padding: '14px 0', borderRadius: 16,
                            border: 'none',
                            background: isValid
                                ? 'linear-gradient(135deg, #06B6D4, #0891B2)'
                                : '#334155',
                            color: isValid ? 'white' : '#64748B',
                            fontSize: 14, fontWeight: 800,
                            cursor: isValid ? 'pointer' : 'not-allowed',
                            boxShadow: isValid ? '0 10px 24px -6px rgba(6,182,212,0.4)' : 'none',
                            transition: 'all 0.3s ease',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                        }}
                    >
                        {isSaving ? (
                            <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</>
                        ) : (
                            editingPoi ? 'Actualizar Punto' : 'Guardar Punto'
                        )}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes poiSlideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
