-- Ejecutar una vez en Supabase SQL Editor.
create extension if not exists pgcrypto;
create type public.user_role as enum ('admin','seller');
create type public.production_status as enum ('pending','in_progress','finished');

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 role public.user_role not null default 'seller',
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.products (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name))>0),
 sku text unique,
 description text,
 image_url text,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.orders (
 id uuid primary key default gen_random_uuid(),
 order_number bigint generated always as identity unique,
 seller_id uuid not null references public.profiles(id),
 customer_name text not null check(length(trim(customer_name))>0),
 customer_phone text,
 delivery_date date,
 notes text,
 created_at timestamptz not null default now()
);
create table public.order_items (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid not null references public.products(id),
 quantity integer not null check(quantity>0),
 status public.production_status not null default 'pending',
 notes text,
 created_at timestamptz not null default now()
);
create index on public.orders(seller_id,created_at desc);
create index on public.order_items(order_id);
create index on public.order_items(status);

-- SECURITY DEFINER consulta solo el perfil propio, evitando recursión en RLS.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and active=true);
$$;
create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and active=true);
$$;
revoke all on function public.is_admin() from public;
revoke all on function public.is_active_user() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;

-- Los nuevos usuarios se registran como vendedores. El primer admin se promueve manualmente.
create or replace function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,full_name,role)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),'seller');
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_profile();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "profiles read" on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
create policy "profiles admin update" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "products read" on public.products for select to authenticated using (public.is_active_user());
create policy "products admin insert" on public.products for insert to authenticated with check (public.is_admin());
create policy "products admin update" on public.products for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "orders read" on public.orders for select to authenticated using (public.is_admin() or (public.is_active_user() and seller_id=auth.uid()));
create policy "orders insert" on public.orders for insert to authenticated with check (public.is_active_user() and (seller_id=auth.uid() or public.is_admin()));
create policy "orders admin update" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "items read" on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id));
create policy "items insert" on public.order_items for insert to authenticated with check (
 public.is_active_user() and exists(select 1 from public.orders o where o.id=order_id and (o.seller_id=auth.uid() or public.is_admin()))
);
create policy "items admin update" on public.order_items for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Crear pedido + múltiples ítems de forma atómica; vendedor no puede suplantar otro vendedor.
create or replace function public.create_order(p_customer_name text,p_customer_phone text,p_delivery_date date,p_notes text,p_items jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_item jsonb;
begin
 if not public.is_active_user() then raise exception 'Cuenta inactiva'; end if;
 if nullif(trim(p_customer_name),'') is null then raise exception 'Cliente requerido'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 then raise exception 'Agrega productos'; end if;
 insert into public.orders(seller_id,customer_name,customer_phone,delivery_date,notes)
 values(auth.uid(),trim(p_customer_name),nullif(trim(p_customer_phone),''),p_delivery_date,nullif(trim(p_notes),'')) returning id into v_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
   if not exists(select 1 from public.products where id=(v_item->>'product_id')::uuid and active) then raise exception 'Producto no disponible'; end if;
   insert into public.order_items(order_id,product_id,quantity,notes)
   values(v_id,(v_item->>'product_id')::uuid,(v_item->>'quantity')::integer,nullif(trim(v_item->>'notes'),''));
 end loop;
 return v_id;
end; $$;
revoke all on function public.create_order(text,text,date,text,jsonb) from public;
grant execute on function public.create_order(text,text,date,text,jsonb) to authenticated;

-- Para que el vendedor no modifique el estado de producción ni campos ajenos, la actualización
-- se realiza exclusivamente por administradores (la UI también lo refleja).
