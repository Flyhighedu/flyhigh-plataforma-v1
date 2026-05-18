import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Service-role client for admin operations (bypasses RLS)
function getServiceClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

// Validate admin cookie
async function isAdmin(req) {
    const cookieStore = await cookies();
    return cookieStore.has('flyhigh_admin_auth');
}

const ALLOWED_MIMES = new Set(['audio/mpeg', 'audio/mp4', 'audio/x-m4a']);
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

export async function POST(request) {
    try {
        if (!(await isAdmin(request))) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file');
        const title = formData.get('title')?.trim();
        const artist = formData.get('artist')?.trim() || null;
        const trackType = formData.get('track_type')?.trim();

        // ── Validations ──
        if (!file || !title || !trackType) {
            return NextResponse.json({ error: 'Faltan campos requeridos: file, title, track_type' }, { status: 400 });
        }

        if (!['boarding', 'in_flight'].includes(trackType)) {
            return NextResponse.json({ error: 'track_type inválido. Debe ser "boarding" o "in_flight"' }, { status: 400 });
        }

        const mimeType = file.type;
        if (!ALLOWED_MIMES.has(mimeType)) {
            return NextResponse.json({ 
                error: `Formato no soportado: ${mimeType}. Solo se permiten .mp3 y .m4a (audio ultra-comprimido).`,
                hint: 'Los formatos .wav y .flac son demasiado pesados para transmisión móvil. Convierte tu archivo a .mp3 antes de subirlo.'
            }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 15MB` }, { status: 400 });
        }

        // ── Upload to Supabase Storage ──
        const supabase = getServiceClient();
        const ext = mimeType === 'audio/mpeg' ? 'mp3' : 'm4a';
        const fileId = crypto.randomUUID();
        const storagePath = `${trackType}/${fileId}.${ext}`;

        const buffer = Buffer.from(await file.arrayBuffer());

        const { error: uploadError } = await supabase.storage
            .from('official_soundtracks')
            .upload(storagePath, buffer, {
                contentType: mimeType,
                upsert: false
            });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return NextResponse.json({ error: 'Error al subir archivo: ' + uploadError.message }, { status: 500 });
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('official_soundtracks')
            .getPublicUrl(storagePath);

        const publicUrl = urlData?.publicUrl;
        if (!publicUrl) {
            return NextResponse.json({ error: 'No se pudo obtener la URL pública del archivo' }, { status: 500 });
        }

        // ── Get next sort_order for this track_type ──
        const { data: maxOrder } = await supabase
            .from('official_soundtracks')
            .select('sort_order')
            .eq('track_type', trackType)
            .order('sort_order', { ascending: false })
            .limit(1)
            .single();

        const nextSortOrder = (maxOrder?.sort_order ?? -1) + 1;

        // ── Insert into DB ──
        const { data: inserted, error: insertError } = await supabase
            .from('official_soundtracks')
            .insert({
                title,
                artist,
                track_type: trackType,
                storage_path: storagePath,
                public_url: publicUrl,
                file_size_bytes: file.size,
                mime_type: mimeType,
                sort_order: nextSortOrder
            })
            .select()
            .single();

        if (insertError) {
            console.error('DB insert error:', insertError);
            // Cleanup: remove uploaded file
            await supabase.storage.from('official_soundtracks').remove([storagePath]);
            return NextResponse.json({ error: 'Error al guardar metadatos: ' + insertError.message }, { status: 500 });
        }

        return NextResponse.json({ ok: true, soundtrack: inserted });
    } catch (err) {
        console.error('Upload soundtrack error:', err);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
