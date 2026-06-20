import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Sparkles, X, Trash2, FolderOpen, Lock, Unlock, User, Users, Calendar } from 'lucide-react';
import { parseFile } from '../lib/parser';
import { listProjects, deleteProject } from '../lib/storage';

export default function WelcomeModal({ onProjectReady, onSelectProject, onClose }) {
  // New Project State
  const [projectName, setProjectName] = useState('');
  const [ownerName, setOwnerName] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('intelOwnerName') || '';
    return '';
  });
  const [pin, setPin] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseResults, setParseResults] = useState([]);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Validation Shake State
  const [shake, setShake] = useState(false);

  // Cloud Projects State
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  // PIN Prompt State
  const [pinPromptProject, setPinPromptProject] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
      const list = await listProjects();
      setProjects(list);
      setLoadingProjects(false);
    };
    fetchProjects();
  }, []);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (deletingId === id) {
      await deleteProject(id);
      setDeletingId(null);
      setProjects(prev => prev.filter(p => p.id !== id));
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId(prev => prev === id ? null : prev), 3000);
    }
  };

  const handleSelect = (project) => {
    if (project.hasPin) {
      setPinPromptProject(project);
      setPinInput('');
      setPinError(false);
    } else {
      onSelectProject(project.id, false);
    }
  };

  const submitPin = () => {
    if (pinInput.trim() === '') {
      setPinError(true);
      return;
    }
    onSelectProject(pinPromptProject.id, false, pinInput.trim());
  };

  // --- New Project Logic ---
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setError(`Formato no soportado en "${file.name}". Usa .xlsx, .xls o .csv`);
      return;
    }
    if (parseResults.some(r => r.meta.fileName === file.name)) {
      setError(`El archivo "${file.name}" ya fue agregado.`);
      return;
    }
    setError(null);
    setParsing(true);
    try {
      const result = await parseFile(file);
      setParseResults(prev => [...prev, result]);
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleFile]);

  const handleRemoveFile = useCallback((index) => {
    setParseResults(prev => prev.filter((_, i) => i !== index));
    if (parseResults.length === 1) setError(null);
  }, [parseResults]);

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

  const isReady = parseResults.length > 0 && projectName.trim() && ownerName.trim();

  const handleSubmit = useCallback(() => {
    if (!isReady) {
      // Trigger validation feedback
      setError('Por favor, completa el nombre del proyecto, tu nombre y sube al menos un archivo.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    
    localStorage.setItem('intelOwnerName', ownerName.trim());
    const allSchools = parseResults.flatMap(r => r.schools);

    onProjectReady({
      name: projectName.trim(),
      owner: ownerName.trim(),
      pin: pin.trim() || null,
      stats: aggregateStats,
      schools: allSchools,
      meta: {
        ...parseResults[0].meta,
        validSchools: aggregateStats.totalSchools,
        municipios: aggregateStats.totalMunicipios,
        fileName: parseResults.map(r => r.meta.fileName).join(', '),
      },
    });
  }, [parseResults, projectName, ownerName, pin, aggregateStats, onProjectReady, isReady]);

  // Helpers
  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getAvatarColor = (name) => {
    if (!name || name === 'Anónimo') return 'bg-gray-700 text-gray-400';
    const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-rose-600', 'bg-amber-500', 'bg-cyan-600'];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length] + ' text-white';
  };

  return (
    <div className="fixed inset-0 z-[50000] flex items-center justify-center bg-[#0a0f16]/95 backdrop-blur-xl animate-intel-fade-in overflow-y-auto">
      
      {/* PIN Prompt Modal */}
      {pinPromptProject && (
        <div className="absolute inset-0 z-[50001] flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl animate-intel-scale-in">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700">
                <Lock size={20} className="text-blue-400" />
              </div>
              <button onClick={() => setPinPromptProject(null)} className="text-gray-500 hover:text-white p-2">
                <X size={20} />
              </button>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Proyecto Protegido</h3>
            <p className="text-sm text-gray-400 mb-6">Ingresa el PIN para abrir "<span className="text-white">{pinPromptProject.name}</span>".</p>
            <div className="space-y-4">
              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value.replace(/[^0-9]/g, '')); setPinError(false); }}
                  onKeyDown={(e) => e.key === 'Enter' && submitPin()}
                  placeholder="PIN Numérico"
                  className={`w-full bg-gray-800 border ${pinError ? 'border-red-500' : 'border-gray-700'} text-white px-4 py-3 rounded-xl font-mono tracking-widest outline-none focus:border-blue-500 transition-colors`}
                  autoFocus
                />
                {pinError && <p className="text-xs text-red-400 mt-1">Ingresa un PIN válido</p>}
              </div>
              <button
                onClick={submitPin}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-95"
              >
                <Unlock size={16} /> Desbloquear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close button if optional */}
      {onClose && (
        <button onClick={onClose} className="absolute top-6 right-6 p-3 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
          <X size={24} />
        </button>
      )}

      <div className="w-full max-w-6xl mx-auto p-4 md:p-8 flex flex-col xl:flex-row gap-8 items-stretch animate-intel-scale-in mt-10 mb-10">
        
        {/* LEFT COLUMN: Cloud Projects */}
        <div className="flex-1 min-w-[300px] flex flex-col">
          <div className="mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20">
              <FolderOpen size={18} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Tus Proyectos</h2>
              <p className="text-xs text-gray-400 mt-0.5">Sincronizados en la nube</p>
            </div>
          </div>

          <div className="flex-1 bg-gray-900/50 rounded-3xl border border-white/5 p-2 overflow-y-auto custom-scrollbar min-h-[300px] max-h-[500px]">
            {loadingProjects ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500">
                <div className="w-8 h-8 border-2 border-gray-700 border-t-blue-500 rounded-full animate-intel-spin mb-3" />
                <p className="text-sm">Buscando proyectos...</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 p-8 text-center">
                <FolderOpen size={48} className="text-gray-700 mb-4" />
                <p className="text-base font-semibold text-gray-400">Aún no hay proyectos</p>
                <p className="text-xs mt-1">Crea el tuyo usando el panel de la derecha.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <div 
                    key={p.id} 
                    onClick={() => handleSelect(p)}
                    className="group relative bg-gray-800/30 hover:bg-gray-800 border border-white/5 hover:border-blue-500/30 rounded-2xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-500/10 active:scale-[0.98]"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-inner ${getAvatarColor(p.owner)}`}>
                          {p.owner ? p.owner.substring(0, 2).toUpperCase() : '?'}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            {p.name}
                            {p.hasPin && <Lock size={12} className="text-amber-400" />}
                          </h3>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="flex items-center gap-1 text-[10px] text-gray-400"><User size={10}/> {p.owner || 'Anónimo'}</span>
                            <span className="flex items-center gap-1 text-[10px] text-gray-400"><Calendar size={10}/> {formatDate(p.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, p.id)}
                        className={`p-2 rounded-lg transition-colors ${deletingId === p.id ? 'bg-red-500/20 text-red-400' : 'text-gray-600 hover:bg-red-500/10 hover:text-red-400 opacity-0 group-hover:opacity-100'}`}
                        title={deletingId === p.id ? "Haz clic de nuevo para borrar" : "Eliminar proyecto"}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Divider for Desktop */}
        <div className="hidden xl:block w-px bg-gradient-to-b from-transparent via-white/10 to-transparent my-10" />

        {/* RIGHT COLUMN: Create Project */}
        <div className="flex-1 min-w-[300px] flex flex-col">
          <div className="mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles size={18} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Nuevo Proyecto</h2>
              <p className="text-xs text-gray-400 mt-0.5">Sube tu base de datos y comienza</p>
            </div>
          </div>

          <div className="flex-1 bg-gray-900/50 rounded-3xl border border-white/5 p-6 flex flex-col">
            
            {/* Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1">Nombre del Proyecto</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ej: Ruta Uruapan Sur..."
                  className="w-full bg-gray-800/50 border border-white/5 text-white px-4 py-3.5 rounded-xl font-medium outline-none focus:border-emerald-500/50 focus:bg-gray-800 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider pl-1">Tu Nombre (Editor)</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full bg-gray-800/50 border border-white/5 text-white px-4 py-3.5 rounded-xl font-medium outline-none focus:border-emerald-500/50 focus:bg-gray-800 transition-colors"
                />
              </div>
            </div>

            {/* Dropzone */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex-1 min-h-[160px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center p-6 transition-all cursor-pointer mb-6 overflow-hidden ${
                dragActive ? 'border-emerald-500 bg-emerald-500/5 scale-[0.98]' : 'border-white/10 hover:border-emerald-500/30 hover:bg-white/[0.02]'
              }`}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileInput} accept=".csv, .xlsx, .xls" className="hidden" multiple />
              
              {parsing ? (
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 border-3 border-gray-700 border-t-emerald-500 rounded-full animate-intel-spin mb-4" />
                  <p className="text-sm text-emerald-400 font-medium">Procesando...</p>
                </div>
              ) : parseResults.length > 0 ? (
                <div className="w-full text-left space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1 text-center">Archivos Cargados</p>
                  {parseResults.map((r, i) => (
                    <div key={i} onClick={(e) => e.stopPropagation()} className="bg-gray-800/80 rounded-xl p-3 flex items-center justify-between border border-white/5">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet size={16} className="text-emerald-400" />
                        <div>
                          <p className="text-xs font-bold text-white truncate max-w-[150px]">{r.meta.fileName}</p>
                          <p className="text-[10px] text-gray-400">{r.meta.validSchools} escuelas</p>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveFile(i); }} className="p-3 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="text-center mt-2">
                    <span className="text-[10px] text-emerald-400 font-bold hover:underline">Toca para añadir otro archivo</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center pointer-events-none">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${dragActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                    <Upload size={24} />
                  </div>
                  <p className="text-sm font-bold text-white mb-1">Arrastra tus Excels aquí</p>
                  <p className="text-xs text-gray-500">o toca para explorar archivos (.xlsx, .csv)</p>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-intel-slide-up mb-6">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-red-300">{error}</p>
              </div>
            )}

            {/* ALWAYS ENABLED SUBMIT BUTTON */}
            <button
              onClick={handleSubmit}
              className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 ${
                shake ? 'animate-tw-shake' : ''
              } ${
                isReady
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-gray-900 shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5'
                  : 'bg-emerald-500/20 text-emerald-300/50 hover:bg-emerald-500/30'
              }`}
            >
              <Sparkles size={16} className={isReady ? 'text-gray-900' : 'text-emerald-500/50'} />
              {isReady ? `Iniciar Proyecto (${aggregateStats.totalSchools} escuelas)` : 'Comenzar Proyecto'}
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}
