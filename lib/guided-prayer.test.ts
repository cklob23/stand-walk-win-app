import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hasGuidedPrayerText, showGuidedPrayerComingSoon } from './guided-prayer.ts'

describe('guided prayer visibility', () => {
    it('treats trimmed text as a guided prayer', () => {
        assert.equal(hasGuidedPrayerText('Heavenly Father'), true)
        assert.equal(hasGuidedPrayerText('   '), false)
        assert.equal(hasGuidedPrayerText(null), false)
    })

    it('shows coming soon on prayer types with no text', () => {
        assert.equal(showGuidedPrayerComingSoon('prayer', null), true)
        assert.equal(showGuidedPrayerComingSoon('prayer', ''), true)
        assert.equal(showGuidedPrayerComingSoon('prayer', 'Amen'), false)
    })

    it('shows coming soon on other types only when the empty-string slot is reserved', () => {
        assert.equal(showGuidedPrayerComingSoon('reflection', ''), true)
        assert.equal(showGuidedPrayerComingSoon('reflection', null), false)
        assert.equal(showGuidedPrayerComingSoon('reading', null), false)
        assert.equal(showGuidedPrayerComingSoon('reading', 'Lead me'), false)
    })
})
