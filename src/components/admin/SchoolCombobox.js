'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, School, ChevronDown, X, Loader2, Users } from 'lucide-react';

/**
 * SchoolCombobox — Dual-search combobox for catalogo_escuelas.
 * Searches by CCT and nombre_escuela simultaneously.
 * 
 * Props:
 *  - schools: Array of { cct, nombre_escuela, turno, tipo, ninos, codigo_postal }
 *  - value: currently selected school object (or null)
 *  - onChange: (school | null) => void
 *  - loading: boolean — whether the catalog is still loading
 *  - disabled: boolean
 */
export default function SchoolCombobox({ schools = [], value, onChange, loading = false, disabled = false }) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    // Filter schools based on query (dual: CCT + name)
    const filtered = query.trim().length === 0
        ? schools
        : schools.filter(s => {
            const q = query.toLowerCase();
            return (
                s.cct?.toLowerCase().includes(q) ||
                s.nombre_escuela?.toLowerCase().includes(q)
            );
        });

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightIndex >= 0 && listRef.current) {
            const items = listRef.current.children;
            if (items[highlightIndex]) {
                items[highlightIndex].scrollIntoView({ block: 'nearest' });
            }
        }
    }, [highlightIndex]);

    const handleSelect = useCallback((school) => {
        onChange(school);
        setQuery('');
        setIsOpen(false);
        setHighlightIndex(-1);
        inputRef.current?.blur();
    }, [onChange]);

    const handleClear = useCallback((e) => {
        e.stopPropagation();
        onChange(null);
        setQuery('');
        setHighlightIndex(-1);
        inputRef.current?.focus();
    }, [onChange]);

    const handleKeyDown = useCallback((e) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (highlightIndex >= 0 && highlightIndex < filtered.length) {
                    handleSelect(filtered[highlightIndex]);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setHighlightIndex(-1);
                inputRef.current?.blur();
                break;
        }
    }, [isOpen, filtered, highlightIndex, handleSelect]);

    // Turno badge color
    const turnoColor = (turno) => {
        if (!turno) return 'bg-slate-600/50 text-slate-300';
        const t = turno.toLowerCase();
        if (t.includes('matutino')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
        if (t.includes('vespertino')) return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
        return 'bg-slate-600/30 text-slate-300 border-slate-500/30';
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Selected state display */}
            {value ? (
                <div className="w-full neu-input-inset border-amber-500/30 dark:border-amber-500/40 border rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-all">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <School size={14} className="text-amber-500 shrink-0" />
                            <span className="font-bold neu-text truncate">{value.nombre_escuela}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                            <span className="text-[10px] font-mono bg-cyan-500/15 text-cyan-500 px-1.5 py-0.5 rounded border border-cyan-500/20">
                                {value.cct}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${turnoColor(value.turno)}`}>
                                {value.turno}
                            </span>
                            {value.ninos > 0 && (
                                <span className="text-[10px] neu-text-sub flex items-center gap-0.5">
                                    <Users size={10} /> {value.ninos}
                                </span>
                            )}
                        </div>
                    </div>
                    {!disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-slate-400 hover:text-red-500 shrink-0"
                            title="Cambiar escuela"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            ) : (
                /* Search input */
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                        {loading ? (
                            <Loader2 size={16} className="text-slate-400 animate-spin" />
                        ) : (
                            <Search size={16} className="text-slate-400" />
                        )}
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setIsOpen(true);
                            setHighlightIndex(-1);
                        }}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={handleKeyDown}
                        disabled={disabled || loading}
                        placeholder={loading ? 'Cargando catálogo...' : 'Buscar por nombre o CCT...'}
                        className="w-full neu-input-inset rounded-xl pl-11 pr-10 py-3 transition-all disabled:opacity-50"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            )}

            {/* Dropdown */}
            {isOpen && !value && (
                <div className="absolute z-50 mt-2 w-full neu-card rounded-xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80">
                    {loading ? (
                        <div className="flex items-center justify-center py-8 neu-text-sub gap-2">
                            <Loader2 size={18} className="animate-spin" />
                            <span className="text-sm">Cargando catálogo...</span>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-6 text-center neu-text-sub">
                            <School size={24} className="mx-auto mb-2 opacity-40 text-slate-400" />
                            <p className="text-sm">No se encontraron escuelas</p>
                            <p className="text-[10px] text-slate-400 mt-1">Intenta con otro nombre o CCT</p>
                        </div>
                    ) : (
                        <>
                            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                                    {filtered.length} escuela{filtered.length !== 1 ? 's' : ''}
                                </span>
                                {query && (
                                    <span className="text-[10px] text-amber-500/80">
                                        Buscando: &quot;{query}&quot;
                                    </span>
                                )}
                            </div>
                            <ul
                                ref={listRef}
                                className="max-h-64 overflow-y-auto"
                                role="listbox"
                            >
                                {filtered.map((school, idx) => (
                                    <li
                                        key={school.cct}
                                        role="option"
                                        aria-selected={idx === highlightIndex}
                                        onClick={() => handleSelect(school)}
                                        onMouseEnter={() => setHighlightIndex(idx)}
                                        className={`px-3 py-2.5 cursor-pointer border-b border-slate-100 dark:border-slate-800/50 last:border-b-0 transition-colors ${
                                            idx === highlightIndex
                                                ? 'bg-amber-500/10'
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-sm neu-text truncate">
                                                {school.nombre_escuela}
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${turnoColor(school.turno)}`}>
                                                {school.turno}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400/80">
                                                {school.cct}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                                {school.tipo}
                                            </span>
                                            {school.ninos > 0 && (
                                                <span className="text-[10px] neu-text-sub flex items-center gap-0.5 ml-auto">
                                                    <Users size={10} /> {school.ninos}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
