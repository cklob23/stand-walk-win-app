'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Users, GraduationCap, BookOpen, Crown, Minus, Plus, Building2, ShoppingCart, Trash2, X, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SUBSCRIPTION_TIERS, JOURNEYS, formatPrice } from '@/lib/products'
import { CartCheckout } from './cart-checkout'
import { AppLogoStatic } from '@/components/app-logo'

// Cart item type
interface CartItem {
    id: string
    tierId: string
    tierName: string
    journeyId: string
    journeyName: string
    priceInCents: number
}

// Journey-only cart item for existing subscribers
interface JourneyCartItem {
    id: string
    journeyId: string
    journeyName: string
    priceInCents: number
}

interface UserData {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
    hasSubscription: boolean
    organizationId: string | null
    organizationName: string | null
}

interface PricingContentProps {
    userData?: UserData | null
}

export function PricingContent({ userData }: PricingContentProps) {
    const router = useRouter()
    const [cart, setCart] = useState<CartItem[]>([])
    const [journeyCart, setJourneyCart] = useState<JourneyCartItem[]>([])
    const [selectedTierForAdd, setSelectedTierForAdd] = useState<string | null>(null)
    const [selectedJourneyForAdd, setSelectedJourneyForAdd] = useState<string>(JOURNEYS[0]?.id || '')
    const [quantityToAdd, setQuantityToAdd] = useState(1)
    const [createOrg, setCreateOrg] = useState(false)
    const [orgName, setOrgName] = useState('')
    const [email, setEmail] = useState(userData?.email || '')
    const [showCheckout, setShowCheckout] = useState(false)
    const [cartOpen, setCartOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<string>(userData?.hasSubscription ? 'journeys' : 'plans')

    // Update email if userData changes
    useEffect(() => {
        if (userData?.email) {
            setEmail(userData.email)
        }
    }, [userData?.email])

    // Calculate cart totals
    const cartTotal = cart.reduce((sum, item) => sum + item.priceInCents, 0)
    const journeyCartTotal = journeyCart.reduce((sum, item) => sum + item.priceInCents, 0)
    const totalCartValue = cartTotal + journeyCartTotal
    const cartCountByTier = SUBSCRIPTION_TIERS.map(tier => ({
        tier,
        count: cart.filter(item => item.tierId === tier.id).length
    })).filter(t => t.count > 0)
    const totalItems = cart.length + journeyCart.length

    // Add items to cart (with quantity)
    const addToCart = (tierId: string, journeyId: string, quantity: number) => {
        const tier = SUBSCRIPTION_TIERS.find(t => t.id === tierId)
        const journey = JOURNEYS.find(j => j.id === journeyId)
        if (!tier || !journey) return

        const newItems: CartItem[] = []
        for (let i = 0; i < quantity; i++) {
            newItems.push({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${i}`,
                tierId: tier.id,
                tierName: tier.name,
                journeyId: journey.id,
                journeyName: journey.name,
                priceInCents: tier.priceInCents + journey.priceInCents,
            })
        }

        setCart([...cart, ...newItems])
        setSelectedTierForAdd(null)
        setQuantityToAdd(1)
    }

    // Add journey to cart (for existing subscribers)
    const addJourneyToCart = (journeyId: string) => {
        const journey = JOURNEYS.find(j => j.id === journeyId)
        if (!journey || journey.priceInCents === 0) return

        const newItem: JourneyCartItem = {
            id: `journey-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            journeyId: journey.id,
            journeyName: journey.name,
            priceInCents: journey.priceInCents,
        }

        setJourneyCart([...journeyCart, newItem])
    }

    // Remove journey from cart
    const removeJourneyFromCart = (itemId: string) => {
        setJourneyCart(journeyCart.filter(item => item.id !== itemId))
    }

    // Remove item from cart
    const removeFromCart = (itemId: string) => {
        setCart(cart.filter(item => item.id !== itemId))
    }

    // Clear cart
    const clearCart = () => {
        setCart([])
        setJourneyCart([])
    }

    // Handle proceed to checkout
    const handleProceedToCheckout = () => {
        if ((cart.length === 0 && journeyCart.length === 0) || !email) return
        if (cart.length > 1 && createOrg && !orgName) return
        setShowCheckout(true)
    }

    if (showCheckout && (cart.length > 0 || journeyCart.length > 0)) {
        return (
            <CartCheckout
                cart={cart}
                journeyCart={journeyCart}
                email={email}
                createOrg={createOrg}
                orgName={orgName}
                userId={userData?.id}
                organizationId={userData?.organizationId || undefined}
                onBack={() => setShowCheckout(false)}
            />
        )
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b bg-card">
                <div className="container mx-auto px-4 py-4 sm:py-6">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <AppLogoStatic
                                iconClassName="h-7 w-7 sm:h-9 sm:w-9 rounded-sm shrink-0"
                                textClassName="text-sm sm:text-lg"
                                showText={true}
                            />
                            <div className="hidden sm:block border-l pl-3 ml-1">
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                    {userData?.hasSubscription ? 'Add more plans or journeys' : 'Choose your discipleship plans'}
                                </p>
                            </div>
                        </div>

                        {/* User Info & Cart Button */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Back to Admin Dashboard for logged-in org admins */}
                            {userData?.organizationId && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                    className="hidden sm:flex"
                                >
                                    <Link href="/admin/dashboard">
                                        <ArrowLeft className="h-4 w-4 mr-1" />
                                        Admin
                                    </Link>
                                </Button>
                            )}

                            {userData && (
                                <div className="hidden sm:flex items-center gap-2">
                                    <div className="text-right">
                                        <p className="text-sm font-medium">{userData.fullName || userData.email}</p>
                                        {userData.organizationName && (
                                            <p className="text-xs text-muted-foreground">{userData.organizationName}</p>
                                        )}
                                    </div>
                                    {userData.avatarUrl ? (
                                        <img
                                            src={userData.avatarUrl}
                                            alt={userData.fullName || 'Profile'}
                                            className="h-8 w-8 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                                            {(userData.fullName || userData.email || 'U')[0].toUpperCase()}
                                        </div>
                                    )}
                                </div>
                            )}

                            <Sheet open={cartOpen} onOpenChange={setCartOpen}>
                                <SheetTrigger asChild>
                                    <Button variant="outline" className="relative">
                                        <ShoppingCart className="h-4 w-4 mr-2" />
                                        Cart
                                        {totalItems > 0 && (
                                            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                                                {totalItems}
                                            </Badge>
                                        )}
                                    </Button>
                                </SheetTrigger>
                                <SheetContent className="w-full sm:max-w-md flex flex-col p-6">
                                    <SheetHeader className="px-0">
                                        <SheetTitle>Your Cart</SheetTitle>
                                        <SheetDescription>
                                            {totalItems === 0 ? 'Your cart is empty' : `${totalItems} item${totalItems > 1 ? 's' : ''} selected`}
                                        </SheetDescription>
                                    </SheetHeader>

                                    {totalItems > 0 && (
                                        <div className="flex-1 overflow-auto mt-6 px-0">
                                            {/* Plan Licenses */}
                                            {cart.length > 0 && (
                                                <div className="space-y-3">
                                                    <h4 className="font-medium text-sm text-muted-foreground">Plan Licenses</h4>
                                                    {cart.map((item, index) => (
                                                        <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="secondary">{item.tierName}</Badge>
                                                                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                                                                </div>
                                                                <p className="text-sm text-muted-foreground mt-1 truncate">
                                                                    {item.journeyName}
                                                                </p>
                                                                <p className="text-sm font-medium mt-1">
                                                                    {formatPrice(item.priceInCents)}/mo
                                                                </p>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                                                onClick={() => removeFromCart(item.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Journey Add-ons */}
                                            {journeyCart.length > 0 && (
                                                <div className="space-y-3 mt-4">
                                                    <h4 className="font-medium text-sm text-muted-foreground">Additional Journeys</h4>
                                                    {journeyCart.map((item) => (
                                                        <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <BookOpen className="h-4 w-4 text-primary" />
                                                                    <span className="font-medium text-sm">{item.journeyName}</span>
                                                                </div>
                                                                <p className="text-sm font-medium mt-1">
                                                                    {formatPrice(item.priceInCents)} one-time
                                                                </p>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                                                onClick={() => removeJourneyFromCart(item.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <Separator className="my-4" />

                                            {/* Cart Summary */}
                                            <div className="space-y-2">
                                                {cartCountByTier.map(({ tier, count }) => (
                                                    <div key={tier.id} className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">{tier.name} x {count}</span>
                                                        <span>{formatPrice(tier.priceInCents * count)}/mo</span>
                                                    </div>
                                                ))}
                                                {journeyCart.length > 0 && (
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-muted-foreground">Journey add-ons</span>
                                                        <span>{formatPrice(journeyCartTotal)} one-time</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between font-bold pt-2 border-t">
                                                    <span>Total</span>
                                                    <div className="text-right">
                                                        {cartTotal > 0 && <div>{formatPrice(cartTotal)}/mo</div>}
                                                        {journeyCartTotal > 0 && (
                                                            <div className="text-sm font-normal text-muted-foreground">
                                                                + {formatPrice(journeyCartTotal)} one-time
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <Separator className="my-4" />

                                            {/* Email & Organization */}
                                            <div className="space-y-4">
                                                <div>
                                                    <Label htmlFor="cart-email">Your Email</Label>
                                                    <Input
                                                        id="cart-email"
                                                        type="email"
                                                        placeholder="you@example.com"
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                        className="mt-2"
                                                        disabled={!!userData?.email}
                                                    />
                                                </div>

                                                {/* Show organization info for existing org admins */}
                                                {userData?.organizationId && userData?.organizationName && (
                                                    <div className="rounded-lg border bg-primary/5 border-primary/20 p-3">
                                                        <div className="flex items-center gap-2">
                                                            <Building2 className="h-4 w-4 text-primary" />
                                                            <div>
                                                                <p className="text-sm font-medium">Adding to Organization</p>
                                                                <p className="text-xs text-muted-foreground">{userData.organizationName}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Show create org option only for new users with multiple licenses */}
                                                {cart.length > 1 && !userData?.organizationId && (
                                                    <div className="rounded-lg border bg-muted/30 p-3">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <Building2 className="h-4 w-4 text-primary" />
                                                                <Label htmlFor="cart-createOrg" className="cursor-pointer text-sm">
                                                                    Create Organization
                                                                </Label>
                                                            </div>
                                                            <Switch
                                                                id="cart-createOrg"
                                                                checked={createOrg}
                                                                onCheckedChange={setCreateOrg}
                                                            />
                                                        </div>

                                                        {createOrg && (
                                                            <div className="mt-3">
                                                                <Input
                                                                    placeholder="Organization Name"
                                                                    value={orgName}
                                                                    onChange={(e) => setOrgName(e.target.value)}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {totalItems > 0 && (
                                        <SheetFooter className="mt-6 flex-col gap-2 sm:flex-col px-1 pb-2">
                                            <Button
                                                className="w-full"
                                                size="lg"
                                                onClick={() => {
                                                    setCartOpen(false)
                                                    handleProceedToCheckout()
                                                }}
                                                disabled={!email || (cart.length > 1 && createOrg && !orgName)}
                                            >
                                                Proceed to Checkout
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="w-full"
                                                onClick={clearCart}
                                            >
                                                Clear Cart
                                            </Button>
                                        </SheetFooter>
                                    )}
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-12">
                {/* Tabs for existing subscribers */}
                {userData?.hasSubscription ? (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
                        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                            <TabsTrigger value="plans">Add More Licenses</TabsTrigger>
                            <TabsTrigger value="journeys">Buy Journeys</TabsTrigger>
                        </TabsList>

                        <TabsContent value="plans" className="mt-8">
                            <PlanSelection
                                cart={cart}
                                selectedTierForAdd={selectedTierForAdd}
                                setSelectedTierForAdd={setSelectedTierForAdd}
                                selectedJourneyForAdd={selectedJourneyForAdd}
                                setSelectedJourneyForAdd={setSelectedJourneyForAdd}
                                quantityToAdd={quantityToAdd}
                                setQuantityToAdd={setQuantityToAdd}
                                addToCart={addToCart}
                            />
                        </TabsContent>

                        <TabsContent value="journeys" className="mt-8">
                            <JourneyPurchase
                                journeyCart={journeyCart}
                                addJourneyToCart={addJourneyToCart}
                                removeJourneyFromCart={removeJourneyFromCart}
                            />
                        </TabsContent>
                    </Tabs>
                ) : (
                    <>
                        <PlanSelection
                            cart={cart}
                            selectedTierForAdd={selectedTierForAdd}
                            setSelectedTierForAdd={setSelectedTierForAdd}
                            selectedJourneyForAdd={selectedJourneyForAdd}
                            setSelectedJourneyForAdd={setSelectedJourneyForAdd}
                            quantityToAdd={quantityToAdd}
                            setQuantityToAdd={setQuantityToAdd}
                            addToCart={addToCart}
                        />

                        {/* Available Journeys Info */}
                        <div className="mb-12">
                            <h2 className="mb-2 text-center text-2xl font-bold text-foreground">Available Journeys</h2>
                            <p className="mb-8 text-center text-muted-foreground">
                                Each license can be assigned a different journey
                            </p>

                            <div className="mx-auto max-w-3xl">
                                <div className="space-y-4">
                                    {JOURNEYS.map((journey) => (
                                        <Card key={journey.id} className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <BookOpen className="h-5 w-5 text-primary" />
                                                        <h3 className="font-medium text-foreground">{journey.name}</h3>
                                                    </div>
                                                    <p className="mt-1 text-sm text-muted-foreground">{journey.description}</p>
                                                    <p className="mt-1 text-xs text-muted-foreground">{journey.weeks} weeks</p>
                                                </div>
                                                <Badge variant={journey.priceInCents === 0 ? 'default' : 'secondary'}>
                                                    {journey.priceInCents === 0 ? 'Included' : `+${formatPrice(journey.priceInCents)}`}
                                                </Badge>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Cart Summary (sticky at bottom when items in cart) */}
                {totalItems > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-50">
                        <div className="container mx-auto flex items-center justify-between max-w-5xl">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <ShoppingCart className="h-5 w-5 text-primary" />
                                    <span className="font-medium">{totalItems} item{totalItems > 1 ? 's' : ''}</span>
                                </div>
                                <div className="hidden sm:flex gap-2">
                                    {cartCountByTier.map(({ tier, count }) => (
                                        <Badge key={tier.id} variant="outline">
                                            {count}x {tier.name}
                                        </Badge>
                                    ))}
                                    {journeyCart.length > 0 && (
                                        <Badge variant="outline">
                                            {journeyCart.length}x Journey
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    {cartTotal > 0 && <span className="font-bold text-lg">{formatPrice(cartTotal)}/mo</span>}
                                    {journeyCartTotal > 0 && (
                                        <span className="text-sm text-muted-foreground ml-2">+ {formatPrice(journeyCartTotal)}</span>
                                    )}
                                </div>
                                <Button onClick={() => setCartOpen(true)}>
                                    View Cart
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Spacer for fixed bottom bar */}
                {totalItems > 0 && <div className="h-20" />}

                <p className="mt-8 text-center text-sm text-muted-foreground">
                    Already have an access code?{' '}
                    <a href="/auth/signup" className="text-primary hover:underline">
                        Sign up here
                    </a>
                </p>
            </div>
        </div>
    )
}

// Plan Selection Component with Quantity Controls
function PlanSelection({
    cart,
    selectedTierForAdd,
    setSelectedTierForAdd,
    selectedJourneyForAdd,
    setSelectedJourneyForAdd,
    quantityToAdd,
    setQuantityToAdd,
    addToCart,
}: {
    cart: CartItem[]
    selectedTierForAdd: string | null
    setSelectedTierForAdd: (id: string | null) => void
    selectedJourneyForAdd: string
    setSelectedJourneyForAdd: (id: string) => void
    quantityToAdd: number
    setQuantityToAdd: (n: number) => void
    addToCart: (tierId: string, journeyId: string, quantity: number) => void
}) {
    return (
        <div className="mb-12">
            <h2 className="mb-2 text-center text-3xl font-bold text-foreground">Select Your Plans</h2>
            <p className="mb-8 text-center text-muted-foreground">
                Add multiple plans with different journeys to your cart
            </p>

            <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
                {SUBSCRIPTION_TIERS.map((tier) => {
                    const isPremium = tier.id === 'premium'
                    const cartCount = cart.filter(item => item.tierId === tier.id).length
                    const isAddingToThis = selectedTierForAdd === tier.id

                    return (
                        <Card
                            key={tier.id}
                            className={`relative transition-all hover:shadow-lg ${isPremium ? 'border-primary' : ''
                                } ${isAddingToThis ? 'ring-2 ring-primary' : ''}`}
                        >
                            {isPremium && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                                        <Crown className="h-3 w-3" />
                                        Most Popular
                                    </span>
                                </div>
                            )}

                            {cartCount > 0 && (
                                <div className="absolute -top-2 -right-2">
                                    <Badge className="h-6 w-6 flex items-center justify-center p-0">
                                        {cartCount}
                                    </Badge>
                                </div>
                            )}

                            <CardHeader className="pb-4">
                                <CardTitle className="text-xl">{tier.name}</CardTitle>
                                <CardDescription>{tier.description}</CardDescription>
                                <div className="mt-2">
                                    <span className="text-3xl font-bold text-foreground">
                                        {formatPrice(tier.priceInCents)}
                                    </span>
                                    <span className="text-muted-foreground">/month</span>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-4">
                                <ul className="space-y-3">
                                    {tier.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-sm">
                                            {feature.includes('learner') ? (
                                                <Users className="h-4 w-4 text-primary" />
                                            ) : feature.includes('graduate') ? (
                                                <GraduationCap className="h-4 w-4 text-primary" />
                                            ) : feature.includes('journey') ? (
                                                <BookOpen className="h-4 w-4 text-primary" />
                                            ) : (
                                                <Check className="h-4 w-4 text-primary" />
                                            )}
                                            <span className="text-muted-foreground">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                            <CardFooter className="flex-col gap-3">
                                {isAddingToThis ? (
                                    <div className="w-full space-y-4">
                                        {/* Quantity Controls */}
                                        <div>
                                            <Label className="text-sm mb-2 block">Number of Licenses</Label>
                                            <div className="flex items-center justify-center gap-3">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-10 w-10"
                                                    onClick={() => setQuantityToAdd(Math.max(1, quantityToAdd - 1))}
                                                    disabled={quantityToAdd <= 1}
                                                >
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <span className="text-2xl font-bold w-12 text-center">{quantityToAdd}</span>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-10 w-10"
                                                    onClick={() => setQuantityToAdd(quantityToAdd + 1)}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <p className="text-center text-sm text-muted-foreground mt-1">
                                                {formatPrice(tier.priceInCents * quantityToAdd)}/mo total
                                            </p>
                                        </div>

                                        {/* Journey Selection */}
                                        <div>
                                            <Label className="text-sm mb-1.5 block">Select Journey</Label>
                                            <Select
                                                value={selectedJourneyForAdd}
                                                onValueChange={setSelectedJourneyForAdd}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Choose a journey" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {JOURNEYS.map((journey) => (
                                                        <SelectItem key={journey.id} value={journey.id}>
                                                            <div className="flex items-center justify-between w-full">
                                                                <span>{journey.name}</span>
                                                                {journey.priceInCents === 0 && (
                                                                    <Badge variant="secondary" className="ml-2 text-xs">Included</Badge>
                                                                )}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button
                                                className="flex-1"
                                                onClick={() => addToCart(tier.id, selectedJourneyForAdd, quantityToAdd)}
                                            >
                                                <Plus className="h-4 w-4 mr-1" />
                                                Add {quantityToAdd} to Cart
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => {
                                                    setSelectedTierForAdd(null)
                                                    setQuantityToAdd(1)
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button
                                        className="w-full"
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedTierForAdd(tier.id)
                                            setSelectedJourneyForAdd(JOURNEYS[0]?.id || '')
                                            // Start at current cart count for this tier, minimum 1
                                            setQuantityToAdd(Math.max(1, cartCount))
                                        }}
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        {cartCount > 0 ? 'Add More Licenses' : 'Add License'}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}

// Journey Purchase Component for Existing Subscribers
function JourneyPurchase({
    journeyCart,
    addJourneyToCart,
    removeJourneyFromCart,
}: {
    journeyCart: JourneyCartItem[]
    addJourneyToCart: (journeyId: string) => void
    removeJourneyFromCart: (itemId: string) => void
}) {
    const journeyCountInCart = (journeyId: string) =>
        journeyCart.filter(item => item.journeyId === journeyId).length

    return (
        <div className="mb-12">
            <h2 className="mb-2 text-center text-3xl font-bold text-foreground">Purchase Additional Journeys</h2>
            <p className="mb-8 text-center text-muted-foreground">
                Buy journeys for yourself or members of your organization to use after completing their current journey
            </p>

            <div className="mx-auto max-w-3xl">
                <div className="space-y-4">
                    {JOURNEYS.map((journey) => {
                        const countInCart = journeyCountInCart(journey.id)
                        const isIncluded = journey.priceInCents === 0

                        return (
                            <Card key={journey.id} className={`p-4 ${countInCart > 0 ? 'ring-2 ring-primary' : ''}`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <BookOpen className="h-5 w-5 text-primary" />
                                            <h3 className="font-medium text-foreground">{journey.name}</h3>
                                            {countInCart > 0 && (
                                                <Badge className="ml-2">{countInCart} in cart</Badge>
                                            )}
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">{journey.description}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">{journey.weeks} weeks</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant={isIncluded ? 'default' : 'secondary'} className="whitespace-nowrap">
                                            {isIncluded ? 'Included' : formatPrice(journey.priceInCents)}
                                        </Badge>
                                        {!isIncluded && (
                                            <div className="flex items-center gap-1">
                                                {countInCart > 0 && (
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        onClick={() => {
                                                            const item = journeyCart.find(i => i.journeyId === journey.id)
                                                            if (item) removeJourneyFromCart(item.id)
                                                        }}
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => addJourneyToCart(journey.id)}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </div>

                <div className="mt-8 p-4 rounded-lg bg-muted/50 border">
                    <h4 className="font-medium mb-2">How it works</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                        <li>- Purchase additional journeys for your account or organization members</li>
                        <li>- Journeys can be assigned to any leader or learner in your organization</li>
                        <li>- Members can start new journeys after completing their current one</li>
                        <li>- One-time purchase, no recurring charges</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
