import type {
  InventoryCatalog,
  InventoryMovement,
  Lot,
  ProductId
} from "@/types/inventory";

export type ConfirmedInventoryMutation = Readonly<{
  lot: Lot;
  movement: InventoryMovement;
}>;

export interface InventoryRepository {
  getCatalog(): Promise<InventoryCatalog>;
  listLotsByProduct(productId: ProductId): Promise<readonly Lot[]>;
  applyConfirmedMutation(
    mutation: ConfirmedInventoryMutation
  ): Promise<ConfirmedInventoryMutation>;
}
