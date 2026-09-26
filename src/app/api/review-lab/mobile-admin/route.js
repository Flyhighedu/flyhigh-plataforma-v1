import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/adminAuth';

export async function GET(request) {
    if (process.env.NODE_ENV !== 'development' || process.env.FLYHIGH_REVIEW_LAB !== '1' || process.env.FLYHIGH_REVIEW_ENVIRONMENT !== 'isolated-test') {
        return new Response(null, { status: 404 });
    }
    const url = new URL(request.url);
    const ticket = url.searchParams.get('ticket');
    const payload = await verifyAdminToken(ticket);
    if (!payload || payload.aud !== 'review-mobile') return NextResponse.redirect(new URL('/admin/cronograma?mobile_error=1', url.origin));
    const requested = url.searchParams.get('next') || '';
    const next = requested.startsWith('/admin/') && requested.length <= 300 ? requested : '/admin/cronograma';
    const response = NextResponse.redirect(new URL(next, url.origin));
    response.cookies.set('flyhigh_admin_auth', ticket, { path: '/', maxAge: 10 * 60, sameSite: 'lax', httpOnly: false, secure: false });
    return response;
}
