'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';

import RitualVuelo from '@/components/RitualVuelo';
import ExperienciaInmersiva from '@/components/ExperienciaInmersiva';
import PlanVuelo from '@/components/PlanVuelo';
import SteamPlatform from '@/components/SteamPlatform';
import FlyHighTestimonialGallery from '@/components/FlyHighTestimonialGallery';
// import HorizontalGallery from '@/components/HorizontalGallery'; {/* BACKUP: Galerías originales de Home Page */}

import Manifiesto from '@/components/Manifiesto';
// import ImpactEngineGoldenMaster from '@/components/ImpactEngineGoldenMaster'; // REMOVED: Now using DonationModal
import DonationModal from '@/components/Donation/DonationModal';
import AlliesSection from '@/components/AlliesSection';
import MinimalFooter from '@/components/MinimalFooter';

export default function Home() {
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

  return (
    <main className="w-full">
      <Navbar onOpenDonation={() => setIsDonationModalOpen(true)} />
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
