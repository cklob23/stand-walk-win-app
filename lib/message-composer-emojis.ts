/** Composer emoji palette — insert into the draft, not used as message reactions. */
export const MESSAGE_COMPOSER_EMOJIS = [
  '🙏',
  '❤️',
  '👍',
  '😊',
  '😂',
  '🙌',
  '✝️',
  '🔥',
  '✨',
  '😇',
  '😅',
  '😢',
  '😮',
  '👏',
  '🤗',
  '💪',
  '🕊️',
  '🌟',
  '✅',
  '🎉',
  '🙂',
  '😁',
  '😌',
  '💯',
] as const

export function insertTextAtCursor(
  value: string,
  insert: string,
  selectionStart: number | null | undefined,
  selectionEnd: number | null | undefined,
): { next: string; cursor: number } {
  const start = Math.max(0, Math.min(selectionStart ?? value.length, value.length))
  const end = Math.max(start, Math.min(selectionEnd ?? start, value.length))
  const next = `${value.slice(0, start)}${insert}${value.slice(end)}`
  return { next, cursor: start + insert.length }
}
