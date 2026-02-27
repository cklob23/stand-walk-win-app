'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createNotification } from '@/lib/notifications'

// ──────────────────────────────────────────
// Save / update the daily questions (prayers + free-text god speaking)
// ──────────────────────────────────────────
export async function saveJournalEntry(data: {
    prayerItems: string
    godSaying: string
    pairingId: string
    localDate?: string // 'yyyy-MM-dd' in user's local timezone
    shareWithLeader?: boolean
}) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        // Use client-provided local date, or fall back to UTC (for backward compat)
        const today = data.localDate || new Date().toISOString().split('T')[0]

        const { data: existing } = await supabase
            .from('prayer_journal')
            .select('id, god_speaking')
            .eq('user_id', user.id)
            .eq('journal_date', today)
            .single()

        let entryId: string

        if (existing) {
            entryId = existing.id
            // Preserve verse entries (sections after the first ---) when updating daily questions
            const sections = (existing.god_speaking || '').split('\n\n---\n\n')
            const verseSections = sections.slice(1) // keep verse entries
            const newGodSpeaking = [data.godSaying.trim(), ...verseSections].filter(Boolean).join('\n\n---\n\n')

            const { error } = await supabase
                .from('prayer_journal')
                .update({
                    prayer_items: data.prayerItems,
                    god_speaking: newGodSpeaking,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)

            if (error) return { error: error.message }
        } else {
            const { data: inserted, error } = await supabase
                .from('prayer_journal')
                .insert({
                    user_id: user.id,
                    pairing_id: data.pairingId,
                    journal_date: today,
                    prayer_items: data.prayerItems,
                    god_speaking: data.godSaying.trim(),
                    shared_with_leader: data.shareWithLeader ?? false,
                    shared_sections: data.shareWithLeader ? { daily: true } : {},
                    custom_entries: [],
                })
                .select('id')
                .single()

            if (error) return { error: error.message }
            entryId = inserted.id
        }

        revalidatePath('/dashboard')
        revalidatePath('/dashboard/journal')
        return { success: true, entryId }
    } catch {
        return { error: 'Failed to save journal entry.' }
    }
}

// ──────────────────────────────────────────
// Update daily questions only (preserves verse entries in god_speaking)
// ──────────────────────────────────────────
export async function updateJournalEntry(data: {
    entryId: string
    prayerItems: string
    godSaying: string
    pairingId: string
}) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: existing } = await supabase
            .from('prayer_journal')
            .select('god_speaking, shared_with_leader, shared_sections')
            .eq('id', data.entryId)
            .eq('user_id', user.id)
            .single()

        if (!existing) return { error: 'Entry not found' }

        // Preserve verse entries (sections after the first ---)
        const sections = (existing.god_speaking || '').split('\n\n---\n\n')
        const verseSections = sections.slice(1)
        const newGodSpeaking = [data.godSaying.trim(), ...verseSections].filter(Boolean).join('\n\n---\n\n')

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                prayer_items: data.prayerItems,
                god_speaking: newGodSpeaking,
                updated_at: new Date().toISOString(),
            })
            .eq('id', data.entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        // Notify partner if the daily section was shared
        const sharedSections = (existing.shared_sections as Record<string, boolean>) || {}
        if (sharedSections.daily) {
            const { data: pairing } = await supabase
                .from('pairings')
                .select('leader_id, learner_id')
                .eq('id', data.pairingId)
                .single()

            if (pairing) {
                const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single()

                await createNotification({
                    userId: partnerId!,
                    pairingId: data.pairingId,
                    type: 'journal_shared',
                    title: 'Shared Entry Updated',
                    message: `${profile?.full_name || 'Your partner'} updated a journal entry shared with you.`,
                })
            }
        }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to update journal entry.' }
    }
}

// ──────────────────────────────────────────
// Toggle per-section sharing  (key = "daily" | "verse_0" | "custom_0" etc)
// ──────────────────────────────────────────
export async function toggleSectionShare(
    entryId: string,
    sectionKey: string,
    shared: boolean,
    pairingId: string
) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        // Fetch current shared_sections
        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('shared_sections, shared_with_leader')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const sections: Record<string, boolean> = (entry.shared_sections as Record<string, boolean>) || {}
        sections[sectionKey] = shared

        // shared_with_leader is true if ANY section is shared
        const anyShared = Object.values(sections).some(v => v === true)

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                shared_sections: sections,
                shared_with_leader: anyShared,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        // Notify partner when sharing
        if (shared) {
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

                await createNotification({
                    userId: partnerId!,
                    pairingId,
                    type: 'journal_shared',
                    title: 'Journal Entry Shared',
                    message: `${profile?.full_name || 'Your partner'} shared a journal entry with you.`,
                })
            }
        }

        revalidatePath('/dashboard/journal')
        revalidatePath('/dashboard')

        // When UNSHARING, send a notification so partner's UI refreshes
        if (!shared) {
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

                await createNotification({
                    userId: partnerId!,
                    pairingId,
                    type: 'journal_shared',
                    title: 'Journal Entry Updated',
                    message: `${profile?.full_name || 'Your partner'} updated a shared journal entry.`,
                })
            }
        }

        return { success: true }
    } catch {
        return { error: 'Failed to update sharing.' }
    }
}

// ──────────────────────────────────────────
// Legacy toggle (kept for backward compat)
// ──────────────────────────────────────────
export async function toggleShareEntry(entryId: string, shared: boolean) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                shared_with_leader: shared,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to update entry.' }
    }
}

// ──────────────────────────────────────────
// Update a verse section in god_speaking (sections split by \n\n---\n\n)
// ──────────────────────────────────────────
export async function updateJournalGodSpeakingSection(
    entryId: string,
    sectionIndex: number,
    newText: string
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('god_speaking')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const sections = (entry.god_speaking || '').split('\n\n---\n\n')
        if (sectionIndex < 0 || sectionIndex >= sections.length) {
            return { error: 'Section not found' }
        }

        if (newText.trim()) {
            sections[sectionIndex] = newText.trim()
        } else {
            sections.splice(sectionIndex, 1)
        }

        const updatedGodSpeaking = sections.filter(Boolean).join('\n\n---\n\n')

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                god_speaking: updatedGodSpeaking,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to update section.' }
    }
}

// ──────────────────────────────────────────
// Custom entries CRUD
// ──────────────────────────────────────────

interface CustomEntry {
    title: string
    content: string
    created_at: string
}

export async function addCustomEntry(
    entryId: string,
    title: string,
    content: string
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('custom_entries')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const customs: CustomEntry[] = (entry.custom_entries as CustomEntry[]) || []
        customs.push({
            title: title.trim() || 'My Reflection',
            content: content.trim(),
            created_at: new Date().toISOString(),
        })

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                custom_entries: customs,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to add custom entry.' }
    }
}

export async function updateCustomEntry(
    entryId: string,
    customIndex: number,
    title: string,
    content: string
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('custom_entries')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const customs: CustomEntry[] = (entry.custom_entries as CustomEntry[]) || []
        if (customIndex < 0 || customIndex >= customs.length) return { error: 'Entry not found' }

        customs[customIndex] = {
            ...customs[customIndex],
            title: title.trim() || 'My Reflection',
            content: content.trim(),
        }

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                custom_entries: customs,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to update custom entry.' }
    }
}

export async function deleteCustomEntry(
    entryId: string,
    customIndex: number,
    pairingId?: string
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('custom_entries, shared_sections, pairing_id')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const customs: CustomEntry[] = (entry.custom_entries as CustomEntry[]) || []
        if (customIndex < 0 || customIndex >= customs.length) return { error: 'Entry not found' }

        customs.splice(customIndex, 1)

        // Check if this custom entry was shared
        const sections: Record<string, boolean> = (entry.shared_sections as Record<string, boolean>) || {}
        const wasShared = sections[`custom_${customIndex}`]

        delete sections[`custom_${customIndex}`]
        // Re-index remaining custom entries
        const newSections: Record<string, boolean> = {}
        for (const [key, val] of Object.entries(sections)) {
            if (key.startsWith('custom_')) {
                const idx = parseInt(key.split('_')[1])
                if (idx > customIndex) {
                    newSections[`custom_${idx - 1}`] = val
                } else {
                    newSections[key] = val
                }
            } else {
                newSections[key] = val
            }
        }

        const anyShared = Object.values(newSections).some(v => v === true)

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                custom_entries: customs,
                shared_sections: newSections,
                shared_with_leader: anyShared,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        // Notify partner if the deleted entry was shared
        const resolvedPairingId = pairingId || entry.pairing_id
        if (wasShared && resolvedPairingId) {
            const { data: pairing } = await supabase
                .from('pairings')
                .select('leader_id, learner_id')
                .eq('id', resolvedPairingId)
                .single()

            if (pairing) {
                const partnerId = pairing.leader_id === user.id ? pairing.learner_id : pairing.leader_id
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', user.id)
                    .single()

                await createNotification({
                    userId: partnerId!,
                    pairingId: resolvedPairingId,
                    type: 'journal_shared',
                    title: 'Shared Entry Updated',
                    message: `${profile?.full_name || 'Your partner'} removed a custom entry that was shared with you.`,
                })
            }
        }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to delete entry.' }
    }
}

// ──────────────────────────────────────────
// Delete entire journal entry (entire day)
// ──────────────────────────────────────────
export async function deleteJournalEntry(
    entryId: string,
    pairingId: string
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        // Check if any section was shared so we can notify partner
        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('shared_with_leader, shared_sections')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const wasShared = entry.shared_with_leader

        const { error } = await supabase
            .from('prayer_journal')
            .delete()
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        // Notify partner if anything was shared
        if (wasShared) {
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

                await createNotification({
                    userId: partnerId!,
                    pairingId,
                    type: 'journal_shared',
                    title: 'Shared Entry Removed',
                    message: `${profile?.full_name || 'Your partner'} removed a previously shared journal entry.`,
                })
            }
        }

        revalidatePath('/dashboard/journal')
        revalidatePath('/dashboard')
        return { success: true }
    } catch {
        return { error: 'Failed to delete journal entry.' }
    }
}

// ──────────────────────────────────────────
// Delete a verse section from god_speaking
// ──────────────────────────────────────────
export async function deleteVerseEntry(
    entryId: string,
    sectionIndex: number,
    pairingId: string
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('god_speaking, shared_sections, shared_with_leader')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { error: 'Entry not found' }

        const sections = (entry.god_speaking || '').split('\n\n---\n\n')
        if (sectionIndex < 0 || sectionIndex >= sections.length) {
            return { error: 'Section not found' }
        }

        // Check if this verse section was shared
        const sharedSections: Record<string, boolean> = (entry.shared_sections as Record<string, boolean>) || {}
        const verseIdx = sectionIndex - 1 // verse_0 corresponds to section index 1
        const wasShared = sharedSections[`verse_${verseIdx}`]

        // Remove the section
        sections.splice(sectionIndex, 1)
        const updatedGodSpeaking = sections.filter(Boolean).join('\n\n---\n\n')

        // Re-index verse shared_sections
        const newSections: Record<string, boolean> = {}
        for (const [key, val] of Object.entries(sharedSections)) {
            if (key.startsWith('verse_')) {
                const idx = parseInt(key.split('_')[1])
                if (idx === verseIdx) continue // skip the deleted one
                if (idx > verseIdx) {
                    newSections[`verse_${idx - 1}`] = val
                } else {
                    newSections[key] = val
                }
            } else {
                newSections[key] = val
            }
        }

        const anyShared = Object.values(newSections).some(v => v === true)

        const { error } = await supabase
            .from('prayer_journal')
            .update({
                god_speaking: updatedGodSpeaking,
                shared_sections: newSections,
                shared_with_leader: anyShared,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { error: error.message }

        // Notify partner if was shared
        if (wasShared) {
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

                await createNotification({
                    userId: partnerId!,
                    pairingId,
                    type: 'journal_shared',
                    title: 'Shared Entry Updated',
                    message: `${profile?.full_name || 'Your partner'} removed a section from a shared journal entry.`,
                })
            }
        }

        revalidatePath('/dashboard/journal')
        return { success: true }
    } catch {
        return { error: 'Failed to delete verse entry.' }
    }
}

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

export async function hasTodayEntry(userId: string, localDate?: string): Promise<boolean> {
    const supabase = await createClient()
    const today = localDate || new Date().toISOString().split('T')[0]
    const { data } = await supabase
        .from('prayer_journal')
        .select('id')
        .eq('user_id', userId)
        .eq('journal_date', today)
        .limit(1)
    return (data?.length ?? 0) > 0
}

export async function getTodayEntry(userId: string, localDate?: string) {
    const supabase = await createClient()
    const today = localDate || new Date().toISOString().split('T')[0]
    const { data } = await supabase
        .from('prayer_journal')
        .select('*')
        .eq('user_id', userId)
        .eq('journal_date', today)
        .single()
    return data
}

export async function requestJournalMeeting(
    entryId: string,
    entryDateLabel: string
): Promise<{ success?: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { error: 'Not authenticated' }

        const { data: entry } = await supabase
            .from('prayer_journal')
            .select('pairing_id, user_id')
            .eq('id', entryId)
            .single()

        if (!entry) return { error: 'Journal entry not found' }

        const { data: leaderProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()

        await createNotification({
            userId: entry.user_id,
            pairingId: entry.pairing_id,
            type: 'pairing',
            title: 'Meeting Requested',
            message: `${leaderProfile?.full_name || 'Your leader'} would like to schedule a meeting to discuss your journal entry from ${entryDateLabel}. Head to the Schedule page to pick a time.`,
        })

        return { success: true }
    } catch {
        return { error: 'Failed to send meeting request.' }
    }
}
