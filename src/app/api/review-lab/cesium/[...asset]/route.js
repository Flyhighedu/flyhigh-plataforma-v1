import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isLocal3dReview } from '@/lib/google-3d-proxy.mjs';

export const runtime = 'nodejs';
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ktx2': 'image/ktx2' };
export async function GET(_request, { params }) {
    if (!isLocal3dReview(process.env)) return new Response(null, { status: 404 });
    const { asset } = await params;
    if (!asset?.length || asset.some(part => !/^[\w.-]+$/.test(part) || part === '..' || part === '.')
        || !(asset.length === 1 && asset[0] === 'Cesium.js') && !['Workers', 'Assets', 'ThirdParty', 'Widgets'].includes(asset[0])) return new Response(null, { status: 404 });
    const base = path.resolve(process.cwd(), 'node_modules/cesium/Build/Cesium');
    const file = path.resolve(base, ...asset);
    if (!file.startsWith(base + path.sep)) return new Response(null, { status: 404 });
    try {
        return new Response(await readFile(file), { headers: { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
    } catch { return new Response(null, { status: 404 }); }
}
