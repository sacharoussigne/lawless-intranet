import type {
  CategoryItemRecord,
  CompanyGroupRecord,
  CraftRecipeItemRecord,
  CraftRecipeRecord,
  ItemRecord,
} from '@lawless-intranet/types';

export type ItemWithRelations = ItemRecord;

export type CraftRecipeItemWithItem = CraftRecipeItemRecord;

export type CraftRecipeWithIngredients = CraftRecipeRecord & {
  ingredients: CraftRecipeItemWithItem[];
};

export type { CategoryItemRecord as CategoryItem };
export type CompanyGroupSelect = Pick<CompanyGroupRecord, 'id' | 'name'>;
