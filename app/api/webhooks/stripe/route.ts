import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { sendAccessCodesEmail, sendJourneyPurchaseEmail } from '@/lib/email'
import Stripe from 'stripe'

// Generate a random 8-character access code
function generateAccessCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed similar looking characters
    let code = ''
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

// Parse compressed items format: "tierId:journeyId,tierId:journeyId"
function parseCompressedItems(compressed: string): Array<{ tierIdShort: string; journeyIdShort: string }> {
    if (!compressed) return []
    return compressed.split(',').map(item => {
        const [tierIdShort, journeyIdShort] = item.split(':')
        return { tierIdShort, journeyIdShort }
    })
}

export async function POST(request: Request) {
    console.log('[v0] Stripe webhook received')
    const body = await request.text()
    const headersList = await headers()
    const sig = headersList.get('stripe-signature')

    console.log('[v0] Webhook signature present:', !!sig)
    console.log('[v0] STRIPE_WEBHOOK_SECRET present:', !!process.env.STRIPE_WEBHOOK_SECRET)

    if (!sig) {
        console.log('[v0] No signature, returning 400')
        return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
        console.log('[v0] Webhook event verified, type:', event.type)
    } catch (err) {
        console.error('[v0] Webhook signature verification failed:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Use admin client to bypass RLS - webhooks don't have user sessions
    const supabase = createAdminClient()

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session
                console.log('[v0] Processing checkout.session.completed')
                console.log('[v0] Session metadata:', session.metadata)

                // Check if this is a journey cart purchase, single journey, or subscription
                if (session.metadata?.type === 'journey_cart_purchase') {
                    await handleJourneyCartPurchase(supabase, session)
                } else if (session.metadata?.type === 'journey_purchase') {
                    await handleJourneyPurchase(supabase, session)
                } else if (session.metadata?.items_compressed || session.metadata?.tier_summary) {
                    // New cart-based checkout format
                    await handleCartSubscriptionPurchase(supabase, session)
                } else {
                    // Legacy single-item checkout
                    await handleSubscriptionPurchase(supabase, session)
                }
                break
            }

            case 'customer.subscription.created': {
                const subscription = event.data.object as Stripe.Subscription
                console.log('[v0] Processing customer.subscription.created')
                await handleSubscriptionCreated(supabase, subscription)
                break
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription
                await handleSubscriptionCancelled(supabase, subscription)
                break
            }
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('Webhook processing error:', error)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}

// New handler for cart-based multi-item checkout
async function handleCartSubscriptionPurchase(
    supabase: Awaited<ReturnType<typeof createAdminClient>>,
    session: Stripe.Checkout.Session
) {
    console.log('[v0] handleCartSubscriptionPurchase started')
    const metadata = session.metadata || {}

    const itemsCompressed = metadata.items_compressed || ''
    const tierSummary = metadata.tier_summary ? JSON.parse(metadata.tier_summary) : {}
    const licenseCount = parseInt(metadata.license_count || '1', 10)
    const createOrg = metadata.create_org === 'true'
    const orgName = metadata.org_name
    const purchaserEmail = metadata.purchaser_email || session.customer_email
    const existingOrganizationId = metadata.existing_organization_id || null

    console.log('[v0] Cart metadata:', { itemsCompressed, tierSummary, licenseCount, createOrg, orgName, purchaserEmail, existingOrganizationId })

    if (!purchaserEmail) {
        console.error('[v0] Missing purchaser email')
        return
    }

    // Parse compressed items to get tier and journey info
    const parsedItems = parseCompressedItems(itemsCompressed)
    console.log('[v0] Parsed items:', parsedItems)

    // Get all tiers from the database to match shortened IDs
    const { data: allTiers, error: tiersError } = await supabase
        .from('subscription_tiers')
        .select('id, name, display_name')

    if (tiersError || !allTiers) {
        console.error('[v0] Error fetching tiers:', tiersError)
        throw new Error('Failed to fetch tiers')
    }

    // Get all journeys from the database
    const { data: allJourneys, error: journeysError } = await supabase
        .from('journeys')
        .select('id, name')

    if (journeysError) {
        console.error('[v0] Error fetching journeys:', journeysError)
    }

    // Map shortened tier IDs to full tier data
    const tierMap = new Map<string, typeof allTiers[0]>()
    for (const tier of allTiers) {
        // Match by first 8 chars of UUID or by name
        tierMap.set(tier.id.substring(0, 8), tier)
        tierMap.set(tier.name.toLowerCase(), tier)
    }

    // Map shortened journey IDs to full journey data
    type JourneyType = { id: string; name: string }
    const journeyMap = new Map<string, JourneyType>()
    if (allJourneys) {
        for (const journey of allJourneys) {
            journeyMap.set(journey.id.substring(0, 8), journey)
        }
    }

    // Group items by tier for creating subscriptions
    const tierGroups = new Map<string, { tier: typeof allTiers[0]; journeyIds: string[]; count: number }>()

    for (const item of parsedItems) {
        // Try to match tier by shortened ID or name
        const tier = tierMap.get(item.tierIdShort) || tierMap.get(item.tierIdShort.toLowerCase())
        if (!tier) {
            console.error('[v0] Could not match tier:', item.tierIdShort)
            continue
        }

        // Try to match journey
        const journey = journeyMap.get(item.journeyIdShort)
        const journeyId = journey?.id || (allJourneys && allJourneys[0]?.id) || null

        const existing = tierGroups.get(tier.id)
        if (existing) {
            existing.count++
            if (journeyId) existing.journeyIds.push(journeyId)
        } else {
            tierGroups.set(tier.id, { tier, journeyIds: journeyId ? [journeyId] : [], count: 1 })
        }
    }

    console.log('[v0] Tier groups:', Array.from(tierGroups.entries()).map(([id, g]) => ({ id, count: g.count })))

    // Get the amount paid from the session
    const amountPaid = session.amount_total || 0
    const purchaserName = session.customer_details?.name || null

    // Use existing organization or create a new one if requested
    let organizationId: string | null = existingOrganizationId || null

    // If org admin is adding more licenses, use their existing org
    if (existingOrganizationId) {
        console.log('[v0] Using existing organization for additional licenses:', existingOrganizationId)
    } else if (createOrg && orgName && licenseCount > 1) {
        const baseSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`

        // Get the primary tier (first or most common)
        const primaryTier = tierGroups.values().next().value?.tier

        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .insert({
                name: orgName,
                slug: uniqueSlug,
                subscription_tier_id: primaryTier?.id || null,
                max_users: licenseCount,
                is_active: true,
                admin_email: purchaserEmail,
                // Set default app colors for new organizations
                branding_primary_color: '#0f6353',
                branding_secondary_color: '#f0ede6',
            })
            .select()
            .single()

        if (orgError) {
            console.error('[v0] Error creating organization:', orgError)
        } else {
            organizationId = org.id
            console.log('[v0] Created organization:', organizationId)
        }
    }

    // Create subscription records for each tier
    const allAccessCodes: Array<{ code: string; tierName: string; journeyName: string }> = []

    for (const [tierId, group] of tierGroups) {
        const { tier, journeyIds, count } = group

        // Calculate proportional amount for this tier
        const proportionalAmount = Math.round((amountPaid * count) / licenseCount)

        // Use first journey for the subscription record
        const primaryJourneyId = journeyIds[0] || null

        const { data: subscription, error: subError } = await supabase
            .from('subscriptions')
            .insert({
                stripe_subscription_id: session.subscription as string,
                stripe_customer_id: session.customer as string,
                stripe_checkout_session_id: session.id,
                tier_id: tierId,
                journey_id: primaryJourneyId,
                purchaser_email: purchaserEmail,
                purchaser_name: purchaserName,
                license_count: count,
                status: 'active',
                amount_paid: proportionalAmount,
                currency: session.currency || 'usd',
                organization_id: organizationId,
            })
            .select()
            .single()

        if (subError) {
            console.error('[v0] Error creating subscription:', subError)
            continue
        }

        console.log('[v0] Created subscription for tier:', tier.name, 'count:', count)

        // Generate access codes for each license in this tier
        for (let i = 0; i < count; i++) {
            let code = generateAccessCode()

            // Ensure unique code
            let attempts = 0
            while (attempts < 10) {
                const { data: existing } = await supabase
                    .from('access_codes')
                    .select('id')
                    .eq('code', code)
                    .single()

                if (!existing) break
                code = generateAccessCode()
                attempts++
            }

            // Use the corresponding journey for this license
            const journeyId = journeyIds[i] || journeyIds[0] || primaryJourneyId
            const journeyName = allJourneys?.find(j => j.id === journeyId)?.name || 'Stand Walk Run Journey'

            const { error: codeError } = await supabase
                .from('access_codes')
                .insert({
                    code,
                    subscription_id: subscription.id,
                    organization_id: organizationId,
                    tier_id: tierId,
                    journey_id: journeyId,
                    status: 'available',
                })

            if (codeError) {
                console.error('[v0] Error creating access code:', codeError)
            } else {
                allAccessCodes.push({ code, tierName: tier.display_name || tier.name, journeyName })
                console.log('[v0] Created access code:', code)
            }
        }
    }

    // Send email with all access codes (with plan info per code)
    if (allAccessCodes.length > 0 && purchaserEmail) {
        console.log('[v0] Sending access codes email to:', purchaserEmail, 'isExistingOrgAdmin:', !!existingOrganizationId)

        // Pass detailed code info so each code shows its plan
        // Pass isExistingOrgAdmin flag to send different email for existing admins adding more licenses
        await sendAccessCodesEmail(purchaserEmail, allAccessCodes, undefined, undefined, orgName, !!existingOrganizationId)
    }

    console.log('[v0] Cart subscription purchase completed successfully')
}

// Legacy handler for single-item checkout
async function handleSubscriptionPurchase(
    supabase: Awaited<ReturnType<typeof createAdminClient>>,
    session: Stripe.Checkout.Session
) {
    console.log('[v0] handleSubscriptionPurchase started (legacy)')
    const metadata = session.metadata || {}
    const tierId = metadata.tier_id
    const journeyId = metadata.journey_id
    const licenseCount = parseInt(metadata.license_count || '1', 10)
    const createOrg = metadata.create_org === 'true'
    const orgName = metadata.org_name
    const purchaserEmail = metadata.purchaser_email || session.customer_email

    console.log('[v0] Parsed metadata:', { tierId, journeyId, licenseCount, createOrg, orgName, purchaserEmail })

    if (!tierId || !purchaserEmail) {
        console.error('[v0] Missing required metadata:', metadata)
        return
    }

    // Look up the actual tier UUID from subscription_tiers table
    const tierNameLower = tierId.toLowerCase()
    console.log('[v0] Looking up tier with name:', tierNameLower)

    const { data: tierData, error: tierError } = await supabase
        .from('subscription_tiers')
        .select('id, name, display_name')
        .eq('name', tierNameLower)
        .single()

    if (tierError || !tierData) {
        console.error('[v0] Error finding tier:', tierError)
        throw new Error(`Tier not found: ${tierId}`)
    }

    const actualTierId = tierData.id
    console.log('[v0] Resolved tier UUID:', actualTierId)

    // Look up the journey name
    const { data: journeyData } = await supabase
        .from('journeys')
        .select('name')
        .eq('id', journeyId)
        .single()

    const journeyName = journeyData?.name || 'Stand Walk Run Journey'
    const tierDisplayName = tierData.display_name || tierData.name

    const amountPaid = session.amount_total || 0
    const purchaserName = session.customer_details?.name || null

    // Create subscription record
    const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .insert({
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            stripe_checkout_session_id: session.id,
            tier_id: actualTierId,
            journey_id: journeyId,
            purchaser_email: purchaserEmail,
            purchaser_name: purchaserName,
            license_count: licenseCount,
            status: 'active',
            amount_paid: amountPaid,
            currency: session.currency || 'usd',
        })
        .select()
        .single()

    if (subError) {
        console.error('Error creating subscription:', subError)
        throw subError
    }

    // Create organization if requested
    let organizationId: string | null = null
    if (createOrg && orgName && licenseCount > 1) {
        const baseSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`

        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .insert({
                name: orgName,
                slug: uniqueSlug,
                subscription_tier_id: actualTierId,
                max_users: licenseCount,
                is_active: true,
                admin_email: purchaserEmail,
                // Set default app colors for new organizations
                branding_primary_color: '#0f6353',
                branding_secondary_color: '#f0ede6',
            })
            .select()
            .single()

        if (orgError) {
            console.error('Error creating organization:', orgError)
        } else {
            organizationId = org.id
            console.log('[v0] Created organization:', organizationId)

            await supabase
                .from('subscriptions')
                .update({ organization_id: organizationId })
                .eq('id', subscription.id)
        }
    }

    // Generate access codes
    const accessCodes: string[] = []
    for (let i = 0; i < licenseCount; i++) {
        let code = generateAccessCode()

        let attempts = 0
        while (attempts < 10) {
            const { data: existing } = await supabase
                .from('access_codes')
                .select('id')
                .eq('code', code)
                .single()

            if (!existing) break
            code = generateAccessCode()
            attempts++
        }

        const { error: codeError } = await supabase
            .from('access_codes')
            .insert({
                code,
                subscription_id: subscription.id,
                organization_id: organizationId,
                tier_id: actualTierId,
                journey_id: journeyId,
                status: 'available',
            })

        if (codeError) {
            console.error('Error creating access code:', codeError)
        } else {
            accessCodes.push(code)
        }
    }

    if (accessCodes.length > 0 && purchaserEmail) {
        await sendAccessCodesEmail(purchaserEmail, accessCodes, tierDisplayName, journeyName, orgName)
    }
}

// Handler for journey cart purchase (existing subscribers buying multiple journeys)
async function handleJourneyCartPurchase(
    supabase: Awaited<ReturnType<typeof createAdminClient>>,
    session: Stripe.Checkout.Session
) {
    console.log('[v0] handleJourneyCartPurchase started')
    const metadata = session.metadata || {}
    const journeyItems = metadata.journey_items ? JSON.parse(metadata.journey_items) : []
    const userId = metadata.user_id
    const purchaserEmail = metadata.purchaser_email || session.customer_email

    if (!userId || journeyItems.length === 0) {
        console.error('[v0] Missing journey cart purchase metadata:', metadata)
        return
    }

    for (const item of journeyItems) {
        const { error } = await supabase
            .from('user_journeys')
            .insert({
                user_id: userId,
                journey_id: item.journeyId,
                status: 'available',
                stripe_payment_id: session.payment_intent as string,
            })

        if (error) {
            console.error('[v0] Error adding user journey:', error)
        }
    }

    if (purchaserEmail) {
        try {
            // Send email for first journey (or could send summary)
            await sendJourneyPurchaseEmail(purchaserEmail, journeyItems[0]?.journeyId)
        } catch (emailError) {
            console.error('[v0] Error sending journey confirmation email:', emailError)
        }
    }

    console.log('[v0] Journey cart purchase completed')
}

async function handleJourneyPurchase(
    supabase: Awaited<ReturnType<typeof createAdminClient>>,
    session: Stripe.Checkout.Session
) {
    const metadata = session.metadata || {}
    const journeyId = metadata.journey_id
    const userId = metadata.user_id
    const purchaserEmail = metadata.purchaser_email || session.customer_email

    if (!journeyId || !userId) {
        console.error('Missing journey purchase metadata:', metadata)
        return
    }

    const { error } = await supabase
        .from('user_journeys')
        .insert({
            user_id: userId,
            journey_id: journeyId,
            status: 'available',
            stripe_payment_id: session.payment_intent as string,
        })

    if (error) {
        console.error('Error adding user journey:', error)
        throw error
    }

    if (purchaserEmail) {
        try {
            await sendJourneyPurchaseEmail(purchaserEmail, journeyId)
        } catch (emailError) {
            console.error('Error sending journey confirmation email:', emailError)
        }
    }
}

async function handleSubscriptionCreated(
    supabase: Awaited<ReturnType<typeof createAdminClient>>,
    subscription: Stripe.Subscription
) {
    console.log('[v0] handleSubscriptionCreated - subscription id:', subscription.id)

    const { data: existing } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .single()

    if (existing) {
        console.log('[v0] Subscription already exists, skipping')
        return
    }

    console.log('[v0] Subscription created outside checkout flow - may need manual handling')
}

async function handleSubscriptionCancelled(
    supabase: Awaited<ReturnType<typeof createAdminClient>>,
    subscription: Stripe.Subscription
) {
    await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('stripe_subscription_id', subscription.id)

    const { data: sub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .single()

    if (sub) {
        await supabase
            .from('access_codes')
            .update({ status: 'expired' })
            .eq('subscription_id', sub.id)
            .is('used_by', null)
    }
}
