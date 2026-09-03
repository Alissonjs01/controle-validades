import {
  formatDaysRemaining,
  getDaysUntilExpiration,
  getProduct,
  getProductName
} from "@/features/inventory/domain/display";
import type {
  InventoryMovementId,
  IsoDate,
  IsoDateTime,
  Lot,
  LotId,
  Product
} from "@/types/inventory";

export const DEFAULT_ALERT_MILESTONES = [30, 15, 7, 0] as const;

export type AlertMilestone = (typeof DEFAULT_ALERT_MILESTONES)[number];

export type AlertPreferences = Readonly<{
  enabled: boolean;
  milestones: readonly AlertMilestone[];
}>;

export type AlertDeliveryRecord = Readonly<{
  id: InventoryMovementId;
  lotId: LotId;
  milestone: AlertMilestone;
  deliveredAt: IsoDateTime;
}>;

export type DueExpiryAlert = Readonly<{
  id: string;
  lot: Lot;
  product: Product | null;
  milestone: AlertMilestone;
  daysUntilExpiration: number;
  title: string;
  body: string;
}>;

export const defaultAlertPreferences: AlertPreferences = {
  enabled: false,
  milestones: DEFAULT_ALERT_MILESTONES
};

export function getDueExpiryAlerts(input: {
  lots: readonly Lot[];
  products: readonly Product[];
  preferences: AlertPreferences;
  deliveries: readonly AlertDeliveryRecord[];
  referenceDate: IsoDate;
}) {
  if (!input.preferences.enabled) {
    return [];
  }

  const deliveredKeys = new Set(
    input.deliveries.map((delivery) =>
      getDeliveryKey(delivery.lotId, delivery.milestone)
    )
  );
  const enabledMilestones = new Set(input.preferences.milestones);

  return input.lots.flatMap((lot) => {
    if (lot.status !== "OPEN" || lot.currentQuantity <= 0) {
      return [];
    }

    const daysUntilExpiration = getDaysUntilExpiration(
      lot.expirationDate,
      input.referenceDate
    );

    if (!isAlertMilestone(daysUntilExpiration)) {
      return [];
    }

    if (!enabledMilestones.has(daysUntilExpiration)) {
      return [];
    }

    if (deliveredKeys.has(getDeliveryKey(lot.id, daysUntilExpiration))) {
      return [];
    }

    const product = getProduct(input.products, lot.productId);
    const productName = getProductName(input.products, lot.productId);

    return [
      {
        id: getDeliveryKey(lot.id, daysUntilExpiration),
        lot,
        product,
        milestone: daysUntilExpiration,
        daysUntilExpiration,
        title:
          daysUntilExpiration === 0
            ? `${productName} vence hoje`
            : `${productName} vence em ${daysUntilExpiration} dias`,
        body: `Restam ${lot.currentQuantity} ${product?.baseUnitLabel ?? "unidades"} deste lote.`
      }
    ];
  });
}

export function createAlertDeliveries(
  alerts: readonly DueExpiryAlert[],
  deliveredAt: IsoDateTime
): readonly AlertDeliveryRecord[] {
  return alerts.map((alert) => ({
    id: `alert-${alert.id}-${deliveredAt}`,
    lotId: alert.lot.id,
    milestone: alert.milestone,
    deliveredAt
  }));
}

export function getInternalAttentionLots(
  lots: readonly Lot[],
  referenceDate: IsoDate
) {
  return lots.filter((lot) => {
    if (lot.status !== "OPEN" || lot.currentQuantity <= 0) {
      return false;
    }

    return getDaysUntilExpiration(lot.expirationDate, referenceDate) <= 30;
  });
}

export function getDeliveryKey(lotId: LotId, milestone: AlertMilestone) {
  return `${lotId}:${milestone}`;
}

export function isAlertMilestone(value: number): value is AlertMilestone {
  return DEFAULT_ALERT_MILESTONES.includes(value as AlertMilestone);
}

export function getAlertMilestoneLabel(milestone: AlertMilestone) {
  return milestone === 0 ? "No vencimento" : `${milestone} dias antes`;
}

export function getAlertSummary(lots: readonly Lot[], referenceDate: IsoDate) {
  const attentionLots = getInternalAttentionLots(lots, referenceDate);
  const expired = attentionLots.filter(
    (lot) => getDaysUntilExpiration(lot.expirationDate, referenceDate) < 0
  ).length;

  if (expired > 0) {
    return `${expired} vencido${expired > 1 ? "s" : ""} na lista`;
  }

  if (attentionLots.length === 0) {
    return "Nenhum lote exige atenção agora";
  }

  return `${attentionLots.length} lote${attentionLots.length > 1 ? "s" : ""} em atenção`;
}

export function formatAlertTiming(daysUntilExpiration: number) {
  return formatDaysRemaining(daysUntilExpiration);
}
