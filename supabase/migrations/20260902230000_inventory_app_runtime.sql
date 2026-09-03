create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default false,
  milestones integer[] not null default array[30, 15, 7, 0],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_milestones_allowed check (
    milestones <@ array[30, 15, 7, 0]
  )
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots(id) on delete cascade,
  milestone integer not null,
  delivered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint notification_deliveries_milestone_allowed check (
    milestone in (30, 15, 7, 0)
  ),
  constraint notification_deliveries_unique_lot_milestone unique (lot_id, milestone)
);

create index notification_deliveries_lot_idx
  on public.notification_deliveries (lot_id, delivered_at desc);

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create or replace function public.inventory_create_entry_lot(
  p_product_id uuid,
  p_expiration_date date,
  p_base_quantity numeric,
  p_source_text text default null,
  p_parsed_command jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_lot_id uuid;
begin
  if p_base_quantity <= 0 then
    raise exception 'Entry quantity must be positive';
  end if;

  insert into public.lots (
    product_id,
    expiration_date,
    original_quantity,
    current_quantity,
    status
  )
  values (
    p_product_id,
    p_expiration_date,
    p_base_quantity,
    p_base_quantity,
    'OPEN'
  )
  returning id into v_lot_id;

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
    'ENTRY',
    p_product_id,
    v_lot_id,
    p_base_quantity,
    0,
    p_base_quantity,
    p_source_text,
    coalesce(p_parsed_command, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  );

  return v_lot_id;
end;
$$;

create or replace function public.inventory_adjust_lot(
  p_lot_id uuid,
  p_product_id uuid,
  p_expiration_date date,
  p_current_quantity numeric,
  p_source_text text default 'Edição manual do lote',
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_lot public.lots%rowtype;
  v_movement_id uuid;
begin
  if p_current_quantity < 0 then
    raise exception 'Adjusted quantity cannot be negative';
  end if;

  select *
    into v_lot
    from public.lots
   where id = p_lot_id
   for update;

  if not found then
    raise exception 'Lot % not found', p_lot_id;
  end if;

  update public.lots
     set product_id = p_product_id,
         expiration_date = p_expiration_date,
         current_quantity = p_current_quantity,
         status = case
           when p_current_quantity = 0 then 'ZEROED'::public.lot_status
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
    metadata
  )
  values (
    'ADJUSTMENT',
    p_product_id,
    p_lot_id,
    p_current_quantity - v_lot.current_quantity,
    v_lot.current_quantity,
    p_current_quantity,
    p_source_text,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_movement_id;

  return v_movement_id;
end;
$$;

alter table public.products enable row level security;
alter table public.product_aliases enable row level security;
alter table public.packaging_conversions enable row level security;
alter table public.packaging_aliases enable row level security;
alter table public.lots enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.vocabulary_terms enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_deliveries enable row level security;

create policy authenticated_products_all
  on public.products
  for all
  to authenticated
  using (true)
  with check (true);

create policy authenticated_product_aliases_all
  on public.product_aliases
  for all
  to authenticated
  using (true)
  with check (true);

create policy authenticated_packaging_conversions_all
  on public.packaging_conversions
  for all
  to authenticated
  using (true)
  with check (true);

create policy authenticated_packaging_aliases_all
  on public.packaging_aliases
  for all
  to authenticated
  using (true)
  with check (true);

create policy authenticated_lots_all
  on public.lots
  for all
  to authenticated
  using (true)
  with check (true);

create policy authenticated_inventory_movements_all
  on public.inventory_movements
  for all
  to authenticated
  using (true)
  with check (true);

create policy authenticated_vocabulary_terms_all
  on public.vocabulary_terms
  for all
  to authenticated
  using (true)
  with check (true);

create policy authenticated_notification_preferences_all
  on public.notification_preferences
  for all
  to authenticated
  using (true)
  with check (true);

create policy authenticated_notification_deliveries_all
  on public.notification_deliveries
  for all
  to authenticated
  using (true)
  with check (true);
