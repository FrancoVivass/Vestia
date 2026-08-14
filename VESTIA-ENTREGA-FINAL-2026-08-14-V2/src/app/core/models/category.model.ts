export type CatalogEntityStatus = 'active' | 'inactive';

export interface Category {
  id: string;
  name: string;
  description: string;
  businessId: string;
  status: CatalogEntityStatus;
  createdAt: string;
}
