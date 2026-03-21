import { SignupForm } from '@/components/auth/signup-form'
import Link from 'next/link'
import { AppLogo } from '@/components/app-logo'
import { Info } from 'lucide-react'

interface SignupPageProps {
  searchParams: Promise<{ org_admin?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams
  const isOrgAdmin = params.org_admin === 'true'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6 sm:space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex mb-4 sm:mb-6">
            <AppLogo iconClassName="h-9 w-9 sm:h-10 sm:w-10 rounded-sm" textClassName="text-lg sm:text-xl" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Begin your journey</h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Create an account to start your discipleship path
          </p>
        </div>

        {isOrgAdmin && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 flex gap-3">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Complete Your Setup</p>
              <p className="text-muted-foreground mt-1">
                As an organization admin, please enter an access code to join as a Leader,
                or a pairing code to join as a Learner.
              </p>
            </div>
          </div>
        )}

        <SignupForm isOrgAdmin={isOrgAdmin} />

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
