type PublicEnv = Readonly<{
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
}>;

export function getPublicEnv(): PublicEnv {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  };
}
