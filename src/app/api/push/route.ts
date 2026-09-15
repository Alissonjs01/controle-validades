import { adminServices, pushConfigured } from "@/lib/firebase/admin";
import {
  endpointId,
  sendPush,
  validateMilestones,
  validateSubscription,
  type PushDevice
} from "@/features/inventory/notifications/push-server";

export const runtime = "nodejs";
export function GET() {
  return Response.json(
    {
      available: pushConfigured(),
      publicKey: pushConfigured() ? process.env.WEB_PUSH_PUBLIC_KEY : null
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  if (!pushConfigured())
    return Response.json(
      { error: "Envio automático ainda não configurado." },
      { status: 503 }
    );
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response(null, { status: 403 });
  const { db, auth } = adminServices();
  let uid: string;
  try {
    const token =
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    uid = (await auth.verifyIdToken(token)).uid;
  } catch {
    return new Response(null, { status: 401 });
  }
  try {
    const raw = await request.text();
    if (raw.length > 8192) return new Response(null, { status: 413 });
    const body = JSON.parse(raw) as {
      subscription: unknown;
      milestones: unknown;
      action: string;
    };
    const subscription = validateSubscription(body.subscription);
    const ref = db
      .collection("pushDevices")
      .doc(endpointId(subscription.endpoint));
    const existing = (await ref.get()).data() as PushDevice | undefined;
    if (existing && existing.uid !== uid)
      return new Response(null, { status: 403 });
    if (body.action === "status") {
      return Response.json({
        enabled: existing?.enabled ?? false,
        milestones: existing?.milestones ?? []
      });
    } else if (body.action === "pause") {
      if (existing) await ref.update({ enabled: false });
    } else if (body.action === "test") {
      if (!existing?.enabled) return new Response(null, { status: 409 });
      const allowed = await db.runTransaction(async (tx) => {
        const device = (await tx.get(ref)).data() as PushDevice;
        if (Date.now() - (device.lastTestAt ?? 0) < 60000) return false;
        tx.update(ref, { lastTestAt: Date.now() });
        return true;
      });
      if (!allowed)
        return Response.json(
          { error: "Aguarde um minuto antes de testar novamente." },
          { status: 429 }
        );
      await sendPush(subscription, {
        title: "Avisos do ValiddA",
        body: "Este aparelho está pronto para receber alertas de validade.",
        tag: "push-test"
      });
    } else if (body.action === "subscribe") {
      const milestones = validateMilestones(body.milestones);
      await ref.set(
        {
          uid,
          subscription,
          milestones,
          enabled: true,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    } else return new Response(null, { status: 400 });
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      {
        error: "Não foi possível concluir. Confira a conexão e tente novamente."
      },
      { status: 400 }
    );
  }
}
