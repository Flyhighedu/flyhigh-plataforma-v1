"use client";
import React, { useState, useEffect } from 'react';
import SuccessModal from './SuccessModal';

export default function EscuelasWizard() {
    // State
    const [step, setStep] = useState(1);
    const [type, setType] = useState(''); // 'public' | 'private'
    const [budget, setBudget] = useState(0);
    const [students, setStudents] = useState(0);
    const [scholarships, setScholarships] = useState(0);
    const [showScholarshipInput, setShowScholarshipInput] = useState(false);
    const [showModal, setShowModal] = useState(false);

    // Computed & Validation
    const MIN_OP = 4000;
    const internalVal = type === 'private' ? 65 : 50;
    const valueGenerated = students * internalVal;
    const isMinOpMet = students > 0 ? valueGenerated >= MIN_OP : true;

    const totalReal = students * 90;
    const payingStudents = Math.max(0, students - scholarships);
    const parentPay = payingStudents * budget;
    const sponsorPay = totalReal - parentPay;
    const sponsorContribPerStudent = 90 - budget;
    const totalGift = students * sponsorContribPerStudent;

    // Handlers
    const handleTypeSelect = (selectedType) => {
        setType(selectedType);
        setStep(2);
    };

    const handleBudgetSelect = (amount) => {
        setBudget(amount);
    };

    const handleContinueToData = () => {
        if (budget > 0) setStep(3);
    };

    const handleFinish = () => {
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        window.location.reload();
    };

    return (
        <section className="wizard-container" id="wizard">

            {/* PASO 1: IDENTIDAD */}
            <div className={`step ${step === 1 ? 'active' : ''}`} id="step-1">
                <div className="step-header">
                    <h2 className="step-title">Selecciona tu Institución</h2>
                    <p className="step-sub">Elige tu categoría para acceder a los beneficios correspondientes.</p>
                </div>

                <div className="cards-grid">
                    {/* Pública */}
                    <div className="option-card" onClick={() => handleTypeSelect('public')}>
                        <span className="icon-3d">🏫</span>
                        <h3 className="opt-title">Escuela Pública</h3>
                        <div className="chips-stack">
                            <span className="chip chip-green"><i className="fa-solid fa-check"></i> Subsidio Autorizado</span>
                            <span className="chip chip-gold"><i className="fa-solid fa-star"></i> Becas al 100%</span>
                        </div>
                    </div>
                    {/* Privada */}
                    <div className="option-card" onClick={() => handleTypeSelect('private')}>
                        <span className="icon-3d">🏛️</span>
                        <h3 className="opt-title">Colegio Privado</h3>
                        <div className="chips-stack">
                            <span className="chip chip-blue"><i className="fa-solid fa-gem"></i> Precio Preferencial</span>
                            <span className="chip chip-gold"><i className="fa-solid fa-star"></i> Becas al 100%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* PASO 2: EL DINERO (ACUERDO) */}
            <div className={`step ${step === 2 ? 'active' : ''}`} id="step-2">
                <button onClick={() => setStep(1)} className="back-link">← Volver</button>
                <div className="step-header">
                    <h2 className="step-title">Definamos la Cuota de Recuperación</h2>
                    {type === 'public' ? (
                        <p className="step-sub">
                            El costo real es de <strong>$90</strong>. Gracias a nuestros Patrocinadores, la escuela no tiene que pagar eso.
                            <br /><br />
                            Para que el fondo alcance para todos, necesitamos tu honestidad: <br />
                            <strong>¿Cuánto es lo máximo que los padres de familia pueden aportar por alumno?</strong>
                        </p>
                    ) : (
                        <p className="step-sub">
                            El costo real es de <strong>$90</strong>. Gracias a nuestros Patrocinadores, tu colegio accede a un beneficio exclusivo cubriendo solo <strong>$65</strong> por alumno.
                        </p>
                    )}
                </div>

                {/* Botones */}
                <div className="budget-grid">
                    {type === 'public' ? (
                        <>
                            {[50, 40, 30, 20].map(val => (
                                <div
                                    key={val}
                                    className={`budget-btn ${budget === val ? 'selected' : ''}`}
                                    onClick={() => handleBudgetSelect(val)}
                                >
                                    <span className="b-val">${val}</span>
                                </div>
                            ))}
                        </>
                    ) : (
                        <div
                            className={`budget-btn ${budget === 65 ? 'selected' : ''}`}
                            onClick={() => handleBudgetSelect(65)}
                            style={{ gridColumn: 'span 4', maxWidth: '350px', margin: '0 auto' }}
                        >
                            <span className="b-val">$65</span><span className="b-lbl">Tarifa Preferencial</span>
                        </div>
                    )}
                </div>

                {/* Feedback Mensaje */}
                {budget > 0 && (
                    <div className="budget-feedback" style={{ display: 'block' }}>
                        {type === 'public' ? (
                            <>
                                <strong>
                                    {budget === 50 && "¡Gracias!"}
                                    {budget === 40 && "Muy bien."}
                                    {budget === 30 && "Entendido."}
                                    {budget === 20 && "Perfecto."}
                                </strong>
                                <span>
                                    {budget === 20
                                        ? ` Los Patrocinadores harán un esfuerzo mayor poniendo $${90 - budget} por alumno.`
                                        : ` Los Patrocinadores pondrán los $${90 - budget} restantes por alumno.`}
                                </span>
                            </>
                        ) : (
                            <span>Excelente. Estás ahorrando $25 por alumno sobre el precio de lista.</span>
                        )}
                    </div>
                )}

                {budget > 0 && (
                    <div style={{ textAlign: 'center' }}>
                        <button className="btn-start btn-continue" style={{ display: 'inline-block' }} onClick={handleContinueToData}>
                            Continuar a Datos del Grupo
                        </button>
                    </div>
                )}

                {type === 'public' && (
                    <a href="#" className="help-link" onClick={(e) => { e.preventDefault(); alert('Formulario de Apoyo Total'); }}>
                        ¿La situación económica de la escuela es crítica y no pueden aportar nada? <br />
                        <strong>Solicitar Evaluación para Apoyo Total</strong>
                    </a>
                )}
            </div>

            {/* PASO 3: DATOS Y BECA */}
            <div className={`step ${step === 3 ? 'active' : ''}`} id="step-3">
                <button onClick={() => setStep(2)} className="back-link">← Regresar a Cuota</button>
                <div className="step-header">
                    <h2 className="step-title">Datos y Garantía</h2>
                    <p className="step-sub">Ingresa la matrícula para calcular el impacto total del apoyo.</p>
                </div>

                <div className="split-layout">
                    {/* FORMULARIO */}
                    <div style={{ gridColumn: '1 / -1', maxWidth: '800px', margin: '0 auto' }}>
                        <h4 className="section-title">Datos Generales</h4>
                        <div className="input-group">
                            <label className="label">Nombre de la Escuela</label>
                            <input type="text" className="input" placeholder="Nombre Oficial" />
                        </div>
                        <div className="input-group">
                            <label className="label">Nombre del Director</label>
                            <input type="text" className="input" placeholder="Nombre Completo" />
                        </div>
                        <div className="input-group">
                            <label className="label">WhatsApp / Teléfono de Contacto</label>
                            <input type="tel" className="input" placeholder="Para confirmar la orden" />
                        </div>
                        <div className="input-group">
                            <label className="label">Matrícula (Cantidad de niños)</label>
                            <input
                                type="number"
                                className="input"
                                placeholder="0"
                                value={students || ''}
                                onChange={(e) => setStudents(Number(e.target.value))}
                            />
                        </div>

                        {/* IMPACT BOX */}
                        {type === 'public' && students > 0 && (
                            <div className="impact-box" style={{ display: 'block' }}>
                                <div className="ib-title"><i className="fa-solid fa-hand-holding-dollar"></i> Impacto del Apoyo</div>
                                <p className="ib-text">
                                    Al traer a <span>{students}</span> alumnos, la Alianza de Patrocinadores está regalando <span className="ib-money">${totalGift.toLocaleString()}</span> a tu escuela para cubrir la diferencia.
                                </p>
                            </div>
                        )}

                        {/* GARANTÍA */}
                        <div className="black-card">
                            <div className="bc-title"><i className="fa-solid fa-shield-heart" style={{ color: 'var(--gold)' }}></i> Garantía "Ningún Niño en Tierra"</div>
                            <p className="bc-text">
                                Sabemos que, aunque la cuota sea baja (<span>${budget}</span>), siempre hay alumnos que pasan por momentos difíciles.
                                <br /><strong>¿Tienes alumnos que necesiten una Beca del 100% para no quedarse fuera?</strong>
                            </p>

                            <label className="toggle-row">
                                <input
                                    type="checkbox"
                                    checked={showScholarshipInput}
                                    onChange={(e) => {
                                        setShowScholarshipInput(e.target.checked);
                                        if (!e.target.checked) setScholarships(0);
                                    }}
                                    style={{ display: 'none' }}
                                />
                                <div className="toggle-bg"><div className="toggle-knob"></div></div>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'white' }}>Sí, activar Becas ($0 costo)</span>
                            </label>

                            {showScholarshipInput && (
                                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>¿Cuántos alumnos?</label>
                                    <input
                                        type="number"
                                        value={scholarships}
                                        onChange={(e) => setScholarships(Number(e.target.value))}
                                        style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid #64748b', color: 'white', padding: '12px', borderRadius: '12px', width: '100px', fontSize: '1.1rem' }}
                                    />
                                    <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '10px' }}>Listo. Estos alumnos vuelan gratis. El costo lo absorben nuestros patrocinadores.</p>
                                </div>
                            )}
                        </div>

                        {!isMinOpMet && (
                            <div className="alert-min" style={{ display: 'block' }}>
                                ⚠️ <strong>Mínimo Operativo:</strong> Se requieren al menos $4,000 de valor generado para movilizar la unidad.
                            </div>
                        )}

                        <button
                            className="btn-start"
                            onClick={() => setStep(4)}
                            disabled={!isMinOpMet || students <= 0}
                            style={{
                                width: '100%',
                                marginTop: '30px',
                                background: (!isMinOpMet || students <= 0) ? "#cbd5e1" : "var(--primary)",
                                color: 'white',
                                cursor: (!isMinOpMet || students <= 0) ? "not-allowed" : "pointer"
                            }}
                        >
                            Ver Resumen Final
                        </button>
                    </div>
                </div>
            </div>

            {/* PASO 4: CIERRE (TICKET FINAL) */}
            <div className={`step ${step === 4 ? 'active' : ''}`} id="step-4">
                <button onClick={() => setStep(3)} className="back-link">← Editar Datos</button>

                <div className="ticket-container">
                    <div className="ticket-header">
                        <h2 className="th-title">RESUMEN FINAL</h2>
                        <p className="th-sub">Orden de Vuelo Preliminar</p>
                    </div>

                    <div className="line">
                        <span>Costo Real del Evento</span>
                        <span className="strike">${totalReal.toLocaleString()}</span>
                    </div>

                    <div className="line">
                        <span>Pagan los Patrocinadores</span>
                        <span className="highlight-green">-${sponsorPay.toLocaleString()}</span>
                    </div>

                    <div className="total-box">
                        <div className="tb-lbl">Total a Recaudar (Padres)</div>
                        <div className="tb-val">${parentPay.toLocaleString()}</div>
                    </div>

                    <button className="btn-action" onClick={handleFinish}>
                        <i className="fa-solid fa-file-pdf"></i> GENERAR ORDEN DE VUELO (PDF)
                    </button>
                    <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '20px' }}>
                        Te enviaremos este documento para que puedas presentarlo a tu comité de padres y comenzar la recolección.
                    </p>
                </div>
            </div>

            {showModal && <SuccessModal onClose={closeModal} />}

        </section>
    );
}
