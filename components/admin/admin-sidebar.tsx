'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    Users,
    Ticket,
    Settings,
    Building2,
    CreditCard,
    BarChart3,
    Shield,
    Inbox,
} from 'lucide-react'

interface AdminSidebarProps {
    isMasterAdmin: boolean
}

const orgAdminLinks = [
    {
        title: 'Dashboard',
        href: '/admin/dashboard',
        icon: LayoutDashboard,
    },
    {
        title: 'Members',
        href: '/admin/dashboard/members',
        icon: Users,
    },
    {
        title: 'Requests',
        href: '/admin/dashboard/requests',
        icon: Inbox,
    },
    {
        title: 'Access Codes',
        href: '/admin/dashboard/access-codes',
        icon: Ticket,
    },
    {
        title: 'Subscription',
        href: '/admin/dashboard/subscription',
        icon: CreditCard,
    },
    {
        title: 'Settings',
        href: '/admin/dashboard/settings',
        icon: Settings,
    },
]

const masterAdminLinks = [
    {
        title: 'Dashboard',
        href: '/admin/dashboard',
        icon: LayoutDashboard,
    },
    {
        title: 'Organizations',
        href: '/admin/dashboard/organizations',
        icon: Building2,
    },
    {
        title: 'All Users',
        href: '/admin/dashboard/users',
        icon: Users,
    },
    {
        title: 'Subscriptions',
        href: '/admin/dashboard/subscriptions',
        icon: CreditCard,
    },
    {
        title: 'Analytics',
        href: '/admin/dashboard/analytics',
        icon: BarChart3,
    },
    {
        title: 'System Settings',
        href: '/admin/dashboard/system',
        icon: Shield,
    },
]

export function AdminSidebar({ isMasterAdmin }: AdminSidebarProps) {
    const pathname = usePathname()
    const links = isMasterAdmin ? masterAdminLinks : orgAdminLinks

    return (
        <aside className="hidden lg:flex w-64 flex-col border-r bg-muted/30 min-h-[calc(100vh-4rem)]">
            <nav className="flex-1 space-y-1 p-4">
                {links.map((link) => {
                    const isActive = pathname === link.href ||
                        (link.href !== '/admin/dashboard' && pathname.startsWith(link.href))

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            <link.icon className="h-4 w-4" />
                            {link.title}
                        </Link>
                    )
                })}
            </nav>

            <div className="p-4 border-t">
                <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Need help?</p>
                    <p className="text-xs text-muted-foreground">
                        Contact support at{' '}
                        <a href="mailto:standwalkwinapp@gmail.com" className="text-primary hover:underline">
                            standwalkwinapp@gmail.com
                        </a>
                    </p>
                </div>
            </div>
        </aside>
    )
}
