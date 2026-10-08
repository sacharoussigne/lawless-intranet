'use client';

import type { ReactNode } from 'react';
import { AnimalSpotlightProvider } from '@/app/_contexts/AnimalSpotlightContext';
import { QueryProvider } from '@/lib/react-query/QueryProvider';

export function ShelterClientProviders({
  shelterSlug,
  children,
}: {
  shelterSlug: string;
  children: ReactNode;
}) {
  return (
    <QueryProvider>
      <AnimalSpotlightProvider shelterSlug={shelterSlug}>
        {children}
      </AnimalSpotlightProvider>
    </QueryProvider>
  );
}
