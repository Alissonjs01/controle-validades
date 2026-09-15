import { createHash } from "node:crypto";
import webpush from "web-push";
import { adminServices, pushConfigured } from "@/lib/firebase/admin";
import { brazilToday, planPushAlerts } from "./push-plan";
import { DEFAULT_ALERT_MILESTONES, type AlertMilestone } from "./alerts";
import type { Lot } from "@/types/inventory";

export type PushDevice = {
  uid: string;
  subscription: webpush.PushSubscription;
  milestones: AlertMilestone[];
  enabled: boolean;
  lastTestAt?: number;
};
export const endpointId = (endpoint: string) =>
  createHash("sha256").update(endpoint).digest("hex");

export function validateSubscription(value: unknown): webpush.PushSubscription {
  const sub = value as Partial<webpush.PushSubscription> | null;
  if (!sub || typeof sub.endpoint !== "string" || sub.endpoint.length > 4096)
    throw new Error("invalid");
  const url = new URL(sub.endpoint);
  const allowed = [
    "fcm.googleapis.com",
    "updates.push.services.mozilla.com",
    "web.push.apple.com"
  ];
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    !allowed.includes(url.hostname)
  )
    throw new Error("invalid");
  if (
    !sub.keys ||
    !/^[A-Za-z0-9_-]{80,100}$/.test(sub.keys.p256dh ?? "") ||
    !/^[A-Za-z0-9_-]{20,30}$/.test(sub.keys.auth ?? "")
  )
    throw new Error("invalid");
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }
  };
}

export function validateMilestones(value: unknown): AlertMilestone[] {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 4 ||
    !value.every((v: unknown) => DEFAULT_ALERT_MILESTONES.some((m) => m === v))
  )
    throw new Error("invalid");
  return [...new Set(value as AlertMilestone[])];
}

export async function sendPush(
  subscription: webpush.PushSubscription,
  payload: { title: string; body: string; tag: string }
) {
  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    vapidDetails: {
      subject: "https://validda.netlify.app",
      publicKey: process.env.WEB_PUSH_PUBLIC_KEY!,
      privateKey: process.env.WEB_PUSH_PRIVATE_KEY!
    },
    TTL: 86400,
    urgency: "high",
    timeout: 10000
  });
}

export async function dispatchExpiryPush(now = new Date()) {
  if (!pushConfigured()) throw new Error("Push server is not configured");
  const { db } = adminServices();
  const [devices, snapshot] = await Promise.all([
    db.collection("pushDevices").where("enabled", "==", true).get(),
    db.collection("inventory/shared/lots").get()
  ]);
  const lots = snapshot.docs.map((doc) => doc.data() as Lot);
  let sent = 0;
  let failed = 0;
  for (const deviceDoc of devices.docs) {
    const device = deviceDoc.data() as PushDevice;
    const plans = planPushAlerts(lots, device.milestones, brazilToday(now));
    if (!plans.length) continue;
    const deliveryRef = deviceDoc.ref
      .collection("deliveryState")
      .doc("current");
    const lease = crypto.randomUUID();
    const pending = await db.runTransaction(async (tx) => {
      const state = (await tx.get(deliveryRef)).data() as
        | { leaseUntil?: number; delivered?: string[] }
        | undefined;
      if ((state?.leaseUntil ?? 0) > now.getTime()) return [];
      const remaining = plans.filter(
        (plan) => !state?.delivered?.includes(plan.key)
      );
      if (remaining.length)
        tx.set(
          deliveryRef,
          { lease, leaseUntil: now.getTime() + 300000 },
          { merge: true }
        );
      return remaining;
    });
    if (!pending.length) continue;
    try {
      const expired = pending.filter((p) => p.days < 0).length;
      await sendPush(device.subscription, {
        title: expired
          ? `${expired} lote(s) vencido(s)`
          : `${pending.length} lote(s) perto do vencimento`,
        body: "Confira as validades e quantidades no estoque.",
        tag: `expiry-${brazilToday(now)}`
      });
      await db.runTransaction(async (tx) => {
        const current = (await tx.get(deliveryRef)).data();
        if (current?.lease === lease)
          tx.set(deliveryRef, {
            delivered: plans.map((p) => p.key),
            leaseUntil: 0,
            acceptedAt: now.toISOString()
          });
      });
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410)
        await deviceDoc.ref.update({ enabled: false });
      await deliveryRef.set({ leaseUntil: 0 }, { merge: true });
      failed++;
    }
  }
  if (failed)
    throw new Error(`Push delivery failures: ${failed}; accepted: ${sent}`);
  return { sent };
}
