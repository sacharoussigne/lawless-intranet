export type SpeciesVariantDTO = {
  id: string;
  breedId: string;
  label: string;
  sortOrder: number;
};

export type BreedDTO = {
  id: string;
  speciesId: string;
  name: string;
  sortOrder: number;
  shelterPurchasePrice: number | null;
  animalierPurchasePrice: number | null;
  variants: SpeciesVariantDTO[];
};

export type SpeciesDTO = {
  id: string;
  shelterId: string;
  name: string;
  sortOrder: number;
  breeds: BreedDTO[];
};
