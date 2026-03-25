import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;
let authListenerSet = false;

export function createClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Extend session persistence - don't expire until explicitly logged out
        persistSession: true,
        // Store in localStorage for longer persistence
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        // Auto-refresh tokens before they expire
        autoRefreshToken: true,
        // Detect session from URL (for magic links, OAuth)
        detectSessionInUrl: true,
      },
      cookies: {
        // Override cookie options for longer session duration
        get(name: string) {
          if (typeof document === 'undefined') return undefined;
          const value = document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${name}=`))
            ?.split('=')[1];
          return value ? decodeURIComponent(value) : undefined;
        },
        set(name: string, value: string, options?: { maxAge?: number }) {
          if (typeof document === 'undefined') return;
          // Set cookie to expire in 1 year (365 days)
          const maxAge = options?.maxAge ?? 365 * 24 * 60 * 60;
          document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
        },
        remove(name: string) {
          if (typeof document === 'undefined') return;
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        },
      },
    }
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
