import Link from 'next/link'
import { AppLogoStatic } from '@/components/app-logo'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { HomeMobileNav } from '@/components/home/mobile-nav'
import { homeNavLinks } from '@/lib/home-content'

export function HomeHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-card/50 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:py-4">
        <Link href="/" className="flex items-center gap-2">
          <AppLogoStatic />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex" aria-label="Homepage">
          {homeNavLinks.map((link) => (
            <a key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button variant="ghost" asChild size="sm" className="hidden lg:inline-flex">
            <Link href="/auth/login">Sign in</Link>
          </Button>
          <Button asChild className="hidden lg:inline-flex">
            <Link href="/auth/signup">Get Started</Link>
          </Button>
          <HomeMobileNav />
        </div>
      </div>
    </header>
  )
}
