import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders a typed button with the requested variant", () => {
    render(<Button variant="secondary">Salvar</Button>);

    const button = screen.getByRole("button", { name: "Salvar" });

    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("button--secondary");
  });
});
