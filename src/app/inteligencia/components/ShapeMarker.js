// ═══════════════════════════════════════════════════════════════
// ShapeMarker.js — Custom Leaflet Canvas marker with geometric shapes
// Extends L.CircleMarker to draw triangles, squares, diamonds,
// stars, hexagons directly on the Canvas renderer.
// Performance: identical to circleMarker (canvas draw calls).
// ═══════════════════════════════════════════════════════════════

/**
 * Registers L.ShapeMarker on the provided Leaflet instance.
 * Must be called AFTER Leaflet is loaded (client-side only).
 *
 * Usage:
 *   import { registerShapeMarker } from './ShapeMarker';
 *   registerShapeMarker(L);
 *   new L.ShapeMarker([lat, lng], { shape: 'triangle', radius: 6, ...styles });
 */
export function registerShapeMarker(L) {
  if (L.ShapeMarker) return; // Already registered

  L.ShapeMarker = L.CircleMarker.extend({
    options: {
      shape: 'circle', // 'circle' | 'triangle' | 'square' | 'diamond' | 'hexagon' | 'star'
    },

    _updatePath() {
      const renderer = this._renderer;
      if (!renderer || !renderer._ctx) return;
      const ctx = renderer._ctx;
      const p = this._point;
      const r = this._radius || this.options.radius || 6;

      ctx.beginPath();

      switch (this.options.shape) {
        case 'triangle':
          drawTriangle(ctx, p.x, p.y, r);
          break;
        case 'square':
          drawSquare(ctx, p.x, p.y, r);
          break;
        case 'diamond':
          drawDiamond(ctx, p.x, p.y, r);
          break;
        case 'hexagon':
          drawHexagon(ctx, p.x, p.y, r);
          break;
        case 'star':
          drawStar(ctx, p.x, p.y, r);
          break;
        default: // 'circle'
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          break;
      }

      ctx.closePath();
      this._renderer._fillStroke(ctx, this);

      // Draw route number if present (white text with dark border for absolute legibility)
      if (this.options.routeNumber) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(13, Math.floor(r * 1.55))}px Inter, system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(11, 17, 32, 0.9)';
        ctx.lineWidth = 3.5;
        ctx.strokeText(this.options.routeNumber.toString(), p.x, p.y);
        ctx.fillText(this.options.routeNumber.toString(), p.x, p.y);
      }
    },
  });

  // Factory function
  L.shapeMarker = function (latlng, options) {
    return new L.ShapeMarker(latlng, options);
  };
}

// ─── Shape drawing functions ───
// All shapes are centered on (cx, cy) with radius r.

function drawTriangle(ctx, cx, cy, r) {
  // Equilateral triangle pointing UP, vertically centered
  const h = r * 1.15; // Slightly taller for visual balance
  ctx.moveTo(cx, cy - h);            // top vertex
  ctx.lineTo(cx + r, cy + h * 0.6);  // bottom-right
  ctx.lineTo(cx - r, cy + h * 0.6);  // bottom-left
}

function drawSquare(ctx, cx, cy, r) {
  const s = r * 0.85; // Slightly smaller than radius for visual parity with circle
  ctx.rect(cx - s, cy - s, s * 2, s * 2);
}

function drawDiamond(ctx, cx, cy, r) {
  const s = r * 1.1; // Slightly larger for visual balance
  ctx.moveTo(cx, cy - s);     // top
  ctx.lineTo(cx + s, cy);     // right
  ctx.lineTo(cx, cy + s);     // bottom
  ctx.lineTo(cx - s, cy);     // left
}

function drawHexagon(ctx, cx, cy, r) {
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 2; // Start from top
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

function drawStar(ctx, cx, cy, r) {
  const outerR = r * 1.2;
  const innerR = r * 0.5;
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2; // Start from top
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}
