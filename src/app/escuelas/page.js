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

            {/* Content Container - Optimized Shadow for stability */}
            <div id="escuelas-content" className="relative z-30 bg-white min-h-screen shadow-[0_-30px_60px_rgba(0,0,0,0.2)]">
                {/* Intro Section */}
                <EscuelasIntro />

                {/* Optimized Section Wrapper */}
                <section className="relative w-full bg-white rounded-b-[50px] shadow-[0_20px_40px_-5px_rgba(0,0,0,0.15)] z-40 pb-8 mb-0">
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
