import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;
let authListenerSet = false;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Keep the realtime connection's auth token in sync with session changes.
  // This is critical: without a valid JWT, postgres_changes events won't
  // pass RLS and the client silently receives nothing.
  if (!authListenerSet) {
    authListenerSet = true;
    client.auth.onAuthStateChange((event: any, session: any) => {
      if (client) {
        client.realtime.setAuth(session?.access_token ?? null);
      }
    });
  }

  return client;
}
