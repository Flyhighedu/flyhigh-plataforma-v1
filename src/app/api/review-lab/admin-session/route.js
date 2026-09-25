import { NextResponse } from 'next/server';
import { signAdminToken } from '@/lib/adminAuth';
import { GET as handshake } from '../status/route';

// No password is exposed to the renderer. This bridge only exists in the
// development lab, behind its random host token and fixed local backend.
export async function POST(request) {
    const check = await handshake(request);
    if (!check.ok) return check;
    const identity = await check.json();
    if (identity.environment !== 'isolated-test' ||
        !['http://localhost:54321', 'http://127.0.0.1:54321'].includes(identity.backendOrigin)) {
        return new Response(null, { status: 404 });
    }
    const token = await signAdminToken({ role: 'admin', iat: Date.now(), exp: Date.now() + 86400000 });
    const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('flyhigh_admin_auth', token, { path: '/', maxAge: 86400, sameSite: 'strict', httpOnly: false, secure: false });
    return response;
}
