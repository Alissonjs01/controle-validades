"use client";

import { useEffect, useRef, useState } from "react";
import { BellNotification, WarningCircle, Xmark } from "iconoir-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import {
  formatCivilDate,
  formatDaysRemaining,
  getDaysUntilExpiration,
  getProductName
} from "@/features/inventory/domain/display";
import type { IsoDate, Lot, Product } from "@/types/inventory";
import {
  DEFAULT_ALERT_MILESTONES,
  getAlertMilestoneLabel,
  getInternalAttentionLots,
  isAlertMilestone
} from "./alerts";
import {
  enablePush,
  getPushState,
  pausePush,
  pushSupportMessage,
  testPush
} from "./push-client";

export function AlertsSheet({
  activeLots,
  onClose,
  products,
  referenceDate
}: {
  activeLots: readonly Lot[];
  onClose: () => void;
  products: readonly Product[];
  referenceDate: IsoDate;
}) {
  const panel = useRef<HTMLElement>(null);
  const [milestones, setMilestones] = useState(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem("validda-push-preferences") ?? "null"
      );
      if (
        Array.isArray(stored) &&
        stored.every(
          (v: unknown) => typeof v === "number" && isAlertMilestone(v)
        )
      )
        return new Set(stored);
    } catch {
      /* Use defaults when local preferences cannot be read. */
    }
    return new Set(DEFAULT_ALERT_MILESTONES);
  });
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [message, setMessage] = useState("Verificando envio automático...");
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(false);
  const support = pushSupportMessage();
  const lots = getInternalAttentionLots(activeLots, referenceDate);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/push", { signal: controller.signal })
      .then(async (response) => {
        const config = (await response.json()) as {
          available: boolean;
          publicKey: string | null;
        };
        if (!config.available) {
          setMessage(
            "O envio automático ainda não está configurado no servidor."
          );
          return;
        }
        setPublicKey(config.publicKey);
        const device = await getPushState();
        if (controller.signal.aborted) return;
        const enabled = Boolean(device.enabled);
        if (device.milestones?.length)
          setMilestones(new Set(device.milestones));
        setActive(enabled);
        setMessage(
          enabled
            ? "Avisos ativados neste aparelho."
            : "Ative os avisos para receber notificações mesmo com o app fechado."
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            "Sem conexão com o serviço de avisos. Tente reabrir este painel."
          );
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const previousFocus = document.activeElement;
    panel.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  async function perform(action: "enable" | "pause" | "test") {
    setBusy(true);
    try {
      if (action === "enable" && publicKey) {
        await enablePush(publicKey, [...milestones]);
        setActive(true);
        setMessage(
          "Avisos ativados neste aparelho. Envie um teste para conferir."
        );
      }
      if (action === "pause") {
        await pausePush();
        setActive(false);
        setMessage("Avisos pausados apenas neste aparelho.");
      }
      if (action === "test") {
        await testPush();
        setMessage(
          "Teste enviado. Confira a central de notificações do aparelho."
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar os avisos."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" role="presentation">
      <section
        ref={panel}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
          if (event.key !== "Tab") return;
          const items = panel.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), [href]"
          );
          const first = items?.[0];
          const last = items?.[items.length - 1];
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === panel.current)
          ) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        aria-labelledby="alerts-title"
        aria-modal="true"
        className="bottom-sheet"
        role="dialog"
      >
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">Neste aparelho</span>
            <h2 id="alerts-title">Alertas de validade</h2>
          </div>
          <IconButton aria-label="Fechar avisos" onClick={onClose}>
            <Xmark aria-hidden="true" />
          </IconButton>
        </div>
        <p className="sheet-muted">
          Receba avisos antes do vencimento, mesmo com o app fechado. Lotes
          vencidos com estoque geram um lembrete por dia.
        </p>
        <div className="alert-preferences">
          {DEFAULT_ALERT_MILESTONES.map((value) => (
            <label key={value}>
              <input
                type="checkbox"
                checked={milestones.has(value)}
                disabled={busy}
                onChange={(event) => {
                  const next = new Set(milestones);
                  if (event.target.checked) next.add(value);
                  else next.delete(value);
                  setMilestones(next);
                }}
              />
              <span>{getAlertMilestoneLabel(value)}</span>
            </label>
          ))}
        </div>
        {support ? (
        <div className="message-block message-block--info"><WarningCircle aria-hidden="true" /><p>{support}</p></div>
        ) : null}
        <p role="status" aria-live="polite" className="sheet-muted">
          {message}
        </p>
        <div className="sheet-actions">
          <Button
            disabled={busy || !active}
            variant="secondary"
            onClick={() => void perform("pause")}
          >
            Pausar avisos
          </Button>
          <Button
            disabled={
              busy || !publicKey || Boolean(support) || !milestones.size
            }
            onClick={() => void perform("enable")}
          >
            <BellNotification aria-hidden="true" />
            {active ? "Salvar avisos" : "Ativar avisos"}
          </Button>
        </div>
        <Button
          disabled={busy || !active}
          variant="ghost"
          onClick={() => void perform("test")}
        >
          Enviar notificação de teste
        </Button>
        <p className="sheet-muted">
          Verificação das 8h às 20h, horário de Brasília. Modo Foco, conexão e
          ajustes do aparelho podem silenciar ou atrasar avisos.
        </p>
        <section className="due-alerts" aria-label="Lotes em atenção">
          <h3>Lotes em atenção</h3>
          {lots.length ? (
            lots.map((lot) => (
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
            <p>Nenhum lote exige atenção agora.</p>
          )}
        </section>
      </section>
    </div>
  );
}
