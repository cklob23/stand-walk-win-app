'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { MessageReaction } from '@/lib/types'

const REACTIONS = [
    { emoji: 'thumbsup' as const, label: 'Thumbs up', icon: '\uD83D\uDC4D' },
    { emoji: 'heart' as const, label: 'Heart', icon: '\u2764\uFE0F' },
    { emoji: 'pray' as const, label: 'Pray', icon: '\uD83D\uDE4F' },
    { emoji: 'laugh' as const, label: 'Laugh', icon: '\uD83D\uDE02' },
    { emoji: 'sad' as const, label: 'Sad', icon: '\uD83D\uDE22' },
    { emoji: 'exclamation' as const, label: 'Wow', icon: '\u2757' },
] as const

export function getReactionIcon(emoji: string) {
    return REACTIONS.find((r) => r.emoji === emoji)?.icon || emoji
}

interface ReactionPickerProps {
    onSelect: (emoji: 'thumbsup' | 'heart' | 'pray' | 'laugh' | 'sad' | 'exclamation') => void
    side?: 'left' | 'right'
}

export function ReactionPicker({ onSelect, side = 'left' }: ReactionPickerProps) {
    return (
        <div
            className={cn(
                'flex items-center gap-0.5 rounded-full bg-card border shadow-lg px-1.5 py-1 animate-in fade-in zoom-in-90 duration-150',
                side === 'right' ? 'origin-top-right' : 'origin-top-left'
            )}
        >
            {REACTIONS.map((r) => (
                <button
                    key={r.emoji}
                    onClick={() => onSelect(r.emoji)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-lg hover:scale-125 active:scale-95"
                    aria-label={r.label}
                    title={r.label}
                >
                    {r.icon}
                </button>
            ))}
        </div>
    )
}

interface ReactionDisplayProps {
    reactions: MessageReaction[]
    currentUserId: string
    onToggle: (emoji: 'thumbsup' | 'heart' | 'pray' | 'laugh' | 'sad' | 'exclamation') => void
    isOwn: boolean
}

export function ReactionDisplay({ reactions, currentUserId, onToggle, isOwn }: ReactionDisplayProps) {
    if (!reactions || reactions.length === 0) return null

    // Deduplicate: keep unique emojis only (since it's a 2-person chat, show each emoji once)
    const seen = new Set<string>()
    const uniqueEmojis: { emoji: string; hasOwn: boolean }[] = []
    for (const r of reactions) {
        if (!seen.has(r.emoji)) {
            seen.add(r.emoji)
            uniqueEmojis.push({
                emoji: r.emoji,
                hasOwn: r.user_id === currentUserId || reactions.some(rx => rx.emoji === r.emoji && rx.user_id === currentUserId),
            })
        }
    }

    return (
        <div className="flex items-center gap-0.5">
            {uniqueEmojis.map(({ emoji, hasOwn }) => (
                <button
                    key={emoji}
                    onClick={() => onToggle(emoji as MessageReaction['emoji'])}
                    className={cn(
                        'inline-flex items-center justify-center rounded-full w-7 h-7 text-base transition-all hover:scale-110 active:scale-95',
                        'bg-card border shadow-sm',
                        hasOwn && 'ring-1 ring-primary/40'
                    )}
                    title={`${getReactionIcon(emoji)} reaction`}
                >
                    {getReactionIcon(emoji)}
                </button>
            ))}
        </div>
    )
}
