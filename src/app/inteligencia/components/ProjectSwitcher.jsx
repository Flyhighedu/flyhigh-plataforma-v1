'use client';

import { useState, useEffect, useMemo } from 'react';
import { FolderOpen, Plus, Trash2, Clock, FileSpreadsheet, Route, X, Edit3, Check, Search, Lock, Unlock, User, Users } from 'lucide-react';
import { listProjects, deleteProject, renameProject } from '../lib/storage';

export default function ProjectSwitcher({ onSelectProject, onNewProject, onClose }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // PIN prompt state
  const [pinPromptProject, setPinPromptProject] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    const list = await listProjects();
    setProjects(list);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (deletingId === id) {
      await deleteProject(id);
      setDeletingId(null);
      loadProjects();
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId(prev => prev === id ? null : prev), 3000);
    }
  };

  const handleRename = async (id) => {
    if (editName.trim()) {
      await renameProject(id, editName.trim());
      setEditingId(null);
      loadProjects();
    }
  };

  const handleSelect = (project) => {
    if (project.hasPin) {
      setPinPromptProject(project);
      setPinInput('');
      setPinError(false);
    } else {
      onSelectProject(project.id, false); // Not read-only
    }
  };

  const submitPin = () => {
    if (pinInput.trim() === '') {
      setPinError(true);
      return;
    }
    // We pass the PIN to page.jsx, which will verify it upon loading the project
    onSelectProject(pinPromptProject.id, false, pinInput.trim());
  };

  const enterReadOnly = () => {
    onSelectProject(pinPromptProject.id, true); // true = ReadOnly
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const getInitials = (name) => {
    if (!name || name === 'Anónimo') return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name) => {
    if (!name || name === 'Anónimo') return 'bg-gray-700 text-gray-400';
    const colors = [
      'bg-blue-600 text-white', 'bg-emerald-600 text-white', 
      'bg-purple-600 text-white', 'bg-rose-600 text-white', 
      'bg-amber-500 text-white', 'bg-cyan-600 text-white'
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.owner && p.owner.toLowerCase().includes(q))
    );
  }, [projects, searchQuery]);

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-intel-fade-in" onClick={onClose}>
      
      {/* PIN Prompt Modal (Renders OVER the switcher if active) */}
      {pinPromptProject && (
        <div className="absolute inset-0 z-[3001] flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl animate-intel-scale-in">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700">
                <Lock size={20} className="text-blue-400" />
              </div>
              <button onClick={() => setPinPromptProject(null)} className="text-gray-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <h3 className="text-lg font-bold text-white mb-1">Proyecto Protegido</h3>
            <p className="text-sm text-gray-400 mb-6">
              Ingresa el PIN para editar "<span className="text-white">{pinPromptProject.name}</span>".
            </p>

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

              <div className="flex gap-3">
                <button
                  onClick={submitPin}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Unlock size={16} />
                  Desbloquear
                </button>
              </div>

              <div className="relative py-3 flex items-center">
                <div className="flex-grow border-t border-gray-800"></div>
                <span className="flex-shrink-0 mx-4 text-gray-500 text-xs uppercase tracking-wider font-semibold">O</span>
                <div className="flex-grow border-t border-gray-800"></div>
              </div>

              <button
                onClick={enterReadOnly}
                className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Users size={16} />
                Entrar en Modo Lectura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Switcher */}
      <div
        className="w-full max-w-3xl mx-4 bg-[#0F172A] rounded-[24px] border border-gray-800 shadow-2xl flex flex-col max-h-[85vh] animate-intel-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-800 flex items-center gap-4">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FolderOpen size={20} className="text-blue-500" />
              Comunidad y Proyectos
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Explora proyectos propios y de otros usuarios
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900/50">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por proyecto o editor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white pl-11 pr-4 py-2.5 rounded-xl text-sm outline-none focus:border-blue-500 focus:bg-gray-800 transition-all placeholder:text-gray-500"
            />
          </div>
          <button
            onClick={onNewProject}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
          >
            <Plus size={16} />
            Crear Nuevo
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0B1120]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-gray-800 border-t-blue-500 rounded-full animate-intel-spin" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-gray-500" />
              </div>
              <p className="text-base font-bold text-gray-300">No se encontraron proyectos</p>
              <p className="text-sm text-gray-500 mt-1">Intenta con otros términos de búsqueda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProjects.map(project => (
                <div
                  key={project.id}
                  className="bg-gray-800/80 border border-gray-700 hover:border-blue-500/50 rounded-2xl p-5 cursor-pointer transition-all group hover:shadow-lg hover:shadow-blue-500/5 flex flex-col justify-between"
                  onClick={() => handleSelect(project)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner ${getAvatarColor(project.owner)}`}>
                        {getInitials(project.owner)}
                      </div>
                      <div>
                        {editingId === project.id ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRename(project.id)}
                              className="bg-gray-900 border border-gray-700 text-white px-2 py-1 text-sm rounded outline-none focus:border-blue-500"
                              autoFocus
                            />
                            <button onClick={() => handleRename(project.id)} className="text-emerald-400 hover:text-emerald-300"><Check size={16} /></button>
                            <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-white"><X size={16} /></button>
                          </div>
                        ) : (
                          <h3 className="text-white font-bold text-base line-clamp-1 pr-4">{project.name}</h3>
                        )}
                        <p className="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                          <User size={10} />
                          {project.owner || 'Anónimo'}
                        </p>
                      </div>
                    </div>
                    {project.hasPin && (
                      <div className="bg-gray-900 border border-gray-700 p-1.5 rounded-full text-blue-400" title="Protegido con PIN">
                        <Lock size={12} />
                      </div>
                    )}
                  </div>

                  {/* Stats Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="bg-gray-900 text-gray-300 text-[10px] font-bold px-2.5 py-1 rounded-md border border-gray-800 flex items-center gap-1.5">
                      <FileSpreadsheet size={10} className="text-blue-400"/> {project.schoolCount} Escuelas
                    </span>
                    {project.stats?.totalAlumnos > 0 && (
                      <span className="bg-gray-900 text-gray-300 text-[10px] font-bold px-2.5 py-1 rounded-md border border-gray-800">
                        {project.stats.totalAlumnos.toLocaleString()} Alumnos
                      </span>
                    )}
                    {project.stats?.niveles && project.stats.niveles.map(nivel => (
                      <span key={nivel} className="bg-gray-900 text-gray-400 text-[10px] font-semibold px-2 py-1 rounded-md border border-gray-800 uppercase">
                        {nivel}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-700/50">
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={12} />
                      {formatDate(project.updatedAt)}
                    </span>
                    
                    {/* Actions (Only show if we own it? For now show, but anyone can delete if no RLS) */}
                    {/* The prompt says "que puedan ver todo pero no editar" for pin-protected projects. So let's hide Delete/Rename if it has a PIN. */}
                    {!project.hasPin && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setEditingId(project.id); setEditName(project.name); }}
                          className="w-7 h-7 rounded-md bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                          title="Renombrar"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                            deletingId === project.id ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                          }`}
                          title={deletingId === project.id ? 'Confirmar eliminación' : 'Eliminar'}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
