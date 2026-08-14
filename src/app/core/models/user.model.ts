export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  roleId?: string | null;
  businessId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
