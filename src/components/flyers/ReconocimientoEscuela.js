"use client";
import React from "react";

export const RECONOCIMIENTO_DEFAULTS = {
  escuela: 'Escuela Primaria "Constitución"',
  fecha: "Uruapan, Michoacán. Mayo de 2026."
};

const ReconocimientoEscuela = React.forwardRef(function ReconocimientoEscuela({
  escuela = RECONOCIMIENTO_DEFAULTS.escuela,
  fecha = RECONOCIMIENTO_DEFAULTS.fecha,
}, ref) {
  
  // Convertimos el HTML exacto del usuario a un string, e inyectamos sus variables.
  // Así evitamos los bugs de html2canvas al renderizar un iframe (que causa que se vea el fondo gris cortado).
  // Los colores custom (fly-blue, fly-gold, etc) se definen en el tag <style> interno.
  const rawHTML = `
    <style>
      /* Colores Custom del usuario */
      .text-fly-blue { color: #162846 !important; }
      .bg-fly-blue { background-color: #162846 !important; }
      .border-fly-blue { border-color: #162846 !important; }

      .text-fly-gold { color: #cd9e68 !important; }
      .bg-fly-gold { background-color: #cd9e68 !important; }
      .border-fly-gold { border-color: #cd9e68 !important; }

      .text-fly-gray { color: #5a6270 !important; }
      .bg-fly-gray { background-color: #5a6270 !important; }
      .border-fly-gray { border-color: #5a6270 !important; }

      .bg-fly-light { background-color: #f4f6f9 !important; }

      .font-serif { font-family: "Playfair Display", serif !important; }
      .font-sans { font-family: "Montserrat", sans-serif !important; }

      /* Estilos originales */
      .geometric-bg {
          background: linear-gradient(135deg, #0f1c34 0%, #1c3258 100%);
          position: relative;
      }
      .geometric-bg::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image: 
              polygon(0 0, 100% 20%, 50% 100%, 0 100%),
              polygon(100% 0, 100% 50%, 0 80%, 0 0);
          background-size: 100% 100%;
          background-repeat: no-repeat;
          opacity: 0.03;
          background-color: white;
      }
      .filter-fly-blue {
          filter: brightness(0) saturate(100%) invert(14%) sepia(23%) saturate(2641%) hue-rotate(191deg) brightness(96%) contrast(92%);
      }
    </style>

    <div id="document-content" style="width: 816px; height: 1056px; background-color: white; position: relative; overflow: hidden; display: flex; transform-origin: top left;">
        <!-- Franja Lateral -->
        <div class="w-20 geometric-bg h-full flex-shrink-0 flex flex-col justify-end pb-8">
            <div class="h-32 bg-fly-blue border-t border-fly-gold border-opacity-30"></div>
        </div>

        <!-- Contenido -->
        <div class="flex-grow flex flex-col relative pt-12 pb-10 pr-16 pl-14 h-full">

            <!-- Cabecera -->
            <div class="flex justify-between items-end mb-6">
                <div class="text-fly-gray text-sm font-sans italic">
                    <p>${fecha}</p>
                </div>
                <img src="https://i.postimg.cc/4dm7tdc0/1000x200.png" 
                     alt="Fly High EDU" 
                     class="h-10 object-contain opacity-90 filter-fly-blue"
                     crossOrigin="anonymous">
            </div>

            <!-- Título del Mensaje -->
            <div class="mb-6">
                <h2 class="text-fly-gray font-sans font-semibold tracking-[0.2em] text-[10px] uppercase mb-2">
                    Alianza por la Educación
                </h2>
                <h1 class="font-serif text-5xl text-fly-blue font-bold leading-none">
                    10,000 Gracias.
                </h1>
                <div class="w-10 h-[2px] bg-fly-gold mt-4"></div>
            </div>

            <!-- Destinatario y Cuerpo -->
            <div class="flex-grow flex flex-col">
                
                <div class="mb-6 flex flex-col items-start w-full">
                    <p class="text-[10px] font-sans text-fly-gray mb-1 tracking-[0.15em] uppercase font-semibold">Reconocimiento otorgado a:</p>
                    <h3 class="font-serif text-3xl text-fly-blue font-bold leading-tight border-b-2 border-fly-gold border-opacity-20 pb-1 w-full" 
                        id="school-name">
                        ${escuela}
                    </h3>
                    <p class="text-[9px] font-sans text-fly-gray mt-2 tracking-[0.1em] uppercase font-medium italic">Sede oficial de despegue y aprendizaje</p>
                </div>

                <!-- Texto enfocado a la escuela -->
                <div id="letter-body" 
                     class="flex flex-col gap-4 text-fly-gray font-sans text-justify leading-relaxed p-3 -mx-3 rounded-md outline-none border border-transparent hover:border-gray-200 transition-all text-[15px]">
                    <p>
                        Es un privilegio para el equipo de <strong>Fly High EDU</strong> expresar nuestra más profunda gratitud a esta noble institución educativa por haber abierto sus puertas y, sobre todo, por permitirnos convertir sus instalaciones en una plataforma de sueños.
                    </p>
                    <p>
                        Gracias a su hospitalidad y a la increíble disposición de sus directivos y docentes, hemos logrado alcanzar un hito histórico: <strong>impactar la vida de los primeros 10,000 niños que han volado en Uruapan</strong>. Este logro representa el primer gran paso hacia nuestra meta final de 30,000 pequeños, y su escuela fue el escenario fundamental donde <strong>nuestros pequeños</strong> ampliaron sus horizontes y descubrieron que la tecnología y la educación no tienen límites.
                    </p>
                    <p>
                        Reconocemos su compromiso incansable con el futuro de nuestra comunidad. Al trabajar juntos, estamos demostrando que el cielo es apenas el punto de partida cuando se tiene el corazón puesto en la niñez.
                    </p>
                    <p>
                        Que este documento sea un testimonio del impacto positivo que logramos unidos. Gracias por ser parte fundamental de este gran vuelo institucional.
                    </p>
                </div>
            </div>

            <!-- Firmas y Aliados -->
            <div class="mt-auto pt-4 flex justify-between items-end w-full">
                
                <div id="signature-block" class="flex flex-col w-[55%]">
                    <p class="font-serif text-fly-blue text-lg mb-1 italic">Con profunda admiración,</p>
                    <div class="flex justify-between gap-4 mt-2">
                        <div class="flex flex-col w-1/2">
                            <div class="h-12"></div>
                            <div class="h-px w-full bg-gray-300 mb-1.5"></div>
                            <p class="font-sans font-bold text-fly-blue text-[8px] uppercase tracking-wide">David Sanchez</p>
                            <p class="font-sans text-fly-gray text-[7px] italic">Director General, Fly High EDU</p>
                        </div>
                        <div class="flex flex-col w-1/2">
                            <div class="h-12"></div>
                            <div class="h-px w-full bg-gray-300 mb-1.5"></div>
                            <p class="font-sans font-bold text-fly-blue text-[8px] uppercase tracking-wide">Anaid Ríos</p>
                            <p class="font-sans text-fly-gray text-[7px] italic leading-tight">Directora de Relaciones Inst.</p>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col items-end pb-1 w-[45%] flex-shrink-0">
                    <span class="text-fly-blue font-sans font-semibold tracking-[0.15em] text-[8px] uppercase mb-3 opacity-60">Aliados Institucionales</span>
                    
                    <div class="flex items-start justify-end gap-5">
                        <div class="flex flex-col items-center gap-2 w-14">
                            <img src="https://i.postimg.cc/xdLSDm0y/logo-ccfdsp.png" alt="Aliado" class="h-8 w-auto object-contain filter-fly-blue opacity-90" crossOrigin="anonymous">
                            <span class="text-[5px] font-sans font-bold uppercase text-fly-blue text-center opacity-70">Fábrica San Pedro</span>
                        </div>
                        <div class="flex flex-col items-center gap-2 w-14">
                            <img src="https://i.postimg.cc/vm5dFnQ3/logo-huatapera.png" alt="Aliado" class="h-8 w-auto object-contain filter-fly-blue opacity-90" crossOrigin="anonymous">
                            <span class="text-[5px] font-sans font-bold uppercase text-fly-blue text-center opacity-70">La Huatapera</span>
                        </div>
                        <div class="flex flex-col items-center gap-2 w-14">
                            <img src="https://i.postimg.cc/XZNP9pBB/logo-parque.png" alt="Aliado" class="h-8 w-auto object-contain filter-fly-blue opacity-90" crossOrigin="anonymous">
                            <span class="text-[5px] font-sans font-bold uppercase text-fly-blue text-center opacity-70">Parque Nacional</span>
                        </div>
                        <div class="flex flex-col items-center gap-2 w-14">
                            <img src="https://i.postimg.cc/Pq1ksDtQ/logo-secretaria-cultura-y-turismo.png" alt="Aliado" class="h-8 w-auto object-contain filter-fly-blue opacity-90" crossOrigin="anonymous">
                            <span class="text-[5px] font-sans font-bold uppercase text-fly-blue text-center opacity-70">Cultura y Turismo</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SECCIÓN: Patrocinadores Oficiales -->
            <div class="mt-6 pt-4 border-t border-gray-100 flex flex-col items-center w-full">
                <span class="text-fly-blue font-sans font-semibold tracking-[0.25em] text-[7px] uppercase mb-4 opacity-50">Patrocinadores Oficiales de la Campaña</span>
                <div class="flex flex-row justify-center items-center gap-x-9 gap-y-2 px-1 filter-fly-blue opacity-90 w-full overflow-hidden">
                    <img src="https://i.postimg.cc/Gm95xCWf/logo-Strong-plastic-pdf.png" class="h-14 w-auto object-contain" crossOrigin="anonymous">
                    <img src="https://i.postimg.cc/8zs0mS29/Logo-La-Bonanza-Avocados-pdf.png" class="h-14 w-auto object-contain" crossOrigin="anonymous">
                    <img src="https://i.postimg.cc/0yrB0sTX/Logo-Global-Frut-png.png" class="h-14 w-auto object-contain" crossOrigin="anonymous">
                    <img src="https://i.postimg.cc/rwzPNT6X/logo-RV-Fresh.png" class="h-14 w-auto object-contain" crossOrigin="anonymous">
                    <img src="https://i.postimg.cc/QtpNbP97/51d89e34-3d94-448c-9b34-16abb3360127.png" class="h-10 w-auto object-contain" crossOrigin="anonymous">
                    <img src="https://i.postimg.cc/DwmMPT99/Logo-Madobox.png" class="h-14 w-auto object-contain" crossOrigin="anonymous">
                    <img src="https://i.postimg.cc/kXjJfW4x/Diseno-sin-tituloww.png" class="h-14 w-auto object-contain" crossOrigin="anonymous">
                </div>
            </div>

        </div>
    </div>
  `;

  return (
    <div ref={ref} className="w-full h-full relative" style={{ width: 816, height: 1056, overflow: 'hidden', backgroundColor: 'transparent' }}>
      <div dangerouslySetInnerHTML={{ __html: rawHTML }} className="w-full h-full" />
    </div>
  );
});

export default ReconocimientoEscuela;
