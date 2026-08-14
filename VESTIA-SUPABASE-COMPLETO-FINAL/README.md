# Base de datos VESTIA

PostgreSQL multi-comercio para productos y variantes, dueños de mercadería, lotes FIFO, inventario, compras, ventas, pagos declarativos, caja, devoluciones, cambios, reportes y auditoría.

Las migraciones son la fuente de verdad. `seed.sql` agrega el catálogo inicial de permisos y no contiene datos comerciales de demostración.

## Operaciones críticas

- `save_product`: producto, variantes, talles, colores e imágenes.
- `create_and_confirm_purchase`: compra, detalle, lotes, saldo y movimientos.
- `complete_sale`: venta, asignación FIFO, pagos, caja, stock y auditoría.
- `register_return`: devolución al dueño y lote originales.
- `register_exchange`: devolución y nueva venta en una sola transacción.
- `open_cash_register`, `cash_session_summary`, `close_cash_register`.
- `adjust_inventory`: ajuste seguro con coherencia entre lotes y saldo.

Los buckets `business-assets` y `product-images` son privados y tienen políticas por `business_id`.
