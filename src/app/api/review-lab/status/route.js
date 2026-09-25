import { timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';

// Local workbench handshake only. No database calls, credentials or user data.
export async function GET(request) {
    const expected = process.env.FLYHIGH_REVIEW_TOKEN;
    const supplied = request.headers.get('x-flyhigh-review-token') || '';
    if (process.env.NODE_ENV !== 'development' || process.env.FLYHIGH_REVIEW_LAB !== '1' || !expected ||
        Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
        return new Response(null, { status: 404 });
    }
    return Response.json({
        environment: process.env.FLYHIGH_REVIEW_ENVIRONMENT,
        backendOrigin: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin,
    }, { headers: { 'Cache-Control': 'no-store' } });
}
