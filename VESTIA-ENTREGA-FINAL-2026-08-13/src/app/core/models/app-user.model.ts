import { RoleCode } from './role.model';

export type UserStatus = 'active' | 'inactive';

export interface AppUser {
  id: string;
  fullName: string;
  email: string;
  role: RoleCode;
  businessId: string | null;
  ownerId: string | null;
  status: UserStatus;
  permissions: string[];
  createdAt: string;
}

export interface AppUserFormValue {
  fullName: string;
  email: string;
  role: RoleCode;
  status: UserStatus;
  permissions: string[];
  ownerId?: string | null;
  password?: string;
}
