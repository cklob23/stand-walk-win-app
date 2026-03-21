'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BibleReader } from '@/components/bible/bible-reader'
import { Loader2 } from 'lucide-react'

export default function BiblePanel() {
    const [isLoading, setIsLoading] = useState(true)
    const [profile, setProfile] = useState<any>(null)
    const [preferences, setPreferences] = useState<any>(null)
    const [pairing, setPairing] = useState<any>(null)

    useEffect(() => {
        async function loadData() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                setIsLoading(false)
                return
            }

            // Fetch profile and preferences in parallel
            const [profileRes, prefsRes, pairingRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', user.id).single(),
                supabase.from('bible_preferences').select('*').eq('user_id', user.id).single(),
                supabase.from('pairings')
                    .select('*')
                    .or(`leader_id.eq.${user.id},learner_id.eq.${user.id}`)
                    .eq('status', 'active')
                    .limit(1)
                    .single(),
            ])

            setProfile(profileRes.data)
            setPreferences(prefsRes.data)
            setPairing(pairingRes.data)
            setIsLoading(false)
        }

        loadData()
    }, [])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (!profile) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground p-8">
                <p className="text-sm">Unable to load Bible reader</p>
            </div>
        )
    }

    return (
        <BibleReader
            pairingId={pairing?.id}
            savedTranslation={preferences?.translation}
            savedTextSize={preferences?.text_size}
            savedBook={preferences?.book}
            savedChapter={preferences?.chapter}
            savedSkipVerseNumbers={preferences?.skip_verse_numbers}
            savedVoiceURI={preferences?.voice_uri}
            savedReadingSpeed={preferences?.reading_speed}
            savedVoicePreferences={preferences?.voice_preferences}
            userRole={profile.role}
        />
    )
}
