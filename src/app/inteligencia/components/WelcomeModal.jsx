'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Sparkles, X, Plus, Trash2 } from 'lucide-react';
import { parseFile } from '../lib/parser';

export default function WelcomeModal({ onProjectReady, onClose, existingProjects = [] }) {
  const [projectName, setProjectName] = useState('');
  const [ownerName, setOwnerName] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('intelOwnerName') || '';
    return '';
  });
  const [pin, setPin] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseResults, setParseResults] = useState([]); // array of { schools, meta }
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;

    // Validate extension
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setError(`Formato no soportado en "${file.name}". Usa .xlsx, .xls o .csv`);
      return;
    }

    // Prevent duplicates
    if (parseResults.some(r => r.meta.fileName === file.name)) {
      setError(`El archivo "${file.name}" ya fue agregado.`);
      return;
    }

    setError(null);
    setParsing(true);

    try {
      const result = await parseFile(file);
      setParseResults(prev => [...prev, result]);
      
      // Auto-fill project name from first file only if empty
      if (parseResults.length === 0 && !projectName.trim()) {
        const baseName = file.name.replace(/\.\w+$/, '').replace(/[_-]/g, ' ');
        setProjectName(baseName);
      }
    } catch (err) {
      setError(err.message || 'Error al procesar el archivo.');
    } finally {
      setParsing(false);
    }
  }, [parseResults, projectName]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer?.files?.length > 0) {
      // Allow dropping multiple files
      Array.from(e.dataTransfer.files).forEach(file => handleFile(file));
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleFileInput = useCallback((e) => {
    if (e.target.files?.length > 0) {
      Array.from(e.target.files).forEach(file => handleFile(file));
    }
    // reset input so same file can be selected again if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleFile]);

  const handleRemoveFile = useCallback((index) => {
    setParseResults(prev => prev.filter((_, i) => i !== index));
    if (parseResults.length === 1) {
      setError(null); // Clear errors if removing the last file
    }
  }, [parseResults]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    let totalSchools = 0;
    let totalMunicipiosSet = new Set();
    let totalAlumnos = 0;
    let allNiveles = new Set();
    let allTurnos = new Set();

    parseResults.forEach(result => {
      totalSchools += result.meta.validSchools || 0;
      result.meta.municipios?.forEach(m => totalMunicipiosSet.add(m));
      result.schools.forEach(s => {
        if (s.nivelEducativo) allNiveles.add(s.nivelEducativo.toUpperCase());
        if (s.turno) allTurnos.add(s.turno.toUpperCase().trim());
        totalAlumnos += (s.alumnos || 0);
      });
    });

    return {
      totalSchools,
      totalMunicipios: totalMunicipiosSet.size,
      totalAlumnos,
      niveles: Array.from(allNiveles).sort(),
      turnos: Array.from(allTurnos).sort()
    };
  }, [parseResults]);

  const handleSubmit = useCallback(() => {
    if (parseResults.length === 0 || !projectName.trim() || !ownerName.trim()) return;
    
    // Save owner name for next time
    localStorage.setItem('intelOwnerName', ownerName.trim());

    // Combine all schools
    const allSchools = parseResults.flatMap(r => r.schools);

    onProjectReady({
      name: projectName.trim(),
      owner: ownerName.trim(),
      pin: pin.trim() || null,
      stats: aggregateStats,
      schools: allSchools,
      meta: {
        ...parseResults[0].meta, // Take the first file's meta as base (e.g. columns mapped)
        validSchools: aggregateStats.totalSchools,
        municipios: aggregateStats.totalMunicipios,
        fileName: parseResults.map(r => r.meta.fileName).join(', '), // Comma separated names
      },
    });
  }, [parseResults, projectName, ownerName, pin, aggregateStats, onProjectReady]);

  const isReady = parseResults.length > 0 && projectName.trim() && ownerName.trim();

  return (
    <div className="intel-modal-backdrop animate-intel-fade-in">
      <div className="w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto animate-intel-scale-in hide-scrollbar">
        {/* Glass card */}
        <div className="intel-glass rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="px-8 pt-8 pb-4 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
                <Sparkles size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Nuevo Proyecto</h1>
                <p className="text-sm text-gray-400 mt-0.5">Inteligencia Comercial Fly High</p>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="px-8 pb-8 space-y-5">
            {/* Form Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Nombre del Proyecto
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ej: Ruta Uruapan Sur..."
                  className="intel-input text-base"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Tu Nombre (Editor)
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="intel-input text-base"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5 uppercase tracking-wider">
                <LockIcon />
                Proteger con PIN (Opcional)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Ej: 1234 (4 a 6 dígitos)"
                className="intel-input text-base font-mono tracking-widest placeholder:tracking-normal w-full max-w-[200px]"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Si agregas un PIN, otros podrán ver el mapa pero no podrán guardar cambios ni modificar tus datos.
              </p>
            </div>

            {/* Empty Dropzone */}
            {parseResults.length === 0 && (
              <div
                className={`intel-dropzone p-8 flex flex-col items-center justify-center gap-4 cursor-pointer min-h-[180px] ${
                  dragActive ? 'dragging' : ''
                } ${parsing ? 'pointer-events-none opacity-60' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />

                {parsing ? (
                  <LoadingState />
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20">
                      <Upload size={24} className="text-blue-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-gray-300">
                        Arrastra tus archivos Excel del SIGED aquí
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Puedes subir múltiples archivos .xlsx, .xls, .csv
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* List of uploaded files */}
            {parseResults.length > 0 && (
              <div className="space-y-4 animate-intel-slide-up">
                
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-white/[0.06] pb-2 block">
                  Archivos Cargados ({parseResults.length})
                </label>

                <div className="space-y-2 max-h-[180px] overflow-y-auto hide-scrollbar pr-1">
                  {parseResults.map((result, idx) => (
                    <div key={idx} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 flex items-center justify-between group hover:bg-white/[0.04] transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 shrink-0">
                          <CheckCircle size={14} className="text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-200 truncate pr-4">{result.meta.fileName}</p>
                          <p className="text-[10px] text-gray-500 flex items-center gap-2">
                            <span>{result.meta.validSchools.toLocaleString()} escuelas</span>
                            <span>•</span>
                            <span>{result.meta.municipios.length} municipios</span>
                          </p>
                          <p className="text-[9px] text-gray-400/80 truncate mt-0.5 max-w-[300px]">
                            {result.meta.nivelesEducativos?.join(', ')}
                            {(result.meta.nivelesEducativos?.length > 0 && result.meta.turnos?.length > 0) ? ' | ' : ''}
                            {result.meta.turnos?.join(', ')}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveFile(idx)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        title="Remover archivo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}

                  {/* Secondary Dropzone */}
                  <div
                    className={`border-2 border-dashed border-gray-700 hover:border-blue-500/50 rounded-xl p-3 flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      dragActive ? 'bg-blue-500/10 border-blue-500' : 'bg-transparent'
                    } ${parsing ? 'pointer-events-none opacity-60' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      multiple
                      onChange={handleFileInput}
                      className="hidden"
                    />
                    {parsing ? (
                       <div className="flex items-center gap-2">
                         <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-500 rounded-full animate-intel-spin" />
                         <span className="text-xs font-semibold text-gray-400">Procesando...</span>
                       </div>
                    ) : (
                      <>
                        <Plus size={16} className="text-gray-500" />
                        <span className="text-sm font-semibold text-gray-400">Agregar otro archivo</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Aggregated Stats */}
                <div className="bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-500/20 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-semibold text-blue-400/80 uppercase tracking-wider mb-1">Total Consolidado</p>
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-xl font-bold text-white mr-1">{aggregateStats.totalSchools.toLocaleString()}</span>
                          <span className="text-xs text-gray-400">escuelas</span>
                        </div>
                        <div className="w-px h-6 bg-blue-500/20"></div>
                        <div>
                          <span className="text-xl font-bold text-white mr-1">{aggregateStats.totalMunicipios}</span>
                          <span className="text-xs text-gray-400">municipios</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {(aggregateStats.niveles.length > 0 || aggregateStats.turnos.length > 0) && (
                    <div className="pt-3 border-t border-blue-500/10 flex flex-wrap gap-x-6 gap-y-2">
                      {aggregateStats.niveles.length > 0 && (
                        <div>
                          <span className="text-[9px] text-blue-400/60 uppercase tracking-wider block mb-0.5">Niveles Educativos</span>
                          <span className="text-xs text-blue-200">{aggregateStats.niveles.join(', ')}</span>
                        </div>
                      )}
                      {aggregateStats.turnos.length > 0 && (
                        <div>
                          <span className="text-[9px] text-blue-400/60 uppercase tracking-wider block mb-0.5">Turnos</span>
                          <span className="text-xs text-blue-200">{aggregateStats.turnos.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-intel-slide-up">
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-400">Error al procesar</p>
                  <p className="text-xs text-red-300/70 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!isReady}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                isReady
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-gray-900 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 translate-y-0 hover:-translate-y-0.5'
                  : 'bg-white/[0.05] text-gray-500 cursor-not-allowed'
              }`}
            >
              {isReady ? (
                <>
                  <Sparkles size={16} />
                  Iniciar Proyecto con {parseResults.length} {parseResults.length === 1 ? 'archivo' : 'archivos'}
                </>
              ) : (
                'Completa los datos para iniciar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Extract small UI components to keep code clean
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function LoadingState() {
  return (
    <>
      <div className="w-10 h-10 border-3 border-gray-600 border-t-blue-500 rounded-full animate-intel-spin" />
      <p className="text-sm font-medium text-gray-400">Procesando archivo...</p>
      <div className="w-48 h-1.5 rounded-full bg-gray-800 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full animate-intel-shimmer" />
      </div>
    </>
  );
}
