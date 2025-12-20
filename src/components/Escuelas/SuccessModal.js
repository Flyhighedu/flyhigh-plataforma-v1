"use client";
import React from 'react';

export default function SuccessModal({ onClose }) {
    return (
        <div className="modal-overlay" id="successModal">
            <div className="modal-card">
                <i className="fa-solid fa-circle-check" style={{ fontSize: '4rem', color: 'var(--green)', marginBottom: '20px' }}></i>
                <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '15px' }}>¡Solicitud Recibida!</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '30px', fontSize: '1.1rem' }}>
                    Tu folio oficial es <strong>#AF-2025-884</strong>.
                    <br /><br />
                    Hemos recibido tu solicitud correctamente. <strong>Nos pondremos en contacto contigo vía llamada o WhatsApp en unos minutos</strong> para confirmar detalles y finalizar el proceso.
                </p>
                <button
                    className="btn-start"
                    onClick={onClose}
                    style={{ padding: '15px 40px', fontSize: '1rem', boxShadow: 'none', border: '1px solid #e2e8f0' }}
                >
                    Entendido
                </button>
            </div>
        </div>
    );
}
