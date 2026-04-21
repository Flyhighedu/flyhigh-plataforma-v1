"use client";
import React from "react";
import { SponsorLogos } from "./FlyerNinos";

/**
 * FlyerPadres — Exterior flyer for parents (B/W, letter size, with QR)
 * All styles inline for html2canvas compatibility.
 */
const FlyerPadres = React.forwardRef(function FlyerPadres({ escuela, fecha, monto, valorReal, subsidio }, ref) {
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
    fontFamily: "'Open Sans', sans-serif",
  };

  const titleFont = { fontFamily: "'Montserrat', sans-serif" };

  return (
    <div ref={ref} style={pageStyle}>
      {/* Gradient fade */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, width: "100%", height: "2.2in",
        background: "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.95) 30%, rgba(255,255,255,0) 100%)",
        pointerEvents: "none", zIndex: 5,
      }} />

      <div style={{
        backgroundColor: "transparent", height: "100%", width: "100%",
        padding: "0.15in 0.6in 0.4in", display: "flex", flexDirection: "column",
        boxSizing: "border-box", position: "relative", zIndex: 20, paddingTop: "0.05in",
      }}>
        {/* Header */}
        <header style={{ textAlign: "center", marginBottom: "16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
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
            fontWeight: 700, marginBottom: "8px", color: "#374151", ...titleFont,
          }}>
            ESCUELA: <span>{escuela}</span>
          </p>
          <h1 style={{
            fontSize: "3.5rem", fontWeight: 900, textTransform: "uppercase",
            lineHeight: 1.1, letterSpacing: "-0.02em", color: "#000000",
            margin: 0, ...titleFont,
          }}>
            ¡El cielo llega a<br />nuestra escuela!
          </h1>
        </header>

        {/* Main copy for parents */}
        <main style={{ textAlign: "center", padding: "0 16px" }}>
          <h2 style={{
            fontSize: "1.5rem", fontWeight: 800, marginBottom: "12px",
            letterSpacing: "0.05em", textTransform: "uppercase", color: "#000000", ...titleFont,
          }}>
            ¡Estimados padres de familia!
          </h2>
          <p style={{
            fontSize: "1.15rem", lineHeight: 1.6, textAlign: "justify",
            marginBottom: 0, color: "#111827",
          }}>
            <strong>Volar es el sueño</strong> más grande de la infancia. Hoy, a nuestra escuela{" "}
            <strong>{escuela}</strong>{" "}
            le enorgullece ser sede de la campaña <strong>Fly High EDU 2026-2027</strong>, donde nuestros niños harán realidad este anhelo. Gracias a la tecnología, convertiremos nuestro patio en una verdadera <strong>pista de despegue</strong>. A través de drones y <strong>gafas de realidad virtual</strong>, los llevaremos a <strong>volar sobre Uruapan</strong> en tiempo real, viviendo la increíble experiencia de surcar el cielo.
          </p>
        </main>

        {/* Ticket card with QR */}
        <div style={{
          position: "absolute", bottom: "1in", left: "0.04in",
          backgroundColor: "#ffffff", border: "1px solid #d1d5db",
          padding: "4px", width: "2.25in", zIndex: 20, color: "#000000",
        }}>
          <div style={{
            border: "1px dashed #9ca3af", padding: "8px", textAlign: "left",
            display: "block",
          }}>
            {/* Fecha */}
            <div style={{ marginBottom: "4px" }}>
              <span style={{
                display: "block", fontWeight: 800, fontSize: "0.45rem",
                letterSpacing: "0.1em", color: "#6b7280", marginBottom: "2px", ...titleFont,
              }}>FECHA DEL EVENTO</span>
              <span style={{ fontWeight: 700, fontSize: "0.7rem", display: "block", color: "#000000" }}>
                {fecha}
              </span>
              <div style={{ height: "1px", backgroundColor: "#d1d5db", width: "100%", opacity: 0.7, marginTop: "4px" }} />
            </div>

            {/* Lugar */}
            <div style={{ marginBottom: "4px" }}>
              <span style={{
                display: "block", fontWeight: 800, fontSize: "0.45rem",
                letterSpacing: "0.1em", color: "#6b7280", marginBottom: "2px", ...titleFont,
              }}>LUGAR</span>
              <span style={{
                fontWeight: 700, fontSize: "0.65rem", display: "block",
                color: "#000000", lineHeight: 1.2, textTransform: "uppercase",
              }}>ESCUELA: {escuela}</span>
              <div style={{ height: "1px", backgroundColor: "#d1d5db", width: "100%", opacity: 0.7, marginTop: "4px" }} />
            </div>

            {/* Pricing */}
            <div style={{ marginBottom: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
                <span style={{
                  fontWeight: 800, fontSize: "0.42rem", textTransform: "uppercase",
                  letterSpacing: "0.05em", marginRight: "4px", color: "#374151", ...titleFont,
                }}>Valor real de la experiencia:</span>
                <svg width="48" height="12" viewBox="0 0 48 12" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline-block", verticalAlign: "middle", overflow: "visible", transform: "translateY(1px)" }}>
                  <text x="0" y="11" fill="#1f2937" fontFamily="'Montserrat', sans-serif" fontWeight="800" fontSize="10.5">{valorReal}</text>
                  <line x1="0" y1="8" x2="44" y2="8" stroke="#1f2937" strokeWidth="1.2" pointerEvents="none" />
                </svg>
              </div>

              <div style={{ display: "block", marginBottom: "8px" }}>
                <span style={{
                  display: "block", fontWeight: 800, fontSize: "0.55rem",
                  letterSpacing: "0.1em", color: "#000000", marginBottom: "2px", ...titleFont,
                }}>APOYO PARA LA CAMPAÑA</span>
                <div style={{ display: "flex", alignItems: "baseline", lineHeight: 1 }}>
                  <span style={{ color: "#374151", fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: "4px" }}>Solo</span>
                  <span style={{ fontWeight: 900, fontSize: "2.1rem", color: "#000000", letterSpacing: "-0.02em", lineHeight: 0.8 }}>{monto}</span>
                </div>
              </div>

              {/* Explanation */}
              <div style={{ display: "block", marginTop: "1px" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", border: "none", margin: 0, padding: 0 }}>
                  <tbody>
                    <tr>
                      <td style={{ width: "12px", verticalAlign: "top", padding: 0, paddingRight: "4px", paddingTop: "1px" }}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1f2937" style={{ width: "10px", height: "10px" }}>
                          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                        </svg>
                      </td>
                      <td style={{ verticalAlign: "top", padding: 0 }}>
                        <p style={{ fontSize: "0.52rem", lineHeight: 1.3, textAlign: "left", color: "#1f2937", margin: 0 }}>
                          Gracias a <strong>nuestros patrocinadores</strong>, la aportación es de solo{" "}
                          <strong style={{ color: "#000000" }}>{monto}</strong>. Ellos cubren los otros{" "}
                          <strong style={{ color: "#000000" }}>{subsidio}</strong> de cada niño.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p style={{ fontSize: "0.45rem", lineHeight: 1.3, textAlign: "left", color: "#6b7280", fontStyle: "italic", margin: 0, marginTop: "5px" }}>
                  * Este monto es exclusivo para llevar la campaña a más escuelas. La institución no retiene ningún porcentaje.
                </p>
              </div>
            </div>

            {/* QR Code */}
            <div style={{ marginTop: "5px", paddingTop: "5px", borderTop: "1px dashed #d1d5db" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", border: "none", margin: 0, padding: 0 }}>
                <tbody>
                  <tr>
                    <td style={{ width: "58px", verticalAlign: "middle", padding: 0 }}>
                      <div style={{
                        backgroundColor: "#ffffff", border: "1px solid #d1d5db",
                        padding: "2px", borderRadius: "2px",
                        width: "56px", height: "56px",
                      }}>
                        <img
                          src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://flyhighedu.com.mx/"
                          alt="QR"
                          crossOrigin="anonymous"
                          style={{ width: "100%", height: "auto", mixBlendMode: "multiply", opacity: 0.9 }}
                        />
                      </div>
                    </td>
                    <td style={{ verticalAlign: "middle", padding: 0, paddingLeft: "8px" }}>
                      <span style={{
                        display: "block", fontWeight: 800, fontSize: "0.48rem",
                        letterSpacing: "0.1em", textTransform: "uppercase", color: "#000000",
                        marginBottom: "2px", lineHeight: 1, ...titleFont,
                      }}>¡Escanea aquí!</span>
                      <span style={{ display: "block", fontSize: "0.42rem", color: "#6b7280", lineHeight: 1.4 }}>
                        Para conocer más detalles<br />sobre la experiencia.
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sponsor callout */}
        <div style={{
          position: "absolute", bottom: "0.95in", left: "2.4in", right: "0.4in",
          textAlign: "center", zIndex: 20, display: "flex", flexDirection: "column", justifyContent: "flex-end",
          textShadow: "0px 0px 12px rgba(255,255,255,1), 0px 0px 20px rgba(255,255,255,0.9)",
        }}>
          <p style={{ fontWeight: 700, fontSize: "0.55rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#111827", marginBottom: "2px", ...titleFont }}>
            La educación es el universo que construimos juntos
          </p>
          <p style={{ fontWeight: 800, fontSize: "0.45rem", textTransform: "uppercase", letterSpacing: "0.15em", color: "#374151", ...titleFont }}>
            Esta campaña es posible gracias a:
          </p>
        </div>
      </div>

      {/* Sponsor logos (shared component) */}
      <SponsorLogos />
    </div>
  );
});

export default FlyerPadres;
