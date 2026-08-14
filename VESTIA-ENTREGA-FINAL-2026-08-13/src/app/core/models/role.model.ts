export type RoleCode = 'OWNER' | 'CASHIER';

export interface Role {
  id: string;
  name: string;
  code: RoleCode;
  permissions: string[];
  description?: string;
}
