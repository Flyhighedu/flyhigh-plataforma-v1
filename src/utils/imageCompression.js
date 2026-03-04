/**
 * imageCompression.js — Shared client-side image compression utility.
 * 
 * Uses the native Canvas API to resize and compress photos before
 * storing locally in IndexedDB or uploading to Supabase Storage.
 * 
 * Target: ~400KB output from 5MB+ raw camera images.
 */

/**
 * Compress a photo file using Canvas API.
 * Two-pass: resize first, then iteratively lower quality until ≤ maxSizeBytes.
 * 
 * @param {File|Blob} file - The image file to compress
 * @param {Object} options
 * @param {number} options.maxWidth - Max pixel width (default 1280)
 * @param {number} options.maxSizeBytes - Target max size in bytes (default 400KB)
 * @param {number} options.initialQuality - Starting JPEG quality 0-1 (default 0.7)
 * @param {number} options.minQuality - Minimum quality floor (default 0.3)
 * @returns {Promise<File>} Compressed File object
 */
export async function compressPhoto(file, {
    maxWidth = 1280,
    maxSizeBytes = 400 * 1024,
    initialQuality = 0.7,
    minQuality = 0.3
} = {}) {
    // Skip non-image files
    if (!file || !file.type?.startsWith('image/')) return file;

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');

                // Resize if wider than maxWidth
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    const scale = maxWidth / width;
                    width = maxWidth;
                    height = Math.round(height * scale);
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Iterative quality reduction to hit target size
                let quality = initialQuality;
                const tryCompress = () => {
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                resolve(file); // Fallback: return original
                                return;
                            }

                            if (blob.size <= maxSizeBytes || quality <= minQuality) {
                                // Target reached or minimum quality floor hit
                                const compressed = new File(
                                    [blob],
                                    file.name || 'compressed.jpg',
                                    { type: 'image/jpeg' }
                                );
                                resolve(compressed);
                            } else {
                                // Reduce quality by 0.1 and retry
                                quality = Math.max(quality - 0.1, minQuality);
                                tryCompress();
                            }
                        },
                        'image/jpeg',
                        quality
                    );
                };

                tryCompress();
            };
            img.onerror = () => resolve(file); // Fallback on decode error
        };
        reader.onerror = () => resolve(file); // Fallback on read error
    });
}
