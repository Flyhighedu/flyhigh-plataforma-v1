'use client';

export default function OfflinePage() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: 'white',
            padding: 32,
            textAlign: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 24
            }}>
                <span style={{ fontSize: 36 }}>📡</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>
                Sin conexión
            </h1>
            <p style={{ fontSize: 14, color: '#94a3b8', maxWidth: 300, lineHeight: 1.6, margin: '0 0 32px' }}>
                No tienes conexión a Internet. Tu progreso está guardado localmente.
                Cuando recuperes señal, la app se sincronizará automáticamente.
            </p>
            <button
                onClick={() => window.location.reload()}
                style={{
                    padding: '14px 32px', borderRadius: 14,
                    background: '#2563EB', color: 'white', border: 'none',
                    fontWeight: 700, fontSize: 15, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(37,99,235,0.4)'
                }}
            >
                Reintentar conexión
            </button>
        </div>
    );
}
