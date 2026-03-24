import { ThemeProvider } from 'next-themes';

export const metadata = {
    title: 'Analítica — Fly High Edu',
    description: 'Dashboard de analítica operativa con métricas de impacto, eficiencia y patrocinios.',
};

export default function DashboardLayout({ children }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
                {children}
            </div>
        </ThemeProvider>
    );
}
