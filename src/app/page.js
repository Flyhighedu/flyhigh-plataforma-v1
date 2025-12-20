import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';

import RitualVuelo from '@/components/RitualVuelo';
import ExperienciaInmersiva from '@/components/ExperienciaInmersiva';
import PlanVuelo from '@/components/PlanVuelo';
import SteamPlatform from '@/components/SteamPlatform';
import HorizontalGallery from '@/components/HorizontalGallery';
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
      <HorizontalGallery />
      <Manifiesto />
      <ImpactEngineGoldenMaster />
      <AlliesSection />
      <MinimalFooter />
    </main>
  );
}
