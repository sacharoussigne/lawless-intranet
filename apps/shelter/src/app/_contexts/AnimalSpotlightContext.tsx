'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AnimalDTO } from '@/app/(loggedIn)/s/[shelterSlug]/employee/animals/types';

type AnimalSpotlightContextValue = {
  animals: AnimalDTO[];
  opened: boolean;
  open: () => void;
  close: () => void;
};

const AnimalSpotlightContext = createContext<AnimalSpotlightContextValue | null>(null);

export function AnimalSpotlightProvider({
  animals,
  children,
}: {
  animals: AnimalDTO[];
  children: ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <AnimalSpotlightContext.Provider
      value={{ animals, opened, open: () => setOpened(true), close: () => setOpened(false) }}
    >
      {children}
    </AnimalSpotlightContext.Provider>
  );
}

export function useAnimalSpotlight() {
  const ctx = useContext(AnimalSpotlightContext);
  return ctx;
}
