import type { ReactNode } from 'react';
import './globals.css';
import { AppProvider } from '@/context/app-context';
import { AppShell } from '@/components/app-shell';

export const metadata = {
  title: 'Orsomarso SC Performance Hub',
  description: 'Monitoreo de rendimiento de fútbol profesional',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
