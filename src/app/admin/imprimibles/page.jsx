"use client";
import React, { useState, useRef, useCallback } from "react";
import {
  Printer, Download, Pencil, X, RotateCcw, ChevronDown, ChevronUp,
  FileText, Smartphone, Image as ImageIcon, Package, Settings2, Palette, Newspaper, Loader2, Award, Sparkles, Layers
} from "lucide-react";
import FlyerNinos, { FLYER_NINOS_DEFAULTS } from "@/components/flyers/FlyerNinos";
import FlyerPadres, { FLYER_PADRES_DEFAULTS } from "@/components/flyers/FlyerPadres";
import CircularDigital, { CIRCULAR_DIGITAL_DEFAULTS } from "@/components/flyers/CircularDigital";
import CertificadoEscuela, { CERTIFICADO_DEFAULTS } from "@/components/flyers/CertificadoEscuela";
import AiCanvasModal from "@/components/flyers/AiCanvasModal";
import MassiveCertificateModal from "@/components/flyers/MassiveCertificateModal";
import { formatFlyerDate, formatMoney, captureAsPDF, captureAsPNG, downloadAll } from "@/utils/flyerUtils";
import { flyerStorage } from "@/utils/flyerStorage";

// ── FLYER CATALOG ──
const FLYER_CATALOG = [
  {
    id: "ninos",
    label: "Flyer Niños",
    subtitle: "Interior · B/N · Carta",
    icon: <Palette size={22} className="text-amber-500" strokeWidth={2.5} />,
    format: "PDF",
    color: "#f59e0b",
    defaults: FLYER_NINOS_DEFAULTS,
  },
  {
    id: "padres",
    label: "Flyer Padres",
    subtitle: "Exterior · B/N · Carta",
    icon: <Newspaper size={22} className="text-blue-500" strokeWidth={2.5} />,
    format: "PDF",
    color: "#3b82f6",
    defaults: FLYER_PADRES_DEFAULTS,
  },
  {
    id: "digital",
    label: "Circular Digital",
    subtitle: "WhatsApp · Color · PNG",
    icon: <Smartphone size={22} className="text-emerald-500" strokeWidth={2.5} />,
    format: "PNG",
    color: "#10b981",
    defaults: CIRCULAR_DIGITAL_DEFAULTS,
  },
  {
    id: "certificado",
    label: "Certificado",
    subtitle: "Escuela · Color · Carta",
    icon: <Award size={22} className="text-violet-500" strokeWidth={2.5} />,
    format: "PDF",
    color: "#8b5cf6",
    defaults: CERTIFICADO_DEFAULTS,
  },
];

// ── Field label mapping for drawer form ──
const FIELD_LABELS = {
  titulo: "Título Principal",
  subtitulo: "Subtítulo",
  copyPrincipal: "Texto Principal",
  ticketFechaLabel: "Etiqueta Fecha (Ticket)",
  ticketEscuelaLabel: "Etiqueta Escuela (Ticket)",
  valorLabel: "Etiqueta Valor Real",
  paseLabel: "Etiqueta Pase de Vuelo",
  tipAhorro: "Tip de Ahorro",
  sponsorCallout: "Texto Patrocinadores",
  sponsorSubtitle: "Subtítulo Patrocinadores",
  disclaimer: "Disclaimer Legal",
  tituloExperiencia: "Título Experiencia",
  copyExperiencia: "Texto Experiencia",
  feature1Titulo: "Feature 1 — Título",
  feature1Copy: "Feature 1 — Descripción",
  feature2Titulo: "Feature 2 — Título",
  feature2Copy: "Feature 2 — Descripción",
  corazonTitulo: "Título Sección Corazón",
  narrativaPricing: "Narrativa de Pricing",
  transparenciaCopy: "Texto de Transparencia",
  // Certificate
  cuerpoTexto: "Texto del Cuerpo",
  firmaNombre: "Nombre del Firmante",
  firmaCargo: "Cargo del Firmante",
};

export default function ImprimiblesPage() {
  // ── Per-Flyer Configs ──
  const today = new Date().toISOString().slice(0, 10);
  const defaultConfig = { escuela: "ESCUELA EJEMPLO", fechaISO: today, cuota: 50, tarifa: 100, isDirty: false };
  const currentMonthYear = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' });
  const certDefaultConfig = { escuela: "Nombre de la Escuela", fechaTexto: currentMonthYear.replace(/^./, c => c.toUpperCase()), isDirty: false };
  const [configs, setConfigs] = useState({
    ninos: { ...defaultConfig },
    padres: { ...defaultConfig },
    digital: { ...defaultConfig },
    certificado: { ...certDefaultConfig },
  });



  const getFlyerProps = (id) => {
    const c = configs[id];
    return {
      escuela: c.escuela,
      fecha: formatFlyerDate(c.fechaISO),
      monto: formatMoney(c.cuota),
      valorReal: formatMoney(c.tarifa),
      subsidio: formatMoney(c.tarifa - c.cuota),
    };
  };

  // ── Per-flyer text overrides (empty = use defaults) ──
  const [textOverrides, setTextOverrides] = useState({
    ninos: {},
    padres: {},
    digital: {},
    certificado: {},
  });

  const [editingFlyer, setEditingFlyer] = useState(null);
  const [previewFlyer, setPreviewFlyer] = useState(null);
  const [downloading, setDownloading] = useState({});

  // ── AI State ──
  const [customAIFlyers, setCustomAIFlyers] = useState([]);
  const customRefs = useRef({});
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTarget, setAiTarget] = useState(null);
  
  const [massiveTarget, setMassiveTarget] = useState(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFetchingInitial, setIsFetchingInitial] = useState(true);
  const [newFormatModalOpen, setNewFormatModalOpen] = useState(false);

  // ── Database Sync ──
  React.useEffect(() => {
    async function loadFlyers() {
      try {
        const flyers = await flyerStorage.fetchCustomFlyers();
        if (flyers && flyers.length > 0) {
          // Process flyers into state
          setCustomAIFlyers(flyers.map(f => ({
            id: f.id,
            sourceId: f.sourceId,
            html: f.html,
            isCustom: true,
            label: `${FLYER_CATALOG.find(c => c.id === f.sourceId)?.label || 'Flyer'} (IA)`,
            subtitle: `Variante recuperada`,
            format: FLYER_CATALOG.find(c => c.id === f.sourceId)?.format || 'PDF',
            color: FLYER_CATALOG.find(c => c.id === f.sourceId)?.color || '#9ca3af',
            icon: FLYER_CATALOG.find(c => c.id === f.sourceId)?.icon
          })));

          // Restore configs from the latest flyers
          setConfigs(prev => {
            const next = { ...prev };
            // Simple approach: apply the saved configs over defaults
            // In a real app we might want a UI way to choose which config to apply if they differ.
            flyers.forEach(f => {
              if (f.config && Object.keys(f.config).length > 0) {
                next[f.sourceId] = { ...next[f.sourceId], ...f.config };
              }
            });
            return next;
          });
        }
      } catch (err) {
        console.error("Failed to load flyers", err);
      } finally {
        setIsFetchingInitial(false);
      }
    }
    loadFlyers();
  }, []);

  // Debounced config saver
  const configSaveTimer = useRef(null);
  const triggerConfigSave = useCallback((updatedConfigs) => {
    if (configSaveTimer.current) clearTimeout(configSaveTimer.current);
    configSaveTimer.current = setTimeout(async () => {
      try {
        // Only save configs for flyers that exist in customAIFlyers
        const currentCustomFlyers = customAIFlyers; 
        for (const flyer of currentCustomFlyers) {
           const targetConfig = updatedConfigs[flyer.sourceId] || updatedConfigs["ninos"];
           await flyerStorage.updateFlyerConfig(flyer.id, targetConfig);
        }
      } catch (e) {
        console.error("Failed to sync config", e);
      }
    }, 1000);
  }, [customAIFlyers]);

  const handleConfigChange = useCallback((id, field, value) => {
    setConfigs(prev => {
      const next = { ...prev };
      next[id] = { ...next[id], [field]: value, isDirty: true };
      
      // Magic auto-sync: typing in "ninos" syncs to untouched others
      if (id === "ninos") {
        if (!next.padres.isDirty) next.padres = { ...next.padres, [field]: value };
        if (!next.digital.isDirty) next.digital = { ...next.digital, [field]: value };
      }
      
      // Trigger debounced save to database
      triggerConfigSave(next);
      return next;
    });
  }, [triggerConfigSave]);

  // ── Capture refs ──
  const ninosRef = useRef(null);
  const padresRef = useRef(null);
  const digitalRef = useRef(null);
  const certificadoRef = useRef(null);
  const refMap = { ninos: ninosRef, padres: padresRef, digital: digitalRef, certificado: certificadoRef };

  // ── Handlers ──
  const handleUpdateText = useCallback((flyerId, field, value) => {
    setTextOverrides(prev => ({
      ...prev,
      [flyerId]: { ...prev[flyerId], [field]: value },
    }));
  }, []);

  const handleResetTexts = useCallback((flyerId) => {
    setTextOverrides(prev => ({ ...prev, [flyerId]: {} }));
  }, []);

  const handleResetAll = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const defaultConfig = { escuela: "ESCUELA EJEMPLO", fechaISO: today, cuota: 50, tarifa: 100, isDirty: false };
    const currentMonthYear = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' });
    const certDefaultConfig = { escuela: "Nombre de la Escuela", fechaTexto: currentMonthYear.replace(/^./, c => c.toUpperCase()), isDirty: false };
    setConfigs({ ninos: { ...defaultConfig }, padres: { ...defaultConfig }, digital: { ...defaultConfig }, certificado: { ...certDefaultConfig } });
    setTextOverrides({ ninos: {}, padres: {}, digital: {}, certificado: {} });
    setCustomAIFlyers([]);
  }, []);

  const handleAiCanvasSave = async (html) => {
    let sourceFlyer = FLYER_CATALOG.find(f => f.id === aiTarget);
    
    if (!sourceFlyer && aiTarget.startsWith("nuevo_")) {
      sourceFlyer = {
        id: aiTarget,
        label: aiTarget === "nuevo_vertical" ? "Formato Vertical" : aiTarget === "nuevo_horizontal" ? "Formato Horizontal" : "Formato Cuadrado",
        subtitle: "Plantilla desde cero",
        format: "PDF",
        color: "#ec4899",
        icon: <Sparkles size={22} className="text-pink-500" strokeWidth={2.5} />
      };
    }

    if (!sourceFlyer) return;
    
    const newFlyer = {
      ...sourceFlyer,
      id: `custom_${Date.now()}`,
      sourceId: aiTarget,
      label: `${sourceFlyer.label} (IA)`,
      subtitle: `Variante · ${sourceFlyer.format}`,
      html: html,
      isCustom: true
    };
    
    // Optimistic UI update
    setCustomAIFlyers(prev => [newFlyer, ...prev]);
    setAiModalOpen(false);

    // Save to DB
    try {
      await flyerStorage.saveCustomFlyer({
        id: newFlyer.id,
        sourceId: newFlyer.sourceId,
        html: newFlyer.html
      }, configs[aiTarget] || configs["ninos"]);
    } catch (e) {
      alert("Error al guardar la variante en la base de datos.");
    }
  };

  const handleDownload = useCallback(async (type) => {
    setDownloading(prev => ({ ...prev, [type]: true }));
    try {
      if (type === "all") {
        await downloadAll(ninosRef, padresRef, digitalRef, configs.ninos.escuela);
      } else if (type.startsWith("custom_")) {
        const customFlyer = customAIFlyers.find(f => f.id === type);
        const ref = customRefs.current[type];
        if (!ref?.current) throw new Error("Referencia del documento no encontrada.");
        
        if (customFlyer.format === "PNG") {
          await captureAsPNG(ref.current, `${customFlyer.label}.png`);
        } else {
          await captureAsPDF(ref.current, `${customFlyer.label}.pdf`);
        }
      } else if (type === "digital") {
        const safeName = configs.digital.escuela.replace(/\s+/g, "_");
        await captureAsPNG(digitalRef.current, `Circular digital - ${safeName}.png`);
      } else if (type === "certificado") {
        const safeName = configs.certificado.escuela.replace(/\s+/g, "_");
        await captureAsPDF(certificadoRef.current, `Certificado - ${safeName}.pdf`);
      } else {
        const ref = refMap[type];
        const safeName = configs[type].escuela.replace(/\s+/g, "_");
        const label = type === "ninos" ? "salones" : "exterior";
        await captureAsPDF(ref.current, `Flyer ${label} - ${safeName}.pdf`);
      }
    } catch (err) {
      console.error(`Error downloading ${type}:`, err);
      alert(`Error al generar: ${err.message || err}`);
    } finally {
      setDownloading(prev => ({ ...prev, [type]: false }));
    }
  }, [configs]);

  const isAnyDownloading = Object.values(downloading).some(Boolean);
  const overrideCount = (id) => Object.keys(textOverrides[id] || {}).length;

  // ── Component mapping ──
  const getCertificadoProps = () => {
    const c = configs.certificado;
    return { escuela: c.escuela, fecha: c.fechaTexto };
  };

  const FlyerComponent = ({ id, forCapture = false, isCustom = false, html = null, overrideVariables = null }) => {
    if (isCustom && html) {
      const flyerRecord = customAIFlyers.find(f => f.id === id);
      const sourceId = flyerRecord?.sourceId;

      const processedHtml = React.useMemo(() => {
        if (!sourceId || typeof window === 'undefined') return html;
        
        const props = sourceId === 'certificado' ? getCertificadoProps() : getFlyerProps(sourceId);
        if (overrideVariables) {
          if (overrideVariables.escuela) props.escuela = overrideVariables.escuela;
          if (overrideVariables.cuota) props.monto = formatMoney(overrideVariables.cuota);
          if (overrideVariables.fecha) props.fecha = overrideVariables.fecha;
        }
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        doc.querySelectorAll('[data-variable="escuela"]').forEach(el => {
          el.textContent = props.escuela;
        });
        doc.querySelectorAll('[data-variable="fecha"]').forEach(el => {
          el.textContent = props.fecha;
        });
        doc.querySelectorAll('[data-variable="cuota"]').forEach(el => {
          el.textContent = props.monto;
        });

        return doc.body.innerHTML;
      }, [html, configs, sourceId, overrideVariables]);

      return (
        <div 
          dangerouslySetInnerHTML={{ __html: processedHtml }} 
          ref={forCapture ? (el => customRefs.current[id] = { current: el }) : undefined} 
          style={{ transformOrigin: "top left" }} 
        />
      );
    }
    if (id === "certificado") {
      const props = { ...getCertificadoProps(), texts: textOverrides.certificado };
      if (overrideVariables?.escuela) props.escuela = overrideVariables.escuela;
      if (overrideVariables?.fecha) props.fecha = overrideVariables.fecha;
      const ref = forCapture ? certificadoRef : undefined;
      return <CertificadoEscuela ref={ref} {...props} />;
    }
    const props = { ...getFlyerProps(id), texts: textOverrides[id] };
    if (overrideVariables) {
      if (overrideVariables.escuela) props.escuela = overrideVariables.escuela;
      if (overrideVariables.cuota) props.monto = formatMoney(overrideVariables.cuota);
      if (overrideVariables.fecha) props.fecha = overrideVariables.fecha;
    }
    
    const ref = forCapture ? refMap[id] : undefined;
    switch (id) {
      case "ninos": return <FlyerNinos ref={ref} {...props} />;
      case "padres": return <FlyerPadres ref={ref} {...props} />;
      case "digital": return <CircularDigital ref={ref} {...props} />;
      default: return null;
    }
  };

  const editingCatalog = FLYER_CATALOG.find(f => f.id === editingFlyer);
  const editingDefaults = editingCatalog?.defaults || {};

  return (
    <div className="w-full flex-1 flex flex-col overflow-y-auto overflow-x-hidden bg-slate-50 relative text-slate-800">
      <div className="max-w-[1400px] mx-auto w-full px-4 md:px-12 py-8 md:py-12 space-y-10 animate-in fade-in duration-500">
        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Open+Sans:wght@400;600;700&family=Poppins:wght@400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,700;1,600&display=swap" rel="stylesheet" crossOrigin="anonymous" />

        {/* ── HEADER ACTIONS ── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 drop-shadow-sm">
              Estudio de Imprimibles
            </h1>
            <p className="text-sm md:text-base text-slate-500 max-w-2xl leading-relaxed font-medium">
              Genera materiales promocionales personalizados por escuela. Las ediciones que realices aquí 
              son <span className="font-bold text-slate-700">efímeras</span> y no alterarán las plantillas maestras del sistema central.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              onClick={() => setNewFormatModalOpen(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 border border-indigo-200 hover:border-indigo-300 hover:bg-indigo-100 text-indigo-700 font-bold text-sm transition-all shadow-sm active:scale-95"
            >
              <Sparkles size={18} className="text-indigo-500" /> Crear con IA
            </button>
            <button
              onClick={handleResetAll}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 font-bold text-sm transition-all shadow-sm active:scale-95"
            >
              <RotateCcw size={18} /> Restaurar Todo
            </button>
            <button
              onClick={() => handleDownload("all")}
              disabled={isAnyDownloading}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-sm font-black tracking-wide uppercase transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {downloading.all ? <Loader2 size={18} className="animate-spin" /> : <Package size={18} />}
              {downloading.all ? "Exportando..." : "Descargar Paquete"}
            </button>
          </div>
        </div>

      {/* ── PREVIEW CARDS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 items-start">
        {[...FLYER_CATALOG, ...customAIFlyers].map(flyer => {
          const isDownloading = downloading[flyer.id];
          const edits = overrideCount(flyer.sourceId || flyer.id);
          return (
            <div
              key={flyer.id}
              className="group bg-white rounded-[2rem] border border-slate-200/80 overflow-hidden shadow-xl shadow-slate-200/20 hover:shadow-2xl hover:shadow-slate-300/40 transition-all duration-500 relative flex flex-col hover:-translate-y-1"
            >
              {/* Edit count / AI badge */}
              {(edits > 0 || flyer.isCustom) && (
                <div className="absolute top-5 right-5 z-20 bg-gradient-to-r from-orange-500 to-rose-500 text-white text-[11px] font-black rounded-full px-3 py-1 flex items-center justify-center shadow-lg shadow-orange-500/30">
                  {flyer.isCustom ? "EDITADO POR IA ✨" : `${edits} ${edits === 1 ? 'CAMBIO' : 'CAMBIOS'}`}
                </div>
              )}

              {/* Preview Container */}
              <div 
                className="relative w-full overflow-hidden bg-slate-100/50 border-b border-slate-100 transition-all duration-300 cursor-pointer group/preview" 
                style={{ height: flyer.id === "digital" ? "460px" : "320px" }}
                onClick={() => setPreviewFlyer(flyer.id)}
              >
                <div className="absolute inset-0 flex justify-center items-start pt-8 pointer-events-none" style={{
                  transform: (flyer.sourceId || flyer.id) === "digital" ? "scale(0.40)" : "scale(0.26)",
                  transformOrigin: "top center",
                }}>
                  <div className="shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] transition-transform duration-500 group-hover:scale-[1.03]">
                    <FlyerComponent id={flyer.id} isCustom={flyer.isCustom} html={flyer.html} />
                  </div>
                </div>
                {/* Gradient fade at bottom */}
                <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />
                
                {/* Hover overlay indicator */}
                <div className="absolute inset-0 bg-indigo-900/0 group-hover/preview:bg-indigo-900/5 transition-all flex items-center justify-center opacity-0 group-hover/preview:opacity-100 z-10">
                    <div className="bg-white/95 backdrop-blur-sm text-indigo-600 px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-widest shadow-xl flex items-center gap-2 transform translate-y-4 group-hover/preview:translate-y-0 transition-all">
                        <ImageIcon size={16} /> Ver Ampliado
                    </div>
                </div>
              </div>

              {/* Info + Actions */}
              <div className="p-6 md:p-8 flex-1 flex flex-col justify-between space-y-6 bg-white z-10 relative">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-100 shadow-inner" style={{ backgroundColor: flyer.color + '10' }}>
                    {flyer.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">{flyer.label}</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">{flyer.subtitle}</p>
                  </div>
                </div>

                {/* ── PER-FLYER CONFIG ── */}
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nombre de Escuela</label>
                    <input 
                      type="text" 
                      value={configs[flyer.sourceId || flyer.id]?.escuela ?? configs["ninos"]?.escuela ?? ""}
                      onChange={e => handleConfigChange(flyer.sourceId?.startsWith('nuevo_') ? 'ninos' : (flyer.sourceId || flyer.id), 'escuela', (flyer.sourceId || flyer.id) === 'certificado' ? e.target.value : e.target.value.toUpperCase())}
                      className="w-full bg-slate-50 border-2 border-slate-100/80 rounded-xl px-4 py-2.5 text-xs font-black text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                  {(flyer.sourceId || flyer.id) === 'certificado' ? (
                    /* Certificate: free-text date field */
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Fecha (texto libre)</label>
                      <input 
                        type="text" 
                        value={configs.certificado.fechaTexto}
                        onChange={e => handleConfigChange('certificado', 'fechaTexto', e.target.value)}
                        placeholder="Abril de 2026"
                        className="w-full bg-slate-50 border-2 border-slate-100/80 rounded-xl px-4 py-2.5 text-xs font-black text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner"
                      />
                    </div>
                  ) : (
                    /* Flyers: ISO date + monetary fields */
                    <>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Fecha del Evento</label>
                        <input 
                          type="date" 
                          value={configs[flyer.sourceId || flyer.id]?.fechaISO ?? configs["ninos"]?.fechaISO ?? ""}
                          onChange={e => handleConfigChange(flyer.sourceId?.startsWith('nuevo_') ? 'ninos' : (flyer.sourceId || flyer.id), 'fechaISO', e.target.value)}
                          className="w-full bg-slate-50 border-2 border-slate-100/80 rounded-xl px-4 py-2.5 text-xs font-black text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Cuota $</label>
                          <input 
                            type="number" 
                            value={configs[flyer.sourceId || flyer.id]?.cuota ?? configs["ninos"]?.cuota ?? 0}
                            onChange={e => handleConfigChange(flyer.sourceId?.startsWith('nuevo_') ? 'ninos' : (flyer.sourceId || flyer.id), 'cuota', Number(e.target.value))}
                            className="w-full bg-slate-50 border-2 border-slate-100/80 rounded-xl px-4 py-2.5 text-xs font-black text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner text-center"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Tarifa Base $</label>
                          <input 
                            type="number" 
                            value={configs[flyer.sourceId || flyer.id]?.tarifa ?? configs["ninos"]?.tarifa ?? 0}
                            onChange={e => handleConfigChange(flyer.sourceId?.startsWith('nuevo_') ? 'ninos' : (flyer.sourceId || flyer.id), 'tarifa', Number(e.target.value))}
                            className="w-full bg-slate-50 border-2 border-slate-100/80 rounded-xl px-4 py-2.5 text-xs font-black text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-inner text-center"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-4 border-t border-slate-100/80 mt-auto">
                  <div className="flex gap-2">
                    {!flyer.isCustom && (
                      <button
                        onClick={() => setEditingFlyer(flyer.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-black text-[10px] sm:text-xs uppercase tracking-tight transition-all border-2 border-slate-200 hover:border-slate-300 active:scale-95"
                      >
                        <Pencil size={14} /> Editar Textos
                      </button>
                    )}
                    {flyer.isCustom ? (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm("¿Eliminar esta variante personalizada?")) {
                            // Optimistic delete
                            setCustomAIFlyers(prev => prev.filter(f => f.id !== flyer.id));
                            try {
                              await flyerStorage.deleteCustomFlyer(flyer.id);
                            } catch(err) {
                              alert("Error al eliminar la variante de la base de datos.");
                            }
                          }
                        }}
                        className="flex-1 flex justify-center items-center gap-1.5 px-2 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-tight transition-all active:scale-95 border border-rose-100"
                      >
                        <X size={14} /> Eliminar Copia
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAiTarget(flyer.id);
                          setAiModalOpen(true);
                        }}
                        className="flex-1 flex justify-center items-center gap-1.5 px-2 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-tight transition-all active:scale-95 border border-indigo-100"
                      >
                        <Sparkles size={14} /> Editar con IA
                      </button>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleDownload(flyer.id)}
                    disabled={isAnyDownloading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wide transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    style={{
                      backgroundColor: isDownloading ? "#f1f5f9" : flyer.color,
                      color: isDownloading ? "#64748b" : "white",
                      boxShadow: isDownloading ? "none" : `0 10px 25px -5px ${flyer.color}60`,
                    }}
                  >
                    {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    {isDownloading ? "..." : `Exportar ${flyer.format}`}
                  </button>

                  {/* Add Massive Button for all flyers */}
                  <button
                    onClick={() => setMassiveTarget(flyer)}
                    disabled={isAnyDownloading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wide transition-all active:scale-95 shadow-sm border border-slate-200 mt-2 bg-slate-50 hover:bg-slate-100 text-indigo-700 disabled:opacity-50"
                  >
                    <Layers size={16} /> Generar Masivo (Varias Escuelas)
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── DRAWER DE EDICIÓN ── */}
      {editingFlyer && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] animate-in fade-in duration-300"
            onClick={() => setEditingFlyer(null)}
          />

          {/* Drawer */}
          <div className="fixed top-0 right-0 bottom-0 w-full md:w-[500px] bg-white border-l border-slate-200 z-[110] flex flex-col shadow-2xl animate-in slide-in-from-right duration-500">
            {/* Drawer Header */}
            <div className="shrink-0 flex items-center justify-between px-6 md:px-8 py-6 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner" style={{ backgroundColor: editingCatalog?.color + '15', color: editingCatalog?.color }}>
                  {editingCatalog?.icon}
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight text-slate-900">{editingCatalog?.label}</h3>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                    Modo Borrador Activo
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleResetTexts(editingFlyer)}
                  className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all border border-slate-200"
                  title="Restaurar textos originales"
                >
                  <RotateCcw size={18} />
                </button>
                <button
                  onClick={() => setEditingFlyer(null)}
                  className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-rose-50 flex items-center justify-center text-slate-500 hover:text-rose-600 transition-all border border-slate-200"
                >
                  <X size={20} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {/* Drawer Body — scrollable form */}
            <div className="flex-1 overflow-y-auto px-6 md:px-8 py-8 space-y-8 bg-slate-50/50">
              {/* Mini preview */}
              <div className="bg-slate-100/50 rounded-3xl border-2 border-slate-200/60 overflow-hidden relative shadow-inner" style={{ height: "260px" }}>
                <div className="absolute inset-0 flex justify-center items-start pt-6" style={{
                  transform: editingFlyer === "digital" ? "scale(0.22)" : "scale(0.13)",
                  transformOrigin: "top center",
                  pointerEvents: "none",
                }}>
                  <div className="shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)]">
                    <FlyerComponent id={editingFlyer} />
                  </div>
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-px flex-1 bg-slate-200"></div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Campos Personalizables</h4>
                  <div className="h-px flex-1 bg-slate-200"></div>
                </div>

                {Object.entries(editingDefaults).map(([field, defaultValue]) => {
                  const currentValue = textOverrides[editingFlyer]?.[field] ?? "";
                  const isModified = currentValue !== "" && currentValue !== defaultValue;
                  const isLongText = defaultValue.length > 60;

                  return (
                    <div key={field} className="relative bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-50">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
                          {FIELD_LABELS[field] || field}
                        </label>
                        {isModified && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black text-orange-600 uppercase bg-orange-100 px-2 py-0.5 rounded-full tracking-wider">
                              Modificado
                            </span>
                            <button
                              onClick={() => handleUpdateText(editingFlyer, field, "")}
                              className="text-[10px] text-slate-400 hover:text-slate-700 font-bold transition-colors"
                            >
                              Restaurar
                            </button>
                          </div>
                        )}
                      </div>

                      {isLongText ? (
                        <textarea
                          value={currentValue || defaultValue}
                          onChange={e => handleUpdateText(editingFlyer, field, e.target.value)}
                          rows={4}
                          className={`w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white resize-none leading-relaxed transition-all ${
                            isModified ? "bg-orange-50/30 border-orange-200/50" : ""
                          }`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={currentValue || defaultValue}
                          onChange={e => handleUpdateText(editingFlyer, field, e.target.value)}
                          className={`w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all ${
                            isModified ? "bg-orange-50/30 border-orange-200/50" : ""
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="shrink-0 px-6 md:px-8 py-5 border-t border-slate-100 bg-white flex shadow-[0_-20px_30px_-15px_rgba(0,0,0,0.05)]">
              <button
                onClick={() => handleDownload(editingFlyer)}
                disabled={isAnyDownloading}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black tracking-wide text-sm transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white uppercase"
                style={{
                  backgroundColor: editingCatalog?.color || "#f97316",
                  boxShadow: `0 10px 25px -5px ${editingCatalog?.color}60`
                }}
              >
                {downloading[editingFlyer] ? (
                  <><Loader2 size={18} className="animate-spin" /> Exportando versión personalizada...</>
                ) : (
                  <><Download size={18} strokeWidth={2.5} /> Exportar versión personalizada</>
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── PREVIEW MODAL ── */}
      {previewFlyer && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative max-w-full max-h-full flex flex-col bg-slate-100 rounded-[2rem] shadow-2xl overflow-hidden border border-white/10">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-white shrink-0 shadow-sm z-10">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                 <ImageIcon className="text-indigo-500" size={20} />
                 Vista Previa Ampliada
              </h3>
              <button onClick={() => setPreviewFlyer(null)} className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors">
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            
            {/* Modal Body (Scrollable) */}
            <div className="overflow-auto flex-1 flex items-start justify-center p-4 md:p-8" style={{ maxHeight: "calc(100vh - 100px)" }}>
                <div className="shadow-2xl bg-white origin-top shrink-0 mb-8" style={{ zoom: "0.8" }}>
                    <FlyerComponent 
                      id={previewFlyer} 
                      isCustom={previewFlyer.startsWith('custom_')} 
                      html={customAIFlyers.find(f => f.id === previewFlyer)?.html} 
                    />
                </div>
            </div>
          </div>
        </div>
      )}

      {/* ── OFF-SCREEN FULL-SIZE RENDERS (for capture) ── */}
      <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1, opacity: 1 }} aria-hidden="true">
        <FlyerNinos ref={ninosRef} {...getFlyerProps("ninos")} texts={textOverrides.ninos} />
        <FlyerPadres ref={padresRef} {...getFlyerProps("padres")} texts={textOverrides.padres} />
        <CircularDigital ref={digitalRef} {...getFlyerProps("digital")} texts={textOverrides.digital} />
        <CertificadoEscuela ref={certificadoRef} {...getCertificadoProps()} texts={textOverrides.certificado} />
        
        {customAIFlyers.map(cf => (
          <FlyerComponent key={cf.id} id={cf.id} forCapture={true} isCustom={true} html={cf.html} />
        ))}
      </div>

      {/* ── AI CANVAS MODAL ── */}
      {aiModalOpen && (
        <AiCanvasModal
          flyerId={aiTarget}
          initialHtml={
            aiTarget === "nuevo_vertical" ? `<div style="width: 8.5in; height: 11in; min-width: 8.5in; min-height: 11in; background-color: white; padding: 0.5in; box-sizing: border-box; font-family: 'Open Sans', sans-serif; display: flex; flex-direction: column;">\n  <!-- Instrucciones ocultas para la IA: Mantener los estilos en línea y generar el flyer de manera formal y sobria alineado a los colores de Fly High EDU (Azul, Blanco, etc). -->\n</div>`
            : aiTarget === "nuevo_horizontal" ? `<div style="width: 11in; height: 8.5in; min-width: 11in; min-height: 8.5in; background-color: white; padding: 0.5in; box-sizing: border-box; font-family: 'Open Sans', sans-serif; display: flex; flex-direction: column;">\n  <!-- Instrucciones ocultas para la IA: Mantener los estilos en línea y generar el flyer de manera formal y sobria alineado a los colores de Fly High EDU (Azul, Blanco, etc). -->\n</div>`
            : aiTarget === "nuevo_cuadrado" ? `<div style="width: 8.5in; height: 8.5in; min-width: 8.5in; min-height: 8.5in; background-color: white; padding: 0.5in; box-sizing: border-box; font-family: 'Open Sans', sans-serif; display: flex; flex-direction: column;">\n  <!-- Instrucciones ocultas para la IA: Mantener los estilos en línea y generar el flyer de manera formal y sobria alineado a los colores de Fly High EDU (Azul, Blanco, etc). -->\n</div>`
            : refMap[aiTarget]?.current?.outerHTML
          }
          onClose={() => setAiModalOpen(false)}
          onSave={handleAiCanvasSave}
        />
      )}

      <MassiveCertificateModal 
        isOpen={!!massiveTarget}
        onClose={() => setMassiveTarget(null)}
        targetFlyer={massiveTarget}
        renderFlyer={(variables) => massiveTarget && (
          <FlyerComponent 
            id={massiveTarget.id} 
            isCustom={massiveTarget.isCustom} 
            html={massiveTarget.html} 
            forCapture={false} 
            overrideVariables={variables} 
          />
        )}
      />

      {/* ── FORMAT SELECTION MODAL ── */}
      {newFormatModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setNewFormatModalOpen(false)}>
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setNewFormatModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
            <h3 className="text-2xl font-black text-slate-900 mb-2 flex items-center gap-2">
              <Sparkles className="text-indigo-500" />
              Nuevo Formato con IA
            </h3>
            <p className="text-sm text-slate-500 mb-6 font-medium">
              Elige las proporciones de tu nuevo formato. Gemini se encargará de diseñar la estructura respetando la marca FlyHigh.
            </p>
            
            <div className="grid grid-cols-3 gap-4">
              <button 
                onClick={() => { setAiTarget("nuevo_vertical"); setNewFormatModalOpen(false); setAiModalOpen(true); }}
                className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-slate-100 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
              >
                <div className="w-10 h-14 bg-slate-200 rounded border-2 border-slate-300 group-hover:bg-indigo-200 group-hover:border-indigo-400 transition-colors"></div>
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider group-hover:text-indigo-700">Carta<br/>Vertical</span>
              </button>
              
              <button 
                onClick={() => { setAiTarget("nuevo_horizontal"); setNewFormatModalOpen(false); setAiModalOpen(true); }}
                className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-slate-100 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
              >
                <div className="w-14 h-10 bg-slate-200 rounded border-2 border-slate-300 group-hover:bg-indigo-200 group-hover:border-indigo-400 transition-colors mt-2 mb-2"></div>
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider group-hover:text-indigo-700">Carta<br/>Horizontal</span>
              </button>
              
              <button 
                onClick={() => { setAiTarget("nuevo_cuadrado"); setNewFormatModalOpen(false); setAiModalOpen(true); }}
                className="flex flex-col items-center justify-center gap-3 p-4 border-2 border-slate-100 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
              >
                <div className="w-12 h-12 bg-slate-200 rounded border-2 border-slate-300 group-hover:bg-indigo-200 group-hover:border-indigo-400 transition-colors mt-1 mb-1"></div>
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider group-hover:text-indigo-700">Formato<br/>Cuadrado</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      </div>
    </div>
  );
}
