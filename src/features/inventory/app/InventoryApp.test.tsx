import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InventoryApp } from "@/features/inventory/app/InventoryApp";

describe("InventoryApp", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:00:00-03:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("renders active lots ordered by FEFO with quick filters", () => {
    render(<InventoryApp />);

    expect(screen.getByRole("heading", { name: "Validades" })).toBeVisible();
    expect(screen.getAllByText("Coca-Cola 2L")[0]).toBeVisible();
    expect(screen.getByText("Usar primeiro")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Até 7 dias/u }));

    expect(screen.getByText("Nenhum lote neste filtro")).toBeVisible();
  });

  it("requires confirmation before registering an entry from the parser", () => {
    render(<InventoryApp />);

    submitCommand("Chegou 20 fardos de Coca 2L vence 10/10/2027");

    expect(screen.getByRole("heading", { name: "Nova entrada" })).toBeVisible();
    expect(screen.getByText("20 fardo × 6")).toBeVisible();
    expect(screen.getByText("+120 unidades")).toBeVisible();
    expect(screen.queryByText("Entrada registrada")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(screen.getByRole("status")).toHaveTextContent("Entrada registrada");
    expect(screen.getByText("10/10/2027")).toBeVisible();
  });

  it("confirms an exit with FEFO suggestion before reducing quantity", () => {
    render(<InventoryApp />);

    submitCommand("Vendeu 3 fardos da Coca 2L");

    expect(screen.getByRole("heading", { name: "Saída" })).toBeVisible();
    expect(screen.getByText("-18 unidades")).toBeVisible();
    expect(screen.getByText(/Lote FEFO sugerido/u)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(screen.getByRole("status")).toHaveTextContent("18 unidades baixadas");
    expect(screen.getByText("12 unidades")).toBeVisible();
  });

  it("confirms zeroing and removes the lot from the active list", () => {
    render(<InventoryApp />);

    submitCommand("Zerou a Coca 2L");

    expect(screen.getByRole("heading", { name: "Zerar lote" })).toBeVisible();
    expect(screen.getAllByText(/10\/09\/2026/u).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(screen.getByRole("status")).toHaveTextContent("Lote zerado");
    expect(screen.queryByText("10/09/2026")).not.toBeInTheDocument();
  });

  it("resolves product ambiguity visually before allowing confirmation", () => {
    render(<InventoryApp />);

    submitCommand("Vendeu 3 fardos de Coca");

    expect(screen.getByText("Qual produto?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Coca-Cola 2L" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(screen.getByRole("status")).toHaveTextContent("18 unidades baixadas");
  });

  it("supports manual lot creation as a fallback", () => {
    render(<InventoryApp />);

    fireEvent.click(screen.getByRole("button", { name: "Novo lote manual" }));
    fireEvent.change(screen.getByLabelText("Quantidade"), {
      target: { value: "2" }
    });
    fireEvent.change(screen.getByLabelText("Validade"), {
      target: { value: "2026-12-24" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByRole("status")).toHaveTextContent("Entrada registrada");
    expect(screen.getByText("24/12/2026")).toBeVisible();
  });

  it("edits a lot quantity and keeps an adjustment in history", () => {
    render(<InventoryApp />);

    fireEvent.click(screen.getAllByRole("button", { name: /Coca-Cola 2L/u })[0]!);
    fireEvent.change(screen.getByLabelText("Quantidade atual"), {
      target: { value: "28" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar edição/u }));

    expect(screen.getByRole("status")).toHaveTextContent("Lote atualizado");
    expect(screen.getByText("28 unidades")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Abrir histórico" }));
    expect(screen.getByText("Ajuste")).toBeVisible();
    expect(screen.getAllByText(hasText("Edição manual do lote")).length).toBeGreaterThan(0);
  });

  it("shows movement history without exposing JSON", () => {
    render(<InventoryApp />);

    fireEvent.click(screen.getByRole("button", { name: "Abrir histórico" }));

    const history = screen.getByRole("dialog", { name: "Histórico" });

    expect(within(history).getAllByText("Entrada")[0]).toBeVisible();
    expect(within(history).getAllByText(hasText("Estoque inicial"))[0]).toBeVisible();
    expect(history).not.toHaveTextContent("parsed_command");
  });

  it("reads an OCR validity date and pre-fills manual lot creation", async () => {
    vi.useRealTimers();
    window.__CONTROLE_VALIDADES_OCR_TEXT__ =
      "FAB 02/08/2026 VAL 18/11/2026";
    render(<InventoryApp />);

    fireEvent.click(screen.getByRole("button", { name: "Ler validade" }));
    fireEvent.change(screen.getByLabelText("Foto da validade"), {
      target: {
        files: [new File(["fixture"], "validade.png", { type: "image/png" })]
      }
    });

    expect(await screen.findByText("Qual é a validade?")).toBeVisible();
    expect(screen.getByRole("button", { name: "18/11/2026" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Usar validade" }));

    expect(screen.getByRole("heading", { name: "Novo lote" })).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText("Validade")).toHaveValue("2026-11-18")
    );

    delete window.__CONTROLE_VALIDADES_OCR_TEXT__;
  });

  it("shows alert preferences without requesting notification permission on open", () => {
    render(<InventoryApp />);

    fireEvent.click(screen.getByRole("button", { name: "Preferências de avisos" }));

    expect(screen.getByRole("heading", { name: "Alertas de validade" })).toBeVisible();
    expect(screen.getByLabelText("30 dias antes")).toBeChecked();
    expect(screen.getByText("Lotes em atenção")).toBeVisible();
    expect(screen.getByText(/não oferece avisos locais/u)).toBeVisible();
  });
});

function submitCommand(text: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Nova movimentação" }), {
    target: { value: text }
  });
  fireEvent.click(screen.getByRole("button", { name: "Interpretar movimentação" }));
}

function hasText(text: string) {
  return (_content: string, element: Element | null) =>
    element?.textContent?.includes(text) ?? false;
}
