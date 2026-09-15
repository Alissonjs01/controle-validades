// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  documents: new Map<string, Record<string, unknown>>()
}));
vi.mock("web-push", () => ({ default: { sendNotification: mocks.send } }));
vi.mock("@/lib/firebase/admin", () => {
  function ref(path: string) {
    return {
      path,
      data: () => mocks.documents.get(path),
      collection: (name: string) => ({
        doc: (id: string) => ref(`${path}/${name}/${id}`)
      }),
      update: (data: Record<string, unknown>) => {
        mocks.documents.set(path, { ...mocks.documents.get(path), ...data });
        return Promise.resolve();
      },
      set: (data: Record<string, unknown>) => {
        mocks.documents.set(path, { ...mocks.documents.get(path), ...data });
        return Promise.resolve();
      }
    };
  }
  const db = {
    collection: (name: string) => {
      const get = () =>
        Promise.resolve({
          docs: [...mocks.documents.entries()]
            .filter(
              ([path, value]) =>
                path.startsWith(`${name}/`) &&
                path.split("/").length === name.split("/").length + 1 &&
                (name !== "pushDevices" || value.enabled)
            )
            .map(([path]) => ({
              data: () => mocks.documents.get(path),
              ref: ref(path)
            }))
        });
      return { get, where: () => ({ get }) };
    },
    runTransaction: async <T>(
      callback: (tx: {
        get: (
          r: ReturnType<typeof ref>
        ) => Promise<{ data: () => Record<string, unknown> | undefined }>;
        set: (
          r: ReturnType<typeof ref>,
          data: Record<string, unknown>,
          options?: { merge: boolean }
        ) => void;
      }) => Promise<T>
    ) =>
      callback({
        get: (r) => Promise.resolve({ data: r.data }),
        set: (r, data, options) => {
          mocks.documents.set(
            r.path,
            options?.merge ? { ...mocks.documents.get(r.path), ...data } : data
          );
        }
      })
  };
  return { pushConfigured: () => true, adminServices: () => ({ db }) };
});
import { dispatchExpiryPush } from "./push-server";

describe("scheduled push delivery", () => {
  beforeEach(() => {
    mocks.documents.clear();
    mocks.send.mockReset();
    mocks.send.mockResolvedValue({ statusCode: 201 });
    mocks.documents.set("inventory/shared/lots/lot", {
      id: "lot",
      expirationDate: "2026-10-15",
      status: "OPEN",
      currentQuantity: 10
    });
    for (const id of ["a", "b"])
      mocks.documents.set(`pushDevices/${id}`, {
        enabled: true,
        uid: id,
        subscription: { endpoint: id },
        milestones: [30, 15, 7, 0]
      });
  });
  it("sends independently to two devices and deduplicates later checks", async () => {
    expect(await dispatchExpiryPush(new Date("2026-09-15T12:00:00Z"))).toEqual({
      sent: 2
    });
    expect(await dispatchExpiryPush(new Date("2026-09-16T12:00:00Z"))).toEqual({
      sent: 0
    });
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(await dispatchExpiryPush(new Date("2026-09-30T12:00:00Z"))).toEqual({
      sent: 2
    });
  });
  it("retries failed sends without marking them delivered", async () => {
    mocks.send.mockRejectedValueOnce(new Error("offline"));
    await expect(
      dispatchExpiryPush(new Date("2026-09-15T12:00:00Z"))
    ).rejects.toThrow("failures: 1");
    expect(await dispatchExpiryPush(new Date("2026-09-15T13:00:00Z"))).toEqual({
      sent: 1
    });
  });
  it("disables expired subscriptions", async () => {
    mocks.send.mockRejectedValueOnce({ statusCode: 410 });
    await expect(
      dispatchExpiryPush(new Date("2026-09-15T12:00:00Z"))
    ).rejects.toThrow();
    expect(mocks.documents.get("pushDevices/a")?.enabled).toBe(false);
  });
  it("does not send a device currently leased by another run", async () => {
    const now = new Date("2026-09-15T12:00:00Z");
    mocks.documents.set("pushDevices/a/deliveryState/current", {
      leaseUntil: now.getTime() + 10000
    });
    expect(await dispatchExpiryPush(now)).toEqual({ sent: 1 });
  });
});
