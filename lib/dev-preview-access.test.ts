import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    isDailyPrayerPreviewPath,
    shouldBypassAuthForDevPreview,
    shouldNotFoundDevPreview,
} from './dev-preview-access.ts'

describe('daily prayer preview access', () => {
    it('recognizes only the daily prayer preview path', () => {
        assert.equal(isDailyPrayerPreviewPath('/dev/daily-prayer-preview'), true)
        assert.equal(isDailyPrayerPreviewPath('/dev/daily-prayer-preview/'), true)
        assert.equal(isDailyPrayerPreviewPath('/dev/week12-preview'), false)
        assert.equal(isDailyPrayerPreviewPath('/dev/admin-shell-preview'), false)
        assert.equal(isDailyPrayerPreviewPath('/dashboard'), false)
        assert.equal(isDailyPrayerPreviewPath('/dashboard/journal'), false)
        assert.equal(isDailyPrayerPreviewPath('/dev'), false)
    })

    it('never bypasses auth in production, including the preview path', () => {
        assert.equal(shouldBypassAuthForDevPreview('/dev/daily-prayer-preview', 'production'), false)
        assert.equal(shouldBypassAuthForDevPreview('/dev/admin-shell-preview', 'production'), false)
        assert.equal(shouldBypassAuthForDevPreview('/dashboard', 'production'), false)
        assert.equal(shouldBypassAuthForDevPreview('/admin/dashboard', 'production'), false)
        assert.equal(shouldBypassAuthForDevPreview('/dev/week12-preview', 'production'), false)
        assert.equal(shouldBypassAuthForDevPreview('/auth/login', 'production'), false)
    })

    it('404s the preview route in production and leaves real routes alone', () => {
        assert.equal(shouldNotFoundDevPreview('/dev/daily-prayer-preview', 'production'), true)
        assert.equal(shouldNotFoundDevPreview('/dev/daily-prayer-preview/', 'production'), true)
        assert.equal(shouldNotFoundDevPreview('/dev/admin-shell-preview', 'production'), true)
        assert.equal(shouldNotFoundDevPreview('/dashboard', 'production'), false)
        assert.equal(shouldNotFoundDevPreview('/admin/dashboard', 'production'), false)
        assert.equal(shouldNotFoundDevPreview('/dev/week12-preview', 'production'), false)
        assert.equal(shouldNotFoundDevPreview('/auth/login', 'production'), false)
    })

    it('allows a local-only auth bypass for the preview path', () => {
        assert.equal(shouldBypassAuthForDevPreview('/dev/daily-prayer-preview', 'development'), true)
        assert.equal(shouldBypassAuthForDevPreview('/dev/daily-prayer-preview', 'test'), true)
        assert.equal(shouldBypassAuthForDevPreview('/dev/admin-shell-preview', 'development'), true)
        assert.equal(shouldNotFoundDevPreview('/dev/daily-prayer-preview', 'development'), false)
        assert.equal(shouldNotFoundDevPreview('/dev/admin-shell-preview', 'development'), false)
    })

    it('does not bypass auth for real routes outside production', () => {
        assert.equal(shouldBypassAuthForDevPreview('/dashboard', 'development'), false)
        assert.equal(shouldBypassAuthForDevPreview('/dashboard/journal', 'development'), false)
        assert.equal(shouldBypassAuthForDevPreview('/admin/dashboard', 'development'), false)
        assert.equal(shouldBypassAuthForDevPreview('/dev/week12-preview', 'development'), false)
    })
})
