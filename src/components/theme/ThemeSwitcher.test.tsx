import { afterEach, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeSwitcher } from "./ThemeSwitcher";

afterEach(() => { localStorage.clear(); delete document.documentElement.dataset.theme; });

it("switches appearance and saves the device preference", () => {
  render(<ThemeSwitcher />);
  fireEvent.click(screen.getByRole("button", { name: "Tema claro" }));
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(localStorage.getItem("validda-theme")).toBe("light");
  expect(screen.getByRole("button", { name: "Tema claro" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Tema escuro" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("validda-theme")).toBe("dark");
});
