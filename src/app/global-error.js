'use client';

import { useEffect } from 'react';

/**
 * Root-level Global Error Boundary — catches any fatal crash in the entire app.
 * This is the last line of defense against white-screen crashes.
 *
 * NOTE: global-error.js replaces the root layout entirely during errors,
 *       so it must include <html> and <body> tags.
 */
export default function GlobalError({ error, reset }) {
    useEffect(() => {
        console.error('[GlobalErrorBoundary]', error?.message || error);
    }, [error]);

    return (
        <html lang="es">
            <body style={{ margin: 0 }}>
                <div style={{
                    minHeight: '100vh',
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
                    <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: 'rgba(239,68,68,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 24,
                        border: '2px solid rgba(239,68,68,0.3)'
                    }}>
                        <span style={{ fontSize: 36 }}>🚨</span>
                    </div>

                    <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>
                        Hubo un problema inesperado en el sistema
                    </h1>

                    <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 300, lineHeight: 1.6, margin: '0 0 24px' }}>
                        El sistema se recuperará automáticamente. Tu progreso no se ha perdido.
                    </p>

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

                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '14px 32px', borderRadius: 14,
                            background: '#2563EB', color: 'white', border: 'none',
                            fontWeight: 700, fontSize: 15, cursor: 'pointer',
                            boxShadow: '0 4px 16px rgba(37,99,235,0.4)'
                        }}
                    >
                        Recargar Aplicación
                    </button>
                </div>
            </body>
        </html>
    );
}
