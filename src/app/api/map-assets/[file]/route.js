import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
const FILES = new Set(['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']);

export async function GET(_request, { params }) {
    const { file } = await params;
    if (!FILES.has(file)) return new Response(null, { status: 404 });
    const source = await readFile(path.join(process.cwd(), 'node_modules/maplibre-gl/dist', file));
    return new Response(source, {
        headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' },
    });
}
