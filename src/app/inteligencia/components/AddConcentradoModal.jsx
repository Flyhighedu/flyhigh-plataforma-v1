'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Plus } from 'lucide-react';
import { parseFile } from '../lib/parser';

/**
 * AddConcentradoModal — Mini-modal to upload an additional Excel file
 * and merge its schools into the current project.
 */
export default function AddConcentradoModal({ existingCCTs, onAddSchools, onClose }) {
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setError('Formato no soportado. Por favor carga un archivo Excel (.xlsx, .xls) o CSV.');
      return;
    }

    setError(null);
    setParsing(true);
    setParseResult(null);

    try {
      const result = await parseFile(file);

      // Filter out duplicates by CCT
      const existingSet = new Set(existingCCTs || []);
      const newSchools = result.schools.filter(s => !existingSet.has(s.cct));
      const duplicates = result.schools.length - newSchools.length;

      setParseResult({
        ...result,
        schools: newSchools,
        meta: {
          ...result.meta,
          validSchools: newSchools.length,
          duplicates,
          originalCount: result.schools.length,
        },
      });
    } catch (err) {
      setError(err.message || 'Error al procesar el archivo.');
    } finally {
      setParsing(false);
    }
  }, [existingCCTs]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer?.files?.[0]);
  }, [handleFile]);

  const handleSubmit = useCallback(() => {
    if (!parseResult || parseResult.schools.length === 0) return;
    onAddSchools(parseResult.schools, parseResult.meta);
    onClose();
  }, [parseResult, onAddSchools, onClose]);

  const nivelBadgeClass = (nivel) => {
    if (nivel === 'PRIMARIA') return 'bg-blue-500/15 text-blue-400';
    if (nivel === 'PREESCOLAR') return 'bg-pink-500/15 text-pink-400';
    if (nivel === 'SECUNDARIA') return 'bg-purple-500/15 text-purple-400';
    if (nivel === 'MEDIA SUPERIOR') return 'bg-orange-500/15 text-orange-400';
    return 'bg-gray-500/15 text-gray-400';
  };

  return (
    <div className="intel-modal-backdrop animate-intel-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 animate-intel-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="intel-glass rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="px-6 pt-6 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30">
                <Plus size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Agregar Concentrado</h2>
                <p className="text-xs text-gray-400 mt-0.5">Sube otro Excel para combinar en este proyecto</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="px-6 pb-6 space-y-4">
            {/* Dropzone */}
            {!parseResult && (
              <div
                className={`intel-dropzone p-6 flex flex-col items-center justify-center gap-3 cursor-pointer min-h-[140px] ${
                  dragActive ? 'dragging' : ''
                } ${parsing ? 'pointer-events-none opacity-60' : ''}`}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={e => handleFile(e.target.files?.[0])}
                  className="hidden"
                />
                {parsing ? (
                  <>
                    <div className="w-8 h-8 border-2 border-gray-600 border-t-emerald-500 rounded-full animate-intel-spin" />
                    <p className="text-sm font-medium text-gray-400">Procesando...</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
                      <Upload size={20} className="text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-300">
                      Arrastra tu Excel aquí
                    </p>
                    <p className="text-xs text-gray-500">.xlsx, .xls, .csv</p>
                  </>
                )}
              </div>
            )}

            {/* Success */}
            {parseResult && (
              <div className="intel-card p-4 space-y-3 animate-intel-slide-up border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/15">
                    <CheckCircle size={16} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-400">Listo para combinar</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <FileSpreadsheet size={11} />
                      {parseResult.meta.fileName}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <p className="text-base font-bold text-white">{parseResult.meta.validSchools.toLocaleString()}</p>
                    <p className="text-[9px] font-semibold text-gray-500 uppercase">Nuevas</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <p className="text-base font-bold text-gray-500">{parseResult.meta.duplicates || 0}</p>
                    <p className="text-[9px] font-semibold text-gray-500 uppercase">Duplicadas</p>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-2.5 text-center">
                    <p className="text-base font-bold text-white">{parseResult.meta.municipios?.length || 0}</p>
                    <p className="text-[9px] font-semibold text-gray-500 uppercase">Municipios</p>
                  </div>
                </div>

                {/* Nivel badges */}
                {parseResult.meta.nivelesEducativos?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-500 uppercase">Nivel:</span>
                    {parseResult.meta.nivelesEducativos.map(n => (
                      <span key={n} className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${nivelBadgeClass(n)}`}>
                        {n}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => { setParseResult(null); setError(null); }}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  ← Cambiar archivo
                </button>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-300/70">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!parseResult || parseResult.schools.length === 0}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                parseResult?.schools?.length > 0
                  ? 'intel-btn-emerald shadow-lg'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              <Plus size={15} />
              {parseResult?.schools?.length > 0
                ? `Agregar ${parseResult.schools.length.toLocaleString()} escuelas`
                : 'Selecciona un archivo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
