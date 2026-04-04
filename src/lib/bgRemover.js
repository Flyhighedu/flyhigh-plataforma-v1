/**
 * Utility for removing backgrounds from images using @imgly/background-removal
 * We load it dynamically so it doesn't inflate the main application bundle.
 */

export const processBackgroundRemoval = async (imageFile, onProgress = null) => {
  try {
    // Dynamically import to avoid SSR issues and keep initial bundle small
    const imgly = await import("@imgly/background-removal");

    const config = {
      progress: (key, current, total) => {
        if (onProgress && total > 0) {
          const percentage = Math.round((current / total) * 100);
          onProgress(`Descargando IA (${key})... ${percentage}%`);
        }
      }
    };

    if (onProgress) onProgress("Iniciando IA...");

    // Remove the background. Returns a transparent PNG Blob
    const resultBlob = await imgly.removeBackground(imageFile, config);
    
    if (onProgress) onProgress("Convirtiendo a WebP...");

    // Convert the PNG blob to an optimized WebP blob
    const webpBlob = await convertToWebP(resultBlob);

    return webpBlob;

  } catch (error) {
    console.error("Error in background remover:", error);
    throw error;
  }
};

/**
 * Helper to convert a Blob into a WebP Blob using the Browser Canvas API
 */
const convertToWebP = (blob) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.src = url;

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");

      // Draw the image onto the canvas (preserves transparency)
      ctx.drawImage(img, 0, 0);

      // Convert to webp with 90% quality
      canvas.toBlob(
        (webpBlob) => {
          if (webpBlob) {
            resolve(webpBlob);
          } else {
            reject(new Error("Canvas toBlob failed"));
          }
        },
        "image/webp",
        0.9
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for WebP conversion"));
    };
  });
};
