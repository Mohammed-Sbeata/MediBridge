import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MediBridge',
  description: 'Connecting healthcare professionals across borders',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen antialiased" style={{ backgroundColor: '#F5F5F5' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
