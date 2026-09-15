import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
  type Unsubscribe
} from "firebase/firestore";

import { applyConfirmedMovement } from "@/features/inventory/domain/movements";
import {
  createInitialInventoryState,
  type EntryIntentInput,
  type InventoryStoreState,
  type LotEditInput,
  type MovementIntentInput
} from "@/features/inventory/app/local-inventory-store";
import {
  defaultAlertPreferences,
  type AlertDeliveryRecord,
  type AlertPreferences
} from "@/features/inventory/notifications/alerts";
import {
  ensureFirebaseAnonymousAuth,
  getFirebaseDb
} from "@/lib/firebase/client";
import type {
  InventoryMovement,
  InventoryMovementType,
  Lot,
  Product,
  PackagingConversion
} from "@/types/inventory";

const WORKSPACE_COLLECTION = "inventory";
const SHARED_WORKSPACE_ID = "shared";

type InventoryStateListener = (state: InventoryStoreState) => void;
type RepositoryErrorListener = (error: Error) => void;

export class FirestoreInventoryRepository {
  constructor(private readonly db: Firestore) {}

  async getState() {
    const workspaceId = await this.getWorkspaceId();

    const state = await this.readState(workspaceId);

    if (state.products.length > 0) {
      return this.syncBaselineCatalog(workspaceId, state);
    }

    const initialState = createInitialInventoryState();
    await this.seedInitialState(workspaceId, initialState);

    return initialState;
  }

  async subscribeState(
    onChange: InventoryStateListener,
    onError: RepositoryErrorListener
  ): Promise<Unsubscribe> {
    const workspaceId = await this.getWorkspaceId();
    let current = await this.getState();

    onChange(current);

    const emit = () => onChange(current);
    const handleError = (error: Error) => onError(error);
    const unsubscribers = [
      onSnapshot(
        this.productsCollection(workspaceId),
        (snapshot) => {
          current = {
            ...current,
            products: snapshot.docs.map((item) => item.data() as Product)
          };
          emit();
        },
        handleError
      ),
      onSnapshot(
        this.conversionsCollection(workspaceId),
        (snapshot) => {
          current = {
            ...current,
            packagingConversions: snapshot.docs.map(
              (item) => item.data() as PackagingConversion
            )
          };
          emit();
        },
        handleError
      ),
      onSnapshot(
        query(this.lotsCollection(workspaceId), orderBy("expirationDate", "asc")),
        (snapshot) => {
          current = {
            ...current,
            lots: snapshot.docs.map((item) => item.data() as Lot)
          };
          emit();
        },
        handleError
      ),
      onSnapshot(
        query(this.movementsCollection(workspaceId), orderBy("occurredAt", "desc")),
        (snapshot) => {
          current = {
            ...current,
            movements: snapshot.docs.map(
              (item) => item.data() as InventoryMovement
            )
          };
          emit();
        },
        handleError
      ),
      onSnapshot(
        this.settingsCollection(workspaceId),
        (snapshot) => {
          const settings = snapshot.docs.find((item) => item.id === "alerts");
          current = {
            ...current,
            alertPreferences: settings
              ? (settings.data() as AlertPreferences)
              : defaultAlertPreferences
          };
          emit();
        },
        handleError
      ),
      onSnapshot(
        this.alertDeliveriesCollection(workspaceId),
        (snapshot) => {
          current = {
            ...current,
            alertDeliveries: snapshot.docs.map(
              (item) => item.data() as AlertDeliveryRecord
            )
          };
          emit();
        },
        handleError
      )
    ];

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }

  async createEntryLot(input: EntryIntentInput) {
    const workspaceId = await this.getWorkspaceId();

    const now = new Date().toISOString();
    const lot: Lot = {
      id: createId("lot"),
      productId: input.productId,
      expirationDate: input.expirationDate,
      originalQuantity: input.baseQuantity,
      currentQuantity: input.baseQuantity,
      status: input.baseQuantity === 0 ? "ZEROED" : "OPEN",
      createdAt: now,
      updatedAt: now
    };
    const movement = createMovement({
      type: "ENTRY",
      productId: input.productId,
      lotId: lot.id,
      quantityDelta: input.baseQuantity,
      quantityBefore: 0,
      quantityAfter: input.baseQuantity,
      sourceText: input.sourceText,
      occurredAt: now,
      metadata: input.metadata
    });

    const batch = writeBatch(this.db);
    batch.set(this.lotDoc(workspaceId, lot.id), lot);
    batch.set(this.movementDoc(workspaceId, movement.id), movement);
    await batch.commit();

    return { lot, movement };
  }

  async applyMovement(input: MovementIntentInput) {
    const workspaceId = await this.getWorkspaceId();

    return runTransaction(this.db, async (transaction) => {
      const lotRef = this.lotDoc(workspaceId, input.lotId);
      const lotSnapshot = await transaction.get(lotRef);

      if (!lotSnapshot.exists()) {
        throw new Error("Lote não encontrado.");
      }

      const now = new Date().toISOString();
      const application = applyConfirmedMovement(
        lotSnapshot.data() as Lot,
        {
          id: createId("movement"),
          type: input.type,
          productId: input.productId,
          lotId: input.lotId,
          quantityDelta: input.type === "ZERO" ? 0 : -input.baseQuantity,
          sourceText: input.sourceText,
          metadata: input.metadata,
          occurredAt: now
        }
      );

      transaction.set(lotRef, application.lot);
      transaction.set(
        this.movementDoc(workspaceId, application.movement.id),
        application.movement
      );

      return application;
    });
  }

  async editLot(input: LotEditInput) {
    const workspaceId = await this.getWorkspaceId();

    return runTransaction(this.db, async (transaction) => {
      const lotRef = this.lotDoc(workspaceId, input.lotId);
      const lotSnapshot = await transaction.get(lotRef);

      if (!lotSnapshot.exists()) {
        throw new Error("Lote não encontrado.");
      }

      if (input.currentQuantity < 0) {
        throw new Error("Quantidade não pode ser negativa.");
      }

      const lot = lotSnapshot.data() as Lot;
      const now = new Date().toISOString();
      const updatedLot: Lot = {
        ...lot,
        productId: input.productId,
        expirationDate: input.expirationDate,
        currentQuantity: input.currentQuantity,
        status: input.currentQuantity === 0 ? "ZEROED" : "OPEN",
        updatedAt: now
      };
      const movement = createMovement({
        type: "ADJUSTMENT",
        productId: input.productId,
        lotId: lot.id,
        quantityDelta: input.currentQuantity - lot.currentQuantity,
        quantityBefore: lot.currentQuantity,
        quantityAfter: input.currentQuantity,
        sourceText: "Edição manual do lote",
        occurredAt: now,
        metadata: {
          previousProductId: lot.productId,
          previousExpirationDate: lot.expirationDate,
          expirationDate: input.expirationDate
        }
      });

      transaction.set(lotRef, updatedLot);
      transaction.set(this.movementDoc(workspaceId, movement.id), movement);

      return { lot: updatedLot, movement };
    });
  }

  async updateAlertPreferences(alertPreferences: AlertPreferences) {
    const workspaceId = await this.getWorkspaceId();

    await setDoc(this.settingsDoc(workspaceId, "alerts"), alertPreferences);
  }

  async recordAlertDeliveries(deliveries: readonly AlertDeliveryRecord[]) {
    const workspaceId = await this.getWorkspaceId();

    if (deliveries.length === 0) {
      return;
    }

    const batch = writeBatch(this.db);

    for (const delivery of deliveries) {
      batch.set(this.alertDeliveryDoc(workspaceId, delivery.id), delivery, {
        merge: true
      });
    }

    await batch.commit();
  }

  private async readState(workspaceId: string): Promise<InventoryStoreState> {
    const [
      productsSnapshot,
      conversionsSnapshot,
      lotsSnapshot,
      movementsSnapshot,
      settingsSnapshot,
      deliveriesSnapshot
    ] = await Promise.all([
      getDocs(this.productsCollection(workspaceId)),
      getDocs(this.conversionsCollection(workspaceId)),
      getDocs(
        query(this.lotsCollection(workspaceId), orderBy("expirationDate", "asc"))
      ),
      getDocs(
        query(this.movementsCollection(workspaceId), orderBy("occurredAt", "desc"))
      ),
      getDocs(this.settingsCollection(workspaceId)),
      getDocs(this.alertDeliveriesCollection(workspaceId))
    ]);

    const settings = settingsSnapshot.docs.find((item) => item.id === "alerts");

    return {
      products: productsSnapshot.docs.map((item) => item.data() as Product),
      packagingConversions: conversionsSnapshot.docs.map(
        (item) => item.data() as PackagingConversion
      ),
      lots: lotsSnapshot.docs.map((item) => item.data() as Lot),
      movements: movementsSnapshot.docs.map(
        (item) => item.data() as InventoryMovement
      ),
      alertPreferences: settings
        ? (settings.data() as AlertPreferences)
        : defaultAlertPreferences,
      alertDeliveries: deliveriesSnapshot.docs.map(
        (item) => item.data() as AlertDeliveryRecord
      )
    };
  }

  private async seedInitialState(
    workspaceId: string,
    state: InventoryStoreState
  ) {
    const batch = writeBatch(this.db);

    for (const product of state.products) {
      batch.set(this.productDoc(workspaceId, product.id), product);
    }

    for (const conversion of state.packagingConversions) {
      batch.set(this.conversionDoc(workspaceId, conversion.id), conversion);
    }

    for (const lot of state.lots) {
      batch.set(this.lotDoc(workspaceId, lot.id), lot);
    }

    for (const movement of state.movements) {
      batch.set(this.movementDoc(workspaceId, movement.id), movement);
    }

    batch.set(this.settingsDoc(workspaceId, "alerts"), state.alertPreferences);

    await batch.commit();
  }

  private async syncBaselineCatalog(
    workspaceId: string,
    state: InventoryStoreState
  ): Promise<InventoryStoreState> {
    const baseline = createInitialInventoryState();
    const shouldWriteProducts = hasBaselineChanges(
      state.products,
      baseline.products
    );
    const shouldWriteConversions = hasBaselineChanges(
      state.packagingConversions,
      baseline.packagingConversions
    );

    if (shouldWriteProducts || shouldWriteConversions) {
      const batch = writeBatch(this.db);

      for (const product of baseline.products) {
        batch.set(this.productDoc(workspaceId, product.id), product);
      }

      for (const conversion of baseline.packagingConversions) {
        batch.set(this.conversionDoc(workspaceId, conversion.id), conversion);
      }

      await batch.commit();
    }

    return {
      ...state,
      products: mergeBaselineItems(baseline.products, state.products),
      packagingConversions: mergeBaselineItems(
        baseline.packagingConversions,
        state.packagingConversions
      )
    };
  }

  private async getWorkspaceId() {
    await ensureFirebaseAnonymousAuth();

    return SHARED_WORKSPACE_ID;
  }

  private workspaceDoc(workspaceId: string) {
    return doc(this.db, WORKSPACE_COLLECTION, workspaceId);
  }

  private productsCollection(workspaceId: string) {
    return collection(this.workspaceDoc(workspaceId), "products");
  }

  private productDoc(workspaceId: string, id: string) {
    return doc(this.productsCollection(workspaceId), id);
  }

  private conversionsCollection(workspaceId: string) {
    return collection(this.workspaceDoc(workspaceId), "packagingConversions");
  }

  private conversionDoc(workspaceId: string, id: string) {
    return doc(this.conversionsCollection(workspaceId), id);
  }

  private lotsCollection(workspaceId: string) {
    return collection(this.workspaceDoc(workspaceId), "lots");
  }

  private lotDoc(workspaceId: string, id: string) {
    return doc(this.lotsCollection(workspaceId), id);
  }

  private movementsCollection(workspaceId: string) {
    return collection(this.workspaceDoc(workspaceId), "inventoryMovements");
  }

  private movementDoc(workspaceId: string, id: string) {
    return doc(this.movementsCollection(workspaceId), id);
  }

  private settingsCollection(workspaceId: string) {
    return collection(this.workspaceDoc(workspaceId), "settings");
  }

  private settingsDoc(workspaceId: string, id: string) {
    return doc(this.settingsCollection(workspaceId), id);
  }

  private alertDeliveriesCollection(workspaceId: string) {
    return collection(this.workspaceDoc(workspaceId), "notificationDeliveries");
  }

  private alertDeliveryDoc(workspaceId: string, id: string) {
    return doc(this.alertDeliveriesCollection(workspaceId), id);
  }
}

export function createFirestoreInventoryRepository() {
  const db = getFirebaseDb();

  return db ? new FirestoreInventoryRepository(db) : null;
}

function createMovement(input: {
  type: InventoryMovementType;
  productId: string;
  lotId: string;
  quantityDelta: number;
  quantityBefore: number | null;
  quantityAfter: number | null;
  sourceText: string | null;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}): InventoryMovement {
  return {
    id: createId("movement"),
    type: input.type,
    productId: input.productId,
    lotId: input.lotId,
    quantityDelta: input.quantityDelta,
    quantityBefore: input.quantityBefore,
    quantityAfter: input.quantityAfter,
    sourceText: input.sourceText,
    metadata: input.metadata ?? {},
    occurredAt: input.occurredAt,
    createdAt: input.occurredAt
  };
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function hasBaselineChanges<T extends { id: string }>(
  current: readonly T[],
  baseline: readonly T[]
) {
  const currentById = new Map(current.map((item) => [item.id, item]));

  return baseline.some((item) => {
    const currentItem = currentById.get(item.id);

    return !currentItem || JSON.stringify(currentItem) !== JSON.stringify(item);
  });
}

function mergeBaselineItems<T extends { id: string }>(
  baseline: readonly T[],
  current: readonly T[]
) {
  const baselineIds = new Set(baseline.map((item) => item.id));
  const currentExtras = current.filter((item) => !baselineIds.has(item.id));

  return [...baseline, ...currentExtras];
}

export type FirestoreDocument = DocumentData;
