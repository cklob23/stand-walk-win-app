import { format } from 'date-fns'
import type { Message } from './types.ts'
import { parseLocalDateKey, toLocalDateKey } from './local-datetime.ts'

const FIVE_MINUTES_MS = 5 * 60 * 1000

/** UTC YYYY-MM-DD on SSR (hydration-safe); local calendar day after mount. */
export function messageDayKey(iso: string, useLocal: boolean): string {
  if (!iso) return ''
  if (!useLocal) return iso.slice(0, 10)
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return toLocalDateKey(d)
}

export function isBigTimeGap(earlierIso: string, laterIso: string): boolean {
  const earlier = new Date(earlierIso).getTime()
  const later = new Date(laterIso).getTime()
  if (Number.isNaN(earlier) || Number.isNaN(later)) return false
  return later - earlier > FIVE_MINUTES_MS
}

export function shouldShowTimestamp(msg: Message, nextMsg: Message | undefined): boolean {
  if (!nextMsg) return true
  if (nextMsg.sender_id !== msg.sender_id) return true
  return isBigTimeGap(msg.created_at, nextMsg.created_at)
}

export function shouldShowAvatar(msg: Message, nextMsg: Message | undefined): boolean {
  if (!nextMsg) return true
  if (nextMsg.sender_id !== msg.sender_id) return true
  return isBigTimeGap(msg.created_at, nextMsg.created_at)
}

export function needsSenderSpacing(msg: Message, prevMsg: Message | undefined): boolean {
  if (!prevMsg) return false
  if (prevMsg.sender_id !== msg.sender_id) return true
  return isBigTimeGap(prevMsg.created_at, msg.created_at)
}

export function groupMessagesByDay(
  messages: Message[],
  useLocal: boolean,
): { date: string; messages: Message[] }[] {
  const groups: { date: string; messages: Message[] }[] = []
  let currentDate = ''
  for (const msg of messages) {
    const msgDate = messageDayKey(msg.created_at, useLocal)
    if (!msgDate) continue
    if (msgDate !== currentDate) {
      currentDate = msgDate
      groups.push({ date: msgDate, messages: [msg] })
    } else {
      groups[groups.length - 1].messages.push(msg)
    }
  }
  return groups
}

export function profileInitials(name: string | null | undefined): string {
  return name?.split(' ').map((n) => n[0]).join('').toUpperCase() || '?'
}

/** Calendar label for a YYYY-MM-DD grouping key. Uses local calendar math. */
export function formatGroupDateLabel(dateStr: string, now = new Date()): string {
  const date = parseLocalDateKey(dateStr)
  if (!date) return dateStr
  if (dateStr === toLocalDateKey(now)) return 'Today'
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  if (dateStr === toLocalDateKey(yesterday)) return 'Yesterday'
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays < 7 ? format(date, 'EEEE') : format(date, 'EEEE, MMMM d')
}
