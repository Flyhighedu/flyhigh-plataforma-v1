'use client';

import { useEffect } from 'react';

/**
 * Staff-scoped Error Boundary — catches any crash inside /staff/* routes
 * and shows a branded recovery UI instead of a white screen.
 */
export default function StaffError({ error, reset }) {
    useEffect(() => {
        console.error('[StaffErrorBoundary]', error?.message || error);
    }, [error]);

    return (
        <div style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
            color: 'white',
            padding: 32,
            textAlign: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            {/* Icon */}
            <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(239,68,68,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 24,
                border: '2px solid rgba(239,68,68,0.3)'
            }}>
                <span style={{ fontSize: 36 }}>⚠️</span>
            </div>

            {/* Title */}
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                Hubo un problema inesperado
            </h1>
            <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 300, lineHeight: 1.6, margin: '0 0 8px' }}>
                El sistema encontró un error. Tu progreso está guardado.
            </p>

            {/* Error detail (collapsed) */}
            <details style={{ marginBottom: 24, maxWidth: 300 }}>
                <summary style={{ fontSize: 11, color: '#64748b', cursor: 'pointer', marginBottom: 4 }}>
                    Ver detalle técnico
                </summary>
                <code style={{
                    display: 'block', padding: 12, borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)', fontSize: 10,
                    color: '#f87171', wordBreak: 'break-all', textAlign: 'left'
                }}>
                    {error?.message || 'Error desconocido'}
                </code>
            </details>

            {/* Reset button */}
            <button
                onClick={reset}
                style={{
                    padding: '14px 32px', borderRadius: 14,
                    background: '#2563EB', color: 'white', border: 'none',
                    fontWeight: 700, fontSize: 15, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
                    marginBottom: 12
                }}
            >
                Restablecer Tarea
            </button>

            {/* Hard reload link */}
            <button
                onClick={() => window.location.reload()}
                style={{
                    padding: '10px 24px', borderRadius: 12,
                    background: 'transparent', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.3)',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer'
                }}
            >
                Recargar Aplicación
            </button>
        </div>
    );
}
