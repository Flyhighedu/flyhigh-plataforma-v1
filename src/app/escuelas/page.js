import React from 'react';
import Navbar from '@/components/Navbar';
import './escuelas.css'; // Global styles for this page
import EscuelasHero from '@/components/Escuelas/EscuelasHero';
import EscuelasGallery3D from '@/components/Escuelas/EscuelasGallery3D';
import EscuelasIntro from '@/components/Escuelas/EscuelasIntro';

import EscuelasBenefits from '@/components/Escuelas/EscuelasBenefits';
import EscuelasSteps from '@/components/Escuelas/EscuelasSteps';
import EscuelasCalculator from '@/components/Escuelas/EscuelasCalculator';
import EscuelasWizard from '@/components/Escuelas/EscuelasWizard';

export default function EscuelasPage() {
    return (
        <main className="min-h-screen w-full overflow-x-hidden relative">
            <Navbar />

            <EscuelasHero />

            {/* Content Container */}
            <div id="escuelas-content" className="relative z-30 bg-white min-h-screen shadow-[0_-50px_100px_rgba(0,0,0,0.5)]">
                {/* Intro Section */}
                <EscuelasIntro />

                {/* New Framer-style 3D Gallery & Showcase */}
                <EscuelasGallery3D />


                <EscuelasBenefits />
                <EscuelasSteps />
                <EscuelasCalculator />
                <EscuelasWizard />
            </div>
        </main>
    );
}
