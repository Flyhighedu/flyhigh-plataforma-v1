import React from 'react';
import './escuelas.css'; // Global styles for this page
import EscuelasHero from '@/components/Escuelas/EscuelasHero';
import EscuelasMission from '@/components/Escuelas/EscuelasMission';
import EscuelasWizard from '@/components/Escuelas/EscuelasWizard';

export default function Page() {
    return (
        <main>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

            <EscuelasHero />
            <EscuelasMission />
            <EscuelasWizard />

        </main>
    );
}
