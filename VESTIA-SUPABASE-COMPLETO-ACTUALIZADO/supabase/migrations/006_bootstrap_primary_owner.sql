begin;

do $$
declare
  v_auth_user_id constant uuid := '9cce2750-ff96-4c16-bc01-df86c03017e6';
  v_auth_user auth.users%rowtype;
  v_business_id uuid;
  v_first_name text;
  v_last_name text;
begin
  select * into v_auth_user from auth.users where id = v_auth_user_id;
  if not found then
    raise exception 'No existe el usuario Auth 9cce2750-ff96-4c16-bc01-df86c03017e6';
  end if;

  if exists(select 1 from public.profiles where auth_user_id = v_auth_user_id) then
    update public.profiles set role='OWNER', active=true, updated_at=now()
    where auth_user_id=v_auth_user_id;
    return;
  end if;

  v_first_name := coalesce(
    nullif(v_auth_user.raw_user_meta_data->>'first_name',''),
    nullif(split_part(coalesce(v_auth_user.raw_user_meta_data->>'full_name',''), ' ', 1),''),
    'Dueño'
  );
  v_last_name := coalesce(
    nullif(v_auth_user.raw_user_meta_data->>'last_name',''),
    nullif(btrim(replace(coalesce(v_auth_user.raw_user_meta_data->>'full_name',''),v_first_name,'')),''),
    'Principal'
  );

  insert into public.businesses(name, legal_name, email)
  values ('VESTIA', 'VESTIA', v_auth_user.email)
  returning id into v_business_id;

  insert into public.profiles(auth_user_id,business_id,first_name,last_name,email,role,active)
  values(v_auth_user_id,v_business_id,v_first_name,v_last_name,v_auth_user.email,'OWNER',true);

  insert into public.payment_methods(business_id,code,name) values
    (v_business_id,'CASH','Efectivo'),
    (v_business_id,'DEBIT','Débito'),
    (v_business_id,'CREDIT','Crédito'),
    (v_business_id,'TRANSFER','Transferencia'),
    (v_business_id,'MERCADOPAGO','Mercado Pago'),
    (v_business_id,'QR','QR'),
    (v_business_id,'OTHER','Otro');

  insert into public.cash_registers(business_id,name)
  values(v_business_id,'Caja principal');

  insert into public.sizes(business_id,name,sort_order) values
    (v_business_id,'XS',1),(v_business_id,'S',2),(v_business_id,'M',3),
    (v_business_id,'L',4),(v_business_id,'XL',5),(v_business_id,'XXL',6),
    (v_business_id,'36',7),(v_business_id,'38',8),(v_business_id,'40',9),
    (v_business_id,'42',10),(v_business_id,'44',11),(v_business_id,'46',12);

  insert into public.app_settings(business_id,store_name,email)
  values(v_business_id,'VESTIA',v_auth_user.email);
end $$;

commit;
