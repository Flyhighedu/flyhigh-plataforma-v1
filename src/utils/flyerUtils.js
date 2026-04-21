/**
 * Flyer Generation Utilities
 * Used by FlyerDownloadModal to capture and export flyers as PDF/JPEG.
 * 
 * KEY DESIGN: All external images are inlined as base64 data URIs BEFORE
 * html2canvas capture, preventing CORS/tainted-canvas errors on mobile PWA.
 */

const MONTHS_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

/**
 * Format ISO date "2026-04-21" → "21 / ABRIL / 2026"
 */
export function formatFlyerDate(isoDate) {
  if (!isoDate) return '-- / ------ / ----';
  const [year, month, day] = isoDate.split('-');
  const monthIndex = parseInt(month, 10) - 1;
  return `${parseInt(day, 10)} / ${MONTHS_ES[monthIndex] || '------'} / ${year}`;
}

/**
 * Format number as money: 50 → "$50.00"
 */
export function formatMoney(amount) {
  const num = parseFloat(amount);
  if (isNaN(num)) return '$0.00';
  return `$${num.toFixed(2)}`;
}

/**
 * Wait for all fonts to be loaded before capturing
 */
export async function waitForFonts() {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }
  // Extra safety delay for external font rendering
  await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Fetch an image and return it as a base64 data URI.
 * Tries CORS first, then no-cors fallback via canvas redraw.
 */
async function fetchImageAsDataUri(src, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(src, { mode: 'cors', signal: controller.signal });
    clearTimeout(timer);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    clearTimeout(timer);
    console.warn(`CORS fetch failed for ${src}, trying img-canvas fallback:`, e.message);
    // Fallback: load image via <img> tag without crossOrigin, draw to canvas
    return await new Promise((resolve) => {
      const img = new Image();
      // Don't set crossOrigin — lets the image load even without CORS headers
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          console.warn(`Canvas fallback also failed for ${src}`);
          resolve(null);
        }
      };
      img.onerror = () => {
        console.warn(`Image load completely failed for ${src}`);
        resolve(null);
      };
      img.src = src;
    });
  }
}

/**
 * Convert all external <img> sources in a container to base64 data URIs.
 * This prevents CORS/tainted-canvas errors during html2canvas capture.
 */
async function inlineExternalImages(element) {
  // 1. Inline all <img> tags
  const images = element.querySelectorAll('img');
  const imgPromises = Array.from(images).map(async (img) => {
    const src = img.getAttribute('src') || img.src;
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) return;

    const dataUri = await fetchImageAsDataUri(src);
    if (dataUri) {
      img.src = dataUri;
      img.removeAttribute('crossorigin');
      img.removeAttribute('crossOrigin');
    }
  });

  // 2. Inline all background-images for children
  const allElements = element.querySelectorAll('*');
  const bgPromises = Array.from(allElements).map(async (el) => {
    const style = window.getComputedStyle(el);
    const bgImage = style.getPropertyValue('background-image');
    if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
      const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
      if (match && match[1]) {
        const src = match[1];
        if (!src.startsWith('data:') && !src.startsWith('blob:')) {
          const dataUri = await fetchImageAsDataUri(src);
          if (dataUri) {
            el.style.backgroundImage = `url(${dataUri})`;
          }
        }
      }
    }
  });

  // 3. Inline background-image for the root element
  const rootBgPromise = (async () => {
    const style = window.getComputedStyle(element);
    const bgImage = style.getPropertyValue('background-image');
    if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
      const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
      if (match && match[1]) {
        const src = match[1];
        if (!src.startsWith('data:') && !src.startsWith('blob:')) {
          const dataUri = await fetchImageAsDataUri(src);
          if (dataUri) {
            element.style.backgroundImage = `url(${dataUri})`;
          }
        }
      }
    }
  })();

  await Promise.all([...imgPromises, ...bgPromises, rootBgPromise]);
  // Let the browser render the new data-URI sources
  await new Promise(r => setTimeout(r, 300));
}

/**
 * Core capture function with robust error handling.
 * 1. Waits for fonts
 * 2. Inlines all external images as base64
 * 3. Moves element on-screen (fully visible) for capture
 * 4. Captures with html-to-image
 * 5. Restores element position
 */
async function captureAsDataURL(element, scale = 3) {
  if (!element) {
    throw new Error('Element ref is null — el componente no se ha montado todavía.');
  }

  const htmlToImage = await import('html-to-image');

  await waitForFonts();

  // CRITICAL: Inline all external images as base64 data URIs
  // This helps html-to-image and prevents CORS issues.
  await inlineExternalImages(element);

  // Move the off-screen container on-screen for capture.
  // Use full opacity so the capture is clean.
  const parent = element.parentElement;
  const originalStyle = parent?.style?.cssText || '';
  if (parent) {
    parent.style.cssText = [
      'position: fixed',
      'left: 0',
      'top: 0',
      'z-index: -1',
      'opacity: 1',            // ← FULL opacity for clean capture
      'pointer-events: none',
      'overflow: visible',
    ].join('; ') + ';';
  }

  // Let the browser reflow with the new position
  await new Promise(r => setTimeout(r, 300));

  try {
    const dataUrl = await htmlToImage.toPng(element, {
      pixelRatio: scale,
      backgroundColor: '#ffffff',
      cacheBust: true,
      skipFonts: false,
    });
    return dataUrl;
  } finally {
    // Restore original off-screen position
    if (parent) {
      parent.style.cssText = originalStyle;
    }
  }
}

/**
 * Capture a DOM element as a PDF (letter size) and trigger download.
 */
export async function captureAsPDF(element, filename = 'flyer.pdf') {
  const { jsPDF } = await import('jspdf');
  
  const imgData = await captureAsDataURL(element);
  
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  });

  pdf.addImage(imgData, 'PNG', 0, 0, 8.5, 11);
  pdf.save(filename);
}

/**
 * Capture a DOM element as PNG and trigger download.
 * We use a scale of 5 for PNGs to ensure high-quality, crisp text on digital circulars.
 */
export async function captureAsPNG(element, filename = 'circular.png') {
  const imgData = await captureAsDataURL(element, 5);

  const link = document.createElement('a');
  link.download = filename;
  link.href = imgData;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Download all 3 flyers in sequence
 */
export async function downloadAll(ninosRef, padresRef, digitalRef, escuela) {
  const nombreEscuela = escuela || 'Escuela';
  
  await captureAsPDF(ninosRef.current, `Flyer imprimible para salones - ${nombreEscuela}.pdf`);
  await new Promise(r => setTimeout(r, 1000));
  
  await captureAsPDF(padresRef.current, `Flyer imprimible para exterior - ${nombreEscuela}.pdf`);
  await new Promise(r => setTimeout(r, 1000));
  
  await captureAsPNG(
    digitalRef.current,
    `Circular digital para padres de familia - ${nombreEscuela}.png`
  );
}
