const fs = require('fs');
let code = fs.readFileSync('src/components/staff/MissionBrief.js', 'utf8');

const oldBlock1 = `    // Estado vacío (Sin misión)
    if (!school) {
        return (
            <div className="bg-[#f8f9fb] min-h-screen flex flex-col font-display text-slate-900">
                <Header profile={profile} onLogout={() => setShowLogoutConfirm(true)} />
                <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-sm w-full">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <School className="text-slate-400" size={32} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 mb-2">Sin misión asignada</h2>
                        <p className="text-slate-500 text-sm mb-6">No tienes una escuela programada para hoy.</p>
                        <button onClick={onRefresh} className="text-blue-600 font-bold text-sm flex items-center justify-center gap-2">
                            <RefreshCw size={14} /> Actualizar
                        </button>
                    </div>
                </main>
                <StartDemoFab onDemoStarted={onRefresh} />
                <LogoutModal isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} onLogout={onLogout} />
            </div>
        );
    }`;

const oldBlock2 = `    // Estado vacío (Sin misión)\r
    if (!school) {\r
        return (\r
            <div className="bg-[#f8f9fb] min-h-screen flex flex-col font-display text-slate-900">\r
                <Header profile={profile} onLogout={() => setShowLogoutConfirm(true)} />\r
                <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">\r
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-sm w-full">\r
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">\r
                            <School className="text-slate-400" size={32} />\r
                        </div>\r
                        <h2 className="text-lg font-bold text-slate-900 mb-2">Sin misión asignada</h2>\r
                        <p className="text-slate-500 text-sm mb-6">No tienes una escuela programada para hoy.</p>\r
                        <button onClick={onRefresh} className="text-blue-600 font-bold text-sm flex items-center justify-center gap-2">\r
                            <RefreshCw size={14} /> Actualizar\r
                        </button>\r
                    </div>\r
                </main>\r
                <StartDemoFab onDemoStarted={onRefresh} />\r
                <LogoutModal isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} onLogout={onLogout} />\r
            </div>\r
        );\r
    }`;

const newBlock = `    // Estado vacío (Sin misión)
    if (!school) {
        return (
            <div className="bg-slate-50 min-h-screen flex flex-col font-display text-slate-900">
                <Header profile={profile} onLogout={() => setShowLogoutConfirm(true)} />
                <main className="flex-1 flex flex-col items-center justify-start p-6 pt-10 w-full max-w-md mx-auto">
                    <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 w-full text-center mb-8 relative overflow-hidden shrink-0">
                        {/* Decorative glow */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        
                        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5 relative z-10 text-amber-500">
                            <School size={32} />
                        </div>
                        <h2 className="text-xl font-extrabold text-slate-900 mb-2 tracking-tight">Día Libre</h2>
                        <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium">No tienes ninguna misión activa para <strong className="text-slate-700">hoy</strong>.</p>
                        
                        <button onClick={onRefresh} className="w-full py-4 bg-slate-50 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-100 transition-all flex items-center justify-center gap-2 border border-slate-200 active:scale-[0.98]">
                            <RefreshCw size={16} /> Comprobar Actualización
                        </button>
                    </div>

                    {/* Módulo Aislado de Próximas Misiones (Solo Lectura, Anónimo) */}
                    <UpcomingMissionsList />

                </main>
                <StartDemoFab onDemoStarted={onRefresh} />
                <LogoutModal isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} onLogout={onLogout} />
            </div>
        );
    }`;

if (code.includes(oldBlock1)) {
    code = code.replace(oldBlock1, newBlock);
} else if (code.includes(oldBlock2)) {
    code = code.replace(oldBlock2, newBlock);
} else {
    console.log("Error: Block not found!");
    process.exit(1);
}

if (!code.includes('function UpcomingMissionsList')) {
    code += `

function UpcomingMissionsList() {
    const [missions, setMissions] = useState(null);

    useEffect(() => {
        const fetchUpcoming = async () => {
            try {
                // Fetch misiones > hoy
                const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
                now.setHours(0,0,0,0);
                const isoToday = now.toISOString().split('T')[0];
                
                const supabase = createClient();
                const { data } = await supabase
                    .from('proximas_escuelas')
                    .select('id, fecha_programada') // NOTA: No traemos nombre_escuela por seguridad
                    .gt('fecha_programada', isoToday)
                    .eq('estatus', 'pendiente')
                    .order('fecha_programada', { ascending: true })
                    .limit(5);
                
                setMissions(data || []);
            } catch (e) {
                console.error('Error fetching upcoming missions', e);
                setMissions([]);
            }
        };
        fetchUpcoming();
    }, []);

    if (missions === null) {
        return (
            <div className="w-full flex justify-center py-8">
                <RefreshCw className="animate-spin text-slate-300" size={24} />
            </div>
        );
    }

    if (missions.length === 0) {
        return (
            <div className="w-full text-center py-8 px-4 bg-slate-100/50 rounded-[2rem] border border-slate-100/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-200/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-slate-200/20 rounded-full blur-3xl pointer-events-none"></div>
                
                <h3 className="text-slate-400 font-bold tracking-tight mb-2">Despejado</h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">No hay misiones programadas registradas en el futuro cercano.</p>
            </div>
        );
    }

    const parseLocalDate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        return new Date(year, month - 1, day);
    };

    const getDayName = (date) => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][date.getDay()];
    const getMonthName = (date) => ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][date.getMonth()];

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 pb-8">
            <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <School size={12}/> Próximas Misiones
                </h3>
                <span className="bg-slate-200 text-slate-500 text-[9px] font-bold px-2 py-1 rounded-full">{missions.length} RESERVADAS</span>
            </div>
            
            <div className="flex flex-col gap-3 w-full">
                {missions.map((m, idx) => {
                    const isNext = idx === 0; // Highlight the very next one
                    const dateObj = parseLocalDate(m.fecha_programada);
                    
                    return (
                        <div key={m.id} className={'relative bg-white rounded-3xl p-5 border shadow-[0_4px_15px_rgb(0,0,0,0.02)] flex items-center gap-4 transition-all ' + (isNext ? 'border-amber-200 shadow-amber-500/5' : 'border-slate-100 opacity-90')}>
                            
                            {/* Icon Box */}
                            <div className={'w-12 h-12 shrink-0 rounded-[14px] flex items-center justify-center shadow-inner ' + (isNext ? 'bg-amber-50/50 text-amber-500 border border-amber-100/50' : 'bg-slate-50 text-slate-300 border border-slate-100')}>
                                <div className="relative">
                                    <MapPin size={22} className={!isNext ? 'opacity-80' : ''}/>
                                    {/* Candado / Alerta indicando seguridad */}
                                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100">
                                        <AlertCircle size={10} className="text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Info Anonima */}
                            <div className="flex-1 min-w-0">
                                <h4 className={'font-bold text-[15px] truncate tracking-tight ' + (isNext ? 'text-slate-800' : 'text-slate-600')}>
                                    Misión Reservada
                                </h4>
                                <p className="text-slate-400 text-xs mt-0.5 font-medium flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> 
                                    Ubicación protegida
                                </p>
                            </div>

                            {/* Neumorphic Date Badge */}
                            <div className={'shrink-0 flex flex-col items-center justify-center min-w-[3.5rem] py-2 px-2 rounded-[14px] border shadow-sm ' + (isNext ? 'bg-amber-50/30 border-amber-100 text-amber-600' : 'bg-slate-50 border-slate-100 text-slate-400')}>
                                <span className="text-[9px] font-bold uppercase tracking-widest">{getMonthName(dateObj)}</span>
                                <span className="leading-none text-[22px] font-black my-1">{dateObj.getDate()}</span>
                                <span className="text-[9px] font-bold uppercase tracking-widest">{getDayName(dateObj)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
`;
}
fs.writeFileSync('src/components/staff/MissionBrief.js', code, 'utf8');
console.log('Success');
