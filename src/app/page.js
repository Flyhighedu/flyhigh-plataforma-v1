import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';

import RitualVuelo from '@/components/RitualVuelo';
import ExperienciaInmersiva from '@/components/ExperienciaInmersiva';
import PlanVuelo from '@/components/PlanVuelo';
import SteamPlatform from '@/components/SteamPlatform';
// import HorizontalGallery from '@/components/HorizontalGallery'; {/* BACKUP: Galerías originales de Home Page */}
import EscuelasGallery3D from '@/components/Escuelas/EscuelasGallery3D';
import EscuelasGalleryV2 from '@/components/Escuelas/EscuelasGalleryV2'; // A/B TEST IMPORT
import Manifiesto from '@/components/Manifiesto';
import ImpactEngineGoldenMaster from '@/components/ImpactEngineGoldenMaster';
import AlliesSection from '@/components/AlliesSection';
import MinimalFooter from '@/components/MinimalFooter';

export default function Home() {
  return (
    <main className="w-full">
      <Navbar />
      <Hero />

      <RitualVuelo />
      <PlanVuelo />
      <ExperienciaInmersiva />
      <SteamPlatform />
      {/* <HorizontalGallery /> */} {/* BACKUP: Galerías originales de Home Page */}

      {/* --- A/B TESTING ZONE --- */}
      <section className="relative w-full z-30 mb-8">
        <EscuelasGalleryV2 />
      </section>

      <section className="relative w-full bg-white rounded-b-[50px] rounded-t-none overflow-hidden shadow-lg z-20 pb-10 mb-10">
        <EscuelasGallery3D />
      </section>
      {/* ------------------------ */}

      <Manifiesto />
      <ImpactEngineGoldenMaster />
      <AlliesSection />
      <MinimalFooter />
    </main>
  );
}
