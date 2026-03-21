import { AdminLoginForm } from '@/components/admin/admin-login-form'
import Link from 'next/link'
import { AppLogo } from '@/components/app-logo'
import { Building2 } from 'lucide-react'

export const metadata = {
    title: 'Admin Login | Stand Walk Run',
    description: 'Login to your organization admin dashboard',
}

export default function AdminLoginPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4 py-8">
            <div className="w-full max-w-md space-y-6 sm:space-y-8">
                <div className="text-center">
                    <Link href="/" className="inline-flex mb-4 sm:mb-6">
                        <AppLogo iconClassName="h-9 w-9 sm:h-10 sm:w-10 rounded-sm" textClassName="text-lg sm:text-xl" />
                    </Link>
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium text-primary uppercase tracking-wide">Admin Portal</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">Organization Admin Login</h1>
                    <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                        Manage your organization, members, and access codes
                    </p>
                </div>

                <AdminLoginForm />

                <div className="space-y-3 text-center text-sm text-muted-foreground">
                    <p>
                        {"Looking to start your journey? "}
                        <Link href="/auth/signup" className="font-medium text-primary hover:underline">
                            Sign up here
                        </Link>
                    </p>
                    <p>
                        {"Already on the journey? "}
                        <Link href="/auth/login" className="font-medium text-primary hover:underline">
                            User login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
