'use client';
import React, { useState, useEffect, useRef } from 'react';
import { X, Search, CheckSquare, Square, Layers, Loader2, CheckCircle2, ChevronRight, Check } from 'lucide-react';
import { jsPDF } from 'jspdf';
import CertificadoEscuela from './CertificadoEscuela';
import { waitForFonts, captureAsJPEGDataURL } from '@/utils/flyerUtils';

export default function MassiveCertificateModal({ isOpen, onClose, targetFlyer, renderFlyer }) {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('PRIMARIA');
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to selectedCount
  const [currentSchoolName, setCurrentSchoolName] = useState('');
  const [currentSchoolPrice, setCurrentSchoolPrice] = useState(150);
  const [prices, setPrices] = useState({}); // cct -> price
  const [isSuccess, setIsSuccess] = useState(false);

  const hiddenCertRef = useRef(null);

  // Check if target requires price
  const requiresPrice = targetFlyer && targetFlyer.id !== 'certificado' && targetFlyer.sourceId !== 'certificado';

  // Fetch schools on mount
  useEffect(() => {
    if (!isOpen) return;
    const fetchSchools = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/catalogo-escuelas', { cache: 'no-store' });
        const result = await res.json();
        if (res.ok) {
          setSchools(result.data || []);
        }
      } catch (err) {
        console.error("Error fetching schools:", err);
      } finally {
        setLoading(false);
      }
    };
    
    // Reset states
    setIsGenerating(false);
    setIsSuccess(false);
    setProgress(0);
    setCurrentSchoolName('');
    setCurrentSchoolPrice(150);
    
    fetchSchools();
  }, [isOpen]);

  if (!isOpen || !targetFlyer) return null;

  const filteredSchools = schools.filter(s => {
    const matchesSearch = s.nombre_escuela?.toLowerCase().includes(search.toLowerCase()) || s.colonia?.toLowerCase().includes(search.toLowerCase());
    const matchesTab = s.nivel_educativo?.toUpperCase() === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleSelectAll = () => {
    if (selectedIds.size === filteredSchools.length) {
      setSelectedIds(new Set()); // deselect all
    } else {
      setSelectedIds(new Set(filteredSchools.map(s => s.cct)));
    }
  };

  const handleSelectByState = (state) => {
    const schoolsInState = filteredSchools.filter(s => (s.estado_pipeline || 'Sin Contactar') === state);
    if (schoolsInState.length === 0) return;
    
    const allSelectedInState = schoolsInState.every(s => selectedIds.has(s.cct));
    const newSet = new Set(selectedIds);
    
    if (allSelectedInState) {
      // Deselect all in this state
      schoolsInState.forEach(s => newSet.delete(s.cct));
    } else {
      // Select all in this state
      schoolsInState.forEach(s => newSet.add(s.cct));
    }
    setSelectedIds(newSet);
  };

  const toggleSelect = (cct) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(cct)) newSet.delete(cct);
    else newSet.add(cct);
    setSelectedIds(newSet);
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) return;
    
    setIsGenerating(true);
    setIsSuccess(false);
    setProgress(0);

    const selectedList = schools.filter(s => selectedIds.has(s.cct));
    
    // We create a PDF document (Letter size: 8.5 x 11 inches)
    // using points (pt) where 72pt = 1 inch -> 612 x 792 pt
    // compress: true applies ZIP compression to the PDF container
    const isHorizontal = targetFlyer.sourceId === "nuevo_horizontal" || targetFlyer.id === "nuevo_horizontal";
    const pdf = new jsPDF({ orientation: isHorizontal ? 'l' : 'p', unit: 'pt', format: 'letter', compress: true });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // Ensure fonts are ready before starting
    await waitForFonts();

    for (let i = 0; i < selectedList.length; i++) {
      const school = selectedList[i];
      
      // 1. Update the React state to change the name in the hidden DOM node
      setCurrentSchoolName(school.nombre_escuela);
      setCurrentSchoolPrice(prices[school.cct] || school.costo_boleto || 150);
      setProgress(i + 1);

      // 2. Wait for React to re-render the hidden node
      await new Promise(resolve => setTimeout(resolve, 200));

      // 3. Capture the hidden node using robust utility
      if (hiddenCertRef.current) {
        try {
          // captureAsJPEGDataURL uses JPEG quality 1.0 to guarantee NO visible quality loss 
          // while dropping the file size massively compared to uncompressed PNG.
          // Scale 3 ensures 4K print quality.
          const imgData = await captureAsJPEGDataURL(hiddenCertRef.current, 3, 1.0);

          // 5. Add to PDF
          if (i > 0) {
            pdf.addPage();
          }
          pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
          
        } catch (err) {
          console.error("Error capturing school", school.nombre_escuela, err);
        }
      }
    }

    // 6. Save the PDF
    pdf.save(`${targetFlyer.label.replace(/\s+/g, '_')}-Masivo-${new Date().toISOString().split('T')[0]}.pdf`);
    
    setIsGenerating(false);
    setIsSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      {/* 
        HIDDEN CERTIFICATE DOM NODE 
        This is placed out of the visible screen but still rendered.
        We pass the dynamically changing school name here.
      */}
      <div style={{ position: 'fixed', left: '100vw', top: '100vh', pointerEvents: 'none', zIndex: -9999 }}>
        <div ref={hiddenCertRef}>
          {renderFlyer ? renderFlyer({ escuela: currentSchoolName || "Nombre de la Escuela", cuota: currentSchoolPrice || 150 }) : (
            <CertificadoEscuela 
              escuela={currentSchoolName || "Nombre de la Escuela"} 
              fecha={"Certificación Oficial"} 
            />
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl h-[90vh] max-h-[900px] overflow-hidden flex flex-col relative animate-premium-in border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Layers className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Generación Masiva: {targetFlyer.label}</h2>
              <p className="text-sm text-slate-500 font-medium">Imprime múltiples documentos en un solo PDF unificado.</p>
            </div>
          </div>
          {!isGenerating && (
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <X size={24} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 flex-1 min-h-0 flex flex-col bg-slate-50">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <Check size={48} strokeWidth={3} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">¡Completado con Éxito!</h3>
              <p className="text-slate-500 max-w-md">Tu documento unificado con {selectedIds.size} certificados se ha descargado a tu computadora. Puedes abrirlo e imprimirlo directamente.</p>
            </div>
          ) : isGenerating ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 size={48} className="animate-spin text-indigo-500 mb-6" />
              <h3 className="text-xl font-black text-slate-800 mb-2">Preparando documento para impresión...</h3>
              <p className="text-slate-500 max-w-md mb-8">
                Estamos uniendo los certificados en un solo archivo PDF de alta calidad. Esto puede tomar unos segundos. Por favor, no cierres esta ventana.
              </p>
              
              {/* Progress Indicator */}
              <div className="w-full max-w-sm bg-slate-200 rounded-full h-3 mb-2 overflow-hidden shadow-inner">
                <div 
                  className="bg-indigo-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(progress / selectedIds.size) * 100}%` }}
                ></div>
              </div>
              <p className="font-bold text-indigo-600 text-sm">
                Procesando escuela {progress} de {selectedIds.size}...
              </p>
              <p className="text-xs text-slate-400 font-medium mt-1 uppercase tracking-wider truncate max-w-xs">
                {currentSchoolName}
              </p>
            </div>
          ) : (
            <div className="space-y-4 flex flex-col h-full min-h-0">
              {/* Level Tabs */}
              <div className="flex bg-slate-200/50 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('PREESCOLAR')}
                  className={`flex-1 py-2 text-sm font-black uppercase tracking-wider rounded-lg transition-all ${
                    activeTab === 'PREESCOLAR' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Preescolar
                </button>
                <button
                  onClick={() => setActiveTab('PRIMARIA')}
                  className={`flex-1 py-2 text-sm font-black uppercase tracking-wider rounded-lg transition-all ${
                    activeTab === 'PRIMARIA' 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Primaria
                </button>
              </div>

              {/* Search and Select All */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="relative flex-1 w-full">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar escuela..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-sm font-medium"
                  />
                </div>
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors whitespace-nowrap"
                >
                  {selectedIds.size === filteredSchools.length && filteredSchools.length > 0 ? (
                    <><CheckSquare size={18} /> Deseleccionar Todas</>
                  ) : (
                    <><Square size={18} /> Seleccionar Todas</>
                  )}
                </button>
              </div>

              {/* Quick Select by State */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Selección rápida por estatus:</p>
                <div className="flex flex-wrap gap-2">
                  {[...new Set(schools.map(s => s.estado_pipeline || 'Sin Contactar'))].sort().map(state => {
                    const schoolsInState = filteredSchools.filter(s => (s.estado_pipeline || 'Sin Contactar') === state);
                    if (schoolsInState.length === 0) return null;
                    
                    const allSelectedInState = schoolsInState.every(s => selectedIds.has(s.cct));
                    
                    return (
                      <button
                        key={state}
                        onClick={() => handleSelectByState(state)}
                        className={`text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 active:scale-95 ${
                          allSelectedInState 
                            ? 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/20' 
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                        }`}
                      >
                        {allSelectedInState ? <CheckSquare size={14} /> : <Square size={14} />}
                        {state} ({schoolsInState.length})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Schools List */}
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="animate-spin text-slate-400" />
                </div>
              ) : filteredSchools.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-medium">
                  No se encontraron escuelas.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto min-h-0 pr-2 pb-4 custom-scrollbar content-start">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredSchools.map(school => {
                    const isSelected = selectedIds.has(school.cct);
                    const estado = school.estado_pipeline || 'Sin Contactar';
                    
                    // Assign colors based on pipeline status
                    let badgeColor = 'bg-slate-100 text-slate-600';
                    const estadoLower = estado.toLowerCase();
                    if (estadoLower === 'ganada') badgeColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                    else if (estadoLower === 'interesado') badgeColor = 'bg-amber-100 text-amber-700 border-amber-200';
                    else if (estadoLower === 'perdida') badgeColor = 'bg-rose-100 text-rose-700 border-rose-200';
                    else if (estadoLower === 'visitada') badgeColor = 'bg-blue-100 text-blue-700 border-blue-200';
                    else if (estadoLower === 'llamada_sin_respuesta' || estadoLower === 'llamada sin respuesta') badgeColor = 'bg-orange-100 text-orange-700 border-orange-200';
                    
                    return (
                      <div 
                        key={school.cct}
                        className={`flex flex-col gap-2 p-2.5 rounded-lg border transition-all ${
                          isSelected 
                            ? 'border-indigo-500 bg-indigo-50/50' 
                            : 'border-transparent bg-white shadow-sm hover:border-slate-200 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleSelect(school.cct)}>
                          <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                            isSelected ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-slate-300'
                          }`}>
                            {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col gap-2">
                            <div className="min-w-0">
                              <p className={`text-xs font-black truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`} title={school.nombre_escuela}>
                                {school.nombre_escuela}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">CCT: {school.cct}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-auto">
                              <span className="text-[9px] uppercase font-bold text-slate-500 truncate mr-2">{school.nivel_educativo || 'S/Nivel'} - {school.turno || 'S/Turno'}</span>
                              <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap ${badgeColor}`}>
                                {estado.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                        </div>
                        {requiresPrice && isSelected && (
                          <div className="mt-1 pt-2 border-t border-indigo-200/50 flex items-center justify-between pl-7">
                            <span className="text-[11px] font-bold text-indigo-900/60 uppercase tracking-widest">Precio de Boleto</span>
                            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-indigo-200 shadow-sm">
                              <span className="text-[11px] font-black text-indigo-400">$</span>
                              <input 
                                type="number" 
                                className="w-16 bg-transparent text-[13px] font-black text-slate-800 focus:outline-none" 
                                value={prices[school.cct] !== undefined ? prices[school.cct] : (school.costo_boleto || 150)}
                                onChange={(e) => setPrices(prev => ({ ...prev, [school.cct]: e.target.value }))}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3 shrink-0">
          {isSuccess ? (
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              Cerrar Ventana
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="px-6 py-3 rounded-xl font-bold bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || selectedIds.size === 0}
                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-black tracking-wide uppercase transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {isGenerating ? (
                  <>Generando...</>
                ) : (
                  <>Generar PDF con {selectedIds.size} Certificados</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
