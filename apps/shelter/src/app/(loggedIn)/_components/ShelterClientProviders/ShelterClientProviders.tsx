'use client';

import type { ReactNode } from 'react';
import { AnimalSpotlightProvider } from '@/app/_contexts/AnimalSpotlightContext';
import type { AnimalDTO } from '@/app/(loggedIn)/s/[shelterSlug]/employee/animals/types';

export function ShelterClientProviders({
  animals,
  children,
}: {
  animals: AnimalDTO[];
  children: ReactNode;
}) {
  return (
    <AnimalSpotlightProvider animals={animals}>
      {children}
    </AnimalSpotlightProvider>
  );
}
