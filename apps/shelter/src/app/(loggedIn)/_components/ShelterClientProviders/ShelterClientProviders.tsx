'use client';

import type { ReactNode } from 'react';
import { AnimalSpotlightProvider } from '@/app/_contexts/AnimalSpotlightContext';

export function ShelterClientProviders({
  shelterSlug,
  children,
}: {
  shelterSlug: string;
  children: ReactNode;
}) {
  return (
    <AnimalSpotlightProvider shelterSlug={shelterSlug}>
      {children}
    </AnimalSpotlightProvider>
  );
}
