'use client';

import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { Loader2, Camera, CheckCircle, XCircle } from 'lucide-react';
import { generateQrToken, validateQrToken } from '@/app/actions/staff-actions';

// --- GENERATOR (For Teacher) ---
export function QrGenerator({ journeyId, userId, payload }) {
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let mounted = true;
        const fetchToken = async () => {
            try {
                // In a real app, we might cache this token or use a local secret if truly offline
                // For now, we assume user was online when they started route or we use a pre-fetched key.
                // If completely offline and no pre-fetched key, we might need a fallback.
                // But per plan: "try server action". If fails, maybe show error or simpler QR.

                // If we are offline, we can't hit server action.
                // Fallback: Just encode raw data. It won't be signed securely but peer can accept if in "trust mode"?
                // Or better: We just show the payload and the peer trusts it because they are physically there.
                // Let's try server first.

                if (navigator.onLine) {
                    const res = await generateQrToken(journeyId, userId, payload);
                    if (mounted) setToken(JSON.stringify(res));
                } else {
                    // OFFLINE MODE
                    // We just send the payload. The scanner will see it's unsigned or self-signed.
                    // For MVP, functionality > strict security in offline.
                    const offlineData = {
                        data: { journeyId, userId, payload, timestamp: Date.now(), offline: true },
                        signature: 'offline-trust-me'
                    };
                    if (mounted) setToken(JSON.stringify(offlineData));
                }
            } catch (e) {
                console.error(e);
                if (mounted) setError('Error generando QR');
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchToken();
        return () => { mounted = false; };
    }, [journeyId, userId, payload]);

    if (loading) return <div className="p-4 text-center"><Loader2 className="animate-spin mx-auto" /></div>;
    if (error) return <div className="p-4 text-red-500 text-center">{error}</div>;

    return (
        <div className="flex flex-col items-center bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
            <h3 className="text-lg font-bold mb-4 text-slate-800">Sincronizar Equipo</h3>
            <div className="bg-white p-2 rounded-lg border-2 border-slate-900">
                {token && <QRCodeSVG value={token} size={256} />}
            </div>
            <p className="text-sm text-slate-500 mt-4 text-center px-4">
                Pide a los demás que escaneen este código para actualizar su estado.
            </p>
        </div>
    );
}

// --- SCANNER (For Pilot/Assistant) ---
export function QrScanner({ onScanSuccess, onClose }) {
    const scannerRef = useRef(null);
    const [scannedData, setScannedData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Initialize scanner
        const scanner = new Html5QrcodeScanner(
            "reader",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
        );

        scanner.render(
            async (decodedText) => {
                try {
                    scanner.clear();
                    const json = JSON.parse(decodedText);

                    // Validate
                    if (json.signature === 'offline-trust-me') {
                        // Accept offline token
                        setScannedData(json.data);
                        onScanSuccess(json.data);
                    } else {
                        // Validate with server
                        const validRes = await validateQrToken(json.data, json.signature);
                        if (validRes.valid) {
                            setScannedData(json.data);
                            onScanSuccess(json.data);
                        } else {
                            setError('QR Inválido o Expirado');
                        }
                    }
                } catch (e) {
                    setError('Formato de QR inválido');
                    console.error(e);
                }
            },
            (errorMessage) => {
                // ignore frame errors
            }
        );

        scannerRef.current = scanner;

        return () => {
            scanner.clear().catch(err => console.error("Failed to clear scanner", err));
        };
    }, [onScanSuccess]);

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"
            >
                <XCircle size={32} />
            </button>

            <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden relative">
                <div id="reader" className="w-full"></div>
                {error && (
                    <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center text-red-500 font-bold">
                        <XCircle size={48} className="mb-2" />
                        <p>{error}</p>
                        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-slate-100 rounded text-black text-sm">Reintentar</button>
                    </div>
                )}
                {scannedData && (
                    <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center text-green-600 font-bold animate-in fade-in">
                        <CheckCircle size={48} className="mb-2" />
                        <p>¡Sincronizado!</p>
                    </div>
                )}
            </div>
            <p className="text-white/70 text-sm mt-4 text-center">
                Apunta la cámara al código QR del Docente
            </p>
        </div>
    );
}
