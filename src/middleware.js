import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/adminAuth'

export async function middleware(request) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    if (request.nextUrl.pathname.startsWith('/staff-v2')) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = request.nextUrl.pathname.replace('/staff-v2', '/staff')
        return NextResponse.redirect(redirectUrl)
    }

    // ─── SANDBOX ROUTE PROTECTION ───────────────────────────
    // Protect all /sandbox-* routes with admin cookie auth.
    // This block is COMPLETELY INDEPENDENT from /staff auth.
    if (request.nextUrl.pathname.startsWith('/sandbox-')) {
        const adminCookie = request.cookies.get('flyhigh_admin_auth')?.value;
        const isValid = await verifyAdminToken(adminCookie);

        if (!isValid) {
            // No valid admin cookie → redirect to admin login
            const loginUrl = new URL('/admin', request.url);
            return NextResponse.redirect(loginUrl);
        }

        // Valid cookie → allow through
        return NextResponse.next();
    }

    // ─── STAFF/SUPERVISOR ROUTES (existing, unchanged) ──────
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // OPTIMIZATION: Only check user if likely to be logged in or accessing protected route
    let user = null;

    // Check if we have auth cookies before expensive getUser call
    const cookieStore = request.cookies.getAll();
    const hasAuthCookie = cookieStore.some(c => c.name.includes('auth-token') || c.name.startsWith('sb-'));

    if (hasAuthCookie) {
        const { data } = await supabase.auth.getUser();
        user = data.user;
    }

    // Proteger rutas /staff (excepto /staff/login y /staff/preview)
    if (request.nextUrl.pathname.startsWith('/staff') &&
        !request.nextUrl.pathname.startsWith('/staff/login') &&
        !request.nextUrl.pathname.startsWith('/staff/preview')) {

        const isTestMode = request.cookies.get('flyhigh_test_mode')?.value === 'true';

        if (!user && !isTestMode) {
            return NextResponse.redirect(new URL('/staff/login', request.url))
        }
    }

    // Proteger rutas /supervisor (misma lógica que /staff)
    if (request.nextUrl.pathname.startsWith('/supervisor')) {
        const isTestMode = request.cookies.get('flyhigh_test_mode')?.value === 'true';

        if (!user && !isTestMode) {
            return NextResponse.redirect(new URL('/staff/login', request.url))
        }
    }

    // Redirigir de login a dashboard si ya hay sesión
    if (request.nextUrl.pathname === ('/staff/login') && user) {
        return NextResponse.redirect(new URL('/staff/dashboard', request.url))
    }

    return response
}

export const config = {
    matcher: [
        '/staff/:path*',
        '/staff-v2/:path*',
        '/supervisor/:path*',
        '/sandbox-escuelas/:path*',
        '/sandbox-vuelos/:path*',
        '/sandbox-cronograma/:path*',
        '/sandbox-hr/:path*',
        '/sandbox-patrocinadores/:path*',
        '/sandbox-crm/:path*',
        '/sandbox-dashboards/:path*',
        '/api/:path*',
    ],
}

