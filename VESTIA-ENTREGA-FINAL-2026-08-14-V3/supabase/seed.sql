insert into public.permissions(code,name,module) values
  ('products.read','Ver productos','Productos'),
  ('products.create','Crear productos','Productos'),
  ('products.update','Editar productos','Productos'),
  ('products.delete','Desactivar productos','Productos'),
  ('stock.read','Consultar stock','Inventario'),
  ('stock.adjust','Ajustar stock','Inventario'),
  ('sales.read','Consultar ventas','Ventas'),
  ('sales.create','Realizar ventas','Ventas'),
  ('sales.cancel','Anular ventas','Ventas'),
  ('customers.read','Consultar clientes','Clientes'),
  ('customers.create','Registrar clientes','Clientes'),
  ('customers.update','Editar clientes','Clientes'),
  ('suppliers.read','Consultar proveedores','Proveedores'),
  ('suppliers.create','Registrar proveedores','Proveedores'),
  ('purchases.read','Consultar compras','Compras'),
  ('purchases.create','Registrar compras','Compras'),
  ('cash.read','Consultar caja','Caja'),
  ('cash.open','Abrir caja','Caja'),
  ('cash.close','Cerrar caja','Caja'),
  ('cash.movements','Registrar movimientos de caja','Caja'),
  ('reports.read','Consultar reportes','Reportes'),
  ('users.read','Consultar usuarios','Usuarios'),
  ('users.create','Crear usuarios','Usuarios'),
  ('users.update','Editar usuarios','Usuarios'),
  ('users.delete','Activar o desactivar usuarios','Usuarios'),
  ('settings.read','Consultar configuración','Configuración'),
  ('settings.update','Editar configuración','Configuración'),
  ('returns.create','Gestionar devoluciones','Posventa'),
  ('exchanges.create','Gestionar cambios','Posventa')
on conflict(code) do update set name=excluded.name,module=excluded.module;

insert into public.role_permissions(role,permission_code,enabled)
select 'OWNER',code,true from public.permissions
on conflict(role,permission_code) do update set enabled=true;

insert into public.role_permissions(role,permission_code,enabled) values
  ('CASHIER','products.read',true),
  ('CASHIER','stock.read',true),
  ('CASHIER','sales.read',true),
  ('CASHIER','sales.create',true),
  ('CASHIER','customers.read',true),
  ('CASHIER','customers.create',true),
  ('CASHIER','cash.read',true),
  ('CASHIER','cash.open',true),
  ('CASHIER','cash.close',true)
on conflict(role,permission_code) do update set enabled=excluded.enabled;

-- Los tipos de pago se crean desde Configuración o al dar de alta un comercio.
-- Son etiquetas declarativas: VESTIA no crea cobros, QR, links ni integraciones externas.
