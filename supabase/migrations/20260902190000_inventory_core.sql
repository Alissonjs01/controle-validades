create extension if not exists pgcrypto;

create type public.inventory_movement_type as enum (
  'ENTRY',
  'EXIT',
  'ZERO',
  'ADJUSTMENT'
);

create type public.lot_status as enum (
  'OPEN',
  'ZEROED',
  'CLOSED'
);

create type public.vocabulary_group as enum (
  'ENTRY',
  'EXIT',
  'ZERO',
  'EXPIRATION',
  'PACKAGING'
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_unit_label text not null default 'unidade',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_name_not_blank check (length(trim(name)) > 0),
  constraint products_base_unit_not_blank check (length(trim(base_unit_label)) > 0)
);

create table public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  constraint product_aliases_alias_not_blank check (length(trim(alias)) > 0),
  constraint product_aliases_normalized_not_blank check (length(trim(normalized_alias)) > 0),
  constraint product_aliases_unique_per_product unique (product_id, normalized_alias)
);

create table public.packaging_conversions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  packaging_type text not null,
  multiplier numeric(12, 3) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint packaging_conversions_type_not_blank check (length(trim(packaging_type)) > 0),
  constraint packaging_conversions_multiplier_positive check (multiplier > 0),
  constraint packaging_conversions_unique_type_per_product unique (product_id, packaging_type)
);

create table public.packaging_aliases (
  id uuid primary key default gen_random_uuid(),
  conversion_id uuid not null references public.packaging_conversions(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  created_at timestamptz not null default now(),
  constraint packaging_aliases_alias_not_blank check (length(trim(alias)) > 0),
  constraint packaging_aliases_normalized_not_blank check (length(trim(normalized_alias)) > 0),
  constraint packaging_aliases_unique_per_conversion unique (conversion_id, normalized_alias)
);

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  expiration_date date not null,
  lot_code text,
  original_quantity numeric(14, 3) not null,
  current_quantity numeric(14, 3) not null,
  status public.lot_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lots_original_quantity_non_negative check (original_quantity >= 0),
  constraint lots_current_quantity_non_negative check (current_quantity >= 0),
  constraint lots_zero_status_consistency check (
    (current_quantity = 0 and status in ('ZEROED', 'CLOSED')) or
    (current_quantity > 0 and status = 'OPEN')
  )
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  type public.inventory_movement_type not null,
  product_id uuid not null references public.products(id) on delete restrict,
  lot_id uuid references public.lots(id) on delete restrict,
  quantity_delta numeric(14, 3) not null,
  quantity_before numeric(14, 3),
  quantity_after numeric(14, 3),
  source_text text,
  parsed_command jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint inventory_movements_quantity_before_non_negative check (
    quantity_before is null or quantity_before >= 0
  ),
  constraint inventory_movements_quantity_after_non_negative check (
    quantity_after is null or quantity_after >= 0
  ),
  constraint inventory_movements_delta_direction check (
    (type = 'ENTRY' and quantity_delta > 0) or
    (type in ('EXIT', 'ZERO') and quantity_delta < 0) or
    (type = 'ADJUSTMENT')
  )
);

create table public.vocabulary_terms (
  id uuid primary key default gen_random_uuid(),
  group_name public.vocabulary_group not null,
  term text not null,
  normalized_term text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_terms_term_not_blank check (length(trim(term)) > 0),
  constraint vocabulary_terms_normalized_not_blank check (length(trim(normalized_term)) > 0),
  constraint vocabulary_terms_unique_group_term unique (group_name, normalized_term)
);

create index product_aliases_normalized_alias_idx
  on public.product_aliases (normalized_alias);

create index packaging_aliases_normalized_alias_idx
  on public.packaging_aliases (normalized_alias);

create index lots_product_expiration_open_idx
  on public.lots (product_id, expiration_date)
  where status = 'OPEN' and current_quantity > 0;

create index inventory_movements_product_occurred_idx
  on public.inventory_movements (product_id, occurred_at desc);

create index inventory_movements_lot_occurred_idx
  on public.inventory_movements (lot_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger packaging_conversions_set_updated_at
before update on public.packaging_conversions
for each row execute function public.set_updated_at();

create trigger lots_set_updated_at
before update on public.lots
for each row execute function public.set_updated_at();

create trigger vocabulary_terms_set_updated_at
before update on public.vocabulary_terms
for each row execute function public.set_updated_at();

create or replace function public.inventory_apply_lot_movement(
  p_lot_id uuid,
  p_type public.inventory_movement_type,
  p_quantity_delta numeric,
  p_source_text text default null,
  p_parsed_command jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_lot public.lots%rowtype;
  v_delta numeric(14, 3);
  v_after numeric(14, 3);
  v_movement_id uuid;
begin
  select *
    into v_lot
    from public.lots
   where id = p_lot_id
   for update;

  if not found then
    raise exception 'Lot % not found', p_lot_id;
  end if;

  if v_lot.status <> 'OPEN' then
    raise exception 'Lot % is not open', p_lot_id;
  end if;

  v_delta := case
    when p_type = 'ZERO' then -v_lot.current_quantity
    else p_quantity_delta
  end;
  v_after := v_lot.current_quantity + v_delta;

  if v_after < 0 then
    raise exception 'Movement would produce negative inventory for lot %', p_lot_id;
  end if;

  update public.lots
     set current_quantity = v_after,
         status = case
           when v_after = 0 then 'ZEROED'::public.lot_status
           else 'OPEN'::public.lot_status
         end
   where id = p_lot_id;

  insert into public.inventory_movements (
    type,
    product_id,
    lot_id,
    quantity_delta,
    quantity_before,
    quantity_after,
    source_text,
    parsed_command,
    metadata
  )
  values (
    p_type,
    v_lot.product_id,
    p_lot_id,
    v_delta,
    v_lot.current_quantity,
    v_after,
    p_source_text,
    coalesce(p_parsed_command, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_movement_id;

  return v_movement_id;
end;
$$;
