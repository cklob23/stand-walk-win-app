'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { notifySharedVerse, createNotification } from '@/lib/notifications'

export interface BibleHighlight {
    id: string
    user_id: string
    book_id: string
    chapter: number
    verse: number
    color: string
    note: string | null
    translation: string
    shared_with_partner: boolean
    pairing_id: string | null
    created_at: string
}


const VALID_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange'] as const
export type HighlightColor = typeof VALID_COLORS[number]

export async function getHighlightsForChapter(
    bookId: string,
    chapter: number
): Promise<BibleHighlight[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
        .from('bible_highlights')
        .select('*')
        .eq('user_id', user.id)
        .eq('book_id', bookId)
        .eq('chapter', chapter)
        .order('verse', { ascending: true })

    return data || []
}

export async function getAllHighlights(): Promise<BibleHighlight[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
        .from('bible_highlights')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    return data || []
}

export async function toggleHighlight(
    bookId: string,
    chapter: number,
    verseNumber: number,
    color: HighlightColor,
    translation: string
): Promise<{ highlight: BibleHighlight | null; removed: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    if (!VALID_COLORS.includes(color)) throw new Error('Invalid color')

    // Check if highlight already exists with same color
    const { data: existing } = await supabase
        .from('bible_highlights')
        .select('*')
        .eq('user_id', user.id)
        .eq('book_id', bookId)
        .eq('chapter', chapter)
        .eq('verse', verseNumber)
        .single()

    if (existing) {
        if (existing.color === color) {
            // Same color = remove highlight
            await supabase
                .from('bible_highlights')
                .delete()
                .eq('id', existing.id)
            return { highlight: null, removed: true }
        } else {
            // Different color = update
            const { data: updated } = await supabase
                .from('bible_highlights')
                .update({ color, translation })
                .eq('id', existing.id)
                .select()
                .single()
            return { highlight: updated, removed: false }
        }
    }

    // Create new
    const { data: created } = await supabase
        .from('bible_highlights')
        .insert({
            user_id: user.id,
            book_id: bookId,
            chapter,
            verse: verseNumber,
            color,
            translation,
        })
        .select()
        .single()

    return { highlight: created, removed: false }
}

export async function updateHighlightNote(
    highlightId: string,
    note: string | null
): Promise<BibleHighlight | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data } = await supabase
        .from('bible_highlights')
        .update({ note: note?.trim() || null })
        .eq('id', highlightId)
        .eq('user_id', user.id)
        .select()
        .single()

    return data
}

export async function deleteHighlight(highlightId: string): Promise<void> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    await supabase
        .from('bible_highlights')
        .delete()
        .eq('id', highlightId)
        .eq('user_id', user.id)
}

export async function shareHighlightWithPartner(
    highlightId: string,
    shared: boolean,
    pairingId: string | null,
    bookName?: string,
    verseText?: string,
    translationAbbr?: string
): Promise<BibleHighlight | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data } = await supabase
        .from('bible_highlights')
        .update({
            shared_with_partner: shared,
            pairing_id: shared ? pairingId : null,
        })
        .eq('id', highlightId)
        .eq('user_id', user.id)
        .select()
        .single()

    // When unsharing, remove from shared_items
    if (!shared && pairingId && data) {
        await supabase.from('shared_items')
            .delete()
            .eq('sender_id', user.id)
            .eq('pairing_id', pairingId)
            .eq('scripture_ref', `${bookName || data.book_id} ${data.chapter}:${data.verse}`)
    }

    if (shared && pairingId && data) {
        // Notify the partner and save to shared_items
        const { data: pairing } = await supabase
            .from('pairings')
            .select('leader_id, learner_id')
            .eq('id', pairingId)
            .single()

        if (pairing) {
            const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', user.id)
                .single()

            const senderName = profile?.full_name || 'Your partner'
            const versionTag = translationAbbr ? ` (${translationAbbr})` : ''
            const scriptureRef = bookName
                ? `${bookName} ${data.chapter}:${data.verse}${versionTag}`
                : `${data.book_id} ${data.chapter}:${data.verse}${versionTag}`

            // Insert into shared_items table
            const { error: sharedError } = await supabase.from('shared_items').insert({
                pairing_id: pairingId,
                sender_id: user.id,
                recipient_id: partnerId,
                item_type: data.note ? 'verse_note' : 'verse',
                scripture_ref: scriptureRef.trim(),
                verse_text: verseText || '',
                note: data.note || null,
            })

            await notifySharedVerse(partnerId!, senderName, pairingId, scriptureRef.trim(), !!data.note)
        }
    }

    revalidatePath('/dashboard/journal')
    return data
}

export async function saveNoteToJournal(
    highlightId: string,
    pairingId: string,
    bookName: string,
    chapter: number,
    verse: number,
    verseText: string,
    shareWithLeader: boolean,
    customTitle?: string,
    translationAbbr?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const highlight = await supabase
        .from('bible_highlights')
        .select('note')
        .eq('id', highlightId)
        .eq('user_id', user.id)
        .single()

    if (!highlight.data) return { success: false, error: 'Highlight not found' }

    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()
    const versionTag = translationAbbr ? ` (${translationAbbr})` : ''
    const scriptureRef = `${bookName} ${chapter}:${verse}${versionTag}`
    const hasNote = !!highlight.data.note
    const defaultTitle = `Verse from ${scriptureRef}`
    const title = customTitle?.trim() || defaultTitle
    const friendlyTime = new Date(now).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    })
    const noteLine = highlight.data.note ? `\nMy notes: ${highlight.data.note}` : ''
    const noteContent = `@@TITLE: ${title}\n@@TIME: ${friendlyTime}\n[${scriptureRef}] "${verseText.trim()}"${noteLine}`

    // Check if entry already exists for today
    const { data: existing } = await supabase
        .from('prayer_journal')
        .select('id, god_speaking')
        .eq('user_id', user.id)
        .eq('journal_date', today)
        .single()

    if (existing) {
        // Always append after a --- separator so verse goes into verses array, not freeText
        const updatedGodSpeaking = existing.god_speaking
            ? `${existing.god_speaking}\n\n---\n\n${noteContent}`
            : `\n\n---\n\n${noteContent}`

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                god_speaking: updatedGodSpeaking,
                shared_with_leader: shareWithLeader || undefined,
                updated_at: now,
            })
            .eq('id', existing.id)

        if (error) return { success: false, error: error.message }
    } else {
        // When creating a new entry, use empty freeText + separator + verse content
        const { error } = await supabase
            .from('prayer_journal')
            .insert({
                user_id: user.id,
                pairing_id: pairingId,
                journal_date: today,
                prayer_items: '',
                god_speaking: `\n\n---\n\n${noteContent}`,
                shared_with_leader: shareWithLeader,
                shared_sections: {},
                custom_entries: [],
            })

        if (error) return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/journal')
    return { success: true }
}

// Helper: build smart verse range string e.g. "1-3, 8" from [1,2,3,8]
function buildVerseRangeStr(verseNums: number[]): string {
    if (verseNums.length === 0) return ''
    if (verseNums.length === 1) return `${verseNums[0]}`
    const sorted = [...verseNums].sort((a, b) => a - b)
    const groups: number[][] = []
    let current = [sorted[0]]
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === current[current.length - 1] + 1) {
            current.push(sorted[i])
        } else {
            groups.push(current)
            current = [sorted[i]]
        }
    }
    groups.push(current)
    return groups.map(g => g.length === 1 ? `${g[0]}` : `${g[0]}-${g[g.length - 1]}`).join(', ')
}

// Save multiple verses together as a single journal entry (e.g. John 3:1-5)
export async function saveMultipleVersesToJournal(
    pairingId: string,
    bookName: string,
    chapter: number,
    verseEntries: { verse: number; text: string; note?: string | null }[],
    customTitle?: string,
    translationAbbr?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    if (verseEntries.length === 0) return { success: false, error: 'No verses selected' }

    const sorted = [...verseEntries].sort((a, b) => a.verse - b.verse)
    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    const verseNums = sorted.map(v => v.verse)
    const rangeStr = buildVerseRangeStr(verseNums)
    const versionTag = translationAbbr ? ` (${translationAbbr})` : ''
    const scriptureRef = `${bookName} ${chapter}:${rangeStr}${versionTag}`

    const defaultTitle = `Verses from ${scriptureRef}`
    const title = customTitle?.trim() || defaultTitle

    // Group consecutive verses together in the display
    const groups: typeof sorted[] = []
    let currentGroup = [sorted[0]]
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].verse === currentGroup[currentGroup.length - 1].verse + 1) {
            currentGroup.push(sorted[i])
        } else {
            groups.push(currentGroup)
            currentGroup = [sorted[i]]
        }
    }
    groups.push(currentGroup)

    // Build verse text - group consecutive verses together
    const verseLines = groups.map(group => {
        if (group.length === 1) {
            const v = group[0]
            const line = `[${bookName} ${chapter}:${v.verse}${versionTag}] "${v.text.trim()}"`
            return v.note ? `${line}\nMy notes: ${v.note}` : line
        }
        // Consecutive range - combine text
        const rangeLabel = `${bookName} ${chapter}:${group[0].verse}-${group[group.length - 1].verse}${versionTag}`
        const combinedText = group.map(v => v.text.trim()).join(' ')
        const notesWithContent = group.filter(v => v.note)
        const line = `[${rangeLabel}] "${combinedText}"`
        if (notesWithContent.length === 0) return line
        // If all notes are the same (e.g. combined note from dialog), show once
        const uniqueNotes = [...new Set(notesWithContent.map(v => v.note))]
        if (uniqueNotes.length === 1) return `${line}\nMy notes: ${uniqueNotes[0]}`
        // Different notes per verse - show individually
        const notes = notesWithContent.map(v => `v${v.verse}: ${v.note}`)
        return `${line}\nMy notes: ${notes.join('; ')}`
    }).join('\n\n')

    const friendlyTime = new Date(now).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    })
    const noteContent = `@@TITLE: ${title}\n@@TIME: ${friendlyTime}\n${verseLines}`

    const { data: existing } = await supabase
        .from('prayer_journal')
        .select('id, god_speaking')
        .eq('user_id', user.id)
        .eq('journal_date', today)
        .single()

    if (existing) {
        // Always append after --- so verse goes into verses array, not freeText
        const updatedGodSpeaking = existing.god_speaking
            ? `${existing.god_speaking}\n\n---\n\n${noteContent}`
            : `\n\n---\n\n${noteContent}`

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                god_speaking: updatedGodSpeaking,
                updated_at: now,
            })
            .eq('id', existing.id)

        if (error) return { success: false, error: error.message }
    } else {
        // New entry: empty freeText + separator + verse
        const { error } = await supabase
            .from('prayer_journal')
            .insert({
                user_id: user.id,
                pairing_id: pairingId,
                journal_date: today,
                prayer_items: '',
                god_speaking: `\n\n---\n\n${noteContent}`,
                shared_with_leader: false,
                shared_sections: {},
                custom_entries: [],
            })

        if (error) return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/journal')
    return { success: true }
}

// Save AI explanation to prayer journal
export async function saveExplanationToJournal(
    pairingId: string,
    reference: string,
    explanationText: string,
    customTitle?: string,
    customNote?: string
): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const today = new Date().toISOString().split('T')[0]
    const now = new Date().toISOString()

    const title = customTitle?.trim() || `AI Explanation - ${reference}`
    const friendlyTime = new Date(now).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
    })

    // Strip markdown formatting for clean journal content
    const cleanExplanation = explanationText
        .replace(/^#{1,3}\s+/gm, '')
        .replace(/\*\*/g, '')
        .trim()

    const noteLine = customNote?.trim() ? `\nMy notes: ${customNote.trim()}` : ''
    const noteContent = `@@TITLE: ${title}\n@@TIME: ${friendlyTime}\nAI Explanation for ${reference}:\n${cleanExplanation}${noteLine}`

    const { data: existing } = await supabase
        .from('prayer_journal')
        .select('id, god_speaking')
        .eq('user_id', user.id)
        .eq('journal_date', today)
        .single()

    if (existing) {
        const updatedGodSpeaking = existing.god_speaking
            ? `${existing.god_speaking}\n\n---\n\n${noteContent}`
            : `\n\n---\n\n${noteContent}`

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                god_speaking: updatedGodSpeaking,
                updated_at: now,
            })
            .eq('id', existing.id)

        if (error) return { success: false, error: error.message }
    } else {
        const { error } = await supabase
            .from('prayer_journal')
            .insert({
                user_id: user.id,
                pairing_id: pairingId,
                journal_date: today,
                prayer_items: '',
                god_speaking: `\n\n---\n\n${noteContent}`,
                shared_with_leader: false,
                shared_sections: {},
                custom_entries: [],
            })

        if (error) return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/journal')
    return { success: true }
}

interface VoicePreference {
    type: 'elevenlabs' | 'openai' | 'google' | 'browser'
    uri: string
}

export async function saveBiblePreference(
    translationPref: string,
    textSize: string,
    skipVerseNumbers?: boolean,
    voiceURI?: string,
    readingSpeed?: number,
    voicePreference?: VoicePreference
): Promise<void> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // If a voice preference is provided, merge it into the existing array
    let voicePrefsUpdate: VoicePreference[] | undefined
    if (voicePreference) {
        // First fetch existing preferences
        const { data: profile } = await supabase
            .from('profiles')
            .select('bible_voice_preferences')
            .eq('id', user.id)
            .single()

        const existingPrefs = (profile?.bible_voice_preferences as VoicePreference[]) || []
        // Remove any existing preference of the same type, then add the new one
        voicePrefsUpdate = [
            ...existingPrefs.filter(p => p.type !== voicePreference.type),
            voicePreference
        ]
    }

    await supabase
        .from('profiles')
        .update({
            bible_translation_preference: translationPref,
            bible_text_size: textSize,
            bible_skip_verse_numbers: skipVerseNumbers ?? false,
            bible_voice_uri: voiceURI ?? null,
            bible_reading_speed: readingSpeed ?? 0.85,
            ...(voicePrefsUpdate && { bible_voice_preferences: voicePrefsUpdate }),
        })
        .eq('id', user.id)
}

export async function saveBibleReadingPlace(
    bookId: string,
    chapter: number,
    translation: string
): Promise<void> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
        .from('profiles')
        .update({
            bible_last_book: bookId,
            bible_last_chapter: chapter,
            bible_translation_preference: translation,
        })
        .eq('id', user.id)
}

export async function sendVerseToPartner(
    pairingId: string,
    bookName: string,
    chapter: number,
    verse: number,
    verseText: string,
    note?: string,
    translationAbbr?: string
): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    const { data: pairing } = await supabase
        .from('pairings')
        .select('leader_id, learner_id')
        .eq('id', pairingId)
        .single()

    if (!pairing) return { success: false }

    const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

    const senderName = profile?.full_name || 'Your partner'
    const scriptureRef = `${bookName} ${chapter}:${verse}`
    const versionTag = translationAbbr ? ` (${translationAbbr})` : ''
    const messageText = note
        ? `${scriptureRef}${versionTag} - "${verseText.trim()}"\n\n${senderName}'s note: ${note}`
        : `${scriptureRef}${versionTag} - "${verseText.trim()}"`

    // Send as a chat message only (Share button handles shared_items separately)
    await supabase.from('messages').insert({
        pairing_id: pairingId,
        sender_id: user.id,
        content: messageText,
    })

    // Notify partner about the message
    await createNotification({
        userId: partnerId!,
        pairingId,
        type: 'message',
        title: 'New Message',
        message: `${senderName} sent you ${scriptureRef}`,
    })

    revalidatePath('/dashboard/messages')
    return { success: true }
}

export async function sendMultipleVersesToPartner(
    pairingId: string,
    bookName: string,
    chapter: number,
    verseEntries: { verse: number; text: string; note?: string | null }[],
    translationAbbr?: string
): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    const { data: pairing } = await supabase
        .from('pairings')
        .select('leader_id, learner_id')
        .eq('id', pairingId)
        .single()

    if (!pairing) return { success: false }

    const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

    const senderName = profile?.full_name || 'Your partner'
    const sorted = [...verseEntries].sort((a, b) => a.verse - b.verse)
    const verseNums = sorted.map(v => v.verse)
    const rangeStr = buildVerseRangeStr(verseNums)
    const scriptureRef = `${bookName} ${chapter}:${rangeStr}`

    const versionTag = translationAbbr ? ` (${translationAbbr})` : ''
    const messageLines = sorted.map(v => {
        const line = `${bookName} ${chapter}:${v.verse}${versionTag} - "${v.text.trim()}"`
        return v.note ? `${line}\n${senderName}'s note: ${v.note}` : line
    }).join('\n\n')

    // Send as chat message only (Share handles shared_items separately)
    await supabase.from('messages').insert({
        pairing_id: pairingId,
        sender_id: user.id,
        content: messageLines,
    })

    // Notify partner about the message
    await createNotification({
        userId: partnerId!,
        pairingId,
        type: 'message',
        title: 'New Message',
        message: `${senderName} sent you ${scriptureRef}`,
    })

    revalidatePath('/dashboard/messages')
    return { success: true }
}

// Share multiple verses to partner's shared journal entries (no chat message)
export async function shareMultipleVersesWithPartner(
    pairingId: string,
    bookName: string,
    chapter: number,
    verseEntries: { verse: number; text: string; note?: string | null }[],
    translationAbbr?: string
): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    const { data: pairing } = await supabase
        .from('pairings')
        .select('leader_id, learner_id')
        .eq('id', pairingId)
        .single()

    if (!pairing) return { success: false }

    const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

    const senderName = profile?.full_name || 'Your partner'
    const sorted = [...verseEntries].sort((a, b) => a.verse - b.verse)
    const verseNums = sorted.map(v => v.verse)
    const rangeStr = buildVerseRangeStr(verseNums)
    const versionTag = translationAbbr ? ` (${translationAbbr})` : ''
    const scriptureRef = `${bookName} ${chapter}:${rangeStr}${versionTag}`
    const hasAnyNotes = sorted.some(v => v.note)

    // Insert into shared_items table only (no chat message)
    await supabase.from('shared_items').insert({
        pairing_id: pairingId,
        sender_id: user.id,
        recipient_id: partnerId,
        item_type: hasAnyNotes ? 'verse_note' : 'verse',
        scripture_ref: scriptureRef,
        verse_text: sorted.map(v => v.text.trim()).join(' '),
        note: sorted.filter(v => v.note).map(v => v.note).join('; ') || null,
    })

    await notifySharedVerse(partnerId!, senderName, pairingId, scriptureRef, hasAnyNotes)

    revalidatePath('/dashboard/journal')
    return { success: true }
}

// Send an AI explanation to partner as a chat message
export async function sendExplanationToPartner(
    pairingId: string,
    reference: string,
    explanation: string
): Promise<{ success: boolean }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    const { data: pairing } = await supabase
        .from('pairings')
        .select('leader_id, learner_id')
        .eq('id', pairingId)
        .single()

    if (!pairing) return { success: false }

    const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

    const senderName = profile?.full_name || 'Your partner'

    // Clean up markdown for chat: remove # headers, keep text readable
    const cleanExplanation = explanation
        .replace(/^#{1,3}\s+/gm, '')
        .replace(/\*\*/g, '')
        .trim()

    const messageText = `AI Explanation of ${reference}:\n\n${cleanExplanation}`

    await supabase.from('messages').insert({
        pairing_id: pairingId,
        sender_id: user.id,
        content: messageText,
    })

    await createNotification({
        userId: partnerId!,
        pairingId,
        type: 'message',
        title: 'Bible Explanation Shared',
        message: `${senderName} shared an AI explanation of ${reference} with you.`,
    })

    revalidatePath('/dashboard/messages')
    return { success: true }
}

// Share an AI explanation: saves a private copy to the user's own journal AND
// shares it with the partner via shared_items (which powers the partner's
// "Shared With Me" list on the journal page).
export async function shareExplanationWithPartner(
    pairingId: string,
    reference: string,
    explanationText: string,
    customTitle?: string,
    customNote?: string
): Promise<{ success: boolean; error?: string }> {
    // 1) Save a private copy to the sharer's own journal.
    const saveResult = await saveExplanationToJournal(
        pairingId,
        reference,
        explanationText,
        customTitle,
        customNote
    )
    if (!saveResult.success) return saveResult

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const { data: pairing } = await supabase
        .from('pairings')
        .select('leader_id, learner_id')
        .eq('id', pairingId)
        .single()
    if (!pairing) return { success: false, error: 'Pairing not found' }

    const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
    const senderName = profile?.full_name || 'Your partner'

    const cleanExplanation = explanationText
        .replace(/^#{1,3}\s+/gm, '')
        .replace(/\*\*/g, '')
        .trim()

    // 2) Share with the partner via shared_items.
    const { error } = await supabase.from('shared_items').insert({
        pairing_id: pairingId,
        sender_id: user.id,
        recipient_id: partnerId,
        item_type: 'verse_note',
        scripture_ref: reference,
        verse_text: cleanExplanation,
        note: customNote?.trim() || `AI Explanation of ${reference}`,
    })
    if (error) return { success: false, error: error.message }

    await notifySharedVerse(partnerId!, senderName, pairingId, reference, true)

    revalidatePath('/dashboard/journal')
    return { success: true }
}
