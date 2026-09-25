import { NextResponse } from 'next/server';
import { signAdminToken } from '@/lib/adminAuth';

export async function POST(request) {
    const passwordConfigured = process.env.ADMIN_PASSWORD;
    if (!passwordConfigured || !process.env.ADMIN_AUTH_SECRET) {
        return NextResponse.json({ error: 'Acceso administrativo no configurado' }, { status: 503 });
    }
    try {
        const { password } = await request.json();
        if (typeof password !== 'string' || password !== passwordConfigured) {
            return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
        }
        const token = await signAdminToken({
            role: 'admin', iat: Date.now(), exp: Date.now() + 24 * 60 * 60 * 1000,
        });
        const response = NextResponse.json({ success: true });
        response.cookies.set('flyhigh_admin_auth', token, {
            path: '/', maxAge: 24 * 60 * 60, sameSite: 'lax',
            // Existing UI reads this cookie; migrate that UI before enabling HttpOnly.
            httpOnly: false, secure: process.env.NODE_ENV === 'production',
        });
        return response;
    } catch {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

export async function DELETE() {
    const response = NextResponse.json({ success: true });
    response.cookies.set('flyhigh_admin_auth', '', { path: '/', maxAge: 0 });
    return response;
}
