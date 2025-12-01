import "./globals.css";
import { ImpactProvider } from '../context/ImpactContext';

export const metadata = {
    title: "Fly High Edu | Masterpiece V15 Final",
    description: "Meta 2025-2026: 30,000 Niños al Cielo",
};

export default function RootLayout({ children }) {
    return (
        <html lang="es">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;700;800;900&display=swap" rel="stylesheet" />
            </head>
            <body className="antialiased bg-[#F5F7FA] text-slate-800">
                <ImpactProvider>
                    {children}
                </ImpactProvider>
            </body>
        </html>
    );
}
