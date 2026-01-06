'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Box, Globe, ChevronRight, Activity, Sprout, Sun, BarChart3, ShieldCheck, Target, History, Leaf } from 'lucide-react';

// --- DATA DE LOS GIGANTES (MANIFIESTO + KPIs) ---
const GIANTS = [
    {
        id: 'strong',
        name: "STRONG",
        fullName: "Strong Plastic",
        concept: "LA ESTRUCTURA",
        color: "#0047BA", // Azul Strong (Profundo y Técnico)
        description: "Nuestra vida entera ha consistido en dar forma a la materia con una precisión que nos enorgullece, pero entendemos que la estructura más importante de una ciudad no se fabrica solo con moldes de acero. Ponemos toda nuestra experiencia al servicio de este proyecto para compartir la seguridad y la firmeza que nuestra infancia necesita, asegurando que el talento de Uruapan tenga siempre una base sólida sobre la cual crecer.",
        tagline: "LA ESTRUCTURA DEL MAÑANA",
        icon: <Cpu className="w-6 h-6" />,
        image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1600",
        logoPath: "/videos/logo strong plastic animado.mp4",
        isVideo: true,
        whiteLogo: "/img/logo sp Negro.png",
        productImage: "/img/producto corazones strong plastic.png",
        kpis: [
            { label: "PLANTA", value: "3,100 m²", sub: "Industriales" },
            { label: "MONITOREO", value: "24/7", sub: "Precisión" },
            { label: "CERTIFICACIÓN", value: "ISO", sub: "Estándares" }
        ]
    },
    {
        id: 'rvfresh',
        name: "RVFRESH",
        fullName: "RV Fresh",
        concept: "EL ORIGEN",
        color: "#006837", // Verde RV (Fresco y Natural)
        description: "Lo que inició en los surcos de nuestra tierra hoy se proyecta en los mercados más importantes del mundo. Nos unimos a Fly High Edu porque estamos convencidos de que la verdadera riqueza de Uruapan no está solo en los frutos que exportamos, sino en la energía y el ingenio de los niños que la habitan. Apostamos por ellos porque son la fuerza que mantendrá viva nuestra identidad.",
        tagline: "PASIÓN POR EL FUTURO",
        icon: <Globe className="w-6 h-6" />,
        image: "https://images.unsplash.com/photo-1550989460-0adf9ea622e2?auto=format&fit=crop&q=80&w=1600",
        logoPath: "/videos/logo rv fresh animado(1).mp4",
        isVideo: true,
        whiteLogo: "/img/logo RV Fresh.png",
        productImage: "/img/producto corazones RV Fresh.png",
        kpis: [
            { label: "ORIGEN", value: "Raíces", sub: "Familiares" },
            { label: "EXPORTACIÓN", value: "3", sub: "Continentes" },
            { label: "INOCUIDAD", value: "Grado", sub: "Internacional" }
        ]
    },
    {
        id: 'bonanza',
        name: "BONANZA",
        fullName: "La Bonanza",
        concept: "LA ABUNDANCIA",
        color: "#15803d", // Verde Bonanza (Base para textos)
        gradient: "linear-gradient(180deg, #84cc16 0%, #15803d 100%)", // Degradado Verde Fresco
        description: "Nuestra historia es la prueba de que el origen determina el destino. La Bonanza sustenta esta campaña como una extensión de nuestro compromiso con la tierra: invertimos en la raíz pedagógica de Uruapan para asegurar que el fruto de nuestra sociedad sea reconocido por su calidad en cualquier parte del mundo.",
        tagline: "LEGADO DE TRADICIÓN",
        icon: <Sprout className="w-6 h-6" />,
        image: "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&q=80&w=1600",
        logoPath: "/videos/logo animado la bonanza 1.mp4",
        isVideo: true,
        whiteLogo: "/img/bonanza.png",
        productImage: "/img/producto corazones La bonanza.png",
        kpis: [
            { label: "EXPERIENCIA", value: "40 Años", sub: "Agrícolas" },
            { label: "PRODUCCIÓN", value: "Control", sub: "Total" },
            { label: "SELLO", value: "100%", sub: "Mexicano" }
        ]
    },
    {
        id: 'madobox',
        name: "MADOBOX",
        fullName: "MadoBox",
        concept: "EL RESGUARDO",
        color: "#0891B2", // Azul MadoBox (Cian Profundo)
        description: "En MadoBox sabemos que lo más importante en la vida es aquello que decidimos proteger. Nuestro compromiso nace de una verdad simple: el futuro de Uruapan es lo más valioso que tenemos y merece nuestro mejor cuidado. Nos unimos a Fly High Edu para ser ese apoyo que abraza el talento de nuestra infancia, asegurando que cada niño sienta la confianza de volar sabiendo que su camino está resguardado.",
        tagline: "EL CORAZÓN DEL CUIDADO",
        icon: <Box className="w-6 h-6" />,
        image: "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&q=80&w=1600",
        logoPath: "/videos/lgo animado madobox.mp4",
        isVideo: true,
        whiteLogo: "/img/Logo Madobox.png",
        productImage: "/img/producto corazones madobox.png",
        kpis: [
            { label: "LOGÍSTICA", value: "Red", sub: "Nacional" },
            { label: "INOCUIDAD", value: "FSSC", sub: "Estándar" },
            { label: "DISEÑO", value: "Ingeniería", sub: "Estructural" }
        ]
    },
    {
        id: 'globalfruit',
        name: "GLOBAL FRUIT",
        fullName: "Global Fruit",
        concept: "LA SABIDURÍA",
        color: "#D97706", // Ámbar Global (Dorado y Prestigioso)
        description: "Casi cinco décadas de historia nos han enseñado que el activo más valioso de Uruapan no nace de la tierra, sino de la gente que la trabaja con excelencia. Sustentamos este proyecto porque creemos que el talento de nuestra infancia es la herencia más importante que podemos cultivar. Compartimos nuestra trayectoria para asegurar que la grandeza de nuestra región trascienda y florezca en las nuevas generaciones.",
        tagline: "LEGADO HUMANO",
        icon: <Sun className="w-6 h-6" />,
        image: "https://images.unsplash.com/photo-1610832958506-aa56368d712f?auto=format&fit=crop&q=80&w=1600",
        logoPath: "/videos/logo animado global fruit.mp4",
        isVideo: true,
        whiteLogo: "/img/Logo Global Frut png.png",
        productImage: "/img/producto corazones Global fruit.png",
        kpis: [
            { label: "HISTORIA", value: "50 Años", sub: "Liderando" },
            { label: "CULTURA", value: "GPTW", sub: "Sello" },
            { label: "CALIDAD", value: "Exportación", sub: "Grado" }
        ]
    }
];

// --- COMPONENTE 1: LA CARTA DEL LOGO (TITAN LOGO - GHOST SWAP + VIDEO FORCE) ---
const TitanLogo = ({ titan, style }) => {
    const videoRef = React.useRef(null);
    const [isVideoReady, setIsVideoReady] = React.useState(false);

    React.useEffect(() => {
        if (!titan.isVideo) return;

        // 1. GLOBAL TOUCH UNLOCK (La Llave Maestra)
        // Algunos navegadores requieren interacción del usuario para desbloquear audio/video.
        // Escuchamos el PRIMER toque en cualquier parte y enviamos orden de play.
        const unlockHandler = () => {
            if (videoRef.current && videoRef.current.paused) {
                videoRef.current.play().catch(e => console.log("Unlock attempt processed:", e));
            }
        };
        window.addEventListener('touchstart', unlockHandler, { once: true });
        window.addEventListener('click', unlockHandler, { once: true });

        // 2. OBSERVER (Ahorro de energí­a)
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && videoRef.current) {
                    const playPromise = videoRef.current.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            // Fallback silencioso, el Ghost Swap maneja lo visual
                            console.log("Autoplay prevent handled");
                        });
                    }
                } else if (videoRef.current) {
                    videoRef.current.pause();
                }
            });
        }, { threshold: 0.1 });

        if (videoRef.current) observer.observe(videoRef.current);
        return () => {
            observer.disconnect();
            window.removeEventListener('touchstart', unlockHandler);
            window.removeEventListener('click', unlockHandler);
        };
    }, [titan.isVideo]);

    return (
        <div style={style} className="sticky top-0 h-screen bg-white flex flex-col items-center justify-center shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-t border-gray-100/50 transform-gpu backface-hidden">
            <div className="relative w-full max-w-lg px-8 flex flex-col items-center justify-center text-center">

                {/* CONTENEDOR DE MEDIOS: GHOST SWAP SCHEME */}
                <div className="relative w-full h-auto max-h-[35vh] mb-12 flex items-center justify-center">

                    {/* CAPA 1: SEGURIDAD ESTÁTICA (Siempre visible, carga ultra-rápida) */}
                    {/* Usamos el whiteLogo pero invertido (negro/color) o la imagen si existe una versión color */}
                    {/* ASUNCIÓN: Usamos el mismo path del whiteLogo pero quitamos el filtro para mostrar su color real si es PNG transparente, 
                        o buscamos una alternativa. Si no, usamos el fallback safe. */}
                    <img
                        src={titan.whiteLogo}
                        alt={`${titan.name} Static`}
                        className="absolute inset-0 w-full h-full object-contain filter-none z-0"
                        style={{ opacity: isVideoReady ? 0 : 1, transition: 'opacity 0.5s ease-out' }} // Sin filtro, mostramos la imagen original
                    />

                    {/* CAPA 2: VIDEO FORCE (Se revela solo cuando reproduce frames reales) */}
                    {titan.isVideo ? (
                        <video
                            ref={videoRef}
                            src={titan.logoPath}
                            muted
                            loop
                            playsInline
                            preload="auto" // PRELOAD AGRESIVO
                            onPlaying={() => setIsVideoReady(true)} // LA LLAVE DEL GHOST SWAP
                            onError={() => setIsVideoReady(false)} // Si falla, nos quedamos con la imagen
                            className="relative z-10 w-full h-full object-contain mix-blend-multiply"
                            style={{ opacity: isVideoReady ? 1 : 0, transition: 'opacity 0.5s ease-in' }}
                        />
                    ) : (
                        // Fallback para no-videos (Imágenes estáticas normales)
                        <motion.img
                            initial={{ scale: 0.9, opacity: 0 }}
                            whileInView={{ scale: 1, opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            src={titan.logoPath}
                            alt={`${titan.name} Logo`}
                            className="relative z-10 w-full h-auto object-contain"
                        />
                    )}
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-col items-center gap-4"
                >
                    <div className="h-10 w-[1px] bg-gray-200"></div>
                    <p className="text-[10px] font-black tracking-[0.6em] text-gray-400 uppercase">
                        {titan.concept}
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

// --- COMPONENTE 2: LA CARTA DEL TELÓN (TITAN INFO - POP EDITORIAL POLISHED) ---
// --- COMPONENTE 2: LA CARTA DEL TELÓN (TITAN INFO - POP EDITORIAL POLISHED) ---
const TitanInfo = ({ titan, style }) => {
    return (
        <div
            style={{
                ...style,
                background: titan.gradient || titan.color
            }}
            className="sticky top-0 h-screen w-full shadow-[0_-50px_100px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col font-sans isolate transform-gpu backface-hidden"
        >

            {/* 1. FONDO CON TEXTO GIGANTE Y DETALLES DE LUZ */}
            <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
                {/* Radial leve para dar volumen (Optimizado: Gradiente simple, sin Blur costoso) */}
                <div
                    className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full pointer-events-none opacity-20"
                    style={{
                        background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 70%)'
                    }}
                />

                {/* TIPOGRAFÍA GIGANTE OUTLINED (Ajustada para no molestar) */}
                <motion.h2
                    initial={{ x: 100, opacity: 0 }}
                    whileInView={{ x: 0, opacity: 0.1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className="absolute top-[15%] -right-[20%] md:-top-[5%] md:-right-[10%] font-syne font-black text-[15vh] md:text-[35vh] tracking-tighter uppercase whitespace-nowrap"
                    style={{
                        WebkitTextStroke: '2px rgba(255,255,255,1)',
                        color: 'transparent',
                        transform: 'rotate(5deg)'
                    }}
                >
                    {titan.name}
                </motion.h2>
            </div>


            {/* 2. CONTENIDO PRINCIPAL (Scrollable interno si es necesario y SAFE ZONE) */}
            <div className="relative z-10 w-full h-full px-5 pt-28 pb-6 md:p-16 lg:p-24 flex flex-col justify-start md:justify-center">

                {/* HEADER: STICKERS FLOTANTES (Safe Zone aplicada con pt-28) */}
                <div className="flex flex-wrap items-center w-full mb-4 md:mb-12 shrink-0 gap-4 relative z-20">
                    <motion.div
                        initial={{ scale: 0, rotate: -10 }}
                        whileInView={{ scale: 1, rotate: -2 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="bg-white text-black px-4 py-2 md:px-6 md:py-3 rounded-full shadow-xl flex items-center gap-2"
                    >
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: titan.color }} />
                        <span className="text-[9px] md:text-xs font-bold tracking-widest uppercase" style={{ color: titan.color }}>
                            {titan.tagline}
                        </span>
                    </motion.div>
                </div>

                {/* LOGO SATÉLITE GIGANTE (ABSOLUTE) */}
                {titan.whiteLogo && (
                    <motion.img
                        initial={{ opacity: 0, scale: 0.5, y: -20, rotate: 10 }}
                        whileInView={{ opacity: 0.8, scale: 1, y: 0, rotate: 0 }}
                        viewport={{ once: true }}
                        transition={{ type: "spring", bounce: 0.4, duration: 1.2 }}
                        src={titan.whiteLogo}
                        alt={`${titan.name} Logo`}
                        className="absolute top-20 right-4 md:top-16 md:right-16 w-32 md:w-64 lg:w-96 h-auto object-contain brightness-0 invert drop-shadow-lg pointer-events-none z-0 opacity-10"
                    />
                )}


                {/* BODY: GRID RESPONSIVE */}
                <div className="flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-20 h-full">

                    {/* MANIFIESTO */}
                    <div className="md:col-span-8 lg:col-span-7 flex flex-col justify-center">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                        >
                            <h3 className="text-2xl md:text-6xl font-black text-white font-syne leading-none mb-3 md:mb-8 drop-shadow-lg">
                                {titan.concept}
                            </h3>
                            <p className="text-base md:text-2xl font-['Outfit'] text-white/90 leading-relaxed md:leading-[1.5] text-pretty max-w-4xl drop-shadow-md font-light">
                                {titan.description}
                            </p>
                        </motion.div>
                    </div>

                    {/* KPIs (Grid 3 col en móvil para ahorrar altura, vertical en desktop) */}
                    <div className="md:col-span-4 lg:col-span-5 w-full grid grid-cols-3 md:flex md:flex-col gap-2 md:gap-4 md:justify-end pb-4 md:pb-0 mt-auto md:mt-0">
                        {/* PRODUCT IMAGE INSERTION */}
                        {titan.productImage && (
                            <div className="flex justify-center md:justify-end mb-4 col-span-3">
                                <motion.img
                                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                    whileInView={{ opacity: 1, scale: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.6, delay: 0.2 }}
                                    src={titan.productImage}
                                    alt="Producto Destacado"
                                    className="w-auto h-auto max-h-[22vh] md:max-h-[40vh] object-contain drop-shadow-2xl"
                                />
                            </div>
                        )}

                        {titan.kpis.map((kpi, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ type: "spring", stiffness: 100, delay: 0.4 + (idx * 0.1) }}
                                className="border-l md:border-l-0 md:border-b border-white/20 pl-2 md:pl-0 md:pb-4 md:pt-2 transition-colors rounded-lg group"
                            >
                                <div className="flex flex-col md:flex-row md:justify-between md:items-end w-full">
                                    <div className="flex flex-col w-full">
                                        <span className="text-[7px] md:text-[9px] font-bold tracking-[0.2em] text-white/60 uppercase mb-1 leading-tight truncate">{kpi.label}</span>
                                        <div className="flex flex-col md:items-end md:text-right">
                                            <span className="text-xs md:text-4xl font-black text-white font-syne leading-tight md:leading-none break-words tracking-tight">{kpi.value}</span>
                                            {kpi.sub && (
                                                <span className="text-[7px] md:text-xs text-white/80 font-bold font-syne uppercase tracking-widest mt-0.5 leading-tight">{kpi.sub}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                </div>

            </div>
        </div>
    );
};

export default function SponsorsGrid() {
    return (
        <section id="sponsors" className="bg-white relative">
            {/* Header Sticky */}
            <div className="text-center py-24 mb-0 reveal-node px-6 sticky top-0 bg-white z-10 border-b border-gray-50/50 min-h-[50vh] flex flex-col justify-center">
                <h2 className="text-[9px] font-bold tracking-[0.6em] text-blue-600 uppercase mb-4">
                    Motores del Cambio
                </h2>
                <p className="text-gray-900 text-3xl font-black leading-tight max-w-2xl mx-auto">
                    Presentamos a las empresas visionarias que han transformado sus recursos en alas.
                </p>
            </div>

            {/* BARAJA DE GIGANTES (INFINITE DECK) */}
            <div className="relative">
                {GIANTS.map((titan, index) => {
                    const baseZ = 20 + (index * 2);
                    return (
                        <React.Fragment key={titan.id}>
                            <TitanLogo titan={titan} style={{ zIndex: baseZ }} />
                            <TitanInfo titan={titan} style={{ zIndex: baseZ + 1 }} />
                        </React.Fragment>
                    );
                })}
            </div>

            {/* Footer Sticky/Covered */}
            <div className="reveal-node py-32 px-6 bg-white relative z-[100] sticky top-0 h-screen flex flex-col justify-center">
                <div className="bg-blue-600 rounded-[40px] p-12 text-white text-center shadow-2xl relative overflow-hidden transform-gpu max-w-7xl mx-auto w-full">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                    <div className="relative z-10 flex flex-col items-center">
                        <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-6">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        </div>
                        <h3 className="text-2xl font-black tracking-tighter mb-4 uppercase leading-tight">Tu logo aquí es una promesa cumplida.</h3>
                        <p className="text-white/70 text-xs mb-10 max-w-[200px] mx-auto">Hay un lugar reservado para las empresas que no solo habitan Uruapan, sino que la construyen.</p>
                        <button className="w-full md:w-auto px-12 bg-white text-blue-600 py-5 rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-xl active:scale-95 transition-transform">
                            Iniciar mi Legado
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
