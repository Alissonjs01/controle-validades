"use client";

import { useSyncExternalStore } from "react";
import { HalfMoon, SunLight } from "iconoir-react";

type Theme = "light" | "dark";
const THEME_KEY = "validda-theme";

function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#15191b" : "#edf0ef");
}

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.("(prefers-color-scheme: light)");
  const sync = () => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch { /* Keep themes usable without storage. */ }
    applyTheme(saved === "light" || saved === "dark" ? saved : systemTheme());
    onChange();
  };
  window.addEventListener("storage", sync);
  window.addEventListener(THEME_KEY, onChange);
  media?.addEventListener("change", sync);
  return () => {
    window.removeEventListener("storage", sync);
    window.removeEventListener(THEME_KEY, onChange);
    media?.removeEventListener("change", sync);
  };
}

export function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark");
  function select(next: Theme) {
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* The selection still applies for this visit. */ }
    window.dispatchEvent(new Event(THEME_KEY));
  }
  return <div className="theme-switcher" role="group" aria-label="Aparência">
    <button type="button" aria-label="Tema claro" title="Tema claro" aria-pressed={theme === "light"} onClick={() => select("light")}><SunLight aria-hidden="true" /></button>
    <button type="button" aria-label="Tema escuro" title="Tema escuro" aria-pressed={theme === "dark"} onClick={() => select("dark")}><HalfMoon aria-hidden="true" /></button>
  </div>;
}
