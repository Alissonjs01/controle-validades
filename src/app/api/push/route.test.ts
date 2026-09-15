// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import type * as PushServer from "@/features/inventory/notifications/push-server";
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  existing: { uid: "a", enabled: true },
  update: vi.fn(),
  send: vi.fn()
}));
vi.mock("@/lib/firebase/admin", () => ({
  pushConfigured: () => true,
  adminServices: () => ({
    auth: { verifyIdToken: mocks.verify },
    db: {
      collection: () => ({
        doc: () => ({
          get: () => Promise.resolve({ data: () => mocks.existing }),
          update: mocks.update
        })
      })
    }
  })
}));
vi.mock("@/features/inventory/notifications/push-server", async (original) => ({
  ...(await original<
    typeof PushServer
  >()),
  sendPush: mocks.send
}));
import { POST } from "./route";

beforeEach(() => {
  mocks.verify.mockReset();
  mocks.verify.mockResolvedValue({ uid: "a" });
  mocks.update.mockReset();
  mocks.update.mockResolvedValue(undefined);
});
const request = (origin = "https://validda.netlify.app", action = "pause") =>
  new Request("https://validda.netlify.app/api/push", {
    method: "POST",
    headers: { origin, Authorization: "Bearer test" },
    body: JSON.stringify({
      action,
      subscription: {
        endpoint: "https://fcm.googleapis.com/test",
        keys: { auth: "a".repeat(22), p256dh: "b".repeat(87) }
      }
    })
  });
it("rejects foreign origins before accessing Firebase", async () => {
  expect((await POST(request("https://other.test"))).status).toBe(403);
  expect(mocks.verify).not.toHaveBeenCalled();
});
it("rejects invalid Firebase tokens", async () => {
  mocks.verify.mockRejectedValueOnce(new Error("invalid"));
  expect((await POST(request())).status).toBe(401);
});
it("prevents another anonymous user from changing a subscription", async () => {
  mocks.verify.mockResolvedValueOnce({ uid: "b" });
  expect((await POST(request())).status).toBe(403);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("pauses only the owner's device", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith({ enabled: false });
});
it("reads delivery status from the server", async () => {
  const response = await POST(request("https://validda.netlify.app", "status"));
  expect(await response.json()).toMatchObject({ enabled: true });
});
