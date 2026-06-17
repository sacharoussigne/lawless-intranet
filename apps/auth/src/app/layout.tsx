import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lawless Auth',
  description: 'Identity provider for Lawless Intranet',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
