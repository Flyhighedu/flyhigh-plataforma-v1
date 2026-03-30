const fs = require('fs');

const file = 'c:/Users/jd9/Documents/NewFlyHigh/web/src/app/admin/page.js';
let content = fs.readFileSync(file, 'utf8');

// The sponsor wrapper matches exactly these words regardless of spaces
const regexSponsorWrapper = /className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-800\/30 border border-slate-700\/50 rounded-xl hover:bg-slate-800\/50 transition-colors"/g;
content = content.replace(regexSponsorWrapper, 'className="neu-list-item"');

// Replace the sub-text colors
content = content.replace(/text-xs text-slate-500 uppercase tracking-wider mb-1/g, 'text-[10px] neu-text-sub uppercase tracking-wider mb-0.5 font-bold');

// Replace the edit/delete/test actions into a select! 
// Let's find index of "flex flex-row md:flex-col gap-2 justify-end mt-4 md:mt-0"
// and replace it until the end of the map.
// To do this safely, we will replace the block explicitly
const actionsRegex = /<div className="flex flex-row md:flex-col gap-2 justify-end mt-4 md:mt-0">[\s\S]*?<Trash2 size=\{18\} \/>\s*<\/button>\s*<\/div>/g;

const newActionsHTML = `<div className="flex justify-end mt-4 md:mt-0">
                                            <select 
                                                className="neu-action-select"
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if(val === 'test') { window.open(\`/dashboard?action=test_login&email=\${encodeURIComponent(sponsor.email)}&password=\${encodeURIComponent(sponsor.password)}\`, '_blank'); }
                                                    if(val === 'edit') handleEditSponsor(sponsor);
                                                    if(val === 'delete') handleDeleteSponsor(sponsor.id);
                                                    e.target.value = '';
                                                }}
                                                defaultValue=""
                                            >
                                                <option value="" disabled>Seleccione acción</option>
                                                <option value="test">👁️ Probar Login</option>
                                                <option value="edit">✏️ Editar Datos</option>
                                                <option value="delete">🗑️ Eliminar</option>
                                            </select>
                                        </div>`;

content = content.replace(actionsRegex, newActionsHTML);

fs.writeFileSync(file, content);
console.log('Done!');
