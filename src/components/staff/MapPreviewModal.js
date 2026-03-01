'use client';

import { X, MapPin, Navigation } from 'lucide-react';
import { STAFF_CONFIG } from '@/config/staffConfig';

export default function MapPreviewModal({ isOpen, onClose, school }) {
    if (!isOpen) return null;

    const lat = school?.lat || STAFF_CONFIG.OFFICE_LOCATION.lat;
    const lng = school?.lng || STAFF_CONFIG.OFFICE_LOCATION.lng;

    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Ubicación de Misión</h2>
                    <p className="text-xs text-slate-500">{school?.school_name || 'Oficina Central'}</p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors text-slate-600"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative bg-slate-100">
                <iframe
                    title="Mapa Detallado"
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`}
                />

                {/* Floating Info Card */}
                <div className="absolute bottom-6 left-4 right-4 bg-white p-4 rounded-2xl shadow-xl border border-slate-100">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                            <MapPin size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm">
                                {school?.colonia || 'Ubicación registrada'}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Coordenadas: {lat.toFixed(5)}, {lng.toFixed(5)}
                            </p>
                            <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 mt-3 bg-blue-50 px-3 py-1.5 rounded-lg active:bg-blue-100"
                            >
                                <Navigation size={14} />
                                Abrir en Google Maps
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
