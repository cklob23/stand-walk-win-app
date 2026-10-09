import React from "react"
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { getSelectedPairingId } from '@/lib/selected-pairing'
import { pickActivePairing } from '@/lib/pairing-resolution'
import { SyncSelectedPairing } from '@/components/dashboard/sync-selected-pairing'
import { SyncLocalDate } from '@/components/dashboard/sync-local-date'
import { BrandingProvider, type OrgBranding } from '@/contexts/branding-context'
import { SplitScreenProvider } from '@/contexts/split-screen-context'
import { DynamicFavicon } from '@/components/dynamic-favicon'
import { DashboardContent } from '@/components/dashboard/dashboard-content'
import { CovenantRedirectGuard } from '@/components/dashboard/covenant-redirect-guard'
import type { Profile, Pairing } from '@/lib/types'
import { tallyUnreadByPairing } from '@/lib/notification-unread'
import { fetchUnreadToLeader } from '@/lib/unread-to-leader'
import { UnreadToLeaderProvider } from '@/components/dashboard/unread-to-leader-provider'

interface LearnerWithPairing {
  pairing: Pairing
  learner: Profile
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      *,
      subscription_tier:subscription_tiers(*)
    `)
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/onboarding')
  }

  // Track covenant state for client-side redirect guard
  let needsCovenantSignature = false
  let covenantPairingId: string | null = null

  // Fetch organization branding if user belongs to an org
  let orgBranding: OrgBranding | null = null
  if (profile.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name, branding_logo_url, branding_church_name, branding_slogan, branding_primary_color, branding_secondary_color')
      .eq('id', profile.organization_id)
      .single()

    if (org) {
      orgBranding = {
        logoUrl: org.branding_logo_url,
        churchName: org.branding_church_name,
        slogan: org.branding_slogan,
        primaryColor: org.branding_primary_color,
        secondaryColor: org.branding_secondary_color,
        organizationName: org.name,
      }
    }
  }

  // One unread SELECT drives both the bell and the learner pills.
  // A separate HEAD count was returning 0 while this list still had rows.
  const [{ data: unreadRows }, { data: recentNotifications }] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, pairing_id, type')
      .eq('user_id', user.id)
      .eq('read', false),
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])
  const count = unreadRows?.length ?? 0

  // Fetch learners for leaders
  let allLearners: LearnerWithPairing[] = []
  let currentPairingId: string | null = null
  let learnerNotificationCounts: Record<string, number> = {}
  let unreadToLeader: Record<string, number> = {}
  let pairingIds: string[] = []

  if (profile.role === 'leader') {
    const { data: allPairings } = await supabase
      .from('pairings')
      .select(`
        *,
        learner:profiles!pairings_learner_id_fkey(*)
      `)
      .eq('leader_id', user.id)
      .in('status', ['active', 'pending'])
      .order('created_at', { ascending: false })

    if (allPairings && allPairings.length > 0) {
      allLearners = allPairings
        .filter(p => p.learner)
        .map(p => ({
          pairing: p as Pairing,
          learner: p.learner as Profile
        }))

      // Prefer cookie only if that pairing is usable (has a learner).
      // Never fall back to an unclaimed invite / partner-less pairing — that
      // stale ID is what sent Messages/Schedule/Covenant to a blank redirect.
      const cookiePairingId = await getSelectedPairingId()
      const selectedPairing = pickActivePairing(allPairings, 'leader', [cookiePairingId])
      currentPairingId = selectedPairing?.id || null

      // Same unread rows as the bell — not a second query, not unread messages.
      learnerNotificationCounts = tallyUnreadByPairing(unreadRows)

      // The dashboard LearnerSwitcher badge was learners.length (always 2
      // when two pairings exist). The pill must be unread messages TO the
      // leader on that pairing — the same rows opening the thread marks.
      pairingIds = allPairings.map(p => p.id)
      unreadToLeader = await fetchUnreadToLeader(supabase, user.id, pairingIds)

      // Check if covenant needs to be signed (for leaders)
      // Find active pairing with a learner where the LEADER hasn't signed yet
      const unsignedPairing = allPairings.find(p =>
        p.learner_id &&
        p.status === 'active' &&
        !p.covenant_accepted_leader  // Leader hasn't signed
      )
      if (unsignedPairing) {
        needsCovenantSignature = true
        covenantPairingId = unsignedPairing.id
      }
    }
  }

  // Check covenant for learners - redirect if LEARNER hasn't signed yet
  if (profile.role === 'learner') {
    const { data: learnerPairing } = await supabase
      .from('pairings')
      .select('*')
      .eq('learner_id', user.id)
      .eq('status', 'active')
      .single()

    if (learnerPairing && !learnerPairing.covenant_accepted_learner) {
      needsCovenantSignature = true
      covenantPairingId = learnerPairing.id
    }
  }

  return (
    <BrandingProvider initialBranding={orgBranding}>
      <SplitScreenProvider>
        <CovenantRedirectGuard
          needsCovenantSignature={needsCovenantSignature}
          covenantPairingId={covenantPairingId}
        >
          <DynamicFavicon />
          <div className="min-h-screen bg-background overflow-x-hidden">
            <SyncSelectedPairing pairingId={currentPairingId} />
            <SyncLocalDate />
            <UnreadToLeaderProvider
              leaderId={profile.role === 'leader' ? user.id : null}
              pairingIds={pairingIds}
              initial={unreadToLeader}
            >
              <DashboardHeader
                profile={profile}
                notificationCount={count || 0}
                recentNotifications={recentNotifications || []}
                allLearners={allLearners}
                currentPairingId={currentPairingId}
                learnerNotificationCounts={learnerNotificationCounts}
                maxLearners={(profile.subscription_tier as { max_learners?: number })?.max_learners || 1}
                slogan={orgBranding?.slogan || null}
              />
              <main className="w-full overflow-x-hidden">
                <DashboardContent>{children}</DashboardContent>
              </main>
            </UnreadToLeaderProvider>
          </div>
        </CovenantRedirectGuard>
      </SplitScreenProvider>
    </BrandingProvider>
  )
}
