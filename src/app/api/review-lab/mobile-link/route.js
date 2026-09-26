import { GET as handshake } from '../status/route';
import { signAdminToken } from '@/lib/adminAuth';

const STAFF = {
    pilot: { route: '/staff/dashboard' },
    teacher: { route: '/staff/dashboard' },
    assistant: { route: '/staff/dashboard' },
    supervisor: { route: '/supervisor/dashboard' },
};
function safeDestination(role, value) {
    let pathname;
    try { pathname = new URL(value || '', 'http://review.local').pathname; } catch { return role.route; }
    const prefix = role.route.startsWith('/supervisor') ? '/supervisor/' : '/staff/';
    return pathname.startsWith(prefix) && pathname.length <= 300 ? pathname : role.route;
}
export async function POST(request) {
    const check = await handshake(request);
    if (!check.ok) return check;
    try {
        const body = await request.json();
        if (body.role === 'admin') {
            const ticket = await signAdminToken({ role: 'admin', aud: 'review-mobile', iat: Date.now(), exp: Date.now() + 10 * 60 * 1000 });
            let next = '/admin/cronograma';
            try { const candidate = new URL(body.pathname || '', 'http://review.local').pathname; if (candidate.startsWith('/admin/') && candidate.length <= 300) next = candidate; } catch { /* default */ }
            return Response.json({ path: `/api/review-lab/mobile-admin?ticket=${encodeURIComponent(ticket)}&next=${encodeURIComponent(next)}` }, { headers: { 'Cache-Control': 'no-store' } });
        }
        const role = STAFF[body.role];
        if (!role) return Response.json({ error: 'Perfil desconocido.' }, { status: 400 });
        const ticket = await signAdminToken({ role: 'admin', aud: 'review-mobile-staff', staffRole: body.role,
            next: safeDestination(role, body.pathname), iat: Date.now(), exp: Date.now() + 10 * 60 * 1000 });
        return Response.json({ path: `/api/review-lab/mobile-staff?ticket=${encodeURIComponent(ticket)}` }, { headers: { 'Cache-Control': 'no-store' } });
    } catch {
        return Response.json({ error: 'No se pudo preparar el acceso móvil.' }, { status: 400 });
    }
}
