// @vitest-environment node
import { describe, expect, it } from "vitest";
import { validateMilestones, validateSubscription } from "./push-server";

describe("push input validation", () => {
  const sub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/example",
    keys: { auth: "a".repeat(22), p256dh: "b".repeat(87) }
  };
  it("accepts standard push providers", () => {
    expect(validateSubscription(sub)).toEqual(sub);
    expect(validateMilestones([30, 7, 7])).toEqual([30, 7]);
  });
  it.each([
    "http://127.0.0.1",
    "https://localhost",
    "https://fcm.googleapis.com.evil.test",
    "https://fcm.googleapis.com:8443",
    "https://user@fcm.googleapis.com"
  ])("rejects arbitrary network destination %s", (endpoint) => {
    expect(() => validateSubscription({ ...sub, endpoint })).toThrow();
  });
  it("rejects bad keys and unexpected milestones", () => {
    expect(() => validateSubscription({ ...sub, keys: {} })).toThrow();
    expect(() => validateMilestones([99])).toThrow();
    expect(() => validateMilestones([])).toThrow();
  });
});
