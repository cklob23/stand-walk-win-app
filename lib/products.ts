export interface SubscriptionTier {
    id: string
    name: string
    description: string
    priceInCents: number
    maxLearners: number
    features: string[]
    stripeProductId: string
    stripePriceId: string
}

export interface Journey {
    id: string
    name: string
    description: string
    priceInCents: number
    weeks: number
}

// Subscription tiers
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
    {
        id: 'basic',
        name: 'Basic',
        description: 'Perfect for individual discipleship',
        priceInCents: 699, // $6.99/month
        maxLearners: 1,
        features: [
            'Up to 1 learner',
            'Can graduate to leader',
            'Additional journeys available',
        ],
        stripeProductId: 'prod_U8s6m2r0hpAeoB',
        stripePriceId: 'price_1TAaMrGWwU79IQt3bjBmsBo0',
    },
    {
        id: 'standard',
        name: 'Standard',
        description: 'Great for small groups',
        priceInCents: 999, // $9.99/month
        maxLearners: 5,
        features: [
            'Up to 5 learners',
            'Can graduate to leader',
            'Additional journeys available',
        ],
        stripeProductId: 'prod_U8s6iEVk35cVzx',
        stripePriceId: 'price_1TAaMrGWwU79IQt39yefN36Q',
    },
    {
        id: 'premium',
        name: 'Premium',
        description: 'Best for larger organizations',
        priceInCents: 1999, // $19.99/month
        maxLearners: 10,
        features: [
            'Up to 10 learners',
            'Can graduate to leader',
            'Additional journeys available',
            'Priority support',
        ],
        stripeProductId: 'prod_U8s6WPkqXRuO7v',
        stripePriceId: 'price_1TAaMKGWwU79IQt3B6hAruAP',
    },
]

// Available journeys
export const JOURNEYS: Journey[] = [
    {
        id: 'a0000000-0000-0000-0000-000000000001',
        name: 'New Believer Foundations',
        description: 'A 6-week journey designed to help new believers establish a strong foundation in their faith.',
        priceInCents: 0, // Included with subscription
        weeks: 6,
    }
]

export function getTierById(id: string): SubscriptionTier | undefined {
    return SUBSCRIPTION_TIERS.find(tier => tier.id === id)
}

export function getJourneyById(id: string): Journey | undefined {
    return JOURNEYS.find(journey => journey.id === id)
}

export function formatPrice(priceInCents: number): string {
    return `$${(priceInCents / 100).toFixed(2)}`
}
