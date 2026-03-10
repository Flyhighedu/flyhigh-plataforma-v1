/**
 * compressPhoto.js — Shared photo compression utility.
 *
 * Resizes images to a max width of 1600px and encodes as JPEG at 82% quality.
 * This reduces typical phone camera photos (5-15MB) to ~200-500KB,
 * ensuring they stay within Supabase Storage size limits.
 *
 * Gracefully falls back to the original file on any error.
 */

/**
 * Compress a photo File/Blob for upload.
 * @param {File|Blob} file - The original photo file
 * @returns {Promise<File|Blob|null>} Compressed file, or original on error, or null if no file
 */
export function compressPhotoForUpload(file) {
    return new Promise((resolve) => {
        if (!file) {
            resolve(null);
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result;

            img.onload = () => {
                const MAX_WIDTH = 1600;
                const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
                const width = Math.round(img.width * scale);
                const height = Math.round(img.height * scale);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(file);
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (!blob) {
                        resolve(file);
                        return;
                    }

                    const baseName = (file.name || 'evidence').replace(/\.[^/.]+$/, '');
                    resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.82);
            };

            img.onerror = () => resolve(file);
        };

        reader.onerror = () => resolve(file);
    });
}
