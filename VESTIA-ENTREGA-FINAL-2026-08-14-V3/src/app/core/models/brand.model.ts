import { CatalogEntityStatus } from './category.model';

export interface Brand {
  id: string;
  name: string;
  description: string;
  businessId: string;
  status: CatalogEntityStatus;
  createdAt: string;
}
