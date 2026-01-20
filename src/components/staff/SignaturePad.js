'use client';

import { useRef, useEffect, useState } from 'react';
import { Eraser } from 'lucide-react';

export default function SignaturePad({ onEnd }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const resizeCanvas = () => {
            if (canvas) {
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                canvas.width = canvas.offsetWidth * ratio;
                canvas.height = canvas.offsetHeight * ratio;
                canvas.getContext('2d').scale(ratio, ratio);
            }
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const getCoords = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDrawing = (e) => {
        e.preventDefault(); // prevent scroll on touch
        setIsDrawing(true);
        const ctx = canvasRef.current.getContext('2d');
        const { x, y } = getCoords(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const ctx = canvasRef.current.getContext('2d');
        const { x, y } = getCoords(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        setHasSignature(true);
    };

    const endDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        onEnd(canvas.toDataURL());
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
        onEnd(null);
    };

    return (
        <div className="relative border border-slate-300 rounded-lg bg-white overflow-hidden touch-none h-40 w-full">
            <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={endDrawing}
                onMouseLeave={endDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={endDrawing}
            />

            {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-300 text-sm">
                    Firma aquí
                </div>
            )}

            {hasSignature && (
                <button
                    onClick={clear}
                    className="absolute top-2 right-2 p-1.5 bg-slate-100 rounded-full text-slate-500 hover:text-red-500 transition-colors"
                >
                    <Eraser size={16} />
                </button>
            )}
        </div>
    );
}
