/** Sample values for the template previews, in the current RP year of the shelter. */
export const sampleAnimalTemplateVariables = (rpYear: number) => ({
  shelterName: 'Refuge Lawless',
  animalName: 'Moustache',
  speciesName: 'Chat',
  breedName: 'Européen',
  variantName: 'Roux',
  arrivalDate: `12/03/${rpYear}`,
  adoptionPrice: '$150.00',
  status: "En attente d'adoption",
  caseManagerName: 'Alice Dupont',
  adopterName: 'Jean Martin',
  departureDate: `20/06/${rpYear}`,
  biography: 'Chat calin et sociable.',
  careProvided: 'Vaccination et vermifuge.',
  notes: 'Préfère les foyers calmes.',
});
