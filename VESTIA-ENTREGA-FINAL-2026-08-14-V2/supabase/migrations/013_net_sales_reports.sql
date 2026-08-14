begin;

create or replace view public.owner_sales_summary
with (security_invoker = true)
as
select
  sale.business_id,
  allocation.owner_id,
  owner.first_name as owner_first_name,
  owner.last_name as owner_last_name,
  date_trunc('day', sale.created_at) as sale_day,
  sum((allocation.quantity - coalesce(returned.quantity, 0)) * (item.subtotal / nullif(item.quantity, 0))) as gross_sales,
  sum((allocation.quantity - coalesce(returned.quantity, 0)) * allocation.unit_cost) as cost,
  sum((allocation.quantity - coalesce(returned.quantity, 0)) * ((item.subtotal / nullif(item.quantity, 0)) - allocation.unit_cost)) as estimated_profit,
  sum(allocation.quantity - coalesce(returned.quantity, 0)) as units
from public.sales sale
join public.sale_items item on item.sale_id = sale.id
join public.sale_item_allocations allocation on allocation.sale_item_id = item.id
join public.owners owner on owner.id = allocation.owner_id
left join lateral (
  select coalesce(sum(return_item.quantity), 0)::integer as quantity
  from public.return_items return_item
  where return_item.sale_item_allocation_id = allocation.id
) returned on true
where sale.status <> 'CANCELLED'
  and allocation.quantity - coalesce(returned.quantity, 0) > 0
group by sale.business_id, allocation.owner_id, owner.first_name, owner.last_name, date_trunc('day', sale.created_at);

create or replace view public.dashboard_summary
with (security_invoker = true)
as
select
  business.id as business_id,
  coalesce((
    select sum(net.net_total)
    from (
      select sale.id, sale.created_at,
        greatest(
          sum((allocation.quantity - coalesce(returned.quantity, 0)) * (item.subtotal / nullif(item.quantity, 0)))
          - sale.discount * (
              sum((allocation.quantity - coalesce(returned.quantity, 0)) * (item.subtotal / nullif(item.quantity, 0)))
              / nullif(sale.subtotal, 0)
            ),
          0
        ) as net_total
      from public.sales sale
      join public.sale_items item on item.sale_id = sale.id
      join public.sale_item_allocations allocation on allocation.sale_item_id = item.id
      left join lateral (
        select coalesce(sum(return_item.quantity), 0)::integer as quantity
        from public.return_items return_item
        where return_item.sale_item_allocation_id = allocation.id
      ) returned on true
      where sale.business_id = business.id and sale.status <> 'CANCELLED'
      group by sale.id
    ) net
    where net.created_at >= current_date
  ), 0) as today_sales,
  coalesce((
    select sum(net.net_total)
    from (
      select sale.id, sale.created_at,
        greatest(
          sum((allocation.quantity - coalesce(returned.quantity, 0)) * (item.subtotal / nullif(item.quantity, 0)))
          - sale.discount * (
              sum((allocation.quantity - coalesce(returned.quantity, 0)) * (item.subtotal / nullif(item.quantity, 0)))
              / nullif(sale.subtotal, 0)
            ),
          0
        ) as net_total
      from public.sales sale
      join public.sale_items item on item.sale_id = sale.id
      join public.sale_item_allocations allocation on allocation.sale_item_id = item.id
      left join lateral (
        select coalesce(sum(return_item.quantity), 0)::integer as quantity
        from public.return_items return_item
        where return_item.sale_item_allocation_id = allocation.id
      ) returned on true
      where sale.business_id = business.id and sale.status <> 'CANCELLED'
      group by sale.id
    ) net
    where net.created_at >= date_trunc('month', now())
  ), 0) as month_sales,
  coalesce((select sum(balance.quantity) from public.inventory_balances balance where balance.business_id = business.id), 0) as total_stock,
  coalesce((
    select count(*) from public.inventory_balances balance
    join public.product_variants variant on variant.id = balance.variant_id
    where balance.business_id = business.id and variant.active and balance.quantity <= variant.minimum_stock
  ), 0) as low_stock
from public.businesses business;

grant select on public.owner_sales_summary, public.dashboard_summary to authenticated;

commit;
