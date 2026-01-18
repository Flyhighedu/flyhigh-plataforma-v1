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
        <main className="min-h-screen w-full overflow-x-hidden relative" style={{ isolation: 'isolate' }}>
            <Navbar />

            <EscuelasHero />

            {/* Content Container - Zero-Jump Flat Structure */}
            <div id="escuelas-content" className="relative z-30 bg-white min-h-screen">
                {/* Intro Section */}
                <EscuelasIntro />

                {/* Flattened Gallery Section */}
                <section className="relative w-full bg-white z-40 pb-16">
                    <EscuelasGallery3D />
                </section>


                <EscuelasBenefits />
                <EscuelasSteps />
                <EscuelasCalculator />
                <EscuelasWizard />
            </div>
        </main>
    );
}
