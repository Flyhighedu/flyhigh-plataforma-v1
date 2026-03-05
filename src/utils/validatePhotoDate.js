/**
 * validatePhotoDate - Ensures a photo was taken/created today.
 * Checks file.lastModified against today's date in Mexico City timezone.
 *
 * @param {File} file - The image file to validate
 * @returns {{ valid: boolean, message?: string }}
 */
export function validatePhotoDate(file) {
    if (!file || !file.lastModified) {
        return { valid: true }; // Can't validate → allow
    }

    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

    const fileDate = new Date(file.lastModified);
    const fileDateStr = fileDate.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

    if (fileDateStr !== todayStr) {
        return {
            valid: false,
            message: 'Evidencia rechazada: La foto debe haber sido tomada el día de hoy.'
        };
    }

    return { valid: true };
}
