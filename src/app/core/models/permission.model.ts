export interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  group?: string;
}

export const PERMISSIONS: Permission[] = [
  { id: 'p-001', code: 'products.read', name: 'Ver productos', group: 'Productos' },
  { id: 'p-002', code: 'products.create', name: 'Crear productos', group: 'Productos' },
  { id: 'p-003', code: 'products.update', name: 'Editar productos', group: 'Productos' },
  { id: 'p-004', code: 'products.delete', name: 'Desactivar productos', group: 'Productos' },
  { id: 'p-005', code: 'stock.read', name: 'Ver stock', group: 'Stock' },
  { id: 'p-006', code: 'stock.adjust', name: 'Ajustar stock', group: 'Stock' },
  { id: 'p-007', code: 'sales.read', name: 'Ver ventas', group: 'Ventas' },
  { id: 'p-008', code: 'sales.create', name: 'Crear ventas', group: 'Ventas' },
  { id: 'p-009', code: 'sales.cancel', name: 'Anular ventas', group: 'Ventas' },
  { id: 'p-010', code: 'customers.read', name: 'Ver clientes', group: 'Clientes' },
  { id: 'p-011', code: 'customers.create', name: 'Crear clientes', group: 'Clientes' },
  { id: 'p-012', code: 'customers.update', name: 'Editar clientes', group: 'Clientes' },
  { id: 'p-013', code: 'suppliers.read', name: 'Ver proveedores', group: 'Proveedores' },
  { id: 'p-014', code: 'suppliers.create', name: 'Crear proveedores', group: 'Proveedores' },
  { id: 'p-015', code: 'purchases.read', name: 'Ver compras', group: 'Compras' },
  { id: 'p-016', code: 'purchases.create', name: 'Crear compras', group: 'Compras' },
  { id: 'p-017', code: 'cash.read', name: 'Ver caja', group: 'Caja' },
  { id: 'p-018', code: 'cash.open', name: 'Abrir caja', group: 'Caja' },
  { id: 'p-019', code: 'cash.close', name: 'Cerrar caja', group: 'Caja' },
  { id: 'p-020', code: 'cash.movements', name: 'Registrar movimientos de caja', group: 'Caja' },
  { id: 'p-021', code: 'reports.read', name: 'Ver reportes', group: 'Reportes' },
  { id: 'p-022', code: 'users.read', name: 'Ver usuarios', group: 'Usuarios' },
  { id: 'p-023', code: 'users.create', name: 'Crear usuarios', group: 'Usuarios' },
  { id: 'p-024', code: 'users.update', name: 'Editar usuarios', group: 'Usuarios' },
  { id: 'p-025', code: 'users.delete', name: 'Activar o desactivar usuarios', group: 'Usuarios' },
  { id: 'p-026', code: 'settings.read', name: 'Ver configuración', group: 'Configuración' },
  { id: 'p-027', code: 'settings.update', name: 'Editar configuración', group: 'Configuración' },
  { id: 'p-028', code: 'returns.create', name: 'Registrar devoluciones', group: 'Posventa' },
  { id: 'p-029', code: 'exchanges.create', name: 'Registrar cambios', group: 'Posventa' },
];
