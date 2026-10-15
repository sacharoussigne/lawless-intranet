'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AnimalDTO } from '@/app/(loggedIn)/s/[shelterSlug]/employee/animals/types';
import { fetchRead } from '@/lib/read/fetchRead';

type AnimalSpotlightContextValue = {
  animals: AnimalDTO[];
  loading: boolean;
  opened: boolean;
  open: () => void;
  close: () => void;
};

const AnimalSpotlightContext = createContext<AnimalSpotlightContextValue | null>(null);

export function AnimalSpotlightProvider({
  shelterSlug,
  children,
}: {
  shelterSlug: string;
  children: ReactNode;
}) {
  const [animals, setAnimals] = useState<AnimalDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);

  const open = () => {
    setOpened(true);
    setLoading(true);
    void fetchRead(shelterSlug, 'animals').then((result) => {
      if ('data' in result && Array.isArray(result.data)) {
        setAnimals(result.data as AnimalDTO[]);
      }
      setLoading(false);
    });
  };

  return (
    <AnimalSpotlightContext.Provider
      value={{ animals, loading, opened, open, close: () => setOpened(false) }}
    >
      {children}
    </AnimalSpotlightContext.Provider>
  );
}

export function useAnimalSpotlight() {
  return useContext(AnimalSpotlightContext);
}
