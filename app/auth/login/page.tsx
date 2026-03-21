import { LoginForm } from '@/components/auth/login-form'
import Link from 'next/link'
import { AppLogoStatic } from '@/components/app-logo'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6 sm:space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-flex mb-4 sm:mb-6">
            <AppLogoStatic iconClassName="h-9 w-9 sm:h-10 sm:w-10 rounded-sm" textClassName="text-lg sm:text-xl" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Sign in to continue your discipleship journey
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-sm text-muted-foreground">
          {"Don't have an account? "}
          <Link href="/auth/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
