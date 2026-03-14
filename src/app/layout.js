import "./globals.css";
import { ImpactProvider } from '../context/ImpactContext';
import { Toaster } from "@/components/ui/sonner";
import { Inter, Outfit, Manrope, Montserrat } from "next/font/google";

const inter = Inter({
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700", "800"],
    variable: "--font-inter",
    display: "swap",
});

const outfit = Outfit({
    subsets: ["latin"],
    weight: ["400", "500", "700", "800", "900"],
    variable: "--font-outfit",
    display: "swap",
});

const manrope = Manrope({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800"],
    variable: "--font-manrope",
    display: "swap",
});

const montserrat = Montserrat({
    subsets: ["latin"],
    weight: ["700", "900"],
    variable: "--font-montserrat",
    display: "swap",
});

export const metadata = {
    title: "Fly High Edu",
    description: "Inspirando a través del vuelo. Experiencias educativas inmersivas con drones y realidad virtual en Uruapan.",
    icons: {
        icon: '/img/app-icon.png',
        apple: '/img/app-icon.png',
    },
};

export const viewport = {
    themeColor: '#0185e4',
};

import CustomSplashScreen from '@/components/CustomSplashScreen';

export default function RootLayout({ children }) {
    return (
        <html lang="es" className={`${inter.variable} ${outfit.variable} ${manrope.variable} ${montserrat.variable}`}>
            <head>
                {/* Capture PWA install prompt before React hydrates */}
                <script dangerouslySetInnerHTML={{ __html: `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaInstallPrompt=e;});` }} />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <link rel="apple-touch-icon" href="/img/app-icon.png" />
                <link href="https://fonts.googleapis.com/css2?family=Anton&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            </head>
            <body className={`${inter.className} antialiased bg-[#F5F7FA] text-slate-800`} suppressHydrationWarning>
                <ImpactProvider>
                    <CustomSplashScreen>
                        {children}
                    </CustomSplashScreen>
                </ImpactProvider>
                <Toaster richColors position="top-right" />
            </body>
        </html>
    );
}

