const fs = require('fs');

const file = 'c:/Users/jd9/Documents/NewFlyHigh/web/src/app/admin/page.js';
let content = fs.readFileSync(file, 'utf8');

// FLIGHTS Replace
const regexFlightWrapper = /className="relative overflow-hidden bg-slate-800\/50 border border-slate-700\/50 rounded-2xl p-5 hover:bg-slate-800\/70 transition-all group"/g;
content = content.replace(regexFlightWrapper, 'className="neu-list-item relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 group"');

// STAFF Replace
const regexStaffWrapper = /className="flex items-center justify-between bg-slate-800\/30 border border-slate-700\/50 p-4 rounded-xl hover:bg-slate-800\/50 transition-colors"/g;
content = content.replace(regexStaffWrapper, 'className="neu-list-item flex flex-col md:flex-row md:items-center justify-between gap-4 p-4"');

// Fix specific ugly tags in flights
content = content.replace(/text-slate-400/g, 'neu-text-sub');
content = content.replace(/text-slate-500/g, 'neu-text-sub');
content = content.replace(/text-white/g, 'neu-text');

// Flight Actions: find "flex items-center gap-2 mt-4 pt-4 border-t border-slate-700/50" and replace child buttons
const flightActionsRegex = /<div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-700\/50">[\s\S]*?<Trash2 size=\{16\} \/>\s*<\/button>\s*<\/div>/g;

const newActionsFlight = `<div className="flex justify-end mt-4 pt-4 border-t border-slate-700/10 dark:border-slate-700/50">
                                            <select 
                                                className="neu-action-select"
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if(val === 'edit') handleEditFlight(flight);
                                                    if(val === 'delete') handleDeleteFlight(flight.id);
                                                    e.target.value = '';
                                                }}
                                                defaultValue=""
                                            >
                                                <option value="" disabled>Seleccione acción</option>
                                                <option value="edit">✏️ Editar Vuelo</option>
                                                <option value="delete">🗑️ Eliminar</option>
                                            </select>
                                        </div>`;

content = content.replace(flightActionsRegex, newActionsFlight);

// Staff Actions: 
const staffActionsRegex = /<div className="flex items-center gap-2">[\s\S]*?<Trash2 size=\{18\} \/>\s*<\/button>\s*<\/div>/g;
const newActionsStaff = `<div className="flex justify-end mt-4 md:mt-0">
                                            <select 
                                                className="neu-action-select"
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if(val === 'delete') handleDeleteStaff(s.id);
                                                    e.target.value = '';
                                                }}
                                                defaultValue=""
                                            >
                                                <option value="" disabled>Seleccione acción</option>
                                                <option value="delete">🗑️ Eliminar Empleado</option>
                                            </select>
                                        </div>`;

content = content.replace(staffActionsRegex, newActionsStaff);

fs.writeFileSync(file, content);
console.log('Done Flights and Staff!');
