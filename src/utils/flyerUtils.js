/**
 * Flyer Generation Utilities
 * Used by FlyerDownloadModal to capture and export flyers as PDF/JPEG.
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
  await new Promise(resolve => setTimeout(resolve, 800));
}

/**
 * Preload all cross-origin images in a container so they're in browser cache.
 * This prevents CORS/tainted canvas issues during html2canvas capture.
 */
async function preloadImages(element) {
  const images = element.querySelectorAll('img[crossorigin]');
  const promises = Array.from(images).map(img => {
    return new Promise((resolve) => {
      if (img.complete && img.naturalWidth > 0) {
        resolve();
        return;
      }
      const timeout = setTimeout(resolve, 5000); // 5s max per image
      img.onload = () => { clearTimeout(timeout); resolve(); };
      img.onerror = () => { clearTimeout(timeout); console.warn('Failed to load:', img.src); resolve(); };
    });
  });
  await Promise.all(promises);
}

/**
 * Core capture function with robust error handling
 */
async function captureElement(element) {
  if (!element) {
    throw new Error('Element ref is null — cannot capture');
  }

  const html2canvas = (await import('html2canvas')).default;

  await waitForFonts();
  await preloadImages(element);

  // Temporarily move element on-screen for capture (some browsers
  // have issues with off-screen elements)
  const originalStyle = element.parentElement?.style?.cssText || '';
  if (element.parentElement) {
    element.parentElement.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;opacity:0.01;pointer-events:none;';
  }

  // Small delay to let the browser reflow
  await new Promise(r => setTimeout(r, 200));

  try {
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      allowTaint: true,       // Fallback: allow tainted canvas
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 10000,     // 10s timeout for images
      removeContainer: true,
    });
    return canvas;
  } finally {
    // Restore original off-screen position
    if (element.parentElement) {
      element.parentElement.style.cssText = originalStyle;
    }
  }
}

/**
 * Capture a DOM element as a PDF (letter size) and trigger download.
 */
export async function captureAsPDF(element, filename = 'flyer.pdf') {
  const { jsPDF } = await import('jspdf');
  
  const canvas = await captureElement(element);
  
  // Try toDataURL — if tainted, use toBlob fallback
  let imgData;
  try {
    imgData = canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('toDataURL failed (tainted canvas), trying blob approach:', e.message);
    // Convert canvas to blob then to data URL
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    imgData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  });

  pdf.addImage(imgData, 'PNG', 0, 0, 8.5, 11);
  pdf.save(filename);
}

/**
 * Capture a DOM element as JPEG and trigger download.
 */
export async function captureAsJPEG(element, filename = 'circular.jpg', quality = 0.92, sizeOverride = null) {
  const canvas = await captureElement(element);

  try {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/jpeg', quality);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    console.warn('toDataURL failed, trying blob:', e.message);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Download all 3 flyers in sequence
 */
export async function downloadAll(ninosRef, padresRef, digitalRef, escuela) {
  const safeName = (escuela || 'escuela').replace(/\s+/g, '_').toUpperCase();
  
  await captureAsPDF(ninosRef.current, `Flyer_Ninos_${safeName}.pdf`);
  await new Promise(r => setTimeout(r, 1000));
  
  await captureAsPDF(padresRef.current, `Flyer_Padres_${safeName}.pdf`);
  await new Promise(r => setTimeout(r, 1000));
  
  await captureAsJPEG(
    digitalRef.current,
    `Circular_Digital_${safeName}.jpg`,
    0.92
  );
}
