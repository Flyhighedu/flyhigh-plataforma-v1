'use server';

import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fallback_secret_do_not_use_in_prod';

/**
 * Generates a signed token for offline QR synchronization.
 * This allows a device (e.g. Teacher) to display a QR code that other devices can trust.
 */
export async function generateQrToken(journeyId, userId, payload) {
    // 1. Validate session (optional but recommended)
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.id !== userId) {
        throw new Error('Unauthorized');
    }

    // 2. Create data string
    const data = {
        journeyId,
        userId,
        payload,
        timestamp: Date.now(),
        nonce: crypto.randomBytes(8).toString('hex')
    };

    const dataString = JSON.stringify(data);

    // 3. Sign data
    const signature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(dataString)
        .digest('hex');

    return {
        data,
        signature
    };
}

/**
 * Validates a signed QR token.
 * Used by the scanning device (Pilot/Assistant) to verify authenticity.
 */
export async function validateQrToken(tokenData, signature) {
    const dataString = JSON.stringify(tokenData);
    const expectedSignature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(dataString)
        .digest('hex');

    if (signature !== expectedSignature) {
        return { valid: false, error: 'Invalid signature' };
    }

    // Check expiration (e.g., 24 hours) - though for this use case, maybe less?
    // Let's say 4 hours to be safe for a route.
    const now = Date.now();
    if (now - tokenData.timestamp > 4 * 60 * 60 * 1000) {
        return { valid: false, error: 'Token expired' };
    }

    return { valid: true };
}
