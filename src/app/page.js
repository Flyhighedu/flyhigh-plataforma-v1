'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';

import RitualVuelo from '@/components/RitualVuelo';
import ExperienciaInmersiva from '@/components/ExperienciaInmersiva';
import PlanVuelo from '@/components/PlanVuelo';
import SteamPlatform from '@/components/SteamPlatform';
import FlyHighTestimonialGallery from '@/components/FlyHighTestimonialGallery';
import SchoolMarquee from '@/components/SchoolMarquee';
// import HorizontalGallery from '@/components/HorizontalGallery'; {/* BACKUP: Galerías originales de Home Page */}

import Manifiesto from '@/components/Manifiesto';
// import ImpactEngineGoldenMaster from '@/components/ImpactEngineGoldenMaster'; // REMOVED: Now using DonationModal
import DonationModal from '@/components/Donation/DonationModal';
import AlliesSection from '@/components/AlliesSection';
import MinimalFooter from '@/components/MinimalFooter';

export default function Home() {
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const mainContentRef = React.useRef(null);

  React.useEffect(() => {
    let isAutoScrolling = false;
    let scrollTimeout;

    const handleScroll = () => {
      if (isAutoScrolling || !mainContentRef.current) return;

      const scrollY = window.scrollY;
      const contentTop = mainContentRef.current.offsetTop;

      // Hacia abajo: Si el usuario scrollea > 20px desde el Top, fuerza hacia el contenido
      if (scrollY > 20 && scrollY < contentTop * 0.3) {
        isAutoScrolling = true;
        window.scrollTo({ top: contentTop, behavior: 'smooth' });
        scrollTimeout = setTimeout(() => { isAutoScrolling = false; }, 800);
      }
      // Hacia arriba: Si el usuario scrollea hacia arriba desde el tope del contenido, regresa al Hero
      else if (scrollY < contentTop - 20 && scrollY > contentTop * 0.7) {
        isAutoScrolling = true;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        scrollTimeout = setTimeout(() => { isAutoScrolling = false; }, 800);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  return (
    <main className="w-full">
      <Navbar onOpenDonation={() => setIsDonationModalOpen(true)} />
      <Hero />

      {/* MAIN CONTENT - Pasa por encima del Hero sticky */}
      <div
        ref={mainContentRef}
        className="relative z-10 bg-white rounded-t-[3rem] sm:rounded-t-[5rem] overflow-hidden"
        style={{ isolation: 'isolate' }}
      >
        <RitualVuelo />
        <PlanVuelo />
        <ExperienciaInmersiva />
        <SteamPlatform />
        <FlyHighTestimonialGallery />
        <SchoolMarquee />
        {/* <HorizontalGallery /> */} {/* BACKUP: Galerías originales de Home Page */}

        <Manifiesto />
        {/* <ImpactEngineGoldenMaster /> */}
        <AlliesSection />
        <MinimalFooter />
      </div>

      <DonationModal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
      />
    </main>
  );
}
