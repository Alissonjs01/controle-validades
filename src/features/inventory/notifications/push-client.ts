import { getAuth } from "firebase/auth";
import {
  ensureFirebaseAnonymousAuth,
  getFirebaseApp
} from "@/lib/firebase/client";
import type { AlertMilestone } from "./alerts";

export function pushSupportMessage() {
  const ios =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios && !window.matchMedia("(display-mode: standalone)").matches)
    return "No iPhone/iPad, adicione o app à Tela de Início pelo menu Compartilhar e abra pelo ícone para ativar os avisos.";
  if (!("PushManager" in window) || !("Notification" in window))
    return "Este navegador não oferece notificações push. Os alertas na lista continuam disponíveis.";
  if (Notification.permission === "denied")
    return "Notificações bloqueadas. Permita avisos nas configurações do navegador ou aparelho.";
  return null;
}

async function registration() {
  await navigator.serviceWorker.register("/sw.js");
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Não foi possível preparar os avisos. Reabra o app e tente novamente."
            )
          ),
        15000
      )
    )
  ]);
}

async function api(
  action: string,
  subscription: PushSubscription,
  milestones?: readonly AlertMilestone[]
) {
  const app = getFirebaseApp();
  if (!app)
    throw new Error("Avisos automáticos precisam do estoque conectado.");
  await ensureFirebaseAnonymousAuth();
  const token = await getAuth(app).currentUser?.getIdToken();
  const response = await fetch("/api/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      action,
      subscription: subscription.toJSON(),
      milestones
    }),
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      result.error ?? "Não foi possível atualizar os avisos. Tente novamente."
    );
  }
  return response.json() as Promise<{
    enabled?: boolean;
    milestones?: AlertMilestone[];
  }>;
}

export async function getPushState() {
  const worker = await navigator.serviceWorker?.getRegistration();
  const subscription = await worker?.pushManager?.getSubscription();
  if (!subscription) return { enabled: false };
  return api("status", subscription);
}

export async function enablePush(
  publicKey: string,
  milestones: readonly AlertMilestone[]
) {
  const support = pushSupportMessage();
  if (support) throw new Error(support);
  // Must run directly from the user's click, before waiting for network/auth.
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "Avisos não autorizados. Você pode permitir nas configurações do aparelho."
    );
  const worker = await registration();
  const key = Uint8Array.from(
    atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );
  const subscription =
    (await worker.pushManager.getSubscription()) ??
    (await worker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key
    }));
  await api("subscribe", subscription, milestones);
  localStorage.setItem("validda-push-preferences", JSON.stringify(milestones));
}

export async function pausePush() {
  const worker = await registration();
  const subscription = await worker.pushManager.getSubscription();
  if (subscription) {
    await api("pause", subscription);
    await subscription.unsubscribe();
  }
  localStorage.removeItem("validda-push-preferences");
}

export async function testPush() {
  const subscription = await (
    await registration()
  ).pushManager.getSubscription();
  if (!subscription)
    throw new Error("Ative os avisos neste aparelho primeiro.");
  await api("test", subscription);
}
