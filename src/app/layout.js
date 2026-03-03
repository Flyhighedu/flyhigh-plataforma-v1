import "./globals.css";
import { ImpactProvider } from '../context/ImpactContext';

export const metadata = {
    title: "Fly High Edu",
    description: "Inspirando a través del vuelo. Experiencias educativas inmersivas con drones y realidad virtual en Uruapan.",
};

export const viewport = {
    themeColor: '#0A4FE2',
};

export default function RootLayout({ children }) {
    return (
        <html lang="es">
            <head>
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@300;400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&family=Outfit:wght@400;500;700;800;900&family=Montserrat:wght@700;900&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            </head>
            <body className="antialiased bg-[#F5F7FA] text-slate-800" suppressHydrationWarning>
                <ImpactProvider>
                    {children}
                </ImpactProvider>
            </body>
        </html>
    );
}
