"use client";
import React from "react";

/**
 * CircularDigital — Digital flyer for WhatsApp (color, 9:19.5 ratio)
 * All Lucide icons replaced with inline SVGs for html2canvas compatibility.
 * All styles inline for capture reliability.
 */
const CircularDigital = React.forwardRef(function CircularDigital({ escuela, fecha, monto, valorReal, subsidio }, ref) {
  const containerStyle = {
    width: "450px",
    height: "975px",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Poppins', sans-serif",
    WebkitFontSmoothing: "antialiased",
    color: "#1f2937",
  };

  // Inline SVG icon components
  const HeartIcon = ({ size = 14, fill = "#f59e0b" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="none">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  );

  const NavigationIcon = ({ size = 24, color = "#f59e0b" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  );

  const HeadphonesIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    </svg>
  );

  const BookIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0c4a6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );

  const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

  const PiggyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2" /><path d="M2 9v1c0 1.1.9 2 2 2h1" /><path d="M16 11h0" />
    </svg>
  );

  const ShieldIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
    </svg>
  );

  const sponsorImgs = [
    { src: "https://i.postimg.cc/0yrB0sTX/Logo-Global-Frut-png.png", alt: "Global Frut" },
    { src: "https://i.postimg.cc/8zs0mS29/Logo-La-Bonanza-Avocados-pdf.png", alt: "La Bonanza" },
    { src: "https://i.postimg.cc/DwmMPT99/Logo-Madobox.png", alt: "Madobox" },
    { src: "https://i.postimg.cc/rwzPNT6X/logo-RV-Fresh.png", alt: "RV Fresh" },
    { src: "https://i.postimg.cc/Gm95xCWf/logo-Strong-plastic-pdf.png", alt: "Strong Plastic" },
    { src: "https://i.postimg.cc/kXjJfW4x/Diseno-sin-tituloww.png", alt: "Círculo" },
    { src: "https://i.postimg.cc/QtpNbP97/51d89e34-3d94-448c-9b34-16abb3360127.png", alt: "Aztecavo" },
  ];

  const allyImgs = [
    { src: "https://i.postimg.cc/xdLSDm0y/logo-ccfdsp.png", label: "Fábrica de San Pedro" },
    { src: "https://i.postimg.cc/vm5dFnQ3/logo-huatapera.png", label: "Huatapera" },
    { src: "https://i.postimg.cc/25nfRWzG/logo-parque.png", label: "Parque Nacional" },
    { src: "https://i.postimg.cc/Pq1ksDtQ/logo-secretaria-cultura-y-turismo.png", label: "Secretaría de Cultura" },
  ];

  return (
    <div ref={ref} style={containerStyle}>
      {/* Cover image */}
      <img
        src="https://i.postimg.cc/L6g2DV4v/El-cielo-llega-a-nuestra-escuela.png"
        alt="Portada"
        crossOrigin="anonymous"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "auto", zIndex: 0, pointerEvents: "none" }}
      />

      {/* Top spacer */}
      <header style={{ position: "relative", width: "100%", height: "340px", flexShrink: 0, zIndex: 10 }} />

      {/* Main body */}
      <main style={{ flex: 1, padding: "4px 24px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", zIndex: 10 }}>

        {/* Welcome */}
        <div style={{ padding: "0 8px", textAlign: "center" }}>
          <p style={{ fontWeight: 900, color: "#0c4a6e", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 6px" }}>
            A los padres de familia de la escuela {escuela}:
          </p>
          <div style={{ fontSize: "10px", color: "#1f2937", lineHeight: 1.5, textAlign: "center", maxWidth: "90%", margin: "0 auto" }}>
            Volar es uno de los sueños más grandes que compartimos cuando fuimos niños. Hoy nos enorgullece que la escuela{" "}
            <strong style={{ color: "#0c4a6e", fontWeight: 700 }}>{escuela}</strong>{" "}
            sea sede de la campaña <strong style={{ color: "#0c4a6e", fontWeight: 800 }}>Fly High EDU</strong> para que sus hijos lo hagan realidad:{" "}
            <span style={{ color: "#0284c7", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.03em" }}>descubrir su ciudad desde las alturas.</span>
          </div>
        </div>

        {/* Experience block */}
        <div style={{
          margin: "0 -24px", padding: "12px 32px", backgroundColor: "#0ea5e9",
          display: "flex", flexDirection: "column", gap: "12px", position: "relative", overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <NavigationIcon />
              <h3 style={{ fontSize: "12px", fontWeight: 900, letterSpacing: "0.1em", color: "#ffffff", textTransform: "uppercase", margin: 0 }}>La Experiencia</h3>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#ffffff" }}>
              <span style={{ fontSize: "8px", fontWeight: 900, textTransform: "uppercase" }}>6 Minutos</span>
              <div style={{ height: "8px", width: "1px", backgroundColor: "rgba(255,255,255,0.3)" }} />
              <span style={{ fontSize: "8px", fontWeight: 900, textTransform: "uppercase" }}>5 km Recorrido</span>
            </div>
          </div>

          <div style={{ fontSize: "9.5px", color: "#ffffff", lineHeight: 1.6, textAlign: "justify", fontWeight: 500 }}>
            Convertiremos nuestro patio escolar en una <strong style={{ fontWeight: 900 }}>pista de despegue</strong>. A través de un dron que se elevará desde nuestra escuela y{" "}
            <strong style={{ fontWeight: 900, textDecoration: "underline" }}>gafas de última generación</strong>, llevaremos a nuestros niños a volar hacia las nubes para redescubrir{" "}
            <strong style={{ fontWeight: 900, color: "#e0f2fe", textTransform: "uppercase" }}>Uruapan</strong>{" "}
            <strong style={{ fontWeight: 900, textTransform: "uppercase" }}>totalmente en vivo</strong>, como si fueran ellos mismos los que estuvieran surcando el cielo.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ backgroundColor: "#0c4a6e", padding: "6px", borderRadius: "50%", flexShrink: 0 }}><HeadphonesIcon /></div>
              <div style={{ fontSize: "8.5px", color: "#ffffff", lineHeight: 1.3 }}>
                <strong style={{ fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "2px" }}>Relator Maestro en Vivo</strong>
                Un guía pedagógico narra cada punto de interés, transformando el asombro en aprendizaje directo por sus audífonos.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div style={{ backgroundColor: "#f59e0b", padding: "6px", borderRadius: "50%", flexShrink: 0 }}><BookIcon /></div>
              <div style={{ fontSize: "8.5px", color: "#ffffff", lineHeight: 1.3 }}>
                <strong style={{ fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "2px" }}>Aprendizaje al aterrizar</strong>
                Al bajar, la aventura sigue con talleres educativos dirigidos por personal del <strong>Parque Nacional</strong> y <strong>Cultura</strong>.
              </div>
            </div>
          </div>
        </div>

        {/* Institutional logos */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "0 8px", marginTop: "6px", height: "44px" }}>
          {allyImgs.map((a, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
              <img src={a.src} alt={a.label} crossOrigin="anonymous" style={{ height: "28px", width: "auto", objectFit: "contain", mixBlendMode: "multiply", opacity: 0.8 }} />
              <span style={{ fontSize: "4.5px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af", textAlign: "center", lineHeight: 1 }}>{a.label}</span>
            </div>
          ))}
        </div>

        {/* Heart of the campaign */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "2px", padding: "0 4px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "4px" }}>
            <HeartIcon />
            <span style={{ fontSize: "10px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", color: "#0c4a6e" }}>El Corazón de Fly High EDU</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Price card */}
            <div style={{
              width: "38%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(to bottom, #f0f9ff, transparent)", border: "1px solid #e0f2fe",
              borderRadius: "1.2rem", padding: "6px 4px", flexShrink: 0,
            }}>
              <span style={{ fontSize: "4.5px", color: "#6b7280", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.1em" }}>
                Costo Real por niño: <span style={{ textDecoration: "line-through" }}>{valorReal.replace('$', '')} Pesos</span>
              </span>
              <div style={{ marginTop: "6px", marginBottom: "4px", display: "flex", flexDirection: "column", alignItems: "center", width: "100%", padding: "0 4px" }}>
                <span style={{ fontSize: "6px", color: "#0c4a6e", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>Tu Aportación</span>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "2px", width: "100%" }}>
                  <span style={{ fontSize: "8px", fontWeight: 900, color: "#0284c7", textTransform: "uppercase" }}>Solo</span>
                  <span style={{ fontSize: "20px", fontWeight: 900, color: "#0c4a6e", lineHeight: 1 }}>{monto}</span>
                </div>
              </div>
              <span style={{
                fontSize: "4.5px", backgroundColor: "#0c4a6e", color: "#ffffff",
                padding: "2px 8px", borderRadius: "9999px", fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.1em", width: "85%", textAlign: "center",
              }}>Gracias Patrocinadores</span>
            </div>

            {/* Narrative */}
            <div style={{ width: "62%", display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px", paddingRight: "4px" }}>
              <p style={{ fontSize: "8px", color: "#1f2937", lineHeight: 1.3, textAlign: "justify", margin: 0 }}>
                <strong style={{ color: "#0c4a6e", fontWeight: 900 }}>7 empresas comprometidas</strong> con los sueños de la niñez en Uruapan financian la mayor parte de este proyecto.
              </p>
              <p style={{ fontSize: "8px", color: "#1f2937", lineHeight: 1.3, textAlign: "justify", margin: 0 }}>
                Así como otros padres aportaron para tu hijo, hoy tus{" "}
                <strong style={{ color: "#0284c7", fontWeight: 700, fontSize: "9px" }}>{monto} pesos</strong>{" "}
                regresan el favor para que niños de otras escuelas también puedan volar.
              </p>
            </div>
          </div>

          {/* Info panel */}
          <div style={{ display: "flex", flexDirection: "column", borderRadius: "12px", border: "1px solid #f3f4f6", marginTop: "2px", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", backgroundColor: "rgba(249,250,251,0.7)", padding: "10px" }}>
              <div style={{ width: "40%", display: "flex", flexDirection: "column", justifyContent: "center", borderRight: "1px solid #e5e7eb", paddingRight: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <CalendarIcon />
                  <span style={{ fontSize: "8px", fontWeight: 700, color: "#1f2937" }}>{fecha}</span>
                </div>
              </div>
              <div style={{ width: "60%", display: "flex", alignItems: "flex-start", gap: "6px", paddingLeft: "4px" }}>
                <PiggyIcon />
                <p style={{ fontSize: "7.5px", color: "#1f2937", lineHeight: 1.3, fontWeight: 500, margin: 0 }}>
                  Cada niño puede aportar <strong style={{ color: "#0c4a6e", fontWeight: 900, fontSize: "8px", textDecoration: "underline" }}>incluso $1 peso</strong> diario con su maestro.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", backgroundColor: "#0284c7", padding: "6px 10px" }}>
              <ShieldIcon />
              <p style={{ fontSize: "6.5px", color: "rgba(255,255,255,0.95)", lineHeight: 1.2, margin: 0 }}>
                <strong style={{ fontWeight: 900, color: "#ffffff", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "7px" }}>Transparencia Total:</strong>{" "}
                La escuela <strong>{escuela}</strong> y sus maestros no retienen ningún ingreso. El 100% de la aportación financia directamente la campaña.
              </p>
            </div>
          </div>

          {/* Sponsor row */}
          <div style={{ width: "calc(100% + 2rem)", margin: "0 -16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", marginBottom: "48px", padding: "0 8px", height: "55px" }}>
            {sponsorImgs.map((s, i) => (
              <img key={i} src={s.src} alt={s.alt} crossOrigin="anonymous" style={{ height: "80%", width: "auto", maxWidth: "13%", objectFit: "contain", mixBlendMode: "multiply" }} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e5e7eb", paddingTop: "8px", paddingBottom: "20px", padding: "8px 8px 20px", marginTop: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", opacity: 0.8 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14,2 14,8 20,8" /><path d="M9 15l2 2 4-4" />
            </svg>
            <span style={{ fontSize: "7px", fontWeight: 900, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.1em" }}>Operación Certificada</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", opacity: 0.8 }}>
            <span style={{ fontSize: "7.5px", fontWeight: 900, color: "#0c4a6e", textTransform: "uppercase", letterSpacing: "0.1em" }}>Fly High EDU © 2026</span>
            <span style={{ fontSize: "5px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, textAlign: "right" }}>Programa Educativo</span>
          </div>
        </div>
      </main>
    </div>
  );
});

export default CircularDigital;
