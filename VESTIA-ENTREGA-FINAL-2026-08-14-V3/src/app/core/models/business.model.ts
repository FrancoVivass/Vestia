export type BusinessStatus = 'active' | 'inactive';

export interface Business {
  id: string;
  name: string;
  slug: string;
  legalName: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  logoUrl?: string | null;
  logoPath?: string | null;
  status: BusinessStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface BusinessFormValue {
  name: string;
  legalName: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  logoUrl?: string | null;
}

export interface BusinessMetrics {
  activeBusinesses: number;
  inactiveBusinesses: number;
  totalUsers: number;
  totalSales: number;
  totalProducts: number;
}

export interface BusinessActivityItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}
