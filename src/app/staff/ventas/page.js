'use client';

import React, { useState } from 'react';
import SalesFunnelScreen from '@/components/sales/SalesFunnelScreen';
import SalesFlyerPreview from '@/components/sales/SalesFlyerPreview';
import SalesRegistrationForm from '@/components/sales/SalesRegistrationForm';
import { CheckCircle, Home, CalendarCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function VentasPage() {
    const router = useRouter();
    const [stage, setStage] = useState('SIMULATOR'); // SIMULATOR, PREVIEW, REGISTRATION, SUCCESS
    const [proposalData, setProposalData] = useState(null);

    const handleSimulatorComplete = (data) => {
        setProposalData(data);
        setStage('PREVIEW');
    };

    const handlePreviewBack = () => {
        setStage('SIMULATOR');
    };

    const handleProceedToRegistration = () => {
        setStage('REGISTRATION');
    };

    const handleRegistrationBack = () => {
        setStage('PREVIEW');
    };

    const handleRegistrationSuccess = (data) => {
        setStage('SUCCESS');
    };

    return (
        <div className="min-h-screen bg-slate-100 pt-8 px-4 font-sans selection:bg-sky-200">
            {stage === 'SIMULATOR' && (
                <SalesFunnelScreen onComplete={handleSimulatorComplete} />
            )}
            
            {stage === 'PREVIEW' && proposalData && (
                <SalesFlyerPreview 
                    data={proposalData} 
                    onBack={handlePreviewBack} 
                    onProceed={handleProceedToRegistration} 
                />
            )}
            
            {stage === 'REGISTRATION' && proposalData && (
                <SalesRegistrationForm 
                    data={proposalData} 
                    onBack={handleRegistrationBack} 
                    onSuccess={handleRegistrationSuccess} 
                />
            )}

            {stage === 'SUCCESS' && (
                <div className="w-full max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center animate-in zoom-in duration-500">
                    <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
                        <CheckCircle size={48} />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 mb-4">¡Escuela Registrada!</h1>
                    <p className="text-slate-600 mb-8 max-w-sm">
                        La escuela ha sido agregada a la lista de próximas escuelas. El equipo de logística se pondrá en contacto pronto.
                    </p>
                    
                    <div className="space-y-4 w-full">
                        <button
                            onClick={() => {
                                setProposalData(null);
                                setStage('SIMULATOR');
                            }}
                            className="w-full flex items-center justify-center gap-2 bg-sky-500 text-white font-black py-4 rounded-full shadow-[0_8px_24px_rgba(14,165,233,0.4)] hover:bg-sky-400 transition-all"
                        >
                            <CalendarCheck size={20} /> Registrar Otra Escuela
                        </button>
                        
                        <button
                            onClick={() => router.back()}
                            className="w-full flex items-center justify-center gap-2 bg-white text-slate-600 font-bold py-4 rounded-full shadow-[4px_4px_8px_#cbd5e1,-4px_-4px_8px_#ffffff] hover:text-sky-600 transition-all"
                        >
                            <Home size={20} /> Volver a mi Operación
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
