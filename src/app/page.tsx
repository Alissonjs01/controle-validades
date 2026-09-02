import {
  Bell,
  Calendar,
  Database,
  NavArrowRight,
  Package,
  Plus
} from "iconoir-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { getExpiryStatus } from "@/features/inventory/domain/expiry-status";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const demoLots = [
  {
    product: "Coca-Cola 2L",
    package: "20 fardos",
    quantity: "120 un.",
    expiresAt: "2027-10-10"
  },
  {
    product: "Leite integral",
    package: "8 caixas",
    quantity: "96 un.",
    expiresAt: "2026-09-16"
  },
  {
    product: "Iogurte natural",
    package: "18 un.",
    quantity: "18 un.",
    expiresAt: "2026-09-07"
  }
] as const;

const statusLabel = {
  normal: "Normal",
  attention: "Atenção",
  urgent: "Urgente",
  expired: "Vencido"
} as const;

export default function Home() {
  const referenceDate = new Date("2026-09-02T12:00:00-03:00");

  return (
    <main className="app-shell">
      <Container className="home">
        <header className="topbar" aria-label="Resumo do aplicativo">
          <div>
            <span className="eyebrow">Fundação PWA</span>
            <h1>Controle de Validades</h1>
          </div>
          <IconButton aria-label="Preferências de alerta">
            <Bell aria-hidden="true" />
          </IconButton>
        </header>

        <section className="hero-grid" aria-label="Visão técnica inicial">
          <GlassCard className="hero-panel">
            <Badge variant="info">Mobile-first</Badge>
            <h2>O que tenho, quanto tenho e o que está perto de vencer.</h2>
            <p>
              Base criada para evoluir para produtos, lotes, conversões,
              movimentos, OCR e alertas sem transformar o app em ERP.
            </p>
            <div className="hero-actions">
              <Button>
                <Plus aria-hidden="true" />
                Nova entrada
              </Button>
              <Button variant="secondary">
                Ver lotes
                <NavArrowRight aria-hidden="true" />
              </Button>
            </div>
          </GlassCard>

          <GlassCard className="status-panel">
            <span className="panel-label">Ambiente</span>
            <div className="status-row">
              <Database aria-hidden="true" />
              <div>
                <strong>Supabase</strong>
                <span>
                  {isSupabaseConfigured()
                    ? "Variáveis públicas configuradas"
                    : "Pronto para configurar na Etapa 2"}
                </span>
              </div>
            </div>
          </GlassCard>
        </section>

        <section className="command-preview" aria-label="Entrada futura">
          <Input
            label="Comando futuro"
            readOnly
            value="Chegou 20 fardos de Coca 2L vence 10/10/2027"
          />
        </section>

        <section className="lot-list" aria-label="Lotes demonstrativos">
          {demoLots.map((lot) => {
            const status = getExpiryStatus(lot.expiresAt, referenceDate);

            return (
              <article className="lot-item" key={lot.product}>
                <div className="lot-icon" aria-hidden="true">
                  <Package />
                </div>
                <div className="lot-copy">
                  <h3>{lot.product}</h3>
                  <span>
                    {lot.package} · {lot.quantity}
                  </span>
                </div>
                <div className="lot-meta">
                  <Badge variant={status}>{statusLabel[status]}</Badge>
                  <span>
                    <Calendar aria-hidden="true" />
                    {new Intl.DateTimeFormat("pt-BR").format(
                      new Date(`${lot.expiresAt}T12:00:00-03:00`)
                    )}
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      </Container>
    </main>
  );
}
