import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
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

    const { data: { user } } = await supabase.auth.getUser()

    // Proteger rutas /staff
    if (request.nextUrl.pathname.startsWith('/staff') && !request.nextUrl.pathname.startsWith('/staff/login')) {
        if (!user) {
            return NextResponse.redirect(new URL('/staff/login', request.url))
        }

        // Aquí podríamos verificar roles, ej:
        // const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        // if (profile?.role !== 'staff') { ... }
        // Por ahora solo validamos sesión activa como pidió el usuario inicial (ajustable luego)
    }

    // Redirigir de login a dashboard si ya hay sesión
    if (request.nextUrl.pathname === ('/staff/login') && user) {
        return NextResponse.redirect(new URL('/staff/dashboard', request.url))
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
