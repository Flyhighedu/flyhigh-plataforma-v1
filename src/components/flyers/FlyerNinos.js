"use client";
import React from "react";

/**
 * FlyerNinos — Interior flyer for kids (B/W, letter size)
 * All styles are inline to guarantee html2canvas captures them correctly.
 */
const FlyerNinos = React.forwardRef(function FlyerNinos({ escuela, fecha, monto, valorReal, subsidio }, ref) {
  const pageStyle = {
    width: "8.5in",
    height: "11in",
    minWidth: "8.5in",
    minHeight: "11in",
    flexShrink: 0,
    backgroundColor: "white",
    backgroundImage: "url('/flyers/Gemini-Generated-Image-2c1w2j2c1w2j2c1w.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    WebkitPrintColorAdjust: "exact",
    printColorAdjust: "exact",
    position: "relative",
    boxSizing: "border-box",
    padding: "0.3in",
    display: "flex",
    flexDirection: "column",
    color: "#000000",
    overflow: "hidden",
    filter: "grayscale(100%)",
    fontFamily: "'Open Sans', sans-serif",
  };

  const titleFont = { fontFamily: "'Montserrat', sans-serif" };

  return (
    <div ref={ref} style={pageStyle}>
      {/* Gradient fade */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, width: "100%", height: "2.5in",
        background: "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.95) 40%, rgba(255,255,255,0) 100%)",
        pointerEvents: "none", zIndex: 5,
      }} />

      <div style={{
        backgroundColor: "transparent", height: "100%", width: "100%",
        padding: "0.15in 0.2in 0.4in", display: "flex", flexDirection: "column",
        boxSizing: "border-box", position: "relative", zIndex: 20, paddingTop: "0.05in",
      }}>
        {/* Header */}
        <header style={{ textAlign: "center", marginBottom: "8px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <img
            src="/flyers/1000x200.png"
            alt="Fly High EDU"
            crossOrigin="anonymous"
            style={{
              filter: "grayscale(100%) contrast(2) brightness(0)",
              mixBlendMode: "multiply", maxHeight: "38px", width: "auto",
              objectFit: "contain", marginBottom: "8px",
            }}
          />
          <p style={{
            textTransform: "uppercase", letterSpacing: "0.3em", fontSize: "0.65rem",
            fontWeight: 700, marginBottom: "8px", color: "#1f2937", ...titleFont,
          }}>
            ESCUELA: <span style={{ color: "#000000" }}>{escuela}</span>
          </p>
          <h1 style={{
            fontSize: "3.5rem", fontWeight: 900, textTransform: "uppercase",
            lineHeight: 1.1, letterSpacing: "-0.02em", color: "#000000",
            margin: 0, ...titleFont,
          }}>
            ¡El cielo llega a<br />nuestra escuela!
          </h1>
        </header>

        {/* Main copy */}
        <main style={{ textAlign: "center", marginTop: "8px" }}>
          <h2 style={{
            fontSize: "1.7rem", fontWeight: 900, marginBottom: "12px",
            letterSpacing: "0.05em", textTransform: "uppercase", color: "#000000",
            textShadow: "0px 0px 12px rgba(255,255,255,1), 0px 0px 20px rgba(255,255,255,1)",
            ...titleFont,
          }}>
            ¡PREPÁRATE PARA VOLAR!
          </h2>
          <p style={{
            fontSize: "1.35rem", lineHeight: "1.4", textAlign: "center", marginBottom: 0,
            color: "#000000", fontWeight: 600,
            textShadow: "0px 0px 12px rgba(255,255,255,1), 0px 0px 20px rgba(255,255,255,0.9)",
          }}>
            ¡Tu patio se convertirá en una increíble <strong style={{ fontWeight: 900 }}>pista de despegue</strong>! Usando <strong style={{ fontWeight: 900 }}>gafas de realidad virtual</strong> y <strong style={{ fontWeight: 900 }}>drones</strong>, te llevaremos a volar a ti, a tus compañeros y a tu maestr@ por todo Uruapan en tiempo real, despegando desde tu escuela. ¡Sentirán lo que se siente volar! Además, con tu pase de vuelo <strong style={{ fontWeight: 900 }}>ayudas a que más niños también vivan este sueño</strong>.
          </p>
        </main>

        {/* Ticket card */}
        <div style={{
          position: "absolute", bottom: "0.95in", left: "0.04in",
          backgroundColor: "#ffffff", border: "2px solid #000000",
          padding: "4px", width: "2.4in", zIndex: 20, color: "#000000",
        }}>
          <div style={{
            border: "2px dashed #9ca3af", padding: "12px", textAlign: "left",
            display: "block",
          }}>
            {/* Fecha */}
            <div style={{ marginBottom: "8px" }}>
              <span style={{
                display: "block", fontWeight: 900, fontSize: "0.55rem",
                letterSpacing: "0.1em", textTransform: "uppercase", color: "#4b5563",
                marginBottom: "2px", ...titleFont,
              }}>¡El día del despegue es!</span>
              <span style={{
                fontWeight: 900, fontSize: "0.8rem", display: "block",
                color: "#000000", textTransform: "uppercase",
              }}>{fecha}</span>
              <div style={{ height: "1px", backgroundColor: "#9ca3af", width: "100%", opacity: 0.8, marginTop: "5px" }} />
            </div>

            {/* Escuela */}
            <div style={{ marginBottom: "10px" }}>
              <span style={{
                display: "block", fontWeight: 900, fontSize: "0.55rem",
                letterSpacing: "0.1em", textTransform: "uppercase", color: "#4b5563",
                marginBottom: "2px", ...titleFont,
              }}>Nuestra pista será en:</span>
              <span style={{
                fontWeight: 900, fontSize: "0.75rem", display: "block",
                color: "#000000", lineHeight: 1.2, textTransform: "uppercase",
              }}>ESCUELA: {escuela}</span>
              <div style={{ height: "1px", backgroundColor: "#9ca3af", width: "100%", opacity: 0.8, marginTop: "5px" }} />
            </div>

            {/* Pricing */}
            <div style={{ marginBottom: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
                <span style={{
                  fontWeight: 800, fontSize: "0.45rem", textTransform: "uppercase",
                  letterSpacing: "0.05em", marginRight: "4px", color: "#1f2937", ...titleFont,
                }}>Valor real del vuelo:</span>
                <svg width="48" height="12" viewBox="0 0 48 12" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline-block", verticalAlign: "middle", overflow: "visible", transform: "translateY(1px)" }}>
                  <text x="0" y="11" fill="#000000" fontFamily="'Montserrat', sans-serif" fontWeight="800" fontSize="10.5">{valorReal}</text>
                  <line x1="0" y1="8" x2="44" y2="8" stroke="#000000" strokeWidth="1.5" pointerEvents="none" />
                </svg>
              </div>

              <div style={{ display: "block", marginBottom: "6px" }}>
                <span style={{
                  display: "block", fontWeight: 900, fontSize: "0.6rem",
                  letterSpacing: "0.1em", color: "#000000", marginBottom: "2px", ...titleFont,
                }}>TU PASE DE VUELO</span>
                <div style={{ display: "flex", alignItems: "baseline", lineHeight: 1 }}>
                  <span style={{ color: "#1f2937", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: "6px" }}>Solo</span>
                  <span style={{ fontWeight: 900, fontSize: "2.4rem", color: "#000000", letterSpacing: "-0.02em", lineHeight: 0.8 }}>{monto}</span>
                </div>
              </div>

              {/* Saving tip */}
              <div style={{
                backgroundColor: "#e5e7eb", padding: "6px", borderRadius: "4px",
                border: "1px solid #9ca3af", marginBottom: "12px", marginTop: "8px",
              }}>
                <p style={{
                  fontSize: "0.52rem", lineHeight: 1.3, textAlign: "center",
                  color: "#000000", fontWeight: 900, textTransform: "uppercase", margin: 0,
                }}>
                  TIP: ¡Puedes darle a tu maestr@ $1 o $2 pesitos diarios hasta juntarlo!
                </p>
              </div>

              {/* Heart explanation */}
              <div style={{ display: "block", marginTop: "1px" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", border: "none", margin: 0, padding: 0 }}>
                  <tbody>
                    <tr>
                      <td style={{ width: "14px", verticalAlign: "top", padding: 0, paddingRight: "4px", paddingTop: "1px" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000" style={{ width: "12px", height: "12px" }}>
                          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                        </svg>
                      </td>
                      <td style={{ verticalAlign: "top", padding: 0 }}>
                        <p style={{ fontSize: "0.52rem", lineHeight: 1.3, textAlign: "left", color: "#000000", fontWeight: 600, margin: 0 }}>
                          Con tus <strong style={{ color: "#000000", fontWeight: 900 }}>{monto}</strong> y nuestros aliados (que ponen <strong style={{ color: "#000000", fontWeight: 900 }}>{subsidio}</strong>), <strong style={{ fontWeight: 900 }}>aseguras tu vuelo y ayudas a otros niños</strong>.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Sponsor callout */}
        <div style={{
          position: "absolute", bottom: "0.95in", left: "2.5in", right: "0.4in",
          textAlign: "center", zIndex: 20, display: "flex", flexDirection: "column", justifyContent: "flex-end",
          textShadow: "0px 0px 12px rgba(255,255,255,1), 0px 0px 20px rgba(255,255,255,0.9)",
        }}>
          <p style={{ fontWeight: 900, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#000000", marginBottom: "4px", ...titleFont }}>
            ¡Gracias a estas empresas e instituciones, podrás conocer el cielo!
          </p>
          <p style={{ fontWeight: 800, fontSize: "0.45rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#1f2937", ...titleFont }}>
            ESTE SUEÑO ES POSIBLE GRACIAS A:
          </p>
        </div>
      </div>

      {/* Sponsor logos */}
      <SponsorLogos />
    </div>
  );
});

/** Shared sponsor logos footer used by both print flyers */
export function SponsorLogos() {
  const sponsorStyle = {
    filter: "grayscale(100%) contrast(1.6) brightness(0.4)",
    mixBlendMode: "multiply", maxHeight: "58px", maxWidth: "13%",
    width: "auto", objectFit: "contain",
  };
  const allyLogoStyle = {
    filter: "grayscale(100%) contrast(1.6) brightness(0.4)",
    mixBlendMode: "multiply", maxHeight: "32px", width: "auto", objectFit: "contain",
  };
  const allyLabelStyle = {
    fontSize: "0.4rem", fontWeight: 800, textTransform: "uppercase",
    color: "#000000", lineHeight: 1.1, letterSpacing: "0.05em", textAlign: "left",
  };

  return (
    <div style={{
      position: "absolute", bottom: "0.3in", left: 0, width: "100%",
      padding: "0 0.4in", display: "flex", flexDirection: "column",
      alignItems: "center", gap: "0.2rem", zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <img src="/flyers/Logo-Madobox.png" alt="Madobox" crossOrigin="anonymous" style={sponsorStyle} />
        <img src="/flyers/Logo-La-Bonanza-Avocados-pdf.png" alt="La Bonanza" crossOrigin="anonymous" style={sponsorStyle} />
        <img src="/flyers/Logo-Global-Frut-png.png" alt="Global Frut" crossOrigin="anonymous" style={sponsorStyle} />
        <img src="/flyers/Diseno-sin-tituloww.png" alt="Patrocinador" crossOrigin="anonymous" style={sponsorStyle} />
        <img src="/flyers/51d89e34-3d94-448c-9b34-16abb3360127.png" alt="Aztecavo" crossOrigin="anonymous" style={{ ...sponsorStyle, maxHeight: "42px" }} />
        <img src="/flyers/logo-Strong-plastic-pdf.png" alt="Strong Plastic" crossOrigin="anonymous" style={sponsorStyle} />
        <img src="/flyers/logo-RV-Fresh.png" alt="RV Fresh" crossOrigin="anonymous" style={sponsorStyle} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "0 0.2in" }}>
        {[
          { src: "/flyers/logo-parque.png", label: "Parque\nNacional" },
          { src: "/flyers/logo-secretaria-cultura-y-turismo.png", label: "Secretaría\nde Cultura" },
          { src: "/flyers/logo-huatapera.png", label: "Museo de la\nHuatapera" },
          { src: "/flyers/logo-ccfdsp.png", label: "Fábrica de\nSan Pedro" },
        ].map((ally, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <img src={ally.src} alt={ally.label} crossOrigin="anonymous" style={allyLogoStyle} />
            <span style={allyLabelStyle}>{ally.label.split('\n').map((line, j) => <React.Fragment key={j}>{line}{j === 0 && <br />}</React.Fragment>)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FlyerNinos;
