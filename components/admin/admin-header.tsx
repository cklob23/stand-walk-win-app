'use client'

import { useState } from 'react'
import { AppLogo } from '@/components/app-logo'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet'
import { ArrowLeft, Building2, LogOut, Settings, User as UserIcon, Shield, Menu, LayoutDashboard, Users, Ticket, CreditCard, BarChart3, Inbox } from 'lucide-react'
import { adminSignOut } from '@/lib/admin-auth-actions'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'
import { AdminBackToJourneyLink } from '@/components/admin/admin-back-to-journey'
import { BACK_TO_JOURNEY_LABEL, getAdminLogoHref, getJourneyHomeHref } from '@/lib/admin-journey-nav'
import { SUPPORT_EMAIL } from '@/lib/support'

interface AdminHeaderProps {
    user: User
    profile: {
        full_name?: string | null
        avatar_url?: string | null
        role?: string | null
    } | null
    organization: {
        id: string
        name: string
    } | null
    isMasterAdmin: boolean
}

const orgAdminLinks = [
    { title: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { title: 'Members', href: '/admin/dashboard/members', icon: Users },
    { title: 'Requests', href: '/admin/dashboard/requests', icon: Inbox },
    { title: 'Access Codes', href: '/admin/dashboard/access-codes', icon: Ticket },
    { title: 'Subscription', href: '/admin/dashboard/subscription', icon: CreditCard },
    { title: 'Settings', href: '/admin/dashboard/settings', icon: Settings },
]

const masterAdminLinks = [
    { title: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { title: 'Organizations', href: '/admin/dashboard/organizations', icon: Building2 },
    { title: 'All Users', href: '/admin/dashboard/users', icon: Users },
    { title: 'Subscriptions', href: '/admin/dashboard/subscriptions', icon: CreditCard },
    { title: 'Analytics', href: '/admin/dashboard/analytics', icon: BarChart3 },
    { title: 'System Settings', href: '/admin/dashboard/system', icon: Shield },
]

export function AdminHeader({ user, profile, organization, isMasterAdmin }: AdminHeaderProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const pathname = usePathname()
    const links = isMasterAdmin ? masterAdminLinks : orgAdminLinks
    const journeyHomeHref = getJourneyHomeHref(profile?.role)
    const logoHref = getAdminLogoHref(profile?.role)

    const initials = profile?.full_name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase() || user.email?.[0]?.toUpperCase() || '?'

    return (
        <>
            {/* Mobile menu Sheet - placed outside header to prevent layout shift */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetContent side="left" className="w-72 p-0 flex flex-col">
                    <SheetHeader className="p-4 border-b">
                        <SheetTitle className="flex items-center gap-2">
                            <Link href={logoHref} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 min-w-0">
                                <AppLogo iconClassName="h-8 w-8 rounded-sm" textClassName="text-base" showSubtitle />
                            </Link>
                        </SheetTitle>
                    </SheetHeader>
                    <nav className="flex-1 p-4 space-y-1">
                        {links.map((link) => {
                            const isActive = pathname === link.href ||
                                (link.href !== '/admin/dashboard' && pathname.startsWith(link.href))

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={cn(
                                        'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    )}
                                >
                                    <link.icon className="h-5 w-5" />
                                    {link.title}
                                </Link>
                            )
                        })}
                    </nav>
                    {journeyHomeHref && (
                        <div className="px-4 pb-2">
                            <AdminBackToJourneyLink
                                href={journeyHomeHref}
                                onClick={() => setMobileMenuOpen(false)}
                                className="py-3"
                                iconClassName="h-5 w-5"
                            />
                        </div>
                    )}
                    <div className="p-4 border-t mt-auto">
                        <div className="rounded-lg bg-muted p-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Need help?</p>
                            <p className="text-xs text-muted-foreground">
                                Contact support at{' '}
                                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
                                    {SUPPORT_EMAIL}
                                </a>
                            </p>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex h-16 items-center justify-between px-4 lg:px-6">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                        {/* Mobile menu trigger */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden shrink-0"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">Open menu</span>
                        </Button>

                        <Link href={logoHref} className="flex min-w-0 items-center gap-2">
                            <AppLogo
                                iconClassName="h-8 w-8 rounded-sm"
                                textClassName="text-sm lg:text-lg"
                                subtitleClassName="hidden lg:block"
                                showSubtitle
                            />
                        </Link>
                        {journeyHomeHref && (
                            <AdminBackToJourneyLink
                                href={journeyHomeHref}
                                className="lg:hidden shrink-0 px-2 py-1.5 gap-1.5 whitespace-nowrap"
                                iconClassName="h-4 w-4"
                            />
                        )}
                        {isMasterAdmin ? (
                            <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="text-border">/</span>
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 text-amber-600">
                                    <Shield className="h-3.5 w-3.5" />
                                    <span className="font-medium">Master Admin</span>
                                </div>
                            </div>
                        ) : !organization ? (
                            <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="text-border">/</span>
                                <span>Admin Portal</span>
                            </div>
                        ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || ''} />
                                        <AvatarFallback className="bg-primary text-primary-foreground">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{profile?.full_name || 'Admin'}</p>
                                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/admin/dashboard/profile" className="cursor-pointer">
                                        <UserIcon className="mr-2 h-4 w-4" />
                                        Profile
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/admin/dashboard/settings" className="cursor-pointer">
                                        <Settings className="mr-2 h-4 w-4" />
                                        Settings
                                    </Link>
                                </DropdownMenuItem>
                                {journeyHomeHref && (
                                    <DropdownMenuItem asChild>
                                        <Link href={journeyHomeHref} className="cursor-pointer">
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            {BACK_TO_JOURNEY_LABEL}
                                        </Link>
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="cursor-pointer text-destructive focus:text-destructive"
                                    onClick={() => adminSignOut()}
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Sign out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>
        </>
    )
}
