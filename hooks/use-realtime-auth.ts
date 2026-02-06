'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Session } from '@supabase/supabase-js'

/**
 * Ensures the Supabase auth session is refreshed before realtime subscriptions
 * are set up. Returns `ready` once the token has been refreshed.
 *
 * Components should gate their channel subscriptions on `ready === true`
 * so the realtime connection always has a valid JWT for RLS policies.
 */
export function useRealtimeAuth() {
  const [ready, setReady] = useState(false)
  const refreshed = useRef(false)

  useEffect(() => {
    if (refreshed.current) return
    refreshed.current = true

    const supabase = createClient()
    // Force-refresh the session so the realtime socket gets a fresh JWT
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (session) {
        supabase.realtime.setAuth(session.access_token)
      }
      setReady(true)
    })
  }, [])

  return ready
}
