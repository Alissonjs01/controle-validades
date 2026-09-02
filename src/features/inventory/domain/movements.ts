import type {
  InventoryMovement,
  InventoryMovementId,
  InventoryMovementType,
  IsoDateTime,
  Lot,
  LotId,
  ProductId
} from "@/types/inventory";

export type ConfirmedMovementRequest = Readonly<{
  id: InventoryMovementId;
  type: InventoryMovementType;
  productId: ProductId;
  lotId: LotId;
  quantityDelta: number;
  sourceText: string | null;
  metadata?: Record<string, unknown>;
  occurredAt: IsoDateTime;
}>;

export type MovementApplication = Readonly<{
  lot: Lot;
  movement: InventoryMovement;
}>;

export function applyConfirmedMovement(
  lot: Lot,
  request: ConfirmedMovementRequest
): MovementApplication {
  if (lot.id !== request.lotId) {
    throw new Error("Movement lot does not match the provided lot.");
  }

  if (lot.productId !== request.productId) {
    throw new Error("Movement product does not match the provided lot.");
  }

  const quantityBefore = lot.currentQuantity;
  const quantityDelta =
    request.type === "ZERO" ? -quantityBefore : request.quantityDelta;
  const quantityAfter = quantityBefore + quantityDelta;

  if (quantityAfter < 0) {
    throw new Error("Movement would produce negative inventory.");
  }

  const updatedLot: Lot = {
    ...lot,
    currentQuantity: quantityAfter,
    status: quantityAfter === 0 ? "ZEROED" : lot.status,
    updatedAt: request.occurredAt
  };

  return {
    lot: updatedLot,
    movement: {
      id: request.id,
      type: request.type,
      productId: request.productId,
      lotId: request.lotId,
      quantityDelta,
      quantityBefore,
      quantityAfter,
      sourceText: request.sourceText,
      metadata: request.metadata ?? {},
      occurredAt: request.occurredAt,
      createdAt: request.occurredAt
    }
  };
}
