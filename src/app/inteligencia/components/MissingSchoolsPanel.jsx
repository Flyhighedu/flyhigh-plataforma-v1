import { useState, useMemo } from 'react';
import { X, Search, School, Users, MapPin, Building, GraduationCap, MapPinOff, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { formatNumber } from '../lib/filters';

export default function MissingSchoolsPanel({ schools, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc' | null
  const [filterSost, setFilterSost] = useState('todas'); // 'todas' | 'publicas' | 'privadas'
  
  // Slider states (similar to CommandPanel)
  // We'll calculate min and max from the dataset
  const { minStudents, maxStudents } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    schools.forEach(s => {
      const alu = s.alumnos || 0;
      if (alu < min) min = alu;
      if (alu > max) max = alu;
    });
    if (min === Infinity) return { minStudents: 0, maxStudents: 1000 };
    return { minStudents: min, maxStudents: max };
  }, [schools]);

  const [studentRange, setStudentRange] = useState({ min: 0, max: 10000 });
  const [sliderMax, setSliderMax] = useState(10000);

  // Initialize slider when schools load
  useMemo(() => {
    setStudentRange({ min: minStudents, max: maxStudents });
    setSliderMax(maxStudents);
  }, [minStudents, maxStudents]);

  // Apply filters and sorting
  const filteredSchools = useMemo(() => {
    let res = schools;

    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      res = res.filter(s => 
        (s.nombre && s.nombre.toLowerCase().includes(q)) ||
        (s.cct && s.cct.toLowerCase().includes(q)) ||
        (s.municipio && s.municipio.toLowerCase().includes(q)) ||
        (s.domicilio && s.domicilio.toLowerCase().includes(q))
      );
    }

    // Sostenimiento filter
    if (filterSost !== 'todas') {
      if (filterSost === 'privadas') {
        res = res.filter(s => s.isPrivada);
      } else {
        res = res.filter(s => !s.isPrivada);
      }
    }

    // Slider filter
    res = res.filter(s => {
      const alu = s.alumnos || 0;
      return alu >= studentRange.min && alu <= studentRange.max;
    });

    // Sorting by students
    if (sortOrder) {
      res = res.slice().sort((a, b) => {
        const aluA = a.alumnos || 0;
        const aluB = b.alumnos || 0;
        return sortOrder === 'desc' ? aluB - aluA : aluA - aluB;
      });
    }

    return res;
  }, [schools, searchTerm, filterSost, studentRange, sortOrder]);

  const toggleSort = () => {
    setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 z-[3000] backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div className="fixed inset-y-0 right-0 w-[600px] max-w-[100vw] bg-gray-900 border-l border-white/5 z-[3001] flex flex-col shadow-2xl transition-transform duration-300 translate-x-0">
        
        {/* Header */}
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-gray-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/10 border border-amber-500/20">
              <MapPinOff size={18} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Escuelas sin Ubicación
              </h2>
              <p className="text-[11px] text-gray-400">
                {formatNumber(schools.length)} registros que no tienen coordenadas GPS válidas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </header>

        {/* Filters Section */}
        <div className="shrink-0 p-5 border-b border-white/5 bg-gray-900/30 space-y-4">
          
          <div className="flex gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, CCT o municipio..."
                className="w-full bg-gray-950 border border-gray-800 text-white text-xs rounded-lg pl-9 pr-4 py-2 outline-none focus:border-amber-500/50 transition-colors"
              />
            </div>

            {/* Sostenimiento */}
            <div className="flex bg-gray-950 border border-gray-800 p-1 rounded-lg">
              {['todas', 'publicas', 'privadas'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setFilterSost(opt)}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider transition-colors ${
                    filterSost === opt 
                      ? 'bg-amber-500/20 text-amber-500' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Slider */}
          <div className="bg-gray-950 border border-gray-800 p-3 rounded-lg flex items-center gap-4">
            <div className="shrink-0 text-[10px] font-bold text-gray-400 flex items-center gap-1.5 uppercase tracking-wider">
              <Users size={12} className="text-amber-500/70" /> Matrícula
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={studentRange.min}
                onChange={(e) => setStudentRange(p => ({ ...p, min: Number(e.target.value) }))}
                className="w-16 bg-transparent border border-gray-800 text-white text-xs px-2 py-1 rounded text-center outline-none focus:border-amber-500"
              />
            </div>
            
            <input
              type="range"
              min={minStudents}
              max={sliderMax}
              value={studentRange.max}
              onChange={(e) => setStudentRange(p => ({ ...p, max: Number(e.target.value) }))}
              className="flex-1 accent-amber-500 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
            />
            
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={studentRange.max}
                onChange={(e) => setStudentRange(p => ({ ...p, max: Number(e.target.value) }))}
                className="w-16 bg-transparent border border-gray-800 text-white text-xs px-2 py-1 rounded text-center outline-none focus:border-amber-500"
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Mostrando <strong className="text-white">{formatNumber(filteredSchools.length)}</strong> escuelas
            </span>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto bg-gray-950 p-5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="pb-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Escuela</th>
                <th className="pb-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 whitespace-nowrap cursor-pointer hover:text-white transition-colors" onClick={toggleSort}>
                  <div className="flex items-center gap-1">
                    Alumnos
                    {sortOrder === 'desc' ? <ArrowDown size={10} className="text-amber-500" /> : <ArrowUp size={10} className="text-amber-500" />}
                  </div>
                </th>
                <th className="pb-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 whitespace-nowrap">Municipio</th>
                <th className="pb-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider px-4 whitespace-nowrap">Nivel & Turno</th>
                <th className="pb-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap text-right">CCT</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchools.map((s, idx) => (
                <tr key={`${s.cct}-${idx}`} className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors group">
                  <td className="py-3 pr-4">
                    <div className="font-bold text-xs text-gray-200 group-hover:text-white transition-colors">
                      {s.nombre || 'SIN NOMBRE'}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1" title={s.domicilio}>
                      {s.domicilio || 'Sin domicilio registrado'}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5 bg-gray-900 w-fit px-2 py-0.5 rounded border border-gray-800">
                      <Users size={10} className="text-gray-500" />
                      <span className="text-xs font-bold text-gray-300">
                        {formatNumber(s.alumnos || 0)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-xs text-gray-400 flex items-center gap-1.5">
                      <MapPin size={10} className="text-gray-500" />
                      {s.municipio || 'N/A'}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded w-fit border border-blue-500/20 uppercase">
                        {s.nivelEducativo || 'N/A'}
                      </span>
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <ClockIcon turno={s.turno} />
                        {s.turno || 'Sin Turno'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pl-4 text-right">
                    <code className="text-[10px] text-gray-400 bg-gray-900 px-1.5 py-0.5 rounded">
                      {s.cct}
                    </code>
                    {s.isPrivada && (
                      <div className="text-[9px] text-amber-500/70 font-bold uppercase mt-1">Privada</div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredSchools.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-sm text-gray-500">
                    No se encontraron escuelas con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ClockIcon({ turno }) {
  const t = (turno || '').toUpperCase();
  if (t === 'MATUTINO') return <span>☀️</span>;
  if (t === 'VESPERTINO') return <span>🌙</span>;
  if (t === 'NOCTURNO') return <span>🌑</span>;
  return <span>🕐</span>;
}
