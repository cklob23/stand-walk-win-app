'use server'

import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe'
import { SUBSCRIPTION_TIERS, JOURNEYS, getTierById, getJourneyById } from '@/lib/products'

export interface CheckoutParams {
    tierId: string
    journeyId: string
    licenseCount: number
    email: string
    createOrg?: boolean
    orgName?: string
}

export async function startSubscriptionCheckout(params: CheckoutParams) {
    const { tierId, journeyId, licenseCount, email, createOrg, orgName } = params

    const tier = getTierById(tierId)
    if (!tier) {
        throw new Error(`Tier with id "${tierId}" not found`)
    }

    const journey = getJourneyById(journeyId)
    if (!journey) {
        throw new Error(`Journey with id "${journeyId}" not found`)
    }

    const headersList = await headers()
    const origin = headersList.get('origin') || 'http://localhost:3000'

    // Calculate total price
    const tierTotal = tier.priceInCents * licenseCount
    const journeyTotal = journey.priceInCents > 0 ? journey.priceInCents * licenseCount : 0

    const lineItems: Array<{
        price_data: {
            currency: string
            product_data: { name: string; description: string }
            unit_amount: number
            recurring?: { interval: 'month' | 'year' }
        }
        quantity: number
    }> = [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `${tier.name} Plan`,
                        description: `${tier.description} - ${licenseCount} license${licenseCount > 1 ? 's' : ''}`,
                    },
                    unit_amount: tier.priceInCents,
                    recurring: { interval: 'month' },
                },
                quantity: licenseCount,
            },
        ]

    // Add journey if it has a cost
    if (journey.priceInCents > 0) {
        lineItems.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: `${journey.name} Journey`,
                    description: journey.description,
                },
                unit_amount: journey.priceInCents,
            },
            quantity: licenseCount,
        })
    }

    // Store metadata for webhook processing
    const metadata = {
        tier_id: tierId,
        journey_id: journeyId,
        license_count: licenseCount.toString(),
        create_org: createOrg ? 'true' : 'false',
        org_name: orgName || '',
        purchaser_email: email,
    }

    const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        customer_email: email,
        redirect_on_completion: 'never',
        line_items: lineItems,
        mode: 'subscription',
        metadata,
        subscription_data: {
            metadata,
        },
    })

    return { clientSecret: session.client_secret, sessionId: session.id }
}

// For cart-based checkout with multiple plans and journeys
export interface CartItem {
    tierId: string
    journeyId: string
}

export interface CartCheckoutParams {
    items: CartItem[]
    email: string
    createOrg?: boolean
    orgName?: string
}

export async function startCartCheckout(params: CartCheckoutParams) {
    const { items, email, createOrg, orgName } = params

    if (items.length === 0) {
        throw new Error('Cart is empty')
    }

    const headersList = await headers()
    const origin = headersList.get('origin') || 'http://localhost:3000'

    // Build line items for each cart item
    // Group items by tier for subscription line items
    const tierCounts = new Map<string, { tier: typeof SUBSCRIPTION_TIERS[0], count: number, journeyIds: string[] }>()

    for (const item of items) {
        const tier = getTierById(item.tierId)
        if (!tier) {
            throw new Error(`Tier with id "${item.tierId}" not found`)
        }

        const existing = tierCounts.get(item.tierId)
        if (existing) {
            existing.count += 1
            existing.journeyIds.push(item.journeyId)
        } else {
            tierCounts.set(item.tierId, { tier, count: 1, journeyIds: [item.journeyId] })
        }
    }

    // Create line items for each tier
    const lineItems: Array<{
        price_data: {
            currency: string
            product_data: { name: string; description: string }
            unit_amount: number
            recurring?: { interval: 'month' | 'year' }
        }
        quantity: number
    }> = []

    tierCounts.forEach(({ tier, count }) => {
        lineItems.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: `${tier.name} Plan`,
                    description: `${tier.description} - ${count} license${count > 1 ? 's' : ''}`,
                },
                unit_amount: tier.priceInCents,
                recurring: { interval: 'month' },
            },
            quantity: count,
        })
    })

    // Check for any paid journeys and add as one-time charges
    const journeyCounts = new Map<string, { journey: typeof JOURNEYS[0], count: number }>()

    for (const item of items) {
        const journey = getJourneyById(item.journeyId)
        if (journey && journey.priceInCents > 0) {
            const existing = journeyCounts.get(item.journeyId)
            if (existing) {
                existing.count += 1
            } else {
                journeyCounts.set(item.journeyId, { journey, count: 1 })
            }
        }
    }

    journeyCounts.forEach(({ journey, count }) => {
        lineItems.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: `${journey.name} Journey`,
                    description: journey.description,
                },
                unit_amount: journey.priceInCents,
            },
            quantity: count,
        })
    })

    // Store metadata for webhook processing
    // Compress cart items to fit Stripe's 500 char limit per value
    // Format: tierId:journeyId,tierId:journeyId (shortened IDs)
    const compressedItems = items.map(item => {
        // Use first 8 chars of each ID to save space
        const shortTier = item.tierId.substring(0, 8)
        const shortJourney = item.journeyId.substring(0, 8)
        return `${shortTier}:${shortJourney}`
    }).join(',')

    // Also store tier counts for easier processing
    const tierSummary: Record<string, number> = {}
    tierCounts.forEach(({ count }, tierId) => {
        tierSummary[tierId.substring(0, 8)] = count
    })

    const metadata = {
        items_compressed: compressedItems.substring(0, 500), // Ensure under limit
        tier_summary: JSON.stringify(tierSummary),
        license_count: items.length.toString(),
        create_org: createOrg ? 'true' : 'false',
        org_name: orgName || '',
        purchaser_email: email,
    }

    const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        customer_email: email,
        redirect_on_completion: 'never',
        line_items: lineItems,
        mode: 'subscription',
        metadata,
        subscription_data: {
            metadata,
        },
    })

    return { clientSecret: session.client_secret, sessionId: session.id }
}

// For purchasing multiple journeys at once (existing subscribers)
export interface JourneyCartCheckoutParams {
    items: { journeyId: string }[]
    email: string
    userId?: string
}

export async function startJourneyCartCheckout(params: JourneyCartCheckoutParams) {
    const { items, email, userId } = params

    if (items.length === 0) {
        throw new Error('Cart is empty')
    }

    // Count journeys
    const journeyCounts = new Map<string, { journey: typeof JOURNEYS[0], count: number }>()

    for (const item of items) {
        const journey = getJourneyById(item.journeyId)
        if (!journey) {
            throw new Error(`Journey with id "${item.journeyId}" not found`)
        }
        if (journey.priceInCents === 0) {
            continue // Skip free journeys
        }

        const existing = journeyCounts.get(item.journeyId)
        if (existing) {
            existing.count += 1
        } else {
            journeyCounts.set(item.journeyId, { journey, count: 1 })
        }
    }

    const lineItems: Array<{
        price_data: {
            currency: string
            product_data: { name: string; description: string }
            unit_amount: number
        }
        quantity: number
    }> = []

    journeyCounts.forEach(({ journey, count }) => {
        lineItems.push({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: `${journey.name} Journey`,
                    description: journey.description,
                },
                unit_amount: journey.priceInCents,
            },
            quantity: count,
        })
    })

    if (lineItems.length === 0) {
        throw new Error('No paid journeys in cart')
    }

    const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        customer_email: email,
        redirect_on_completion: 'never',
        line_items: lineItems,
        mode: 'payment',
        metadata: {
            type: 'journey_cart_purchase',
            journey_items: JSON.stringify(items),
            user_id: userId || '',
            purchaser_email: email,
        },
    })

    return { clientSecret: session.client_secret, sessionId: session.id }
}

// For purchasing a single additional journey
export interface JourneyPurchaseParams {
    journeyId: string
    email: string
    userId?: string
}

export async function startJourneyPurchase(params: JourneyPurchaseParams) {
    const { journeyId, email, userId } = params

    const journey = getJourneyById(journeyId)
    if (!journey) {
        throw new Error(`Journey with id "${journeyId}" not found`)
    }

    if (journey.priceInCents === 0) {
        throw new Error('This journey is included with subscription')
    }

    const headersList = await headers()
    const origin = headersList.get('origin') || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        customer_email: email,
        redirect_on_completion: 'never',
        line_items: [
            {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `${journey.name} Journey`,
                        description: journey.description,
                    },
                    unit_amount: journey.priceInCents,
                },
                quantity: 1,
            },
        ],
        mode: 'payment',
        metadata: {
            type: 'journey_purchase',
            journey_id: journeyId,
            user_id: userId || '',
            purchaser_email: email,
        },
    })

    return { clientSecret: session.client_secret, sessionId: session.id }
}

// Get checkout session status
export async function getCheckoutSession(sessionId: string) {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    return {
        status: session.status,
        customerEmail: session.customer_email,
        paymentStatus: session.payment_status,
    }
}
