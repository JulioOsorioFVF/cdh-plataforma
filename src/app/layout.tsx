import type { Metadata, Viewport } from 'next';
import { Jost, Oswald } from 'next/font/google';
import '@/styles/globals.css';

const jost = Jost({
  subsets: ['latin'],
  variable: '--font-jost',
  display: 'swap',
});

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-oswald',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Consejo de Honor FVF',
    template: '%s | Consejo de Honor FVF',
  },
  description:
    'Plataforma de Big Data Disciplinaria del Fútbol Venezolano: sanciones, expedientes, actas y KPIs.',
  applicationName: 'Consejo de Honor FVF',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#3C0C24',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es-VE"
      className={`light-theme ${jost.variable} ${oswald.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-vin-900 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
