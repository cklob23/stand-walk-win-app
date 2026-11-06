import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COMPOSER_TEXTAREA_MAX_PX,
  COMPOSER_TEXTAREA_MIN_PX,
  applyComposerTextareaSize,
  fitComposerTextareaHeight,
  shouldComposerTextareaScroll,
} from './message-composer-layout.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('composer textarea height', () => {
  it('floors short content and caps tall content so the field can scroll', () => {
    assert.equal(fitComposerTextareaHeight(0), COMPOSER_TEXTAREA_MIN_PX)
    assert.equal(fitComposerTextareaHeight(24), COMPOSER_TEXTAREA_MIN_PX)
    assert.equal(fitComposerTextareaHeight(72), 72)
    assert.equal(COMPOSER_TEXTAREA_MIN_PX, 44)
    assert.equal(fitComposerTextareaHeight(COMPOSER_TEXTAREA_MAX_PX), COMPOSER_TEXTAREA_MAX_PX)
    assert.equal(fitComposerTextareaHeight(480), COMPOSER_TEXTAREA_MAX_PX)
    assert.equal(fitComposerTextareaHeight(Number.NaN), COMPOSER_TEXTAREA_MIN_PX)
    assert.equal(shouldComposerTextareaScroll(80), false)
    assert.equal(shouldComposerTextareaScroll(COMPOSER_TEXTAREA_MAX_PX + 1), true)
  })

  it('writes a capped pixel height and only scrolls once the cap is exceeded', () => {
    const el = { style: { height: '', overflowY: '' }, scrollHeight: 48 }
    assert.equal(applyComposerTextareaSize(el), 48)
    assert.equal(el.style.height, '48px')
    assert.equal(el.style.overflowY, 'hidden')

    el.scrollHeight = 320
    assert.equal(applyComposerTextareaSize(el), COMPOSER_TEXTAREA_MAX_PX)
    assert.equal(el.style.height, `${COMPOSER_TEXTAREA_MAX_PX}px`)
    assert.equal(el.style.overflowY, 'auto')
    assert.equal(applyComposerTextareaSize(null), COMPOSER_TEXTAREA_MIN_PX)
  })
})

describe('composer shell wiring', () => {
  it('uses a rounded-rect Grok-style bar instead of a growing pill', () => {
    const composer = readFileSync(join(here, '../components/messages/message-composer.tsx'), 'utf8')
    assert.match(composer, /message-composer-shell/)
    assert.match(composer, /applyComposerTextareaSize/)
    assert.match(composer, /field-sizing-content/)
    assert.match(composer, /overflow-y-auto/)
    assert.match(composer, /rounded-2xl/)
    assert.match(composer, /env\(safe-area-inset-bottom/)
    assert.match(composer, /Paperclip/)
    assert.match(composer, /message-emoji/)
    assert.match(composer, /message-mic/)
    assert.match(composer, /message-send/)
    assert.match(composer, /shouldShowUnsupportedDictationNotice/)
    assert.doesNotMatch(composer, /rounded-full px-4 max-md/)
    assert.doesNotMatch(composer, /max-md:pr-12/)
    assert.doesNotMatch(composer, /max-md:items-center/)
    assert.doesNotMatch(composer, /message-send-mobile/)
    assert.doesNotMatch(composer, /absolute top-1\/2/)
  })
})
