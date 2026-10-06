import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppLogoStatic } from '@/components/app-logo'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-6 text-center">
        <Link href="/" className="inline-flex">
          <AppLogoStatic iconClassName="h-9 w-9 sm:h-10 sm:w-10 rounded-sm" textClassName="text-lg sm:text-xl" />
        </Link>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild>
            <Link href="/">Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
