import './inteligencia.css';

export const metadata = {
  title: 'Fly High — Inteligencia Comercial',
  description: 'Herramienta de inteligencia geográfica y planificación de rutas comerciales para Fly High EDU.',
};

export default function InteligenciaLayout({ children }) {
  return (
    <div className="intel-app">
      {children}
    </div>
  );
}
