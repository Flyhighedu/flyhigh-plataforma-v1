import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

// Admin password — ideally from env var, fallback to hardcoded for dev
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Flyhigh2026';
const AUTH_SECRET = process.env.ADMIN_AUTH_SECRET || 'flyhigh_admin_secret_2026_do_not_share';

// Generate a signed token that the middleware can verify
function signToken(payload) {
    const data = JSON.stringify(payload);
    const signature = createHmac('sha256', AUTH_SECRET).update(data).digest('hex');
    return Buffer.from(JSON.stringify({ data, signature })).toString('base64');
}

// Verify a signed token
export function verifyToken(token) {
    try {
        const { data, signature } = JSON.parse(Buffer.from(token, 'base64').toString());
        const expected = createHmac('sha256', AUTH_SECRET).update(data).digest('hex');
        if (signature !== expected) return null;
        const payload = JSON.parse(data);
        // Check expiration (24 hours)
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

// POST — Login: validate password, set cookie
export async function POST(request) {
    try {
        const { password } = await request.json();

        if (password !== ADMIN_PASSWORD) {
            return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
        }

        const token = signToken({
            role: 'admin',
            iat: Date.now(),
            exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        });

        const response = NextResponse.json({ success: true });

        response.cookies.set('flyhigh_admin_auth', token, {
            path: '/',
            maxAge: 24 * 60 * 60, // 24 hours in seconds
            sameSite: 'lax',
            httpOnly: false, // Client needs to read it to know auth state
            secure: process.env.NODE_ENV === 'production',
        });

        return response;
    } catch (err) {
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// DELETE — Logout: remove cookie
export async function DELETE() {
    const response = NextResponse.json({ success: true });

    response.cookies.set('flyhigh_admin_auth', '', {
        path: '/',
        maxAge: 0,
    });

    return response;
}
