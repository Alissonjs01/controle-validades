"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Archive,
  BellNotification,
  Calendar,
  Camera,
  Check,
  ClockRotateRight,
  CloudDesync,
  EditPencil,
  Filter,
  NavArrowRight,
  Plus,
  Send,
  WarningCircle,
  Xmark
} from "iconoir-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { IconButton } from "@/components/ui/IconButton";
import {
  addEntryLot,
  addManualLot,
  applyInventoryMovement,
  editLot,
  loadInventoryState,
  recordAlertDeliveries,
  saveInventoryState,
  updateAlertPreferences,
  type InventoryStoreState
} from "@/features/inventory/app/local-inventory-store";
import { createFirestoreInventoryRepository } from "@/features/inventory/repositories/firestore-inventory-repository";
import { parseBrazilianCivilDate } from "@/features/inventory/domain/dates";
import {
  formatCivilDate,
  formatDaysRemaining,
  formatQuantity,
  getDaysUntilExpiration,
  getExpiryVisualState,
  getProduct,
  getProductName,
  getTodayIsoDate,
  movementLabel
} from "@/features/inventory/domain/display";
import { getOpenLotsByFefo } from "@/features/inventory/domain/fefo";
import {
  createAlertDeliveries,
  DEFAULT_ALERT_MILESTONES,
  getAlertMilestoneLabel,
  getAlertSummary,
  getDueExpiryAlerts,
  getInternalAttentionLots,
  type DueExpiryAlert
} from "@/features/inventory/notifications/alerts";
import { recognizeExpirationDatesFromImage } from "@/features/inventory/ocr/browser-ocr";
import type { OcrExpirationExtraction } from "@/features/inventory/ocr/expiration-date-extraction";
import { normalizePortugueseText } from "@/features/inventory/parser/normalization";
import {
  parseInventoryCommand,
  type ParsedCommand
} from "@/features/inventory/parser/parse-command";
import type {
  InventoryCatalog,
  InventoryMovement,
  IsoDate,
  Lot,
  LotId,
  PackagingConversionId,
  Product,
  ProductId
} from "@/types/inventory";

type FilterKey = "all" | "expired" | "7" | "30";

type PendingCommand = Readonly<{
  text: string;
  command: ParsedCommand;
  selectedProductId: ProductId | null;
  selectedLotId: LotId | null;
}>;

type OcrReviewState = Readonly<{
  phase: "idle" | "reading" | "review" | "error";
  progress: number;
  statusText: string;
  result: OcrExpirationExtraction | null;
  selectedDate: IsoDate | null;
  manualDate: string;
  errorMessage: string | null;
}>;

const filters: readonly { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "7", label: "Até 7 dias" },
  { key: "30", label: "Até 30 dias" },
  { key: "expired", label: "Vencidos" }
];

const subscribeToHydration = () => () => undefined;
const getHydratedSnapshot = () => true;
const getServerSnapshot = () => false;
const subscribeToOnlineStatus = (callback: () => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);

  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
};
const getOnlineSnapshot = () =>
  typeof navigator === "undefined" ? true : navigator.onLine;
const getServerOnlineSnapshot = () => true;

export function InventoryApp() {
  const firestoreRepository = useMemo(
    () => createFirestoreInventoryRepository(),
    []
  );
  const [state, setState] = useState<InventoryStoreState>(() =>
    loadInventoryState()
  );
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [commandText, setCommandText] = useState("");
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(
    null
  );
  const [selectedLotId, setSelectedLotId] = useState<LotId | null>(null);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualInitialExpirationDate, setManualInitialExpirationDate] =
    useState<IsoDate | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(Boolean(firestoreRepository));
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerSnapshot
  );
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );
  const [toast, setToast] = useState<string | null>(null);
  const referenceDate = getTodayIsoDate();

  useEffect(() => {
    saveInventoryState(state);
  }, [state]);

  useEffect(() => {
    if (!firestoreRepository) {
      return;
    }

    let isCurrent = true;

    void firestoreRepository
      .getState()
      .then((firestoreState) => {
        if (!isCurrent) {
          return;
        }

        setState(firestoreState);
        setToast("Firebase conectado");
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }

        setToast("Não foi possível conectar ao Firebase. Usando modo local.");
      })
      .finally(() => {
        if (isCurrent) {
          setIsCloudLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [firestoreRepository]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 2600);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeLots = useMemo(
    () => getOpenLotsByFefo(state.lots),
    [state.lots]
  );
  const visibleLots = useMemo(
    () => filterLots(activeLots, activeFilter, referenceDate),
    [activeFilter, activeLots, referenceDate]
  );
  const selectedLot = state.lots.find((lot) => lot.id === selectedLotId) ?? null;
  const internalAlertLots = useMemo(
    () => getInternalAttentionLots(activeLots, referenceDate),
    [activeLots, referenceDate]
  );
  const dueBrowserAlerts = useMemo(
    () =>
      getDueExpiryAlerts({
        lots: activeLots,
        products: state.products,
        preferences: state.alertPreferences,
        deliveries: state.alertDeliveries,
        referenceDate
      }),
    [
      activeLots,
      referenceDate,
      state.alertDeliveries,
      state.alertPreferences,
      state.products
    ]
  );
  const attentionCount = activeLots.filter(
    (lot) => getDaysUntilExpiration(lot.expirationDate, referenceDate) <= 30
  ).length;
  const expiredCount = activeLots.filter(
    (lot) => getDaysUntilExpiration(lot.expirationDate, referenceDate) < 0
  ).length;

  useEffect(() => {
    if (dueBrowserAlerts.length === 0) {
      return;
    }

    void deliverDueBrowserAlerts(dueBrowserAlerts).then((deliveredAlerts) => {
      if (deliveredAlerts.length === 0) {
        return;
      }

      const deliveries = createAlertDeliveries(
        deliveredAlerts,
        new Date().toISOString()
      );

      if (firestoreRepository) {
        void firestoreRepository.recordAlertDeliveries(deliveries);
      }

      setState((current) =>
        recordAlertDeliveries(current, deliveries)
      );
    });
  }, [dueBrowserAlerts, firestoreRepository]);

  function submitCommand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = commandText.trim();

    if (!trimmed) {
      setToast("Digite uma movimentação.");
      return;
    }

    setPendingCommand({
      text: trimmed,
      command: parseInventoryCommand(trimmed, state, { referenceDate }),
      selectedProductId: null,
      selectedLotId: null
    });
  }

  async function confirmCommand(command: ParsedCommand, overrideLotId: LotId | null) {
    const lot = overrideLotId
      ? state.lots.find((item) => item.id === overrideLotId) ?? null
      : command.lot;

    try {
      if (command.action === "ENTRY") {
        if (!command.product || !command.expirationDate || !command.baseQuantity) {
          setToast("Revise os dados antes de confirmar.");
          return;
        }

        const input = {
          productId: command.product.id,
          expirationDate: command.expirationDate,
          baseQuantity: command.baseQuantity,
          sourceText: command.originalText,
          metadata: commandMetadata(command)
        };

        if (firestoreRepository) {
          const mutation = await firestoreRepository.createEntryLot(input);
          setState((current) => appendRepositoryMutation(current, mutation));
        } else {
          setState((current) => addEntryLot(current, input));
        }

        finishCommand("Entrada registrada");
        return;
      }

      if (command.action === "EXIT") {
        if (!command.product || !command.baseQuantity || !lot) {
          setToast("Escolha o lote antes de confirmar.");
          return;
        }

        const input = {
          type: "EXIT" as const,
          productId: command.product.id,
          lotId: lot.id,
          baseQuantity: command.baseQuantity,
          sourceText: command.originalText,
          metadata: commandMetadata(command)
        };

        if (firestoreRepository) {
          const mutation = await firestoreRepository.applyMovement(input);
          setState((current) => appendRepositoryMutation(current, mutation));
        } else {
          setState((current) => applyInventoryMovement(current, input));
        }

        finishCommand(`${command.baseQuantity} unidades baixadas`);
        return;
      }

      if (command.action === "ZERO") {
        if (!command.product || !lot) {
          setToast("Escolha o lote antes de zerar.");
          return;
        }

        const input = {
          type: "ZERO" as const,
          productId: command.product.id,
          lotId: lot.id,
          baseQuantity: 0,
          sourceText: command.originalText,
          metadata: commandMetadata(command)
        };

        if (firestoreRepository) {
          const mutation = await firestoreRepository.applyMovement(input);
          setState((current) => appendRepositoryMutation(current, mutation));
        } else {
          setState((current) => applyInventoryMovement(current, input));
        }

        finishCommand("Lote zerado");
      }
    } catch (error) {
      setToast(toFriendlyError(error));
    }
  }

  function finishCommand(message: string) {
    setPendingCommand(null);
    setCommandText("");
    setToast(message);
  }

  return (
    <main className="inventory-shell">
      <Container className="inventory-home">
        <header className="inventory-topbar">
          <div>
            <span className="eyebrow">Validades</span>
            <h1>Validades</h1>
            <p>
              {expiredCount > 0
                ? `${expiredCount} vencido${expiredCount > 1 ? "s" : ""} • ${attentionCount} em atenção`
                : `${attentionCount} lote${attentionCount === 1 ? "" : "s"} exige${attentionCount === 1 ? "" : "m"} atenção`}
            </p>
          </div>
          <div className="topbar-actions">
            <IconButton
              aria-label="Ler validade"
              onClick={() => setIsOcrOpen(true)}
            >
              <Camera aria-hidden="true" />
            </IconButton>
            <IconButton
              aria-label="Preferências de avisos"
              onClick={() => setIsAlertsOpen(true)}
            >
              <BellNotification aria-hidden="true" />
            </IconButton>
            <IconButton
              aria-label="Abrir histórico"
              onClick={() => setIsHistoryOpen(true)}
            >
              <ClockRotateRight aria-hidden="true" />
            </IconButton>
            <IconButton
              aria-label="Novo lote manual"
              onClick={() => {
                setManualInitialExpirationDate(null);
                setIsManualOpen(true);
              }}
            >
              <Plus aria-hidden="true" />
            </IconButton>
          </div>
        </header>

        <FilterTabs
          activeFilter={activeFilter}
          lots={activeLots}
          onChange={setActiveFilter}
          referenceDate={referenceDate}
        />

        {!isOnline ? (
          <div className="offline-strip" role="status">
            <CloudDesync aria-hidden="true" />
            <span>Sem conexão. O modo local continua funcionando.</span>
          </div>
        ) : null}

        {isCloudLoading ? (
          <div className="offline-strip" role="status">
            <CloudDesync aria-hidden="true" />
            <span>Conectando ao Firebase...</span>
          </div>
        ) : null}

        {internalAlertLots.length > 0 ? (
          <button
            className="attention-strip"
            onClick={() => setIsAlertsOpen(true)}
            type="button"
          >
            <BellNotification aria-hidden="true" />
            <span>{getAlertSummary(activeLots, referenceDate)}</span>
            <NavArrowRight aria-hidden="true" />
          </button>
        ) : null}

        <section aria-label="Lotes ativos" className="inventory-list">
          {visibleLots.length > 0 ? (
            visibleLots.map((lot, index) => (
              <LotCard
                isFefo={index === 0 && activeFilter === "all"}
                key={lot.id}
                lot={lot}
                onOpen={() => setSelectedLotId(lot.id)}
                product={getProduct(state.products, lot.productId)}
                referenceDate={referenceDate}
              />
            ))
          ) : (
            <EmptyState
              description="Troque o filtro ou cadastre uma nova entrada."
              icon={<Archive aria-hidden="true" />}
              title="Nenhum lote neste filtro"
            />
          )}
        </section>
      </Container>

      {isHydrated ? (
        <MovementComposer
          commandText={commandText}
          onChange={setCommandText}
          onSubmit={submitCommand}
        />
      ) : (
        <div aria-hidden="true" className="movement-composer movement-composer--loading">
          <span className="movement-composer__input-skeleton" />
          <span className="movement-composer__send movement-composer__send--loading" />
        </div>
      )}

      {pendingCommand ? (
        <MovementConfirmation
          catalog={state}
          onCancel={() => setPendingCommand(null)}
          onConfirm={(command, overrideLotId) => {
            void confirmCommand(command, overrideLotId);
          }}
          onSelectLot={(lotId) =>
            setPendingCommand((current) =>
              current ? { ...current, selectedLotId: lotId } : current
            )
          }
          onSelectProduct={(productId) =>
            setPendingCommand((current) =>
              current
                ? { ...current, selectedProductId: productId, selectedLotId: null }
                : current
            )
          }
          pending={pendingCommand}
          referenceDate={referenceDate}
        />
      ) : null}

      {selectedLot ? (
        <LotDetailsSheet
          lot={selectedLot}
          movements={state.movements}
          onClose={() => setSelectedLotId(null)}
          onSave={(input) => {
            void (async () => {
              try {
                if (firestoreRepository) {
                  const mutation = await firestoreRepository.editLot(input);
                  setState((current) =>
                    appendRepositoryMutation(current, mutation)
                  );
                } else {
                  setState((current) => editLot(current, input));
                }
                setToast("Lote atualizado");
                setSelectedLotId(null);
              } catch (error) {
                setToast(toFriendlyError(error));
              }
            })();
          }}
          onZero={(lot) => {
            void (async () => {
              try {
                const input = {
                  type: "ZERO" as const,
                  productId: lot.productId,
                  lotId: lot.id,
                  baseQuantity: 0,
                  sourceText: "Zeramento manual",
                  metadata: { source: "lot-details" }
                };

                if (firestoreRepository) {
                  const mutation = await firestoreRepository.applyMovement(input);
                  setState((current) =>
                    appendRepositoryMutation(current, mutation)
                  );
                } else {
                  setState((current) => applyInventoryMovement(current, input));
                }
                setToast("Lote zerado");
                setSelectedLotId(null);
              } catch (error) {
                setToast(toFriendlyError(error));
              }
            })();
          }}
          products={state.products}
          referenceDate={referenceDate}
        />
      ) : null}

      {isManualOpen ? (
        <ManualLotSheet
          initialExpirationDate={manualInitialExpirationDate}
          onClose={() => {
            setIsManualOpen(false);
            setManualInitialExpirationDate(null);
          }}
          onSave={(input) => {
            void (async () => {
              try {
                if (firestoreRepository) {
                  const conversion = state.packagingConversions.find(
                    (item) =>
                      item.id === input.conversionId &&
                      item.productId === input.productId
                  );

                  if (!conversion) {
                    throw new Error("Conversão de embalagem não encontrada.");
                  }

                  const mutation = await firestoreRepository.createEntryLot({
                    productId: input.productId,
                    expirationDate: input.expirationDate,
                    baseQuantity: input.enteredQuantity * conversion.multiplier,
                    sourceText: input.sourceText ?? "Cadastro manual",
                    metadata: {
                      enteredQuantity: input.enteredQuantity,
                      packaging: conversion.packagingType,
                      multiplier: conversion.multiplier
                    }
                  });
                  setState((current) =>
                    appendRepositoryMutation(current, mutation)
                  );
                } else {
                  setState((current) => addManualLot(current, input));
                }
                setIsManualOpen(false);
                setManualInitialExpirationDate(null);
                setToast("Entrada registrada");
              } catch (error) {
                setToast(toFriendlyError(error));
              }
            })();
          }}
          state={state}
        />
      ) : null}

      {isOcrOpen ? (
        <OcrSheet
          onClose={() => setIsOcrOpen(false)}
          onConfirmDate={(date) => {
            setIsOcrOpen(false);
            setManualInitialExpirationDate(date);
            setIsManualOpen(true);
            setToast("Validade preenchida");
          }}
          referenceDate={referenceDate}
        />
      ) : null}

      {isAlertsOpen ? (
        <AlertsSheet
          activeLots={activeLots}
          alerts={dueBrowserAlerts}
          onClose={() => setIsAlertsOpen(false)}
          onSavePreferences={(preferences) => {
            void (async () => {
              if (firestoreRepository) {
                await firestoreRepository.updateAlertPreferences(preferences);
              }

              setState((current) => updateAlertPreferences(current, preferences));
              setToast(
                preferences.enabled ? "Avisos atualizados" : "Avisos pausados"
              );
            })();
          }}
          preferences={state.alertPreferences}
          products={state.products}
          referenceDate={referenceDate}
        />
      ) : null}

      {isHistoryOpen ? (
        <HistorySheet
          movements={state.movements}
          onClose={() => setIsHistoryOpen(false)}
          products={state.products}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </main>
  );
}

function FilterTabs({
  activeFilter,
  lots,
  onChange,
  referenceDate
}: {
  activeFilter: FilterKey;
  lots: readonly Lot[];
  onChange: (filter: FilterKey) => void;
  referenceDate: IsoDate;
}) {
  return (
    <div aria-label="Filtros de validade" className="filter-tabs">
      <Filter aria-hidden="true" />
      {filters.map((filter) => (
        <button
          aria-pressed={activeFilter === filter.key}
          className="filter-tab"
          key={filter.key}
          onClick={() => onChange(filter.key)}
          type="button"
        >
          <span>{filter.label}</span>
          <strong>{filterCount(lots, filter.key, referenceDate)}</strong>
        </button>
      ))}
    </div>
  );
}

function LotCard({
  isFefo,
  lot,
  onOpen,
  product,
  referenceDate
}: {
  isFefo: boolean;
  lot: Lot;
  onOpen: () => void;
  product: Product | null;
  referenceDate: IsoDate;
}) {
  const days = getDaysUntilExpiration(lot.expirationDate, referenceDate);
  const state = getExpiryVisualState(lot.expirationDate, referenceDate);

  return (
    <button
      className={`lot-card lot-card--${state}`}
      onClick={onOpen}
      type="button"
    >
      <span aria-hidden="true" className="lot-card__rail" />
      <span className="lot-card__main">
        <span className="lot-card__title">{product?.name ?? "Produto"}</span>
        <span className="lot-card__quantity">
          {formatQuantity(lot.currentQuantity, product?.baseUnitLabel ?? "unidade")}
        </span>
      </span>
      <span className="lot-card__meta">
        <Badge variant={state}>{expiryLabel(state)}</Badge>
        {isFefo ? <span className="fefo-pill">Usar primeiro</span> : null}
        <span className="lot-card__date">
          <Calendar aria-hidden="true" />
          {formatCivilDate(lot.expirationDate)}
        </span>
        <span>{formatDaysRemaining(days)}</span>
      </span>
      <NavArrowRight aria-hidden="true" />
    </button>
  );
}

function MovementComposer({
  commandText,
  onChange,
  onSubmit
}: {
  commandText: string;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      aria-label="Nova movimentação"
      className="movement-composer"
      onSubmit={onSubmit}
    >
      <input
        aria-label="Nova movimentação"
        autoComplete="off"
        className="movement-composer__input"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Nova movimentação..."
        value={commandText}
      />
      <IconButton
        aria-label="Interpretar movimentação"
        className="movement-composer__send"
        type="submit"
      >
        <Send aria-hidden="true" />
      </IconButton>
    </form>
  );
}

function MovementConfirmation({
  catalog,
  onCancel,
  onConfirm,
  onSelectLot,
  onSelectProduct,
  pending,
  referenceDate
}: {
  catalog: InventoryCatalog;
  onCancel: () => void;
  onConfirm: (command: ParsedCommand, lotId: LotId | null) => void;
  onSelectLot: (lotId: LotId) => void;
  onSelectProduct: (productId: ProductId) => void;
  pending: PendingCommand;
  referenceDate: IsoDate;
}) {
  const command = useMemo(
    () => resolvePendingCommand(pending, catalog, referenceDate),
    [catalog, pending, referenceDate]
  );
  const selectedLot = pending.selectedLotId
    ? catalog.lots.find((lot) => lot.id === pending.selectedLotId) ?? null
    : command.lot;
  const canConfirm =
    command.action !== null &&
    command.errors.length === 0 &&
    command.product !== null &&
    (command.action === "ZERO" ||
      (command.baseQuantity !== null && command.baseQuantity > 0)) &&
    (command.action === "ENTRY"
      ? command.expirationDate !== null
      : selectedLot !== null);

  return (
    <div className="sheet-backdrop" role="presentation">
      <section
        aria-labelledby="movement-confirmation-title"
        className="bottom-sheet confirmation-sheet"
        role="dialog"
      >
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">Confirmar</span>
            <h2 id="movement-confirmation-title">{actionTitle(command.action)}</h2>
          </div>
          <IconButton aria-label="Cancelar confirmação" onClick={onCancel}>
            <Xmark aria-hidden="true" />
          </IconButton>
        </div>

        <p className="command-quote">“{pending.text}”</p>

        {command.errors.length > 0 ? (
          <MessageBlock messages={command.errors.map(humanizeIssue)} tone="danger" />
        ) : null}

        {command.productCandidates.length > 0 ? (
          <ChoiceGroup
            label="Qual produto?"
            onSelect={onSelectProduct}
            options={command.productCandidates.map((product) => ({
              id: product.id,
              label: product.name
            }))}
            selectedId={pending.selectedProductId}
          />
        ) : null}

        {command.lotCandidates.length > 1 ? (
          <ChoiceGroup
            label="Qual lote?"
            onSelect={onSelectLot}
            options={command.lotCandidates.map((lot) => ({
              id: lot.id,
              label: `${formatCivilDate(lot.expirationDate)} • ${formatQuantity(
                lot.currentQuantity,
                getProduct(catalog.products, lot.productId)?.baseUnitLabel ??
                  "unidade"
              )}`
            }))}
            selectedId={pending.selectedLotId ?? command.lot?.id ?? null}
          />
        ) : null}

        <dl className="confirmation-summary">
          <div>
            <dt>Produto</dt>
            <dd>{command.product?.name ?? "Escolha o produto"}</dd>
          </div>
          {command.action !== "ZERO" ? (
            <div>
              <dt>Quantidade</dt>
              <dd>
                {command.enteredQuantity && command.conversion
                  ? `${command.enteredQuantity} ${command.packaging} × ${command.conversion.multiplier}`
                  : "Informe quantidade e embalagem"}
              </dd>
            </div>
          ) : null}
          {command.baseQuantity ? (
            <div className="confirmation-total">
              <dt>Total</dt>
              <dd>
                {command.action === "ENTRY" ? "+" : "-"}
                {formatQuantity(
                  command.baseQuantity,
                  command.product?.baseUnitLabel ?? "unidade"
                )}
              </dd>
            </div>
          ) : null}
          {command.action === "ENTRY" ? (
            <div>
              <dt>Validade</dt>
              <dd>
                {command.expirationDate
                  ? formatCivilDate(command.expirationDate)
                  : "Informe a validade"}
              </dd>
            </div>
          ) : null}
          {command.action === "EXIT" || command.action === "ZERO" ? (
            <div>
              <dt>Lote</dt>
              <dd>
                {selectedLot
                  ? `${formatCivilDate(selectedLot.expirationDate)} • ${formatDaysRemaining(
                      getDaysUntilExpiration(selectedLot.expirationDate, referenceDate)
                    )}`
                  : "Escolha um lote"}
              </dd>
            </div>
          ) : null}
        </dl>

        {command.warnings.length > 0 || command.missingFields.length > 0 ? (
          <MessageBlock
            messages={[
              ...command.warnings.map(humanizeIssue),
              ...command.missingFields.map(humanizeIssue)
            ]}
            tone="info"
          />
        ) : null}

        <div className="sheet-actions">
          <Button onClick={onCancel} variant="secondary">
            Cancelar
          </Button>
          <Button
            disabled={!canConfirm}
            onClick={() => onConfirm(command, selectedLot?.id ?? null)}
          >
            <Check aria-hidden="true" />
            Confirmar
          </Button>
        </div>
      </section>
    </div>
  );
}

function OcrSheet({
  onClose,
  onConfirmDate,
  referenceDate
}: {
  onClose: () => void;
  onConfirmDate: (date: IsoDate) => void;
  referenceDate: IsoDate;
}) {
  const [ocrState, setOcrState] = useState<OcrReviewState>({
    phase: "idle",
    progress: 0,
    statusText: "",
    result: null,
    selectedDate: null,
    manualDate: "",
    errorMessage: null
  });
  const selectedCandidate =
    ocrState.selectedDate && ocrState.result
      ? ocrState.result.candidates.find(
          (candidate) => candidate.isoDate === ocrState.selectedDate
        ) ?? null
      : null;
  const parsedManualDate = parseManualOcrDate(ocrState.manualDate, referenceDate);
  const confirmDate = parsedManualDate ?? ocrState.selectedDate;
  const warnings = selectedCandidate?.warnings.length
    ? selectedCandidate.warnings
    : confirmDate
      ? getOcrDateWarnings(confirmDate, referenceDate)
      : [];

  async function readImage(file: File | null) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setOcrState({
        phase: "error",
        progress: 0,
        statusText: "",
        result: null,
        selectedDate: null,
        manualDate: "",
        errorMessage: "Escolha uma imagem da validade."
      });
      return;
    }

    setOcrState({
      phase: "reading",
      progress: 0,
      statusText: "Preparando imagem",
      result: null,
      selectedDate: null,
      manualDate: "",
      errorMessage: null
    });

    try {
      const result = await recognizeExpirationDatesFromImage(file, {
        referenceDate,
        onProgress: (progress, status) =>
          setOcrState((current) => ({
            ...current,
            phase: "reading",
            progress,
            statusText: status
          }))
      });
      const selectedDate = result.suggestedCandidate?.isoDate ?? null;

      setOcrState({
        phase: result.candidates.length > 0 ? "review" : "error",
        progress: 1,
        statusText: "Leitura concluída",
        result,
        selectedDate,
        manualDate: selectedDate ? formatCivilDate(selectedDate) : "",
        errorMessage:
          result.candidates.length > 0
            ? null
            : "Não encontrei uma validade clara nessa imagem."
      });
    } catch {
      setOcrState({
        phase: "error",
        progress: 0,
        statusText: "",
        result: null,
        selectedDate: null,
        manualDate: "",
        errorMessage: "Não foi possível ler a imagem. Você pode digitar a validade."
      });
    }
  }

  return (
    <div className="sheet-backdrop" role="presentation">
      <section aria-labelledby="ocr-title" className="bottom-sheet" role="dialog">
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">Câmera</span>
            <h2 id="ocr-title">Ler validade</h2>
          </div>
          <IconButton aria-label="Fechar leitura de validade" onClick={onClose}>
            <Xmark aria-hidden="true" />
          </IconButton>
        </div>

        <p className="sheet-muted">
          Fotografe só a área onde aparece VAL, VENC ou validade. A imagem é
          processada no navegador e descartada depois da leitura.
        </p>

        <label className="capture-control">
          <Camera aria-hidden="true" />
          <span>Tirar foto ou escolher imagem</span>
          <input
            accept="image/*"
            aria-label="Foto da validade"
            capture="environment"
            onChange={(event) => void readImage(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>

        {ocrState.phase === "reading" ? (
          <div className="ocr-progress" role="status">
            <span>Processando OCR</span>
            <progress max={1} value={ocrState.progress} />
            <small>{ocrState.statusText || "Lendo imagem"}</small>
          </div>
        ) : null}

        {ocrState.result?.candidates.length ? (
          <ChoiceGroup
            label={
              ocrState.result.candidates.length > 1
                ? "Qual é a validade?"
                : "Validade encontrada"
            }
            onSelect={(date) =>
              setOcrState((current) => ({
                ...current,
                selectedDate: date as IsoDate,
                manualDate: formatCivilDate(date as IsoDate)
              }))
            }
            options={ocrState.result.candidates.map((candidate) => ({
              id: candidate.isoDate,
              label: candidate.displayDate
            }))}
            selectedId={ocrState.selectedDate}
          />
        ) : null}

        {ocrState.errorMessage ? (
          <MessageBlock messages={[ocrState.errorMessage]} tone="danger" />
        ) : null}

        {ocrState.result?.invalidCandidates.length ? (
          <MessageBlock
            messages={ocrState.result.invalidCandidates.map(
              (candidate) => `${candidate.source} não é uma data válida.`
            )}
            tone="info"
          />
        ) : null}

        <TextField
          inputMode="numeric"
          label="Corrigir validade"
          onChange={(value) =>
            setOcrState((current) => ({
              ...current,
              manualDate: value
            }))
          }
          placeholder="DD/MM/AAAA"
          value={ocrState.manualDate}
        />

        {warnings.length > 0 ? <MessageBlock messages={warnings} tone="info" /> : null}

        <div className="sheet-actions">
          <Button onClick={onClose} variant="secondary">
            Cancelar
          </Button>
          <Button disabled={!confirmDate} onClick={() => confirmDate && onConfirmDate(confirmDate)}>
            <Check aria-hidden="true" />
            Usar validade
          </Button>
        </div>
      </section>
    </div>
  );
}

function AlertsSheet({
  activeLots,
  alerts,
  onClose,
  onSavePreferences,
  preferences,
  products,
  referenceDate
}: {
  activeLots: readonly Lot[];
  alerts: readonly DueExpiryAlert[];
  onClose: () => void;
  onSavePreferences: (preferences: InventoryStoreState["alertPreferences"]) => void;
  preferences: InventoryStoreState["alertPreferences"];
  products: readonly Product[];
  referenceDate: IsoDate;
}) {
  const [selectedMilestones, setSelectedMilestones] = useState(
    new Set(preferences.milestones)
  );
  const internalLots = getInternalAttentionLots(activeLots, referenceDate);
  const notificationSupport = getNotificationSupportLabel();

  async function activateAlerts() {
    const permission = await requestNotificationPermission();

    onSavePreferences({
      enabled: permission === "granted",
      milestones: [...selectedMilestones].sort((left, right) => right - left)
    });
  }

  return (
    <div className="sheet-backdrop" role="presentation">
      <section aria-labelledby="alerts-title" className="bottom-sheet" role="dialog">
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">Avisos</span>
            <h2 id="alerts-title">Alertas de validade</h2>
          </div>
          <IconButton aria-label="Fechar avisos" onClick={onClose}>
            <Xmark aria-hidden="true" />
          </IconButton>
        </div>

        <p className="sheet-muted">
          O app destaca lotes críticos ao abrir. Avisos do navegador só são pedidos
          depois que você ativar.
        </p>

        <div className="alert-preferences">
          {DEFAULT_ALERT_MILESTONES.map((milestone) => (
            <label key={milestone}>
              <input
                checked={selectedMilestones.has(milestone)}
                onChange={(event) => {
                  const next = new Set(selectedMilestones);

                  if (event.target.checked) {
                    next.add(milestone);
                  } else {
                    next.delete(milestone);
                  }

                  setSelectedMilestones(next);
                }}
                type="checkbox"
              />
              <span>{getAlertMilestoneLabel(milestone)}</span>
            </label>
          ))}
        </div>

        <MessageBlock
          messages={[
            notificationSupport,
            "Sem push em segundo plano confiável em todos os PWAs, os alertas internos continuam sendo a fonte principal."
          ]}
          tone="info"
        />

        {alerts.length > 0 ? (
          <section className="due-alerts" aria-label="Avisos pendentes">
            <h3>Avisos pendentes</h3>
            {alerts.map((alert) => (
              <p key={alert.id}>
                <strong>{alert.title}</strong>
                <span>{alert.body}</span>
              </p>
            ))}
          </section>
        ) : null}

        <section className="due-alerts" aria-label="Lotes em atenção">
          <h3>Lotes em atenção</h3>
          {internalLots.length > 0 ? (
            internalLots.map((lot) => (
              <p key={lot.id}>
                <strong>{getProductName(products, lot.productId)}</strong>
                <span>
                  {formatCivilDate(lot.expirationDate)} •{" "}
                  {formatDaysRemaining(
                    getDaysUntilExpiration(lot.expirationDate, referenceDate)
                  )}
                </span>
              </p>
            ))
          ) : (
            <p className="sheet-muted">Nenhum lote exige atenção agora.</p>
          )}
        </section>

        <div className="sheet-actions">
          <Button
            onClick={() =>
              onSavePreferences({
                enabled: false,
                milestones: [...selectedMilestones].sort((left, right) => right - left)
              })
            }
            variant="secondary"
          >
            Pausar avisos
          </Button>
          <Button disabled={selectedMilestones.size === 0} onClick={() => void activateAlerts()}>
            <BellNotification aria-hidden="true" />
            Ativar avisos
          </Button>
        </div>
      </section>
    </div>
  );
}

function ManualLotSheet({
  initialExpirationDate,
  onClose,
  onSave,
  state
}: {
  initialExpirationDate: IsoDate | null;
  onClose: () => void;
  onSave: (input: {
    productId: ProductId;
    conversionId: PackagingConversionId;
    enteredQuantity: number;
    expirationDate: IsoDate;
    sourceText: string | null;
  }) => void;
  state: InventoryStoreState;
}) {
  const [productId, setProductId] = useState(state.products[0]?.id ?? "");
  const conversions = state.packagingConversions.filter(
    (conversion) => conversion.productId === productId
  );
  const [conversionId, setConversionId] = useState(conversions[0]?.id ?? "");
  const effectiveConversionId = conversions.some(
    (conversion) => conversion.id === conversionId
  )
    ? conversionId
    : conversions[0]?.id ?? "";
  const [quantity, setQuantity] = useState("1");
  const [expirationDate, setExpirationDate] = useState(initialExpirationDate ?? "");

  return (
    <div className="sheet-backdrop" role="presentation">
      <section aria-labelledby="manual-lot-title" className="bottom-sheet" role="dialog">
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">Fallback</span>
            <h2 id="manual-lot-title">Novo lote</h2>
          </div>
          <IconButton aria-label="Fechar novo lote" onClick={onClose}>
            <Xmark aria-hidden="true" />
          </IconButton>
        </div>
        <form
          className="sheet-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              productId,
              conversionId: effectiveConversionId,
              enteredQuantity: Number(quantity),
              expirationDate: expirationDate as IsoDate,
              sourceText: "Cadastro manual"
            });
          }}
        >
          <SelectField
            label="Produto"
            onChange={(nextProductId) => {
              setProductId(nextProductId);
              setConversionId(
                state.packagingConversions.find(
                  (conversion) => conversion.productId === nextProductId
                )?.id ?? ""
              );
            }}
            value={productId}
          >
            {state.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Embalagem"
            onChange={setConversionId}
            value={effectiveConversionId}
          >
            {conversions.map((conversion) => (
              <option key={conversion.id} value={conversion.id}>
                {conversion.packagingType} × {conversion.multiplier}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Quantidade"
            min="0.001"
            onChange={setQuantity}
            step="0.001"
            type="number"
            value={quantity}
          />
          <TextField
            label="Validade"
            onChange={setExpirationDate}
            type="date"
            value={expirationDate}
          />
          <div className="sheet-actions">
            <Button onClick={onClose} variant="secondary">
              Cancelar
            </Button>
            <Button
              disabled={
                !productId ||
                !effectiveConversionId ||
                !expirationDate ||
                Number(quantity) <= 0
              }
              type="submit"
            >
              <Plus aria-hidden="true" />
              Salvar
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function LotDetailsSheet({
  lot,
  movements,
  onClose,
  onSave,
  onZero,
  products,
  referenceDate
}: {
  lot: Lot;
  movements: readonly InventoryMovement[];
  onClose: () => void;
  onSave: (input: {
    lotId: LotId;
    productId: ProductId;
    currentQuantity: number;
    expirationDate: IsoDate;
  }) => void;
  onZero: (lot: Lot) => void;
  products: readonly Product[];
  referenceDate: IsoDate;
}) {
  const [productId, setProductId] = useState(lot.productId);
  const [quantity, setQuantity] = useState(lot.currentQuantity.toString());
  const [expirationDate, setExpirationDate] = useState<string>(lot.expirationDate);
  const [isZeroConfirming, setIsZeroConfirming] = useState(false);
  const product = getProduct(products, lot.productId);
  const lotMovements = movements
    .filter((movement) => movement.lotId === lot.id)
    .slice(0, 4);

  return (
    <div className="sheet-backdrop" role="presentation">
      <section aria-labelledby="lot-details-title" className="bottom-sheet" role="dialog">
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">Editar lote</span>
            <h2 id="lot-details-title">{product?.name ?? "Produto"}</h2>
          </div>
          <IconButton aria-label="Fechar lote" onClick={onClose}>
            <Xmark aria-hidden="true" />
          </IconButton>
        </div>
        <p className="sheet-muted">
          {formatQuantity(lot.currentQuantity, product?.baseUnitLabel ?? "unidade")} •{" "}
          {formatDaysRemaining(
            getDaysUntilExpiration(lot.expirationDate, referenceDate)
          )}
        </p>
        <form
          className="sheet-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              lotId: lot.id,
              productId,
              currentQuantity: Number(quantity),
              expirationDate: expirationDate as IsoDate
            });
          }}
        >
          <SelectField label="Produto" onChange={setProductId} value={productId}>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Quantidade atual"
            min="0"
            onChange={setQuantity}
            step="0.001"
            type="number"
            value={quantity}
          />
          <TextField
            label="Validade"
            onChange={setExpirationDate}
            type="date"
            value={expirationDate}
          />
          <div className="sheet-actions">
            <Button type="submit" variant="secondary">
              <EditPencil aria-hidden="true" />
              Salvar edição
            </Button>
            <Button onClick={() => setIsZeroConfirming(true)} variant="ghost">
              Zerar lote
            </Button>
          </div>
        </form>
        {isZeroConfirming ? (
          <div className="inline-confirm" role="alert">
            <WarningCircle aria-hidden="true" />
            <span>
              Zerar as{" "}
              {formatQuantity(lot.currentQuantity, product?.baseUnitLabel ?? "unidade")}{" "}
              restantes?
            </span>
            <Button onClick={() => onZero(lot)}>Confirmar</Button>
          </div>
        ) : null}
        <MovementHistory movements={lotMovements} products={products} title="Histórico do lote" />
      </section>
    </div>
  );
}

function HistorySheet({
  movements,
  onClose,
  products
}: {
  movements: readonly InventoryMovement[];
  onClose: () => void;
  products: readonly Product[];
}) {
  return (
    <div className="sheet-backdrop" role="presentation">
      <section aria-labelledby="history-title" className="bottom-sheet" role="dialog">
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">Auditoria</span>
            <h2 id="history-title">Histórico</h2>
          </div>
          <IconButton aria-label="Fechar histórico" onClick={onClose}>
            <Xmark aria-hidden="true" />
          </IconButton>
        </div>
        <MovementHistory movements={movements} products={products} title="Movimentações" />
      </section>
    </div>
  );
}

function MovementHistory({
  movements,
  products,
  title
}: {
  movements: readonly InventoryMovement[];
  products: readonly Product[];
  title: string;
}) {
  return (
    <section aria-label={title} className="history-block">
      <h3>{title}</h3>
      {movements.length > 0 ? (
        <ol className="history-list">
          {movements.map((movement) => (
            <li className="history-item" key={movement.id}>
              <span
                className={`history-delta ${
                  movement.quantityDelta >= 0 ? "positive" : "negative"
                }`}
              >
                {movement.quantityDelta > 0 ? "+" : ""}
                {movement.quantityDelta}
              </span>
              <span>
                <strong>{movementLabel(movement.type)}</strong>
                <small>{getProductName(products, movement.productId)}</small>
                {movement.sourceText ? <em>“{movement.sourceText}”</em> : null}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="sheet-muted">Sem movimentações ainda.</p>
      )}
    </section>
  );
}

function ChoiceGroup({
  label,
  onSelect,
  options,
  selectedId
}: {
  label: string;
  onSelect: (id: string) => void;
  options: readonly { id: string; label: string }[];
  selectedId: string | null;
}) {
  return (
    <fieldset className="choice-group">
      <legend>{label}</legend>
      {options.map((option) => (
        <button
          aria-pressed={selectedId === option.id}
          key={option.id}
          onClick={() => onSelect(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}

function MessageBlock({
  messages,
  tone
}: {
  messages: readonly string[];
  tone: "danger" | "info";
}) {
  return (
    <div className={`message-block message-block--${tone}`}>
      <WarningCircle aria-hidden="true" />
      <div>
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  description,
  icon,
  title
}: {
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function SelectField({
  children,
  label,
  onChange,
  value
}: {
  children: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {children}
      </select>
    </label>
  );
}

type TextFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> & {
  label: string;
  onChange: (value: string) => void;
  value: string;
};

function TextField({
  label,
  onChange,
  value,
  ...props
}: TextFieldProps) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        {...props}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function filterLots(
  lots: readonly Lot[],
  filter: FilterKey,
  referenceDate: IsoDate
) {
  return lots.filter((lot) => {
    const days = getDaysUntilExpiration(lot.expirationDate, referenceDate);

    if (filter === "expired") {
      return days < 0;
    }

    if (filter === "7") {
      return days >= 0 && days <= 7;
    }

    if (filter === "30") {
      return days >= 0 && days <= 30;
    }

    return true;
  });
}

function appendRepositoryMutation(
  state: InventoryStoreState,
  mutation: Readonly<{ lot: Lot; movement: InventoryMovement }>
): InventoryStoreState {
  const hasLot = state.lots.some((lot) => lot.id === mutation.lot.id);

  return {
    ...state,
    lots: hasLot
      ? state.lots.map((lot) => (lot.id === mutation.lot.id ? mutation.lot : lot))
      : [...state.lots, mutation.lot],
    movements: [mutation.movement, ...state.movements]
  };
}

function filterCount(
  lots: readonly Lot[],
  filter: FilterKey,
  referenceDate: IsoDate
) {
  return filterLots(lots, filter, referenceDate).length;
}

function resolvePendingCommand(
  pending: PendingCommand,
  catalog: InventoryCatalog,
  referenceDate: IsoDate
) {
  if (!pending.selectedProductId) {
    return pending.command;
  }

  const product = catalog.products.find(
    (item) => item.id === pending.selectedProductId
  );

  if (!product) {
    return pending.command;
  }

  return parseInventoryCommand(
    pending.text,
    {
      ...catalog,
      products: [product]
    },
    { referenceDate }
  );
}

function commandMetadata(command: ParsedCommand) {
  return {
    enteredQuantity: command.enteredQuantity,
    packaging: command.packaging,
    multiplier: command.conversion?.multiplier ?? null,
    parserStatus: command.status
  };
}

function actionTitle(action: ParsedCommand["action"]) {
  switch (action) {
    case "ENTRY":
      return "Nova entrada";
    case "EXIT":
      return "Saída";
    case "ZERO":
      return "Zerar lote";
    case "ADJUSTMENT":
      return "Ajuste";
    default:
      return "Revisar movimentação";
  }
}

function expiryLabel(state: "expired" | "urgent" | "attention" | "normal") {
  switch (state) {
    case "expired":
      return "Vencido";
    case "urgent":
      return "Urgente";
    case "attention":
      return "Atenção";
    case "normal":
      return "Normal";
  }
}

function humanizeIssue(issue: string) {
  const labels: Record<string, string> = {
    action: "Não reconheci se é entrada, saída ou zeramento.",
    product: "Escolha ou informe o produto.",
    quantity: "Informe a quantidade.",
    packagingConversion: "Informe uma embalagem com conversão cadastrada.",
    expirationDate: "Informe a validade da entrada."
  };

  return labels[issue] ?? issue;
}

function parseManualOcrDate(value: string, referenceDate: IsoDate) {
  const parsed = parseBrazilianCivilDate(
    normalizePortugueseText(value),
    referenceDate
  );

  return parsed.kind === "complete" ? parsed.value : null;
}

function getOcrDateWarnings(date: IsoDate, referenceDate: IsoDate) {
  const days = getDaysUntilExpiration(date, referenceDate);

  if (days < 0) {
    return ["Essa data já passou. Confira antes de confirmar."];
  }

  if (days > 6 * 366) {
    return ["Essa validade parece muito distante. Confira a leitura."];
  }

  return [];
}

async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  return Notification.requestPermission();
}

function getNotificationSupportLabel() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "Este navegador não oferece avisos locais.";
  }

  if (Notification.permission === "granted") {
    return "Avisos do navegador estão ativos neste dispositivo.";
  }

  if (Notification.permission === "denied") {
    return "O navegador bloqueou avisos. Os alertas internos continuam funcionando.";
  }

  return "Toque em Ativar avisos para permitir notificações deste app.";
}

async function deliverDueBrowserAlerts(alerts: readonly DueExpiryAlert[]) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return [];
  }

  const registration =
    "serviceWorker" in navigator ? await navigator.serviceWorker.ready : null;

  for (const alert of alerts) {
    const options: NotificationOptions = {
      body: alert.body,
      icon: "/icons/pwa-icon-192.png",
      tag: alert.id
    };

    if (registration) {
      await registration.showNotification(alert.title, options);
    } else {
      new Notification(alert.title, options);
    }
  }

  return alerts;
}

function toFriendlyError(error: unknown) {
  if (error instanceof Error && error.message.includes("negative inventory")) {
    return "A quantidade disponível é menor que a saída solicitada.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Não foi possível registrar a movimentação.";
}
