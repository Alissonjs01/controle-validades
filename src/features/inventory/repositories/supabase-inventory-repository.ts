import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database, Json } from "@/types/database";
import type {
  InventoryCatalog,
  InventoryMovement,
  Lot,
  Product,
  ProductAlias,
  ProductId,
  PackagingConversion
} from "@/types/inventory";

type Client = NonNullable<ReturnType<typeof createBrowserSupabaseClient>>;
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductAliasRow = Database["public"]["Tables"]["product_aliases"]["Row"];
type PackagingConversionRow =
  Database["public"]["Tables"]["packaging_conversions"]["Row"];
type PackagingAliasRow = Database["public"]["Tables"]["packaging_aliases"]["Row"];
type LotRow = Database["public"]["Tables"]["lots"]["Row"];
type MovementRow = Database["public"]["Tables"]["inventory_movements"]["Row"];

export type SupabaseInventorySnapshot = InventoryCatalog &
  Readonly<{
    movements: readonly InventoryMovement[];
  }>;

export class SupabaseInventoryRepository {
  constructor(private readonly client: Client) {}

  async getSnapshot(): Promise<SupabaseInventorySnapshot> {
    const [products, productAliases, conversions, packagingAliases, lots, movements] =
      await Promise.all([
        selectAll(this.client.from("products").select("*").order("name")),
        selectAll(this.client.from("product_aliases").select("*")),
        selectAll(this.client.from("packaging_conversions").select("*")),
        selectAll(this.client.from("packaging_aliases").select("*")),
        selectAll(
          this.client
            .from("lots")
            .select("*")
            .order("expiration_date", { ascending: true })
        ),
        selectAll(
          this.client
            .from("inventory_movements")
            .select("*")
            .order("occurred_at", { ascending: false })
        )
      ]);

    return {
      products: mapProducts(products, productAliases),
      packagingConversions: mapPackagingConversions(conversions, packagingAliases),
      lots: lots.map(mapLot),
      movements: movements.map(mapMovement)
    };
  }

  async listLotsByProduct(productId: ProductId): Promise<readonly Lot[]> {
    const lots = await selectAll(
      this.client
        .from("lots")
        .select("*")
        .eq("product_id", productId)
        .order("expiration_date", { ascending: true })
    );

    return lots.map(mapLot);
  }

  async createEntryLot(input: {
    productId: ProductId;
    expirationDate: string;
    baseQuantity: number;
    sourceText: string | null;
    metadata: Record<string, unknown>;
  }) {
    await callRpc(this.client, "inventory_create_entry_lot", {
      p_product_id: input.productId,
      p_expiration_date: input.expirationDate,
      p_base_quantity: input.baseQuantity,
      p_source_text: input.sourceText,
      p_metadata: input.metadata as Json
    });
  }

  async applyLotMovement(input: {
    type: "EXIT" | "ZERO";
    lotId: string;
    quantityDelta: number;
    sourceText: string | null;
    metadata: Record<string, unknown>;
  }) {
    await callRpc(this.client, "inventory_apply_lot_movement", {
      p_lot_id: input.lotId,
      p_type: input.type,
      p_quantity_delta: input.quantityDelta,
      p_source_text: input.sourceText,
      p_metadata: input.metadata as Json
    });
  }

  async adjustLot(input: {
    lotId: string;
    productId: ProductId;
    expirationDate: string;
    currentQuantity: number;
    metadata: Record<string, unknown>;
  }) {
    await callRpc(this.client, "inventory_adjust_lot", {
      p_lot_id: input.lotId,
      p_product_id: input.productId,
      p_expiration_date: input.expirationDate,
      p_current_quantity: input.currentQuantity,
      p_metadata: input.metadata as Json
    });
  }
}

export function createSupabaseInventoryRepository() {
  const client = createBrowserSupabaseClient();

  return client ? new SupabaseInventoryRepository(client) : null;
}

async function selectAll<T>(
  query: PromiseLike<{ data: T[] | null; error: Error | null }>
) {
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function callRpc(
  client: Client,
  functionName: string,
  args: Record<string, Json | undefined>
) {
  const rpc = client.rpc.bind(client) as unknown as (
    name: string,
    args: Record<string, Json | undefined>
  ) => Promise<{ error: Error | null }>;
  const { error } = await rpc(functionName, args);

  if (error) {
    throw error;
  }
}

function mapProducts(
  products: readonly ProductRow[],
  aliases: readonly ProductAliasRow[]
): readonly Product[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    baseUnitLabel: product.base_unit_label,
    isActive: product.is_active,
    aliases: aliases
      .filter((alias) => alias.product_id === product.id)
      .map(mapProductAlias),
    createdAt: product.created_at,
    updatedAt: product.updated_at
  }));
}

function mapProductAlias(alias: ProductAliasRow): ProductAlias {
  return {
    id: alias.id,
    productId: alias.product_id,
    value: alias.alias,
    normalizedValue: alias.normalized_alias,
    createdAt: alias.created_at
  };
}

function mapPackagingConversions(
  conversions: readonly PackagingConversionRow[],
  aliases: readonly PackagingAliasRow[]
): readonly PackagingConversion[] {
  return conversions.map((conversion) => ({
    id: conversion.id,
    productId: conversion.product_id,
    packagingType: conversion.packaging_type,
    multiplier: conversion.multiplier,
    aliases: aliases
      .filter((alias) => alias.conversion_id === conversion.id)
      .map((alias) => alias.alias),
    createdAt: conversion.created_at,
    updatedAt: conversion.updated_at
  }));
}

function mapLot(lot: LotRow): Lot {
  return {
    id: lot.id,
    productId: lot.product_id,
    expirationDate: lot.expiration_date as Lot["expirationDate"],
    lotCode: lot.lot_code,
    originalQuantity: lot.original_quantity,
    currentQuantity: lot.current_quantity,
    status: lot.status,
    createdAt: lot.created_at,
    updatedAt: lot.updated_at
  };
}

function mapMovement(movement: MovementRow): InventoryMovement {
  return {
    id: movement.id,
    type: movement.type,
    productId: movement.product_id,
    lotId: movement.lot_id,
    quantityDelta: movement.quantity_delta,
    quantityBefore: movement.quantity_before,
    quantityAfter: movement.quantity_after,
    sourceText: movement.source_text,
    metadata: jsonToRecord(movement.metadata),
    occurredAt: movement.occurred_at,
    createdAt: movement.created_at
  };
}

function jsonToRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}
