"use client";
import React, { useRef, useState, useCallback } from "react";
import FlyerNinos from "./FlyerNinos";
import FlyerPadres from "./FlyerPadres";
import CircularDigital from "./CircularDigital";
import { formatFlyerDate, formatMoney, captureAsPDF, captureAsPNG, downloadAll } from "@/utils/flyerUtils";

/**
 * FlyerDownloadModal — Full-screen modal that renders flyer previews
 * and provides download buttons for PDF/PNG.
 * 
 * Flyers render off-screen at full size for html2canvas capture,
 * and scaled-down for visual preview.
 */
export default function FlyerDownloadModal({ schoolData, onClose }) {
  const ninosRef = useRef(null);
  const padresRef = useRef(null);
  const digitalRef = useRef(null);

  const [downloading, setDownloading] = useState({
    ninos: false,
    padres: false,
    digital: false,
    all: false,
  });

  // Derive flyer variables from SSoT data
  const escuela = (schoolData.nombre_escuela || "ESCUELA").toUpperCase();
  const fecha = formatFlyerDate(schoolData.fecha_programada);
  const tarifaBase = parseFloat(schoolData.tarifa_base) || 100;
  const cuotaAlumno = parseFloat(schoolData.cuota_alumno) || 50;
  const monto = formatMoney(cuotaAlumno);
  const valorReal = formatMoney(tarifaBase);
  const subsidio = formatMoney(tarifaBase - cuotaAlumno);

  const flyerProps = { escuela, fecha, monto, valorReal, subsidio };

  const handleDownload = useCallback(async (type) => {
    setDownloading(prev => ({ ...prev, [type]: true }));
    const safeName = escuela.replace(/\s+/g, "_");

    try {
      switch (type) {
        case "ninos":
          await captureAsPDF(ninosRef.current, `Flyer imprimible para salones - ${escuela}.pdf`);
          break;
        case "padres":
          await captureAsPDF(padresRef.current, `Flyer imprimible para exterior - ${escuela}.pdf`);
          break;
        case "digital":
          await captureAsPNG(
            digitalRef.current,
            `Circular digital para padres de familia - ${escuela}.png`
          );
          break;
        case "all":
          await downloadAll(ninosRef, padresRef, digitalRef, escuela);
          break;
      }
    } catch (err) {
      console.error(`Error downloading ${type}:`, err);
      alert(`Error al generar documento: ${err.message || err}\n\nRevisa la consola (F12) para más detalles.`);
    } finally {
      setDownloading(prev => ({ ...prev, [type]: false }));
    }
  }, [escuela]);

  const isAnyDownloading = Object.values(downloading).some(Boolean);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      backgroundColor: "rgba(0,0,0,0.85)",
      display: "flex", flexDirection: "column", alignItems: "center",
      overflow: "auto", padding: "20px",
      backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
    }}>
      {/* Google Fonts for flyer rendering */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&family=Open+Sans:wght@400;600;700&family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" crossOrigin="anonymous" />

      {/* Close button */}
      <button
        onClick={onClose}
        disabled={isAnyDownloading}
        style={{
          position: "fixed", top: "16px", right: "16px", zIndex: 100000,
          width: "44px", height: "44px", borderRadius: "50%",
          backgroundColor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)",
          color: "#ffffff", fontSize: "20px", fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: isAnyDownloading ? "not-allowed" : "pointer",
          opacity: isAnyDownloading ? 0.4 : 1,
          transition: "all 0.2s",
        }}
      >
        ✕
      </button>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "24px", maxWidth: "500px" }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>📋</div>
        <h2 style={{ color: "#ffffff", fontSize: "20px", fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
          Material Personalizado Listo
        </h2>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 600, margin: 0 }}>
          {escuela} — {fecha}
        </p>
      </div>

      {/* Preview cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px", maxWidth: "720px", width: "100%", marginBottom: "24px",
      }}>
        {/* Flyer Niños preview */}
        <PreviewCard
          title="Flyer Niños"
          subtitle="Interior · B/N · Carta"
          icon="🎨"
          buttonLabel="📄 Descargar PDF"
          loading={downloading.ninos}
          disabled={isAnyDownloading}
          onDownload={() => handleDownload("ninos")}
        >
          <div style={{ width: "100%", height: "180px", overflow: "hidden", borderRadius: "8px", backgroundColor: "#f3f4f6", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
            <div style={{ transform: "scale(0.18)", transformOrigin: "top center", pointerEvents: "none" }}>
              <FlyerNinos {...flyerProps} />
            </div>
          </div>
        </PreviewCard>

        {/* Flyer Padres preview */}
        <PreviewCard
          title="Flyer Padres"
          subtitle="Exterior · B/N · Carta"
          icon="📰"
          buttonLabel="📄 Descargar PDF"
          loading={downloading.padres}
          disabled={isAnyDownloading}
          onDownload={() => handleDownload("padres")}
        >
          <div style={{ width: "100%", height: "180px", overflow: "hidden", borderRadius: "8px", backgroundColor: "#f3f4f6", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
            <div style={{ transform: "scale(0.18)", transformOrigin: "top center", pointerEvents: "none" }}>
              <FlyerPadres {...flyerProps} />
            </div>
          </div>
        </PreviewCard>

        {/* Circular Digital preview */}
        <PreviewCard
          title="Circular Digital"
          subtitle="WhatsApp · Color · PNG"
          icon="📱"
          buttonLabel="🖼️ Descargar Imagen"
          loading={downloading.digital}
          disabled={isAnyDownloading}
          onDownload={() => handleDownload("digital")}
        >
          <div style={{ width: "100%", height: "180px", overflow: "hidden", borderRadius: "8px", backgroundColor: "#1e293b", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
            <div style={{ transform: "scale(0.35)", transformOrigin: "top center", pointerEvents: "none" }}>
              <CircularDigital {...flyerProps} />
            </div>
          </div>
        </PreviewCard>
      </div>

      {/* Download all button */}
      <button
        onClick={() => handleDownload("all")}
        disabled={isAnyDownloading}
        style={{
          backgroundColor: downloading.all ? "#6b7280" : "#0284c7",
          color: "#ffffff", fontWeight: 800, fontSize: "15px",
          padding: "14px 32px", borderRadius: "9999px", border: "none",
          cursor: isAnyDownloading ? "not-allowed" : "pointer",
          opacity: isAnyDownloading && !downloading.all ? 0.5 : 1,
          display: "flex", alignItems: "center", gap: "10px",
          boxShadow: "0 8px 24px rgba(2,132,199,0.3)",
          transition: "all 0.3s",
          marginBottom: "32px",
        }}
      >
        {downloading.all ? (
          <>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
            Generando documentos...
          </>
        ) : (
          <>📦 Descargar Todo</>
        )}
      </button>

      {/* Off-screen full-size renders (invisible, for html2canvas capture) */}
      <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1, opacity: 1 }} aria-hidden="true">
        <FlyerNinos ref={ninosRef} {...flyerProps} />
        <FlyerPadres ref={padresRef} {...flyerProps} />
        <CircularDigital ref={digitalRef} {...flyerProps} />
      </div>

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/** Reusable preview card */
function PreviewCard({ title, subtitle, icon, buttonLabel, loading, disabled, onDownload, children }) {
  return (
    <div style={{
      backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "16px",
      border: "1px solid rgba(255,255,255,0.1)", padding: "12px",
      display: "flex", flexDirection: "column", gap: "10px",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    }}>
      {/* Preview */}
      {children}

      {/* Info */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "24px" }}>{icon}</span>
        <div>
          <p style={{ color: "#ffffff", fontSize: "14px", fontWeight: 700, margin: 0 }}>{title}</p>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", fontWeight: 500, margin: 0 }}>{subtitle}</p>
        </div>
      </div>

      {/* Download button */}
      <button
        onClick={onDownload}
        disabled={disabled}
        style={{
          width: "100%", padding: "10px", borderRadius: "10px", border: "none",
          backgroundColor: loading ? "#4b5563" : "rgba(255,255,255,0.12)",
          color: "#ffffff", fontWeight: 700, fontSize: "13px",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled && !loading ? 0.4 : 1,
          transition: "all 0.2s",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
        }}
      >
        {loading ? (
          <>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
            Generando...
          </>
        ) : buttonLabel}
      </button>
    </div>
  );
}
