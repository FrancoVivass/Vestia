insert into public.permissions(code,name,module) values
('sales.create','Realizar ventas','Ventas'),('sales.read','Consultar ventas','Ventas'),('stock.read','Consultar stock','Inventario'),('customers.create','Registrar clientes','Clientes'),('returns.create','Gestionar devoluciones','Devoluciones'),('exchanges.create','Gestionar cambios','Cambios') on conflict do nothing;
insert into public.role_permissions(role,permission_code) select 'OWNER',code from public.permissions on conflict do nothing;
insert into public.role_permissions(role,permission_code) values ('CASHIER','sales.create'),('CASHIER','sales.read'),('CASHIER','stock.read'),('CASHIER','customers.create') on conflict do nothing;
-- Luego de crear un business, ejecutar para cada comercio:
-- insert into payment_methods(business_id,code,name) values
-- ('<business-id>','CASH','Efectivo'),('<business-id>','DEBIT','Débito'),('<business-id>','CREDIT','Crédito'),
-- ('<business-id>','TRANSFER','Transferencia'),('<business-id>','MERCADOPAGO','Mercado Pago'),('<business-id>','QR','QR'),('<business-id>','OTHER','Otro');
-- insert into cash_registers(business_id,name) values ('<business-id>','Caja principal');
-- insert into sizes(business_id,name,sort_order) values ('<business-id>','XS',1),('<business-id>','S',2),('<business-id>','M',3),('<business-id>','L',4),('<business-id>','XL',5),('<business-id>','XXL',6);
-- Los usuarios Auth se crean desde Supabase Auth. Luego se inserta su profile con el auth_user_id correspondiente.
