import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documents API',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
