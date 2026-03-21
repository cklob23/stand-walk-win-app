import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { JourneyStore } from '@/components/journeys/journey-store'

export const metadata: Metadata = {
    title: 'Journeys | Stand Walk Run',
    description: 'Browse and purchase additional discipleship journeys',
}

export default async function JourneysPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    // Get user's profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    // Get user's purchased journeys
    const { data: userJourneys } = await supabase
        .from('user_journeys')
        .select('*')
        .eq('user_id', user.id)

    return (
        <JourneyStore
            userId={user.id}
            email={user.email || ''}
            userJourneys={userJourneys || []}
            currentJourneyId={profile?.current_journey_id}
        />
    )
}
