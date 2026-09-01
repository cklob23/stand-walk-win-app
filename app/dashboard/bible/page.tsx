import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BibleReader } from '@/components/bible/bible-reader'
import { Skeleton } from '@/components/ui/skeleton'
import { getSelectedPairingId } from '@/lib/selected-pairing'

export const metadata = {
    title: 'Bible - Stand Walk Run',
    description: 'Read the Bible in multiple translations',
}

export default async function BiblePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, bible_translation_preference, bible_text_size, bible_last_book, bible_last_chapter, bible_skip_verse_numbers, bible_voice_uri, bible_reading_speed, bible_voice_preferences')
        .eq('id', user.id)
        .single()

    if (!profile) redirect('/onboarding')

    // Get pairing to find current week scripture
    const roleFilter = profile.role === 'leader'
        ? { leader_id: user.id }
        : { learner_id: user.id }

    // A leader can have multiple active pairings (one per learner), so we can't use
    // .single() here — it errors on multiple rows and would drop the pairingId
    // entirely, hiding the "Send/Share to Partner" actions. We resolve the pairing
    // the SAME way the journal page does (selected-pairing cookie, otherwise newest
    // active first) so anything saved/shared from the Bible reader lands in the
    // pairing the journal actually reads back.
    const { data: pairings } = await supabase
        .from('pairings')
        .select('id, current_week')
        .match(roleFilter)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

    const selectedPairingId = await getSelectedPairingId()
    const pairing =
        (selectedPairingId && pairings?.find((p) => p.id === selectedPairingId)) ||
        pairings?.[0] ||
        null

    let weekScripture: string | null = null
    let weekNumber: number | null = null

    if (pairing) {
        weekNumber = pairing.current_week || 1
        const { data: weekContent } = await supabase
            .from('weekly_content')
            .select('scripture_reference')
            .eq('week_number', weekNumber)
            .single()

        weekScripture = weekContent?.scripture_reference || null
    }

    return (
        <div className="mx-auto max-w-4xl px-4 py-6" role="application">
            <Suspense fallback={
                <div className="space-y-4">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-64 w-full rounded-lg" />
                </div>
            }>
                <BibleReader
                    weekScripture={weekScripture}
                    weekNumber={weekNumber}
                    pairingId={pairing?.id || null}
                    savedTranslation={profile.bible_translation_preference || null}
                    savedTextSize={profile.bible_text_size || null}
                    savedBook={profile.bible_last_book || null}
                    savedChapter={profile.bible_last_chapter || null}
                    savedSkipVerseNumbers={profile.bible_skip_verse_numbers || false}
                    savedVoiceURI={profile.bible_voice_uri || null}
                    savedReadingSpeed={profile.bible_reading_speed ?? null}
                    savedVoicePreferences={(profile.bible_voice_preferences as Array<{ type: 'openai' | 'google' | 'browser'; uri: string }>) || null}
                    userRole={profile.role || null}
                />
            </Suspense>
        </div>
    )
}
