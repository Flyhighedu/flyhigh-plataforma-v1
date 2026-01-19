import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';

import RitualVuelo from '@/components/RitualVuelo';
import ExperienciaInmersiva from '@/components/ExperienciaInmersiva';
import PlanVuelo from '@/components/PlanVuelo';
import SteamPlatform from '@/components/SteamPlatform';
import FlyHighTestimonialGallery from '@/components/FlyHighTestimonialGallery';
// import HorizontalGallery from '@/components/HorizontalGallery'; {/* BACKUP: Galerías originales de Home Page */}

import Manifiesto from '@/components/Manifiesto';
import ImpactEngineGoldenMaster from '@/components/ImpactEngineGoldenMaster';
import AlliesSection from '@/components/AlliesSection';
import MinimalFooter from '@/components/MinimalFooter';

export default function Home() {
  return (
    <main className="w-full">
      <Navbar />
      <Hero />

      {/* MAIN CONTENT - Pasa por encima del Hero sticky */}
      <div
        className="relative z-10 bg-transparent"
        style={{ isolation: 'isolate' }}
      >
        <RitualVuelo />
        <PlanVuelo />
        <ExperienciaInmersiva />
        <SteamPlatform />
        <FlyHighTestimonialGallery />
        {/* <HorizontalGallery /> */} {/* BACKUP: Galerías originales de Home Page */}

        <Manifiesto />
        <ImpactEngineGoldenMaster />
        <AlliesSection />
        <MinimalFooter />
      </div>
    </main>
  );
}
