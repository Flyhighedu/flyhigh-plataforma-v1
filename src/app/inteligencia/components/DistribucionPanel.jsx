import { useState, useMemo, useEffect } from 'react';
import { Building2, Users, DollarSign, ChevronDown, ChevronUp, MapPin, Search, Star, Calendar, LineChart } from 'lucide-react';
import { formatNumber, formatMXN, calculateCapacity, getTurnoStyles } from '../lib/filters';

export default function DistribucionPanel({
  filteredSchools,
  prices,
  campusMap,
  turnoMap,
  capacityConfig,
  metaPorDia = 0,
  onFocusCity,
  onFocusSchoolKey,
  variant = 'panel'
}) {
  const isDrawer = variant === 'drawer';
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('escuelas'); // 'escuelas' | 'alumnos' | 'ingresos'
  const [filterSost, setFilterSost] = useState('todas'); // 'todas' | 'publicas' | 'privadas'
  const [expandedCity, setExpandedCity] = useState(null);
  const [localSortBy, setLocalSortBy] = useState({}); // { cityName: 'alumnos' | 'ingresos' }
  
  // Row hover/click state for map connection
  const [hoveredRowKey, setHoveredRowKey] = useState(null);
  const [clickedRowKey, setClickedRowKey] = useState(null);

  // Sync focused school up
  useEffect(() => {
    onFocusSchoolKey?.(hoveredRowKey || clickedRowKey);
  }, [hoveredRowKey, clickedRowKey, onFocusSchoolKey]);

  const capacity = useMemo(() => calculateCapacity(capacityConfig), [capacityConfig]);

  // Group and calculate stats
  const cityData = useMemo(() => {
    const map = new Map();

    for (const s of filteredSchools) {
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
          schoolsMap: new Map() 
        });
      }

      const entry = map.get(muni);
      const coordKey = `${s.latitud},${s.longitud}`;
      const campusGroup = campusMap?.get(coordKey);
      const isCampus = campusGroup && campusGroup.length >= 2;

      const turnoGroupAll = (!isCampus && turnoMap) ? turnoMap.get(coordKey) : null;
      const isTurno = !!turnoGroupAll && turnoGroupAll.length >= 2;

      const alu = s.alumnos || 0;
      const value = s.isPrivada ? alu * (prices.premium || 0) : alu * (prices.base || 0);

      if (s.isPrivada) entry.privStudents += alu;
      else entry.pubStudents += alu;
      
      entry.totalStudents += alu;
      entry.totalValue += value;
      
      if (s.latitud && s.longitud) {
        entry.lats.push(s.latitud);
        entry.lngs.push(s.longitud);
      }
      
      const schoolKey = isCampus ? coordKey + '_cmp' : isTurno ? coordKey + '_trn' : s.cct;
      if (!entry.schoolsMap.has(schoolKey)) {
        entry.schoolsMap.set(schoolKey, {
          schoolKey, 
          isCampus,
          isTurno,
          nombre: s.nombre || 'SIN NOMBRE',
          alumnos: 0,
          computedValue: 0,
          isPrivada: s.isPrivada,
          maxAlumnosSeen: 0,
          ccts: [],
          niveles: [],
          turnos: [],
          latitud: s.latitud,
          longitud: s.longitud,
          municipio: muni,
        });
      }
      
      const groupedSchool = entry.schoolsMap.get(schoolKey);
      
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
      if (s.turno) {
        groupedSchool.turnos.push({
          turno: s.turno,
          alumnos: alu,
          isPrivada: s.isPrivada
        });
      }
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

        const ninosPorDia = gs.isPrivada ? capacity.ninosPorDiaPriv : capacity.ninosPorDiaPub;
        let dias = 0;
        if (ninosPorDia > 0) {
          if (gs.turnos && gs.turnos.length > 0) {
            const byTurno = {};
            for (const t of gs.turnos) {
              const turnoName = t.turno || 'OTRO';
              byTurno[turnoName] = (byTurno[turnoName] || 0) + (t.alumnos || 0);
            }
            for (const t in byTurno) {
              const d = Math.ceil(byTurno[t] / ninosPorDia);
              if (d > dias) dias = d;
            }
            dias = Math.max(1, dias);
          } else {
            dias = Math.max(1, Math.ceil((gs.alumnos || 0) / ninosPorDia));
          }
        }
        gs.diasReales = dias;
        gs.ingresoPorDia = dias > 0 ? gs.computedValue / dias : 0;
      }

      const citySort = localSortBy[city.name] || 'alumnos';
      const cityDias = schoolsArray.reduce((acc, gs) => acc + (gs.diasReales || 0), 0);
      const cityIngresoPorDia = cityDias > 0 ? city.totalValue / cityDias : 0;

      return {
        ...city,
        totalSchools,
        pubSchools,
        privSchools,
        campusSchools,
        totalDias: cityDias,
        ingresoPorDia: cityIngresoPorDia,
        schools: schoolsArray.sort((a,b) => {
          if (citySort === 'alumnos') return b.alumnos - a.alumnos;
          if (citySort === 'ingresos') return b.computedValue - a.computedValue;
          if (citySort === 'ingreso_dia') return b.ingresoPorDia - a.ingresoPorDia;
          return 0;
        })
      };
    });

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (sortBy === 'escuelas') return b.totalSchools - a.totalSchools;
      if (sortBy === 'alumnos') return b.totalStudents - a.totalStudents;
      if (sortBy === 'ingresos') return b.totalValue - a.totalValue;
      return 0;
    });

    return list;
  }, [filteredSchools, filterSost, searchTerm, sortBy, campusMap, turnoMap, prices, localSortBy, capacity.ninosPorDiaPriv, capacity.ninosPorDiaPub]);

  const maxMetricValue = useMemo(() => {
    if (!cityData.length) return 1;
    if (sortBy === 'escuelas') return cityData[0].totalSchools;
    if (sortBy === 'alumnos') return cityData[0].totalStudents;
    if (sortBy === 'ingresos') return cityData[0].totalValue;
    return 1;
  }, [cityData, sortBy]);

  return (
    <div className={`flex flex-col h-full ${isDrawer ? 'bg-transparent' : 'bg-[#0B1120]'}`}>
      {/* Header Filters */}
      <div className={`shrink-0 border-b border-white/5 bg-gray-900/50 space-y-4 ${isDrawer ? 'p-3' : 'p-4'}`}>
        
        {/* Search & Type */}
        <div className="flex flex-col gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar municipio..."
              className="w-full bg-gray-950/50 border border-white/5 text-white text-xs rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
          <div className="flex bg-gray-950/50 border border-white/5 p-1 rounded-lg">
            {['todas', 'publicas', 'privadas'].map(opt => (
              <button
                key={opt}
                onClick={() => setFilterSost(opt)}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-md uppercase tracking-wider transition-colors ${
                  filterSost === opt 
                    ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Sort By */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ordenar por:</span>
          <div className="flex gap-1.5">
            {[
              { id: 'escuelas', icon: Building2, label: 'Escuelas' },
              { id: 'alumnos', icon: Users, label: 'Alumnos' },
              { id: 'ingresos', icon: DollarSign, label: 'Ingresos' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-all ${
                  sortBy === opt.id
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400'
                    : 'bg-transparent border-white/5 text-gray-500 hover:text-gray-300 hover:bg-white/5'
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
      <div className={`flex-1 overflow-y-auto custom-scrollbar ${isDrawer ? 'p-3 space-y-2' : 'p-4 space-y-2'}`}>
        {cityData.length === 0 ? (
          <div className="text-center p-8 text-gray-500 text-sm">
            No hay municipios que coincidan con los filtros.
          </div>
        ) : cityData.map((city, idx) => {
          const isExpanded = expandedCity === city.name;
          let currentMetricValue = 0;
          if (sortBy === 'escuelas') currentMetricValue = city.totalSchools;
          if (sortBy === 'alumnos') currentMetricValue = city.totalStudents;
          if (sortBy === 'ingresos') currentMetricValue = city.totalValue;
          
          const fillPercentage = Math.max(2, (currentMetricValue / maxMetricValue) * 100);

          return (
            <div key={city.name} className="border border-white/5 bg-gray-900/50 rounded-xl overflow-hidden transition-colors hover:bg-gray-800/50">
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
                <div className="relative p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-5 text-right font-mono text-[10px] font-bold ${idx < 3 ? 'text-amber-400' : 'text-gray-600'}`}>
                      #{idx + 1}
                    </div>
                    
                    <div>
                      <h3 className="text-base font-bold text-white leading-tight">{city.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
                          <Building2 size={12} className="text-blue-400" />
                          <strong className="text-gray-200">{formatNumber(city.totalSchools)}</strong>
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
                          <Users size={12} className="text-emerald-400" />
                          <strong className="text-gray-200">{formatNumber(city.totalStudents)}</strong>
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
                          <DollarSign size={12} className="text-amber-400" />
                          <strong className="text-amber-400/80">{formatMXN(city.totalValue)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button 
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onFocusCity && city.lats.length) {
                          onFocusCity(city);
                        }
                      }}
                      title="Enfocar en mapa"
                    >
                      <MapPin size={12} />
                    </button>
                    <div className="text-gray-600 group-hover:text-white transition-colors">
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-white/5 bg-gray-950/50 flex flex-col">
                  {/* Controles de ordenamiento local */}
                  <div className="p-2 border-b border-white/5 flex items-center justify-between bg-gray-900/30 shrink-0">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-2">Ordenar escuelas:</span>
                    <div className="flex gap-1 mr-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setLocalSortBy(p => ({...p, [city.name]: 'alumnos'})); }}
                        className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${
                          (localSortBy[city.name] || 'alumnos') === 'alumnos' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Alumnos
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setLocalSortBy(p => ({...p, [city.name]: 'ingresos'})); }}
                        className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${
                          (localSortBy[city.name] || 'alumnos') === 'ingresos' ? 'bg-amber-500/20 text-amber-400' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Ingresos
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setLocalSortBy(p => ({...p, [city.name]: 'ingreso_dia'})); }}
                        className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${
                          (localSortBy[city.name] || 'alumnos') === 'ingreso_dia' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Ingreso/Día
                      </button>
                    </div>
                  </div>
                  
                  <div className={`${isDrawer ? 'max-h-[260px]' : 'max-h-[550px]'} overflow-y-auto custom-scrollbar`}>
                  {city.schools.map((school) => {
                    const isHovered = hoveredRowKey === school.schoolKey;
                    const isClicked = clickedRowKey === school.schoolKey;
                    const isActive = isHovered || isClicked;

                    return (
                      <div 
                        key={school.schoolKey}
                        className={`p-3 border-b border-white/5 last:border-0 hover:bg-gray-800/80 transition-colors cursor-pointer group flex items-start gap-3 ${
                          isActive ? 'bg-blue-500/10' : ''
                        }`}
                        onMouseEnter={() => setHoveredRowKey(school.schoolKey)}
                        onMouseLeave={() => setHoveredRowKey(null)}
                        onClick={() => setClickedRowKey(prev => prev === school.schoolKey ? null : school.schoolKey)}
                      >
                        <div className="mt-0.5 shrink-0 flex items-center justify-center w-7 h-7">
                          {school.isCampus ? (
                            <Star fill="currentColor" size={16} className="text-[#A855F7] drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]" strokeWidth={1} stroke="#9333EA" />
                          ) : school.isTurno ? (
                            <div className="relative flex items-center justify-center w-4 h-4">
                              <div className="absolute w-full h-full rounded-full border-[2px] border-emerald-400/80 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
                              <div className={`w-2.5 h-2.5 rounded-full ${school.isPrivada ? 'bg-[#F59E0B]' : 'bg-[#3B82F6]'}`} />
                            </div>
                          ) : school.isPrivada ? (
                            <div className="w-3.5 h-3.5 rounded-full bg-[#F59E0B] border-[1.5px] border-[#D97706] shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full bg-[#3B82F6] border-[1.5px] border-[#2563EB] shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                          {/* 1. Header (Nombre y Etiqueta Principal) */}
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-sm font-bold leading-tight ${school.isCampus ? 'text-[#A855F7]' : school.isTurno ? 'text-emerald-400' : school.isPrivada ? 'text-amber-400/90' : 'text-blue-400/90'}`}>
                              {school.nombre}
                            </h4>
                            <span className="shrink-0 text-[9px] font-bold text-gray-500 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded">
                              {school.isCampus ? 'Campus' : school.isTurno ? 'Doble Turno' : school.ccts[0]}
                            </span>
                          </div>

                          {/* 2. Contexto (Pastillas de Turnos y Niveles) */}
                          <div className="flex flex-wrap gap-1">
                            {school.municipio && (
                              <span className="intel-municipio-chip-sm" title={school.municipio}>
                                <MapPin size={9} /> {school.municipio}
                              </span>
                            )}
                            {(() => {
                              const turnosDistintos = [...new Set(
                                (school.turnos || []).map(t => (t.turno || '').toUpperCase()).filter(Boolean)
                              )];
                              return turnosDistintos.map((t, i) => {
                                const st = getTurnoStyles(t);
                                const Icon = st.IconComponent;
                                return (
                                  <span key={i} className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded border ${st.gradientClass} ${st.textClass} ${st.borderClass} ${st.shadowClass}`} style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.2)' }}>
                                    <Icon size={10} strokeWidth={2.5} />
                                    {st.short}
                                  </span>
                                );
                              });
                            })()}
                            {school.isCampus && school.niveles.map((n, i) => (
                              <span key={i} className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-white/5 text-gray-400">
                                {n.nivel} ({n.alumnos})
                              </span>
                            ))}
                          </div>

                          {/* 3. Grid de Métricas */}
                          {(() => {
                            const dias = school.diasReales || 0;
                            const ingPorDia = school.ingresoPorDia || 0;
                            const diaColor = metaPorDia > 0
                              ? (ingPorDia >= metaPorDia ? '#34D399' : '#f87171')
                              : undefined;

                            return (
                              <div className="grid grid-cols-4 gap-2 mt-1 p-2 bg-gray-950/30 rounded-lg border border-white/5">
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-gray-500 uppercase tracking-wider">Alumnos</span>
                                  <span className="text-xs font-bold text-gray-300">{formatNumber(school.alumnos)}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-gray-500 uppercase tracking-wider">Días Op.</span>
                                  <span className="text-xs font-bold text-purple-400">{dias}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-gray-500 uppercase tracking-wider">Total</span>
                                  <span className="text-xs font-bold text-amber-400">{formatMXN(school.computedValue)}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] text-gray-500 uppercase tracking-wider">Ing/Día</span>
                                  <span 
                                    className="text-xs font-bold px-1 rounded w-fit"
                                    style={{ 
                                      color: diaColor ?? '#34D399', 
                                      background: diaColor ? `${diaColor}18` : 'rgba(52,211,153,0.1)',
                                    }}
                                  >
                                    {formatMXN(ingPorDia)}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        
                        <div className="shrink-0 flex items-center h-full text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MapPin size={14} />
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


