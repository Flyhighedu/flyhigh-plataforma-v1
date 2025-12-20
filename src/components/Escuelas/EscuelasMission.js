"use client";
import React from 'react';

export default function EscuelasMission() {
    return (
        <section className="mission-card" id="missionCard">
            <span className="mission-badge">FILOSOFÍA FLY HIGH</span>
            <h2 className="mission-title">Ningún Niño en Tierra</h2>
            <p className="mission-text">
                Creemos que el cielo es de todos. Gracias al compromiso de nuestras <strong>Empresas Socialmente Responsables</strong>, el factor económico deja de ser una barrera. Ellos subsidian la experiencia para todos y <strong>becan al 100%</strong> a los alumnos vulnerables.
            </p>

            <div className="logos-wrapper">
                {[
                    { logo: "/img/strong plastic.png", name: "Strong Plastic" },
                    { logo: "/img/bonanza.png", name: "La Bonanza" }
                ].map((sponsor, index) => (
                    <div className="logo-item" key={index}>
                        <img
                            src={sponsor.logo}
                            alt={sponsor.name}
                            className="logo-image"
                        />
                        <span className="logo-label">{sponsor.name}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}
