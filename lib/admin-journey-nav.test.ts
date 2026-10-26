import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    ADMIN_HOME_HREF,
    ADMIN_PLANS_HREF,
    BACK_TO_ADMIN_LABEL,
    BACK_TO_JOURNEY_LABEL,
    JOURNEY_HOME_HREF,
    getAdminLogoHref,
    getBackToAdminHref,
    getJourneyHomeHref,
    hasJourneyRole,
} from './admin-journey-nav.ts'

describe('admin journey navigation', () => {
    it('treats only leader and learner as journey roles', () => {
        assert.equal(hasJourneyRole('leader'), true)
        assert.equal(hasJourneyRole('learner'), true)
        assert.equal(hasJourneyRole(null), false)
        assert.equal(hasJourneyRole(undefined), false)
        assert.equal(hasJourneyRole(''), false)
        assert.equal(hasJourneyRole('org_admin'), false)
        assert.equal(hasJourneyRole('master_admin'), false)
    })

    it('sends leaders and learners to the shared journey home', () => {
        assert.equal(JOURNEY_HOME_HREF, '/dashboard')
        assert.equal(getJourneyHomeHref('leader'), '/dashboard')
        assert.equal(getJourneyHomeHref('learner'), '/dashboard')
        assert.equal(getJourneyHomeHref(null), null)
        assert.equal(getJourneyHomeHref('org_admin'), null)
    })

    it('points the admin logo at the journey home only when a journey role exists', () => {
        assert.equal(ADMIN_HOME_HREF, '/admin/dashboard')
        assert.equal(getAdminLogoHref('leader'), '/dashboard')
        assert.equal(getAdminLogoHref('learner'), '/dashboard')
        assert.equal(getAdminLogoHref(null), '/admin/dashboard')
        assert.equal(getAdminLogoHref('master_admin'), '/admin/dashboard')
    })

    it('uses Back to Journey copy without an em dash', () => {
        assert.equal(BACK_TO_JOURNEY_LABEL, 'Back to Journey')
        assert.equal(BACK_TO_JOURNEY_LABEL.includes('\u2014'), false)
    })

    it('sends org admins back to the plans page and hides the link otherwise', () => {
        assert.equal(BACK_TO_ADMIN_LABEL, 'Back to Admin')
        assert.equal(BACK_TO_ADMIN_LABEL.includes('\u2014'), false)
        assert.equal(ADMIN_PLANS_HREF, '/admin/dashboard/subscription')
        assert.equal(getBackToAdminHref(true), '/admin/dashboard/subscription')
        assert.equal(getBackToAdminHref(false), null)
    })
})
