import { CatalogEntityStatus } from './category.model';

export interface ProductImage {
  id: string;
  url: string;
  order: number;
  path?: string | null;
}

export interface ProductVariant {
  id: string;
  name: string;
  color: string;
  size: string;
  sku: string;
  barcode: string;
  stock: number;
  ownerId?: string;
  cost: number;
  price: number;
  status: CatalogEntityStatus;
}

export interface Product {
  id: string;
  businessId: string;
  name: string;
  sku: string;
  internalCode: string;
  barcode: string;
  description: string;
  categoryId: string;
  brandId: string;
  purchasePrice: number;
  salePrice: number;
  promotionalPrice: number | null;
  margin: number;
  stock: number;
  status: CatalogEntityStatus;
  images: ProductImage[];
  variants: ProductVariant[];
  createdAt: string;
}

export interface ProductFormValue {
  name: string;
  sku: string;
  internalCode: string;
  barcode: string;
  description: string;
  categoryId: string;
  brandId: string;
  purchasePrice: number;
  salePrice: number;
  promotionalPrice: number | null;
  stock: number;
  status: CatalogEntityStatus;
  images: ProductImage[];
  variants: ProductVariant[];
}
