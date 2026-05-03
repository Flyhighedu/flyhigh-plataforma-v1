import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// POI Approve — Guarda descripción oficial curada por el admin
// ═══════════════════════════════════════════════════════════════

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function makeCacheKey(name, context) {
    const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const ctx = (context || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return `${norm}|${ctx}`;
}

export async function POST(request) {
    try {
        const { name, description, context, lat, lon } = await request.json();
        
        if (!name || !description) {
            return NextResponse.json({ error: 'name and description required' }, { status: 400 });
        }

        const key = makeCacheKey(name, context);

        // Guardar/actualizar en caché con status 'approved'
        const { error } = await supabase
            .from('poi_info_cache')
            .upsert({
                poi_key: key,
                poi_name: name,
                lat: lat || null,
                lon: lon || null,
                description: description,
                city_context: context || null,
                status: 'approved'
            }, { onConflict: 'poi_key' });

        if (error) {
            console.error('POI approve error:', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`✅ POI aprobado: "${name}" → ${description.length} chars`);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('POI approve error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
