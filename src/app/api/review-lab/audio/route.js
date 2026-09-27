import { createClient } from '@/utils/supabase/server';
import { isLocal3dReview } from '@/lib/google-3d-proxy.mjs';
import { localReviewAudioPath } from '@/lib/review-audio.mjs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
    if (!isLocal3dReview(process.env)) return new Response(null, { status: 404 });
    if (request.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, { status: 403 });
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return new Response(null, { status: 401 });
    const path = localReviewAudioPath(new URL(request.url).searchParams.get('url'));
    if (!path) return new Response(null, { status: 400 });
    const headers = new Headers();
    const range = request.headers.get('range');
    if (range && /^bytes=\d*-\d*$/.test(range)) headers.set('Range', range);
    try {
        const upstream = await fetch(`http://127.0.0.1:54321${path}`, { headers, signal: request.signal, redirect: 'error', cache: 'no-store' });
        if (!upstream.ok) { await upstream.body?.cancel(); return new Response(null, { status: upstream.status }); }
        if (!upstream.headers.get('content-type')?.startsWith('audio/')) { await upstream.body?.cancel(); return new Response(null, { status: 415 }); }
        const output = new Headers({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
        for (const key of ['content-type', 'content-length', 'content-range', 'accept-ranges']) if (upstream.headers.has(key)) output.set(key, upstream.headers.get(key));
        return new Response(upstream.body, { status: upstream.status, headers: output });
    } catch { return new Response(null, { status: 502 }); }
}
