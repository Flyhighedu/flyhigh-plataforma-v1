"use client";
import React from "react";

/**
 * CertificadoEscuela — Official school accreditation certificate (Letter size, portrait)
 * All styles inline for capture reliability with html-to-image.
 * 
 * Editable fields: escuela (school name), fecha (date string)
 * All other content is static.
 */

export const CERTIFICADO_DEFAULTS = {
  cuerpoTexto:
    "Por su invaluable visión al integrarse como Escuela Impulsora del Sueño de Volar. Su compromiso con la innovación educativa ha permitido que más estudiantes descubran nuevas formas de aprender, imaginar y conectar con su entorno desde el cielo durante la actividad realizada en sus instalaciones.",
  firmaNombre: "David Sanchez",
  firmaCargo: "Director",
};

const CertificadoEscuela = React.forwardRef(function CertificadoEscuela(
  { escuela = "[Nombre de la Escuela]", fecha = "Abril de 2026", texts = {} },
  ref
) {
  const t = { ...CERTIFICADO_DEFAULTS, ...texts };

  // Sponsor logos (bottom — rendered in white via filter)
  const sponsorLogos = [
    { src: "/flyers/Diseno-sin-tituloww.png", alt: "Círculo", h: 62 },
    { src: "/flyers/51d89e34-3d94-448c-9b34-16abb3360127.png", alt: "Aztecavo", h: 48 },
    { src: "/flyers/logo-RV-Fresh.png", alt: "RV Fresh", h: 62 },
    { src: "/flyers/logo-Strong-plastic-pdf.png", alt: "Strong Plastic", h: 66, maxW: 145 },
    { src: "/flyers/Logo-Madobox.png", alt: "Madobox", h: 62 },
    { src: "/flyers/Logo-La-Bonanza-Avocados-pdf.png", alt: "La Bonanza", h: 62 },
    { src: "/flyers/Logo-Global-Frut-png.png", alt: "Global Frut", h: 62 },
  ];

  // Ally logos (in content area)
  const allyLogos = [
    { src: "/flyers/logo-ccfdsp.png", alt: "CCFDSP", label: "CCFDSP" },
    { src: "/flyers/logo-huatapera.png", alt: "La Huatapera", label: "Huatapera" },
    { src: "/flyers/logo-parque.png", alt: "Parque Nacional", label: "Parque Nac." },
    { src: "/flyers/logo-secretaria-cultura-y-turismo.png", alt: "Secretaría de Cultura", label: "Secretaría\nde Cultura" },
  ];

  return (
    <div
      ref={ref}
      style={{
        width: 816,
        height: 1056,
        backgroundImage: "url(/flyers/certificado-bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#ffffff",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      {/* ── Content area (right 58%) ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: "58%",
          height: "100%",
          padding: "45px 50px 190px 20px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          textAlign: "center",
          color: "#1a2c42",
        }}
      >
        {/* Header Logo */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 15,
            marginBottom: 35,
          }}
        >
          <img
            src="/flyers/1000x200.png"
            alt="Logo Fly High Edu"
            style={{
              height: 45,
              width: "auto",
              maxWidth: 260,
              objectFit: "contain",
              filter:
                "brightness(0) saturate(100%) invert(14%) sepia(45%) saturate(1212%) hue-rotate(176deg) brightness(97%) contrast(93%)",
            }}
          />
        </div>

        {/* Titles */}
        <div>
          <p
            style={{
              fontSize: "1rem",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 5,
              color: "#555",
              margin: "0 0 5px 0",
            }}
          >
            Otorga la presente
          </p>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "2.2rem",
              fontWeight: 700,
              color: "#1a2c42",
              margin: "0 0 15px 0",
              lineHeight: 1.1,
            }}
          >
            ACREDITACIÓN
            <br />
            OFICIAL
          </h1>
          <div
            style={{
              width: 60,
              height: 3,
              backgroundColor: "#c59b6d",
              margin: "0 auto 20px auto",
            }}
          />
        </div>

        {/* School Name */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <p
            style={{
              fontSize: "1.1rem",
              marginBottom: 15,
              color: "#444",
              margin: "0 0 15px 0",
            }}
          >
            A la institución educativa:
          </p>
          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "2rem",
              fontStyle: "italic",
              color: "#1a2c42",
              margin: "0 0 30px 0",
              padding: "0 20px 5px 20px",
              borderBottom: "1px solid rgba(26, 44, 66, 0.2)",
              width: "90%",
            }}
          >
            {escuela}
          </h2>
        </div>

        {/* Body text */}
        <p
          style={{
            fontSize: "1rem",
            lineHeight: 1.6,
            textAlign: "justify",
            textAlignLast: "center",
            color: "#333333",
            marginBottom: 30,
            padding: "0 10px",
            margin: "0 0 30px 0",
          }}
        >
          {t.cuerpoTexto}
        </p>

        {/* Footer */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "auto",
          }}
        >
          {/* Date */}
          <p
            style={{
              fontSize: "0.95rem",
              fontStyle: "italic",
              color: "#666",
              marginBottom: 25,
              margin: "0 0 25px 0",
            }}
          >
            Uruapan, Michoacán. {fecha}.
          </p>

          {/* Signature */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: 15,
            }}
          >
            <div
              style={{
                width: 220,
                borderBottom: "1px solid #1a2c42",
                marginBottom: 8,
              }}
            />
            <p style={{ fontWeight: 600, fontSize: "1.1rem", margin: 0 }}>
              {t.firmaNombre}
            </p>
            <p style={{ fontSize: "0.9rem", color: "#666", margin: 0 }}>
              {t.firmaCargo}
            </p>
          </div>

          {/* Ally logos */}
          <div style={{ width: "100%", marginTop: 15 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "flex-start",
                gap: 35,
                width: "100%",
              }}
            >
              {allyLogos.map((logo, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <img
                    src={logo.src}
                    alt={logo.alt}
                    style={{
                      height: 48,
                      width: "auto",
                      maxWidth: 95,
                      objectFit: "contain",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.55rem",
                      color: "#888",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      textAlign: "center",
                      fontWeight: 600,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {logo.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Sponsor footer (absolute, full width, white logos) ── */}
      <div
        style={{
          position: "absolute",
          bottom: 30,
          left: "50%",
          transform: "translateX(-50%)",
          width: "92%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: "100%",
            height: 1,
            backgroundColor: "rgba(255, 255, 255, 0.4)",
            marginBottom: 20,
            position: "relative",
            top: 12,
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            gap: 15,
          }}
        >
          {sponsorLogos.map((logo, i) => (
            <img
              key={i}
              src={logo.src}
              alt={logo.alt}
              style={{
                height: logo.h || 62,
                width: "auto",
                maxWidth: logo.maxW || 125,
                objectFit: "contain",
                filter: "brightness(0) invert(1)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export default CertificadoEscuela;
