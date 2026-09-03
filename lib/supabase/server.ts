import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
/**
 * True when a getUser() failure is a transient infrastructure problem (network
 * drop, timeout, 5xx from Supabase Auth) rather than a genuine "no valid
 * session" answer. Genuine auth failures are AuthSessionMissingError or a
 * 401/403 from the Auth API.
 */
function isTransientAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; status?: number; message?: string };
  if (e.name === "AuthSessionMissingError") return false;
  if (e.status === 401 || e.status === 403) return false;
  if (e.name === "AuthRetryableFetchError") return true;
  if (typeof e.status === "number" && (e.status === 0 || e.status >= 500)) return true;
  const msg = (e.message || "").toLowerCase();
  return msg.includes("fetch failed") || msg.includes("network") || msg.includes("timeout") || msg.includes("econn");
}

export async function createClient() {
  const cookieStore = await cookies();

  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have proxy refreshing
            // user sessions.
          }
        },
      },
    },
  );

  // Resilient getUser(): every dashboard layout/page does
  // `const { user } = await supabase.auth.getUser(); if (!user) redirect('/auth/login')`.
  // getUser() is a network call to Supabase Auth, so a momentary network blip
  // (weak mobile signal, cold start, 5xx) returned `user: null` and kicked a
  // still-authenticated user to the login page — e.g. right after booking a
  // meeting when router.refresh() re-ran the layout. When the failure is
  // transient (not a real 401/"session missing"), fall back to the session
  // already stored in the cookies (validated by the proxy on this request)
  // instead of treating it as a logout.
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = (async (jwt?: string) => {
    const result = await originalGetUser(jwt);
    if (result.data.user || !isTransientAuthError(result.error)) return result;

    const { data: { session } } = await client.auth.getSession();
    if (session?.user) {
      return { data: { user: session.user }, error: null };
    }
    return result;
  }) as typeof client.auth.getUser;

  return client;
}

/**
 * Admin client using the service role key.
 * Bypasses RLS - use only for system-level operations like creating notifications.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
