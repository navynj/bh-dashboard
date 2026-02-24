import type { Cost, Ingredient, Packaging, Labor, Other, Price, Tag } from '@prisma/client';

type WithoutTimestamps<T> = Omit<T, 'createdAt' | 'updatedAt'>;

export type CostBase = WithoutTimestamps<Cost>;
export type IngredientBase = WithoutTimestamps<Ingredient>;
export type PackagingBase = WithoutTimestamps<Packaging>;
export type LaborBase = WithoutTimestamps<Labor>;
export type OtherBase = WithoutTimestamps<Other>;
export type PriceBase = WithoutTimestamps<Price>;
export type TagBase = WithoutTimestamps<Tag>;

export interface IngredientApiResponse extends Omit<IngredientBase, 'image'> {
  image?: { src: string; alt: string } | null;
  unitPrice: number | null;
  amountPrice: number | null;
  gPrice: number | null;
  metadata?: unknown;
}

export interface PackagingApiResponse extends Omit<PackagingBase, 'image'> {
  image?: { src: string; alt: string } | null;
  unitPrice: number | null;
  amountPrice: number | null;
  gPrice: number | null;
  metadata?: unknown;
}

export interface LaborApiResponse extends LaborBase {}
export interface OtherApiResponse extends OtherBase {}
export interface PriceApiResponse extends PriceBase {}

export interface CostApiResponse extends CostBase {
  ingredients: IngredientApiResponse[];
  packagings: PackagingApiResponse[];
  labors: LaborApiResponse[];
  others: OtherApiResponse[];
  prices: PriceApiResponse[];
  tags: TagBase[];
}

/** Alias for tag used in cost editor UI. */
export type TagApiResponse = TagBase;

/** Cost state shape used by the cost editor (API response shape). */
export type CostEditorStateWithHandlers = CostApiResponse;

/** Price row in the editor. */
export type PriceEditorItem = PriceApiResponse;

/** Ingredient/packaging row in the editor. */
export type IngredientEditorItem = IngredientApiResponse | PackagingApiResponse;

/** Ingredient row with handler fields in the editor. */
export type IngredientEditorItemWithHandlers = IngredientApiResponse & { _handlers?: unknown };

/** Other row in the editor. */
export type OtherEditorItem = OtherApiResponse;

/** Other row with handler fields in the editor. */
export type OtherEditorItemWithHandlers = OtherApiResponse & { _handlers?: unknown };

/** Labor row in the editor. */
export type LaborEditorItem = LaborApiResponse;

/** Labor row with handler fields in the editor. */
export type LaborEditorItemWithHandlers = LaborApiResponse & { _handlers?: unknown };

export interface LaborApiRequest extends Omit<LaborBase, 'costId'> {}
export interface OtherApiRequest extends Omit<OtherBase, 'costId'> {}
export type PriceApiRequest = Omit<PriceBase, 'costId' | 'isFinalPrice'> & {
  isFinalPrice?: boolean;
};
