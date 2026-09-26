import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/adminAuth';

const ACCOUNTS = {
    pilot: 'piloto@revision.flyhigh.test',
    teacher: 'maestra@revision.flyhigh.test',
    assistant: 'auxiliar@revision.flyhigh.test',
    supervisor: 'supervision@revision.flyhigh.test',
};
export async function GET(request) {
    if (process.env.NODE_ENV !== 'development' || process.env.FLYHIGH_REVIEW_LAB !== '1' || process.env.FLYHIGH_REVIEW_ENVIRONMENT !== 'isolated-test') {
        return new Response(null, { status: 404 });
    }
    const url = new URL(request.url);
    const payload = await verifyAdminToken(url.searchParams.get('ticket'));
    const email = ACCOUNTS[payload?.staffRole];
    if (!payload || payload.aud !== 'review-mobile-staff' || !email) return NextResponse.redirect(new URL('/review-mobile?invalid=1', url.origin));
    const backend = process.env.FLYHIGH_REVIEW_BACKEND_ORIGIN;
    if (!['http://127.0.0.1:54321', 'http://localhost:54321'].includes(backend)) return new Response(null, { status: 404 });
    const admin = createClient(backend, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (error || !data?.properties?.hashed_token) return NextResponse.redirect(new URL('/review-mobile?unavailable=1', url.origin));
    const params = new URLSearchParams({ token_hash: data.properties.hashed_token, role: payload.staffRole, next: payload.next });
    return NextResponse.redirect(new URL(`/review-mobile?${params}`, url.origin));
}
