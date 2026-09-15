// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

it("shows background push notifications and opens the app when tapped", async () => {
  const handlers = new Map<string, (event: unknown) => void>();
  const showNotification = vi.fn().mockResolvedValue(undefined);
  const openWindow = vi.fn().mockResolvedValue(undefined);
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: {
      addEventListener: (name: string, fn: (event: unknown) => void) =>
        handlers.set(name, fn),
      registration: { showNotification },
      clients: { matchAll: () => Promise.resolve([]), openWindow }
    }
  });
  const waits: Promise<unknown>[] = [];
  const waitUntil = (p: Promise<unknown>) => waits.push(p);
  handlers.get("push")?.({
    data: {
      json: () => ({
        title: "Lote vencido",
        body: "Confira o estoque",
        tag: "expiry"
      })
    },
    waitUntil
  });
  await Promise.all(waits);
  expect(showNotification).toHaveBeenCalledWith(
    "Lote vencido",
    expect.objectContaining({ body: "Confira o estoque", tag: "expiry" })
  );
  const close = vi.fn();
  handlers.get("notificationclick")?.({ notification: { close }, waitUntil });
  await Promise.all(waits);
  expect(close).toHaveBeenCalled();
  expect(openWindow).toHaveBeenCalledWith("/");
});
