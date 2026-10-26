export interface BillingSubscription {
    status: string
    license_count?: number | null
    amount_paid?: number | null
    current_period_end?: string | null
}

export function isCancelledSubscriptionStatus(status: string | null | undefined): boolean {
    const normalized = (status || '').trim().toLowerCase()
    return normalized === 'cancelled' || normalized === 'canceled'
}

export function getBillableSubscriptions<T extends BillingSubscription>(
    subscriptions: T[] | null | undefined,
): T[] {
    return (subscriptions || []).filter((subscription) => !isCancelledSubscriptionStatus(subscription.status))
}

export function getNextBillingTotals(subscriptions: BillingSubscription[] | null | undefined): {
    licenseCount: number
    amountPaidCents: number
} {
    return getBillableSubscriptions(subscriptions).reduce(
        (totals, subscription) => ({
            licenseCount: totals.licenseCount + (subscription.license_count || 0),
            amountPaidCents: totals.amountPaidCents + (subscription.amount_paid || 0),
        }),
        { licenseCount: 0, amountPaidCents: 0 },
    )
}

/**
 * Earliest current_period_end that is still in the future among billable
 * subscriptions. Past dates and invented fallbacks are never returned.
 */
export function getNextBillingDate(
    subscriptions: BillingSubscription[] | null | undefined,
    now: Date = new Date(),
): Date | null {
    const nowMs = now.getTime()
    const futureDates = getBillableSubscriptions(subscriptions)
        .map((subscription) => subscription.current_period_end)
        .filter((value): value is string => Boolean(value))
        .map((value) => new Date(value))
        .filter((date) => !Number.isNaN(date.getTime()) && date.getTime() > nowMs)
        .sort((left, right) => left.getTime() - right.getTime())

    return futureDates[0] ?? null
}

export function formatBillingDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    })
}
