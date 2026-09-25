const { createClient } = require('@supabase/supabase-js');
const path = require('node:path');
const { readEnv, validateEnvironment } = require('./core.cjs');
const root = path.resolve(__dirname, '../..');
async function seedSchoolLocations(input = readEnv(path.join(root, '.env.review.local'))) {
    validateEnvironment(input, readEnv(path.join(root, '.env.local')));
    const db = createClient(input.NEXT_PUBLIC_SUPABASE_URL, input.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const must = r => { if (r.error) throw new Error(r.error.message); return r.data; };
    const projectId = '11111111-1111-4111-8111-111111110001';
    must(await db.from('intel_projects').upsert({ id: projectId, name: 'EJEMPLO FICTICIO · UBICACIONES LOCALES', school_count: 4 }, { onConflict: 'id', ignoreDuplicates: true }));
    for (let index = 1; index <= 4; index++) {
        const cct = 'TEST-LOCAL-000' + index;
        const name = ['ESCUELA FICTICIA · REVISIÓN LOCAL', 'ESCUELA FICTICIA · PREPARAR VISITA', 'ESCUELA FICTICIA · SIN UBICACIÓN', 'ESCUELA FICTICIA · NUEVA DESDE INTELIGENCIA'][index - 1];
        must(await db.from('intel_schools').upsert({ id: `11111111-1111-4111-8111-11111111000${index}`, project_id: projectId, cct,
            nombre: name, municipio: 'Punto de prueba en Uruapan · NO es una escuela real', turno: 'Matutino', latitud: 19.414 + index * .001,
            longitud: -102.052, nivel_educativo: 'PRIMARIA', alumnos: 24, sostenimiento: 'Ficticio' }, { onConflict: 'id', ignoreDuplicates: true }));
        if (index < 4) must(await db.from('catalogo_escuelas').upsert({ cct, nombre_escuela: name, turno: 'Matutino', ninos: 24 }, { onConflict: 'cct', ignoreDuplicates: true }));
    }
}
if (require.main === module) seedSchoolLocations().then(() => console.log('Cuatro fuentes ficticias preparadas; ninguna ubicación previa sobrescrita.')).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { seedSchoolLocations };
