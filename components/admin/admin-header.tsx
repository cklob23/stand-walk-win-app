'use client'

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
import { Building2, LogOut, Settings, User as UserIcon, Shield } from 'lucide-react'
import { adminSignOut } from '@/lib/admin-auth-actions'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'

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

export function AdminHeader({ user, profile, organization, isMasterAdmin }: AdminHeaderProps) {
    const initials = profile?.full_name
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase() || user.email?.[0]?.toUpperCase() || '?'

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-4 lg:px-6">
                <div className="flex items-center gap-4">
                    <Link href="/admin/dashboard" className="flex items-center gap-2">
                        <AppLogo iconClassName="h-8 w-8 rounded-sm" textClassName="text-lg hidden sm:block" />
                    </Link>
                    <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="text-border">/</span>
                        {isMasterAdmin ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 text-amber-600">
                                <Shield className="h-3.5 w-3.5" />
                                <span className="font-medium">Master Admin</span>
                            </div>
                        ) : organization ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary">
                                <Building2 className="h-3.5 w-3.5" />
                                <span className="font-medium">{organization.name}</span>
                            </div>
                        ) : (
                            <span>Admin Portal</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
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
                                <Link href="/admin/dashboard/settings" className="cursor-pointer">
                                    <Settings className="mr-2 h-4 w-4" />
                                    Settings
                                </Link>
                            </DropdownMenuItem>
                            {profile?.role === 'leader' && (
                                <DropdownMenuItem asChild>
                                    <Link href="/dashboard" className="cursor-pointer">
                                        <UserIcon className="mr-2 h-4 w-4" />
                                        Go to Journey
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
    )
}
