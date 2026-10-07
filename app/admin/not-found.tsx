import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppLogoStatic } from '@/components/app-logo'
import { Building2 } from 'lucide-react'

export default function AdminNotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-8">
            <div className="w-full max-w-md space-y-6 text-center">
                <Link href="/admin/dashboard" className="inline-flex">
                    <AppLogoStatic iconClassName="h-9 w-9 sm:h-10 sm:w-10 rounded-sm" textClassName="text-lg sm:text-xl" />
                </Link>
                <div className="flex items-center justify-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-primary uppercase tracking-wide">Admin Portal</span>
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-foreground">Admin page not found</h1>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        This admin URL does not exist or has been moved.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button asChild>
                        <Link href="/admin/dashboard">Admin dashboard</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/admin/login">Admin login</Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
