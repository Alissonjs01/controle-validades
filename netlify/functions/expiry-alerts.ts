import { dispatchExpiryPush } from "../../src/features/inventory/notifications/push-server";

export default async () => {
  const result = await dispatchExpiryPush();
  return Response.json(result);
};

// Hourly from 08:00 through 20:00 in Sao Paulo, including weekends.
export const config = { schedule: "0 11-23 * * *" };
