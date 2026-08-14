# Base de datos VESTIA

PostgreSQL multi-comercio para productos y variantes, dueños de mercadería, lotes FIFO, inventario, compras, ventas, tipos de pago declarativos, caja, gastos, devoluciones, cambios, reportes, liquidaciones y auditoría.

Las migraciones `001` a `020` son la fuente de verdad. El archivo `VESTIA_BASE_DATOS_COMPLETA_2026-08-14.sql` las reúne para instalar un proyecto Supabase nuevo. En el proyecto vinculado actual ya están aplicadas.

## Operaciones críticas

- `save_product_complete`: producto, códigos, variantes, talles, colores e imágenes.
- `create_and_confirm_purchase`: compra, detalle, lotes, saldo y movimientos.
- `complete_sale` y `cancel_sale`: ventas atómicas y su anulación completa.
- `register_return_with_method`: devolución al dueño/lote original y tipo de pago del reintegro.
- `register_exchange_with_method`: devolución y nueva venta en una transacción, con tipo de pago para la diferencia.
- `open_cash_register`, `cash_session_summary`, `close_cash_register`.
- `register_expense`: gasto comercial o asociado a un dueño.
- `start_physical_inventory`, `set_physical_inventory_count`, `complete_physical_inventory`.
- `create_owner_settlement`: liquidación histórica guardada y auditada.

Los tipos de pago solamente identifican cómo se cobró o reintegró. VESTIA no crea operaciones, enlaces, QR ni integraciones con Mercado Pago u otros proveedores.

Los buckets son privados. Los logos e imágenes se sirven mediante URL firmada y las políticas restringen el acceso por `business_id`.
