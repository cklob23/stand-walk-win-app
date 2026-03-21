import React from "react"
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { getSelectedPairingId } from '@/lib/selected-pairing'
import { BrandingProvider, type OrgBranding } from '@/contexts/branding-context'
import { SplitScreenProvider } from '@/contexts/split-screen-context'
import { DashboardContent } from '@/components/dashboard/dashboard-content'
import type { Profile, Pairing } from '@/lib/types'

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

  // Get current pathname to check if we're on the covenant page
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  const isCovenantPage = pathname.includes('/dashboard/covenant')
  const isAdminPage = pathname.includes('/dashboard/admin')

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

  // Get unread notification count and recent notifications
  const [{ count }, { data: recentNotifications }] = await Promise.all([
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false),
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Fetch learners for leaders
  let allLearners: LearnerWithPairing[] = []
  let currentPairingId: string | null = null
  let learnerNotificationCounts: Record<string, number> = {}

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

      // Get selected pairing from cookie
      const cookiePairingId = await getSelectedPairingId()
      const selectedPairing = cookiePairingId
        ? allPairings.find(p => p.id === cookiePairingId)
        : allPairings[0]

      currentPairingId = selectedPairing?.id || allPairings[0]?.id || null

      // Fetch unread notification counts per pairing (for non-selected learners)
      const pairingIds = allPairings.map(p => p.id)
      const { data: notifCounts } = await supabase
        .from('notifications')
        .select('pairing_id')
        .eq('user_id', user.id)
        .eq('read', false)
        .in('pairing_id', pairingIds)

      if (notifCounts) {
        for (const notif of notifCounts) {
          if (notif.pairing_id) {
            learnerNotificationCounts[notif.pairing_id] = (learnerNotificationCounts[notif.pairing_id] || 0) + 1
          }
        }
      }

      // Check if covenant needs to be signed (for leaders)
      // Find active pairing with a learner that hasn't had covenant signed by both
      if (!isCovenantPage && !isAdminPage) {
        const activePairingWithLearner = allPairings.find(p =>
          p.learner_id &&
          p.status === 'active' &&
          (!p.covenant_accepted_leader || !p.covenant_accepted_learner)
        )
        if (activePairingWithLearner) {
          redirect(`/dashboard/covenant?pairing=${activePairingWithLearner.id}`)
        }
      }
    }
  }

  // Check covenant for learners
  if (profile.role === 'learner' && !isCovenantPage && !isAdminPage) {
    const { data: learnerPairing } = await supabase
      .from('pairings')
      .select('*')
      .eq('learner_id', user.id)
      .eq('status', 'active')
      .single()

    if (learnerPairing && (!learnerPairing.covenant_accepted_leader || !learnerPairing.covenant_accepted_learner)) {
      redirect(`/dashboard/covenant?pairing=${learnerPairing.id}`)
    }
  }

  return (
    <BrandingProvider initialBranding={orgBranding}>
      <SplitScreenProvider>
        <div className="min-h-screen bg-background overflow-x-hidden">
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
        </div>
      </SplitScreenProvider>
    </BrandingProvider>
  )
}
