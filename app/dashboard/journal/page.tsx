import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BookHeart } from 'lucide-react'
import { JournalPageClient } from '@/components/journal/journal-page-client'
import { getTodayEntry } from '@/lib/journal-actions'

export const metadata = {
    title: 'Prayer Journal - Stand Walk Run',
    description: 'Daily prayer journal and reflections',
}

export default async function JournalPage({
    searchParams,
}: {
    searchParams: Promise<{ section?: string; localDate?: string }>
}) {
    const params = await searchParams
    // localDate is passed from the client via URL param to handle timezone correctly
    const localDate = params.localDate || new Date().toISOString().split('T')[0]
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/auth/login')

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, full_name')
        .eq('id', user.id)
        .single()

    if (!profile) redirect('/onboarding')

    // Get pairing
    const roleFilter = profile.role === 'leader'
        ? { leader_id: user.id }
        : { learner_id: user.id }

    const { data: pairing } = await supabase
        .from('pairings')
        .select(`
      id,
      leader_id,
      learner_id,
      leader:profiles!pairings_leader_id_fkey(full_name),
      learner:profiles!pairings_learner_id_fkey(full_name)
    `)
        .match(roleFilter)
        .eq('status', 'active')
        .single()

    if (!pairing) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-6">
                <div className="text-center py-12">
                    <BookHeart className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h2 className="text-lg font-semibold text-foreground">No Active Pairing</h2>
                    <p className="text-sm text-muted-foreground">
                        You need an active pairing to use the prayer journal.
                    </p>
                </div>
            </div>
        )
    }

    const isLeader = profile.role === 'leader'
    const leaderName = (pairing.leader as unknown as { full_name: string })?.full_name || 'Leader'
    const learnerName = (pairing.learner as unknown as { full_name: string })?.full_name || 'Learner'

    const partnerId = isLeader ? pairing.learner_id : pairing.leader_id
    const partnerName = isLeader ? learnerName : leaderName

    // Fetch OWN journal entries (both leaders and learners have their own journals now)
    const { data: myEntries } = await supabase
        .from('prayer_journal')
        .select('*')
        .eq('user_id', user.id)
        .eq('pairing_id', pairing.id)
        .order('journal_date', { ascending: false })

    // Fetch partner's shared entries using admin client to bypass RLS
    // (RLS only allows leaders to SELECT shared entries, but we need bidirectional sharing)
    const adminSupabase = createAdminClient()
    const { data: partnerSharedData } = await adminSupabase
        .from('prayer_journal')
        .select('*')
        .eq('pairing_id', pairing.id)
        .eq('user_id', partnerId!)
        .eq('shared_with_leader', true)
        .order('journal_date', { ascending: false })
    const partnerSharedEntries = partnerSharedData || []

    // Fetch shared items from partner via the shared_items table
    const { data: sharedItemsData } = await supabase
        .from('shared_items')
        .select('*')
        .eq('pairing_id', pairing.id)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)

    const verseSharedItems = (sharedItemsData || []).map((item) => ({
        id: item.id,
        type: item.item_type as 'verse' | 'verse_note' | 'journal',
        scripture_ref: item.scripture_ref || '',
        verse_text: item.verse_text || '',
        note: item.note || '',
        sender_name: partnerName,
        created_at: item.created_at,
    }))

    // Convert partner's shared journal entries into SharedItem format
    const journalSharedItems: typeof verseSharedItems = []
    for (const entry of (partnerSharedEntries || [])) {
        const sections: Record<string, boolean> = (entry.shared_sections as Record<string, boolean>) || {}
        const godSpeakingParts = (entry.god_speaking || '').split('\n\n---\n\n')
        const freeText = (godSpeakingParts[0] || '').trim()
        const verseParts = godSpeakingParts.slice(1).map((s: string) => s.trim()).filter(Boolean)

        // 1) Daily reflection section (shared_sections.daily = true)
        if (sections.daily && (entry.prayer_items?.trim() || freeText)) {
            const dailyLines: string[] = []
            if (entry.prayer_items?.trim()) {
                dailyLines.push(`Q: 3 things I'm praying about today`)
                dailyLines.push(`A: ${entry.prayer_items.trim()}`)
                dailyLines.push('')
            }
            if (freeText) {
                dailyLines.push(`Q: What am I learning today?`)
                dailyLines.push(`A: ${freeText}`)
            }
            journalSharedItems.push({
                id: `journal-daily-${entry.id}`,
                type: 'journal' as const,
                scripture_ref: '',
                verse_text: dailyLines.join('\n'),
                note: `${partnerName}'s Daily Reflections`,
                sender_name: partnerName,
                created_at: entry.created_at,
            })
        }

        // 2) Verse sections (shared_sections.verse_0, verse_1, etc.)
        verseParts.forEach((raw: any, idx: number) => {
            if (!sections[`verse_${idx}`]) return
            let title = ''
            let scriptureRef = ''
            const contentLines: string[] = []
            for (const line of raw.split('\n')) {
                if (line.startsWith('@@TITLE: ')) title = line.replace('@@TITLE: ', '')
                else if (line.startsWith('@@TIME: ')) { /* skip */ }
                else {
                    const refMatch = line.match(/^\[([^\]]+)\]/)
                    if (refMatch && !scriptureRef) scriptureRef = refMatch[1]
                    contentLines.push(line)
                }
            }
            journalSharedItems.push({
                id: `journal-verse-${entry.id}-${idx}`,
                type: 'journal' as const,
                scripture_ref: scriptureRef,
                verse_text: contentLines.join('\n'),
                note: title || 'Shared Scripture',
                sender_name: partnerName,
                created_at: entry.created_at,
            })
        })

        // 3) Custom entries (shared_sections.custom_0, custom_1, etc.)
        const customs = entry.custom_entries as { title: string; content: string; created_at: string }[] | null
        if (customs) {
            customs.forEach((c, idx) => {
                if (!sections[`custom_${idx}`]) return
                journalSharedItems.push({
                    id: `journal-custom-${entry.id}-${idx}`,
                    type: 'journal' as const,
                    scripture_ref: '',
                    verse_text: c.content?.trim() || '',
                    note: c.title || 'Custom Entry',
                    sender_name: partnerName,
                    created_at: entry.created_at,
                })
            })
        }
    }

    // Merge and sort all shared items by date (newest first)
    const sharedItems = [...verseSharedItems, ...journalSharedItems]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Fetch today's entry for editor (using local date to avoid timezone issues)
    const todayEntry = await getTodayEntry(user.id, localDate)

    return (
        <JournalPageClient
            isLeader={isLeader}
            leaderName={leaderName}
            learnerName={learnerName}
            pairingId={pairing.id}
            entries={myEntries || []}
            sharedItems={sharedItems}
            todayEntry={todayEntry}
            initialSection={params.section || null}
        />
    )
}
