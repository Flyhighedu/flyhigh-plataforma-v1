import React, { useState, useRef, useEffect } from "react";
import { X, Sparkles, Undo2, Redo2, Download, Save, Loader2, Send, Mic, MicOff, ZoomIn, ZoomOut, FileImage, FileText, RotateCcw, Pencil } from "lucide-react";
import { captureAsPDF, captureAsPNG } from "@/utils/flyerUtils";

export default function AiCanvasModal({ initialHtml, flyerId, onClose, onSave }) {
  const [history, setHistory] = useState([initialHtml]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0.85);
  
  const previewRef = useRef(null);
  const recognitionRef = useRef(null);
  const originalPromptRef = useRef("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "es-MX";

        recognition.onresult = (event) => {
          let newTranscript = "";
          for (let i = 0; i < event.results.length; i++) {
            newTranscript += event.results[i][0].transcript;
          }
          setPrompt(originalPromptRef.current + (originalPromptRef.current && newTranscript ? " " : "") + newTranscript);
        };
        
        recognition.onerror = () => setIsRecording(false);
        recognition.onend = () => setIsRecording(false);
        
        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!recognitionRef.current) {
        alert("Tu navegador no soporta reconocimiento de voz (Usa Chrome o Edge).");
        return;
      }
      originalPromptRef.current = prompt;
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const currentHtmlRaw = history[currentIndex] || "";
  const currentHtml = currentHtmlRaw.replace(/^```[a-z]*\n/gi, '').replace(/\n?```$/g, '').trim();

  const handleSendPrompt = async (retryPrompt = null) => {
    const userPrompt = typeof retryPrompt === 'string' ? retryPrompt : prompt.trim();
    if (!userPrompt || isProcessing) return;
    
    // Read directly from the DOM to capture any manual edits that haven't been committed to state yet
    const htmlToSend = previewRef.current ? previewRef.current.innerHTML : currentHtml;
    
    setIsProcessing(true);
    setChatHistory(prev => [...prev, { role: "user", text: userPrompt }]);
    if (typeof retryPrompt !== 'string') setPrompt("");
    
    try {
      const res = await fetch("/api/admin/imprimibles/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: htmlToSend, prompt: userPrompt })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error de red");
      
      const newHistory = history.slice(0, currentIndex + 1);
      newHistory.push(data.html);
      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
      
      setChatHistory(prev => [...prev, { role: "assistant", text: data.message || "HTML modificado." }]);
    } catch (e) {
      setChatHistory(prev => [...prev, { 
        role: "assistant", 
        text: "Hubo un error al procesar tu solicitud. Puede ser por alta demanda en los servidores.",
        isError: true,
        failedPrompt: userPrompt 
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndo = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleRedo = () => {
    if (currentIndex < history.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const handleExport = async (format) => {
    setIsExporting(true);
    
    const previousZoom = zoomLevel;
    setZoomLevel(1);
    
    setTimeout(async () => {
      try {
        const node = previewRef.current; 
        if (format === "png") {
          await captureAsPNG(node, `Documento_Custom.png`);
        } else {
          await captureAsPDF(node, `Documento_Custom.pdf`);
        }
      } catch (err) {
        alert("Error al exportar: " + err.message);
      } finally {
        setZoomLevel(previousZoom);
        setIsExporting(false);
      }
    }, 400);
  };

  const handleManualEditBlur = () => {
    if (!previewRef.current) return;
    const currentDomHtml = previewRef.current.innerHTML;
    
    if (currentDomHtml !== currentHtml) {
      const newHistory = history.slice(0, currentIndex + 1);
      newHistory.push(currentDomHtml);
      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
    }
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 2.0));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.3));

  return (
    <div className="fixed inset-0 z-[500] flex bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
      {/* ── HEADER ── */}
      <div className="absolute top-0 left-0 w-full h-16 bg-slate-900 border-b border-white/10 flex items-center justify-between px-6 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Sparkles className="text-indigo-400" />
              Editor Mágico con IA
            </h2>
            <p className="text-xs text-slate-300 mt-1 font-medium flex items-center gap-1.5">
              <Pencil size={12} className="text-indigo-400" />
              Haz clic directamente en el documento para editar los textos manualmente.
            </p>
          </div>
          <div className="flex items-center gap-4 ml-4 border-l border-slate-700 pl-4">
            <span className="text-slate-400 text-sm font-medium">
              Paso {currentIndex + 1} de {history.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleUndo}
                disabled={currentIndex === 0}
                className="flex items-center justify-center p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-slate-300"
                title="Deshacer"
              >
                <Undo2 size={16} />
              </button>
              <button
                onClick={handleRedo}
                disabled={currentIndex === history.length - 1}
                className="flex items-center justify-center p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-slate-300"
                title="Rehacer"
              >
                <Redo2 size={16} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700/50 mr-2">
            <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-700 text-slate-300 rounded-md transition-colors" title="Alejar">
              <ZoomOut size={16} />
            </button>
            <span className="text-slate-300 text-xs font-bold min-w-[3rem] text-center select-none">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-700 text-slate-300 rounded-md transition-colors" title="Acercar">
              <ZoomIn size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => handleExport('pdf')}
              disabled={isExporting}
              title="Exportar como PDF"
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 text-slate-200 rounded-md text-sm font-bold transition-all disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              PDF
            </button>
            <div className="w-[1px] h-4 bg-slate-600"></div>
            <button
              onClick={() => handleExport('png')}
              disabled={isExporting}
              title="Exportar como PNG"
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700 text-slate-200 rounded-md text-sm font-bold transition-all disabled:opacity-50"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileImage size={16} />}
              PNG
            </button>
          </div>
          <button
            onClick={() => onSave(currentHtml)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-black transition-all"
          >
            <Save size={16} /> Guardar como Copia
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
      </div>

      {/* ── WORKSPACE ── */}
      <div className="flex w-full h-full pt-16">
        
        {/* LEFT: PREVIEW PANEL */}
        <div className="flex-1 h-full bg-slate-900 flex items-center justify-center p-8 overflow-auto relative">
          
          {/* Zoom container */}
          <div className="relative shadow-2xl transition-transform duration-200" style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}>
            <div 
              ref={previewRef} 
              dangerouslySetInnerHTML={{ __html: currentHtml }} 
              contentEditable={true}
              suppressContentEditableWarning={true}
              onBlur={handleManualEditBlur}
              className="outline-none focus:ring-4 focus:ring-indigo-500/50 transition-all rounded-sm"
            />
            
            {/* Loading overlay for the preview area */}
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
                <div className="bg-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3">
                  <Loader2 className="animate-spin text-indigo-600" size={24} />
                  <span className="font-bold text-slate-800">Aplicando cambios...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: CHAT / CONTROLS PANEL */}
        <div className="w-[400px] h-full bg-slate-800 border-l border-white/10 flex flex-col shadow-2xl shrink-0">
          
          <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
            {/* Welcome Message */}
            <div className="bg-slate-700/50 p-4 rounded-xl border border-slate-600/50">
              <p className="text-slate-300 text-sm leading-relaxed">
                Describe los cambios estructurales o de contenido que deseas hacer. Gemini reescribirá la estructura HTML manteniendo la calidad y estilos de impresión.
              </p>
            </div>
            
            {/* Chat Bubbles */}
            <div className="flex flex-col gap-4 flex-1">
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : msg.isError ? 'bg-rose-900/50 text-rose-200 rounded-bl-sm border border-rose-500/50' : 'bg-slate-700 text-slate-200 rounded-bl-sm border border-slate-600'}`}>
                    {msg.role === 'assistant' && !msg.isError && <Sparkles size={14} className="inline mr-2 text-indigo-400 mb-0.5" />}
                    {msg.text}
                    {msg.isError && msg.failedPrompt && (
                      <button
                        onClick={() => handleSendPrompt(msg.failedPrompt)}
                        className="mt-3 text-xs bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors"
                      >
                        <RotateCcw size={12} /> Reintentar
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] p-3 rounded-2xl text-sm bg-slate-700 text-slate-200 rounded-bl-sm border border-slate-600 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-indigo-400" /> Pensando...
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Input Area */}
          <div className="p-4 bg-slate-850 border-t border-white/5">
            <div className="relative">
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Ej: Agrega un apartado adicional para que firme la supervisora escolar..."
                className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm rounded-xl p-4 pr-12 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none h-32"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendPrompt();
                  }
                }}
              />
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <button
                  onClick={toggleRecording}
                  disabled={isProcessing}
                  title={isRecording ? "Detener grabación" : "Dictar por voz"}
                  className={`p-2 rounded-lg transition-all ${isRecording ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'} disabled:opacity-50`}
                >
                  {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button
                  onClick={handleSendPrompt}
                  disabled={!prompt.trim() || isProcessing}
                  title="Enviar"
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
            <p className="text-center text-xs text-slate-500 mt-3 font-medium">
              Presiona <kbd className="font-sans px-1 py-0.5 bg-slate-800 rounded">Enter</kbd> para enviar
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
