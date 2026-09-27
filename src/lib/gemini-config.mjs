import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import path from 'node:path';

// Server only. The local workbench can receive its explicitly configured key
// without restarting its five sessions or invalidating the mobile access link.
export function geminiApiKey(env = process.env, root = process.cwd()) {
    if (env.FLYHIGH_REVIEW_LAB === '1') {
        if (env.NODE_ENV !== 'development' || env.FLYHIGH_REVIEW_ENVIRONMENT !== 'isolated-test') return '';
        try {
            const local = parseEnv(readFileSync(path.join(root, '.env.review.local'), 'utf8'));
            return local.FLYHIGH_REVIEW_ENVIRONMENT === 'isolated-test' ? local.GEMINI_API_KEY?.trim() || '' : '';
        } catch { return ''; }
    }
    return env.GEMINI_API_KEY?.trim() || '';
}
