const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCatalog() {
    const { data: schools } = await supabase.from('proximas_escuelas').select('id, nombre_escuela, cct, turno').limit(5);
    console.log("Proximas Escuelas:", schools);

    const ccts = schools.map(s => s.cct).filter(Boolean);
    if (ccts.length > 0) {
        const { data: cat } = await supabase.from('catalogo_escuelas').select('cct, nombre_escuela, turno').in('cct', ccts);
        console.log("\nCatálogo Escuelas matches:", cat);
    }
}

checkCatalog();
