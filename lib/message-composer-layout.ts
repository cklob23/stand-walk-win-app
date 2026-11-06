/** Cap the Messages composer textarea so it grows, then scrolls inside. */
export const COMPOSER_TEXTAREA_MIN_PX = 44
export const COMPOSER_TEXTAREA_MAX_PX = 160

export function fitComposerTextareaHeight(scrollHeight: number): number {
  if (!Number.isFinite(scrollHeight) || scrollHeight < 0) return COMPOSER_TEXTAREA_MIN_PX
  return Math.min(
    COMPOSER_TEXTAREA_MAX_PX,
    Math.max(COMPOSER_TEXTAREA_MIN_PX, Math.round(scrollHeight)),
  )
}

export function shouldComposerTextareaScroll(contentHeight: number): boolean {
  return contentHeight > COMPOSER_TEXTAREA_MAX_PX
}

export function applyComposerTextareaSize(
  el: {
    style: { height: string; overflowY: string }
    scrollHeight: number
  } | null,
): number {
  if (!el) return COMPOSER_TEXTAREA_MIN_PX
  el.style.overflowY = 'hidden'
  el.style.height = 'auto'
  const contentHeight = el.scrollHeight
  const next = fitComposerTextareaHeight(contentHeight)
  el.style.height = `${next}px`
  el.style.overflowY = shouldComposerTextareaScroll(contentHeight) ? 'auto' : 'hidden'
  return next
}
