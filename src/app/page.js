import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';

import RitualVuelo from '@/components/RitualVuelo';
import ExperienciaInmersiva from '@/components/ExperienciaInmersiva';
import PlanVuelo from '@/components/PlanVuelo';
import SteamPlatform from '@/components/SteamPlatform';
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
      <Manifiesto />
      <ImpactEngineGoldenMaster />
      <AlliesSection />
      <MinimalFooter />
    </main>
  );
}
