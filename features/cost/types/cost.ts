export interface CostPrice {
  id: string;
  title: string;
  margin: number;
  price: number;
  base: string | null;
  isFinalPrice: boolean;
  rank: string;
}

export interface CostTag {
  id: string;
  name: string;
  color: string;
}

export interface CostListItem {
  id: string;
  title: string;
  tags: CostTag[];
  prices: CostPrice[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CostsApiResponse {
  costs: CostListItem[];
}
