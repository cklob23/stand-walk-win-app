import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Message } from './types.ts'
import {
  formatGroupDateLabel,
  groupMessagesByDay,
  messageDayKey,
  needsSenderSpacing,
  profileInitials,
  shouldShowAvatar,
  shouldShowTimestamp,
} from './message-thread.ts'

function msg(partial: Partial<Message> & Pick<Message, 'id' | 'sender_id' | 'created_at'>): Message {
  return {
    pairing_id: 'p1',
    content: 'hello',
    is_read: true,
    ...partial,
  }
}

describe('message thread grouping', () => {
  it('groups by UTC day before local grouping is ready', () => {
    const groups = groupMessagesByDay(
      [
        msg({ id: '1', sender_id: 'a', created_at: '2026-11-05T22:00:00.000Z', content: 'one' }),
        msg({ id: '2', sender_id: 'b', created_at: '2026-11-05T23:30:00.000Z', content: 'two' }),
        msg({ id: '3', sender_id: 'a', created_at: '2026-11-06T01:00:00.000Z', content: 'three' }),
      ],
      false,
    )
    assert.equal(groups.length, 2)
    assert.equal(groups[0].date, '2026-11-05')
    assert.equal(groups[0].messages.length, 2)
    assert.equal(groups[1].date, '2026-11-06')
  })

  it('uses the UTC ISO prefix when local grouping is off', () => {
    assert.equal(messageDayKey('2026-11-06T07:30:00.000Z', false), '2026-11-06')
    assert.equal(messageDayKey('', false), '')
  })

  it('shows timestamp and avatar on the last message or after a sender/time break', () => {
    const first = msg({ id: '1', sender_id: 'a', created_at: '2026-11-06T12:00:00.000Z' })
    const sameSenderSoon = msg({ id: '2', sender_id: 'a', created_at: '2026-11-06T12:01:00.000Z' })
    const otherSender = msg({ id: '3', sender_id: 'b', created_at: '2026-11-06T12:02:00.000Z' })
    const later = msg({ id: '4', sender_id: 'a', created_at: '2026-11-06T12:10:00.000Z' })

    assert.equal(shouldShowTimestamp(first, sameSenderSoon), false)
    assert.equal(shouldShowAvatar(first, sameSenderSoon), false)
    assert.equal(shouldShowTimestamp(first, otherSender), true)
    assert.equal(shouldShowTimestamp(first, later), true)
    assert.equal(shouldShowTimestamp(later, undefined), true)
    assert.equal(needsSenderSpacing(sameSenderSoon, first), false)
    assert.equal(needsSenderSpacing(otherSender, sameSenderSoon), true)
    assert.equal(needsSenderSpacing(later, first), true)
  })

  it('builds initials from the partner display name', () => {
    assert.equal(profileInitials('David Carter'), 'DC')
    assert.equal(profileInitials('Sarah Mitchell'), 'SM')
    assert.equal(profileInitials(null), '?')
  })

  it('labels grouping keys as Today, Yesterday, weekday, or full date', () => {
    const now = new Date(2026, 10, 6, 14, 0, 0)
    assert.equal(formatGroupDateLabel('2026-11-06', now), 'Today')
    assert.equal(formatGroupDateLabel('2026-11-05', now), 'Yesterday')
    assert.equal(formatGroupDateLabel('2026-11-03', now), 'Tuesday')
    assert.equal(formatGroupDateLabel('2026-10-20', now), 'Tuesday, October 20')
    assert.equal(formatGroupDateLabel('bad', now), 'bad')
  })
})

describe('messages spacious layout wiring', () => {
  const here = dirname(fileURLToPath(import.meta.url))

  it('keeps a centered card, modern composer, and fully rounded bubbles', () => {
    const conversation = readFileSync(join(here, '../components/messages/messages-conversation.tsx'), 'utf8')
    const composer = readFileSync(join(here, '../components/messages/message-composer.tsx'), 'utf8')
    const bubble = readFileSync(join(here, '../components/messages/message-bubble.tsx'), 'utf8')

    assert.match(conversation, /md:max-w-3xl/)
    assert.match(conversation, /md:rounded-2xl md:border/)
    assert.match(conversation, /max-md:fixed max-md:inset-0/)
    assert.match(conversation, /messages-back/)
    assert.match(conversation, /<Phone /)
    assert.match(conversation, /facetime:/)
    assert.match(conversation, /<FeatureTour /)
    assert.match(composer, /Paperclip/)
    assert.match(composer, /message-emoji/)
    assert.match(composer, /message-mic/)
    assert.match(composer, /rounded-2xl border bg-background/)
    assert.match(composer, /rounded-xl bg-primary\/80/)
    assert.match(composer, /type="button"/)
    assert.match(composer, /shouldSendOnEnterKey/)
    assert.match(composer, /useSpeechDictation/)
    assert.match(bubble, /rounded-2xl px-4 py-2\.5/)
    assert.match(bubble, /bg-secondary text-foreground/)
    assert.doesNotMatch(bubble, /dark:bg-background/)
  })

  it('keeps live send, realtime, typing, presence, replies, edits, and reactions in MessagesView', () => {
    const view = readFileSync(join(here, '../components/messages/messages-view.tsx'), 'utf8')
    assert.match(view, /optimisticMessage/)
    assert.match(view, /postgres_changes/)
    assert.match(view, /presence:\$\{pairing\.id\}/)
    assert.match(view, /event: 'typing'/)
    assert.match(view, /message_reactions/)
    assert.match(view, /handleReply/)
    assert.match(view, /handleEdit/)
    assert.match(view, /handleToggleReaction/)
    assert.match(view, /is_read/)
    assert.match(view, /<MessagesConversation/)
  })
})
