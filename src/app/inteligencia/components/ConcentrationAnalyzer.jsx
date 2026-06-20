import { useState, useMemo, useEffect } from 'react';
import { X, Building2, Users, DollarSign, ChevronDown, ChevronUp, MapPin, Search } from 'lucide-react';
import { formatNumber, formatMXN } from '../lib/filters';

export default function ConcentrationAnalyzer({ 
  filteredSchools, 
  prices, 
  campusMap, 
  onClose,
  onFocusCity,
  onFocusSchoolKey // Callback to highlight school on map
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('escuelas'); // 'escuelas' | 'alumnos' | 'ingresos'
  const [filterSost, setFilterSost] = useState('todas'); // 'todas' | 'publicas' | 'privadas'
  const [expandedCity, setExpandedCity] = useState(null);
  
  // Row hover/click state for map connection
  const [hoveredRowKey, setHoveredRowKey] = useState(null);
  const [clickedRowKey, setClickedRowKey] = useState(null);

  // Sync focused school up
  useEffect(() => {
    onFocusSchoolKey?.(hoveredRowKey || clickedRowKey);
  }, [hoveredRowKey, clickedRowKey, onFocusSchoolKey]);

  // Group and calculate stats
  const cityData = useMemo(() => {
    const map = new Map();

    for (const s of filteredSchools) {
      // Basic filtering inside the analyzer
      if (filterSost === 'privadas' && !s.isPrivada) continue;
      if (filterSost === 'publicas' && s.isPrivada) continue;

      const muni = (s.municipio || 'SIN MUNICIPIO').toUpperCase();
      if (!map.has(muni)) {
        map.set(muni, {
          name: muni,
          totalSchools: 0,
          pubSchools: 0,
          privSchools: 0,
          campusSchools: 0,
          totalStudents: 0,
          pubStudents: 0,
          privStudents: 0,
          totalValue: 0,
          lats: [],
          lngs: [],
          schoolsMap: new Map() // Used to group schools before array conversion
        });
      }

      const entry = map.get(muni);
      
      const coordKey = `${s.latitud},${s.longitud}`;
      const campusGroup = campusMap?.get(coordKey);
      const isCampus = campusGroup && campusGroup.length >= 2;

      const alu = s.alumnos || 0;
      const value = s.isPrivada ? alu * (prices.premium || 0) : alu * (prices.base || 0);

      if (s.isPrivada) {
        entry.privStudents += alu;
      } else {
        entry.pubStudents += alu;
      }
      
      entry.totalStudents += alu;
      entry.totalValue += value;
      
      if (s.latitud && s.longitud) {
        entry.lats.push(s.latitud);
        entry.lngs.push(s.longitud);
      }
      
      const schoolKey = isCampus ? coordKey + '_cmp' : s.cct;
      if (!entry.schoolsMap.has(schoolKey)) {
        entry.schoolsMap.set(schoolKey, {
          schoolKey, // Store it for hover tracking
          isCampus,
          nombre: s.nombre || 'SIN NOMBRE',
          alumnos: 0,
          computedValue: 0,
          isPrivada: s.isPrivada,
          maxAlumnosSeen: 0,
          ccts: [],
          niveles: [],
          latitud: s.latitud,
          longitud: s.longitud,
        });
      }
      
      const groupedSchool = entry.schoolsMap.get(schoolKey);
      
      // Inherit name and private status from the largest sub-school in the campus
      if (alu > groupedSchool.maxAlumnosSeen) {
        groupedSchool.nombre = s.nombre || groupedSchool.nombre;
        groupedSchool.isPrivada = s.isPrivada;
        groupedSchool.maxAlumnosSeen = alu;
      }
      
      groupedSchool.alumnos += alu;
      groupedSchool.computedValue += value;
      groupedSchool.ccts.push(s.cct);
      groupedSchool.niveles.push({
        nivel: s.nivelEducativo || 'N/A',
        alumnos: alu,
        isPrivada: s.isPrivada
      });
    }

    let list = Array.from(map.values()).map(city => {
      const schoolsArray = Array.from(city.schoolsMap.values());
      
      let totalSchools = schoolsArray.length;
      let pubSchools = 0;
      let privSchools = 0;
      let campusSchools = 0;
      
      for (const gs of schoolsArray) {
        if (gs.isPrivada) privSchools++;
        else pubSchools++;
        if (gs.isCampus) campusSchools++;
      }

      return {
        ...city,
        totalSchools,
        pubSchools,
        privSchools,
        campusSchools,
        schools: schoolsArray
      };
    });

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'escuelas') return b.totalSchools - a.totalSchools;
      if (sortBy === 'alumnos') return b.totalStudents - a.totalStudents;
      if (sortBy === 'ingresos') return b.totalValue - a.totalValue;
      return 0;
    });

    return list;
  }, [filteredSchools, filterSost, searchTerm, sortBy, campusMap, prices]);

  const maxMetricValue = useMemo(() => {
    if (!cityData.length) return 1;
    if (sortBy === 'escuelas') return cityData[0].totalSchools;
    if (sortBy === 'alumnos') return cityData[0].totalStudents;
    if (sortBy === 'ingresos') return cityData[0].totalValue;
    return 1;
  }, [cityData, sortBy]);

  return (
    <>
      {/* Main Panel */}
      <div className="fixed inset-y-0 right-0 w-[650px] max-w-[100vw] bg-gray-900 border-l border-white/5 z-[3001] flex flex-col shadow-2xl transition-transform duration-300 translate-x-0 pointer-events-auto">
        
        {/* Header */}
        <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded flex items-center justify-center bg-blue-500/10 border border-blue-500/20">
              <MapPin size={18} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Distribución por Municipio
              </h2>
              <p className="text-[11px] text-gray-400">
                Distribución en base a {formatNumber(filteredSchools.length)} escuelas filtradas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </header>

        {/* Controls */}
        <div className="shrink-0 p-5 border-b border-white/5 bg-gray-900 space-y-4">
          <div className="flex gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar municipio..."
                className="w-full bg-gray-950 border border-gray-800 text-white text-xs rounded pl-9 pr-4 py-2 outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>

            {/* Sostenimiento */}
            <div className="flex bg-gray-950 border border-gray-800 p-1 rounded">
              {['todas', 'publicas', 'privadas'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setFilterSost(opt)}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded uppercase tracking-wider transition-colors ${
                    filterSost === opt 
                      ? 'bg-blue-500 text-white' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ordenar por:</span>
            <div className="flex gap-2">
              {[
                { id: 'escuelas', icon: Building2, label: 'Escuelas' },
                { id: 'alumnos', icon: Users, label: 'Alumnos' },
                { id: 'ingresos', icon: DollarSign, label: 'Ingresos' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                    sortBy === opt.id
                      ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                      : 'bg-gray-950 border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'
                  }`}
                >
                  <opt.icon size={12} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#0B1120] space-y-2">
          {cityData.map((city, idx) => {
            const isExpanded = expandedCity === city.name;
            let currentMetricValue = 0;
            if (sortBy === 'escuelas') currentMetricValue = city.totalSchools;
            if (sortBy === 'alumnos') currentMetricValue = city.totalStudents;
            if (sortBy === 'ingresos') currentMetricValue = city.totalValue;
            
            const fillPercentage = Math.max(2, (currentMetricValue / maxMetricValue) * 100);

            return (
              <div key={city.name} className="border border-white/5 bg-gray-900 rounded overflow-hidden">
                {/* Bar Header (Clickable) */}
                <div 
                  className="relative cursor-pointer group select-none"
                  onClick={() => setExpandedCity(isExpanded ? null : city.name)}
                >
                  {/* Fill Background */}
                  <div 
                    className="absolute inset-y-0 left-0 bg-blue-500/10 transition-all duration-500 ease-out"
                    style={{ width: `${fillPercentage}%` }}
                  />
                  
                  {/* Content */}
                  <div className="relative p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Rank Number */}
                      <div className={`w-6 text-right font-mono text-xs font-bold ${idx < 3 ? 'text-amber-400' : 'text-gray-600'}`}>
                        #{idx + 1}
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-bold text-white">{city.name}</h3>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400">
                            <span className="flex items-center gap-1">
                              <Building2 size={10} className="text-blue-400" />
                              <strong className="text-gray-200">{formatNumber(city.totalSchools)}</strong>
                              <span className="text-gray-500">({city.pubSchools} Púb / {city.privSchools} Priv)</span>
                            </span>
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
                            <Users size={10} className="text-emerald-400" />
                            <strong className="text-gray-200">{formatNumber(city.totalStudents)}</strong>
                          </span>
                          <span className="flex items-center gap-1 text-[10px] font-medium text-gray-400">
                            <DollarSign size={10} className="text-amber-400" />
                            <strong className="text-amber-400/80">{formatMXN(city.totalValue)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                        className="w-7 h-7 rounded flex items-center justify-center bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onFocusCity && city.lats.length) {
                            onFocusCity(city);
                          }
                        }}
                        title="Enfocar en mapa"
                      >
                        <MapPin size={14} />
                      </button>
                      <div className="text-gray-600 group-hover:text-white transition-colors">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Content: High Density Table */}
                {isExpanded && (
                  <div className="border-t border-white/5 bg-gray-950 p-4">
                    <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      <table className="w-full text-left">
                        <thead>
                          <tr>
                            <th className="pb-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider">Escuela</th>
                            <th className="pb-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider text-right">Alumnos</th>
                            <th className="pb-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider text-right">Valor Est.</th>
                            <th className="pb-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider text-right">CCT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                          {city.schools
                            .sort((a, b) => (b.alumnos || 0) - (a.alumnos || 0))
                            .map((s, sIdx) => (
                            <tr 
                              key={sIdx} 
                              className={`transition-colors cursor-pointer ${clickedRowKey === s.schoolKey ? 'bg-blue-500/10' : 'hover:bg-white/[0.05]'}`}
                              onMouseEnter={() => setHoveredRowKey(s.schoolKey)}
                              onMouseLeave={() => setHoveredRowKey(null)}
                              onClick={() => setClickedRowKey(prev => prev === s.schoolKey ? null : s.schoolKey)}
                            >
                              <td className="py-2 pr-2">
                                <div className="flex items-center gap-2">
                                  {s.isCampus && (
                                    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border text-purple-400 border-purple-500/30 bg-purple-500/10">
                                      Campus
                                    </span>
                                  )}
                                  <div className="text-[11px] font-bold text-gray-300">{s.nombre}</div>
                                </div>
                                {s.isCampus ? (
                                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                    {s.niveles.map((n, i) => (
                                      <span key={i} className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${n.isPrivada ? 'text-amber-500 border-amber-500/30 bg-amber-500/5' : 'text-blue-400 border-blue-400/30 bg-blue-400/5'}`}>
                                        {n.nivel} <span className="opacity-70 ml-1">({formatNumber(n.alumnos)})</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="mt-0.5">
                                    <span className="text-[9px] text-gray-500 uppercase">{s.niveles[0]?.nivel}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right">
                                <span className="text-[11px] font-bold text-gray-300">{formatNumber(s.alumnos || 0)}</span>
                              </td>
                              <td className="py-2 px-2 text-right">
                                <span className={`text-[11px] font-bold ${s.isPrivada ? 'text-amber-400/80' : 'text-blue-400/80'}`}>
                                  {formatMXN(s.computedValue)}
                                </span>
                              </td>
                              <td className="py-2 pl-2 text-right">
                                {s.isCampus ? (
                                  <span className="text-[9px] text-gray-500 font-medium">Múltiples CCTs</span>
                                ) : (
                                  <code className="text-[9px] text-gray-500 font-mono">{s.ccts[0]}</code>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {cityData.length === 0 && (
            <div className="text-center py-12">
              <Building2 size={32} className="mx-auto text-gray-700 mb-3" />
              <h3 className="text-sm font-bold text-gray-400">Sin Resultados</h3>
              <p className="text-xs text-gray-600 mt-1">No hay ciudades que coincidan con estos filtros.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
