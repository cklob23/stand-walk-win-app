import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    getNextBillingDate,
    getNextBillingTotals,
    isCancelledSubscriptionStatus,
} from './admin-billing.ts'

const NOW = new Date('2026-10-26T12:00:00.000Z')

describe('admin billing', () => {
    it('treats cancelled and canceled as cancelled statuses', () => {
        assert.equal(isCancelledSubscriptionStatus('cancelled'), true)
        assert.equal(isCancelledSubscriptionStatus('canceled'), true)
        assert.equal(isCancelledSubscriptionStatus('CANCELLED'), true)
        assert.equal(isCancelledSubscriptionStatus('active'), false)
        assert.equal(isCancelledSubscriptionStatus('past_due'), false)
        assert.equal(isCancelledSubscriptionStatus(null), false)
    })

    it('excludes cancelled subscriptions from next billing amount and licenses', () => {
        const totals = getNextBillingTotals([
            { status: 'active', license_count: 1, amount_paid: 699 },
            { status: 'cancelled', license_count: 1, amount_paid: 1999 },
        ])
        assert.equal(totals.amountPaidCents, 699)
        assert.equal(totals.licenseCount, 1)
    })

    it('keeps multiple active plans in the next bill', () => {
        const totals = getNextBillingTotals([
            { status: 'active', license_count: 1, amount_paid: 699 },
            { status: 'active', license_count: 2, amount_paid: 1999 },
        ])
        assert.equal(totals.amountPaidCents, 2698)
        assert.equal(totals.licenseCount, 3)
    })

    it('includes Basic plus reactivated Premium in the next bill', () => {
        const totals = getNextBillingTotals([
            { status: 'active', license_count: 1, amount_paid: 699 },
            { status: 'active', license_count: 1, amount_paid: 1999 },
        ])
        assert.equal(totals.amountPaidCents, 2698)
        assert.equal(totals.licenseCount, 2)
        const nextDate = getNextBillingDate([
            { status: 'active', current_period_end: '2026-11-15T00:00:00.000Z' },
            { status: 'active', current_period_end: '2026-11-29T00:00:00.000Z' },
        ], NOW)
        assert.ok(nextDate)
        assert.equal(nextDate.toISOString(), '2026-11-15T00:00:00.000Z')
    })

    it('picks the earliest future period end from billable subscriptions', () => {
        const nextDate = getNextBillingDate([
            { status: 'cancelled', current_period_end: '2026-11-01T00:00:00.000Z' },
            { status: 'active', current_period_end: '2026-12-10T00:00:00.000Z' },
            { status: 'active', current_period_end: '2026-11-15T00:00:00.000Z' },
        ], NOW)
        assert.ok(nextDate)
        assert.equal(nextDate.toISOString(), '2026-11-15T00:00:00.000Z')
    })

    it('does not invent a date or return a past period end', () => {
        assert.equal(
            getNextBillingDate([
                { status: 'active', current_period_end: '2026-08-29T00:00:00.000Z' },
            ], NOW),
            null,
        )
        assert.equal(
            getNextBillingDate([
                { status: 'cancelled', current_period_end: '2026-12-01T00:00:00.000Z' },
                { status: 'active', current_period_end: null },
            ], NOW),
            null,
        )
        assert.equal(getNextBillingDate([], NOW), null)
    })
})
