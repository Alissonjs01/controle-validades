import { getPublicEnv } from "@/lib/env";

export function isSupabaseConfigured() {
  const { supabasePublishableKey, supabaseUrl } = getPublicEnv();

  return Boolean(supabaseUrl && supabasePublishableKey);
}
