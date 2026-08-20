-- Migration: Fix foreign key constraint on return_items.sale_item_allocation_id
-- Adds ON DELETE CASCADE so when sale_item_allocations are deleted (e.g. sale cancel),
-- the referencing return_items are also cleaned up.

ALTER TABLE public.return_items
  DROP CONSTRAINT IF EXISTS return_items_sale_item_allocation_id_fkey;

ALTER TABLE public.return_items
  ADD CONSTRAINT return_items_sale_item_allocation_id_fkey
  FOREIGN KEY (sale_item_allocation_id)
  REFERENCES public.sale_item_allocations(id)
  ON DELETE CASCADE;
