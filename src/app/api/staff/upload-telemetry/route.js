import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// =====================================================
// POST /api/staff/upload-telemetry
// Receives a WebM/Opus audio blob from the Supervisor's
// PWA and uploads it to Supabase Storage.
//
// Returns the public URL for future playback.
//
// SECURITY: Uses service role key (server-side only).
// The client never has direct write access to the bucket.
// =====================================================

const BUCKET_NAME = 'staff-telemetry';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB hard limit (expected: ~480KB)

export async function POST(request) {
    try {
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceRoleKey) {
            return NextResponse.json({ ok: false, error: 'Server configuration error.' }, { status: 500 });
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceRoleKey,
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        // Parse form data
        const formData = await request.formData();
        const audioFile = formData.get('audio');
        const journeyId = formData.get('journeyId');
        const flightNumber = formData.get('flightNumber');
        const userId = formData.get('userId');
        const source = formData.get('source') || 'unknown'; // 'bitacora' | 'pilot_narration'

        if (!audioFile || !(audioFile instanceof Blob)) {
            return NextResponse.json({ ok: false, error: 'No audio file provided.' }, { status: 400 });
        }

        if (audioFile.size > MAX_FILE_SIZE) {
            return NextResponse.json({ ok: false, error: `File too large (${(audioFile.size / 1024 / 1024).toFixed(1)}MB). Max: 5MB.` }, { status: 400 });
        }

        if (!journeyId) {
            return NextResponse.json({ ok: false, error: 'Missing journeyId.' }, { status: 400 });
        }

        // Generate deterministic path — detect format from filename
        const timestamp = Date.now();
        const safeJourneyId = String(journeyId).replace(/[^a-zA-Z0-9-_]/g, '');
        const flightNum = Number(flightNumber) || 0;
        const uploadedName = audioFile.name || '';
        const isMP3 = uploadedName.endsWith('.mp3') || (audioFile.type || '').includes('mp3');
        const ext = isMP3 ? 'mp3' : 'webm';
        const contentType = isMP3 ? 'audio/mpeg' : 'audio/webm';
        const storagePath = `${safeJourneyId}/telemetry_f${flightNum}_${timestamp}.${ext}`;

        // Upload to Supabase Storage
        const arrayBuffer = await audioFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .upload(storagePath, buffer, {
                contentType,
                cacheControl: '31536000', // 1 year — audio is immutable
                upsert: false
            });

        if (uploadError) {
            // If bucket doesn't exist, try to create it
            if (/bucket.*not found/i.test(uploadError.message || '')) {
                console.warn('Bucket not found. Creating bucket:', BUCKET_NAME);
                const { error: createError } = await supabaseAdmin.storage
                    .createBucket(BUCKET_NAME, {
                        public: true,
                        fileSizeLimit: MAX_FILE_SIZE
                    });

                if (createError && !/already exists/i.test(createError.message || '')) {
                    console.error('Failed to create bucket:', createError);
                    return NextResponse.json({ ok: false, error: 'Storage setup failed.' }, { status: 500 });
                }

                // Retry upload
                const { error: retryError } = await supabaseAdmin.storage
                    .from(BUCKET_NAME)
                    .upload(storagePath, buffer, {
                        contentType: 'audio/webm',
                        cacheControl: '31536000',
                        upsert: false
                    });

                if (retryError) {
                    console.error('Upload retry failed:', retryError);
                    return NextResponse.json({ ok: false, error: retryError.message }, { status: 500 });
                }
            } else {
                console.error('Upload failed:', uploadError);
                return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
            }
        }

        // Get public URL
        const { data: publicData } = supabaseAdmin.storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);

        const publicUrl = publicData?.publicUrl || null;

        // Save telemetry reference to journey meta
        if (journeyId && publicUrl) {
            try {
                // Read current meta, merge, write
                const { data: journeyRow } = await supabaseAdmin
                    .from('staff_journeys')
                    .select('meta')
                    .eq('id', journeyId)
                    .single();

                let currentMeta = {};
                try {
                    currentMeta = typeof journeyRow?.meta === 'string'
                        ? JSON.parse(journeyRow.meta)
                        : (journeyRow?.meta || {});
                } catch { currentMeta = {}; }

                // Append to telemetry array
                const telemetryArray = Array.isArray(currentMeta.telemetry_recordings)
                    ? currentMeta.telemetry_recordings
                    : [];

                telemetryArray.push({
                    url: publicUrl,
                    flightNumber: flightNum,
                    source, // 'bitacora' | 'pilot_narration' | 'unknown'
                    durationSeconds: Number(formData.get('durationSeconds')) || 0,
                    fileSizeKB: Math.round(audioFile.size / 1024),
                    userId: userId || null,
                    timestamp: new Date().toISOString()
                });

                await supabaseAdmin
                    .from('staff_journeys')
                    .update({
                        meta: JSON.stringify({
                            ...currentMeta,
                            telemetry_recordings: telemetryArray,
                            telemetry_latest_url: publicUrl,
                            telemetry_latest_flight: flightNum
                        })
                    })
                    .eq('id', journeyId);
            } catch (metaError) {
                // Non-blocking — the URL is still returned
                console.warn('Failed to update journey meta with telemetry:', metaError);
            }
        }

        return NextResponse.json({
            ok: true,
            url: publicUrl,
            storagePath,
            fileSizeKB: Math.round(audioFile.size / 1024)
        });

    } catch (error) {
        console.error('Telemetry upload error:', error);
        return NextResponse.json({ ok: false, error: error?.message || 'Internal server error.' }, { status: 500 });
    }
}
