'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { homeNavLinks } from '@/lib/home-content'

export function HomeMobileNav() {
  const [open, setOpen] = useState(false)
  const pendingSection = useRef<string | null>(null)

  function closeAndScroll(id: string) {
    pendingSection.current = id
    history.replaceState(null, '', `#${id}`)
    setOpen(false)
    window.setTimeout(() => {
      pendingSection.current = null
      const el = document.getElementById(id)
      if (!el) return
      el.scrollIntoView({ behavior: 'auto', block: 'start' })
      window.setTimeout(() => {
        el.scrollIntoView({ behavior: 'auto', block: 'start' })
      }, 400)
    }, 350)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(20rem,85vw)]"
        onCloseAutoFocus={(event) => {
          if (pendingSection.current) {
            event.preventDefault()
          }
        }}
      >
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Homepage sections, sign in, and get started
          </SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4" aria-label="Homepage">
          {homeNavLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-2 py-2.5 text-base font-medium text-foreground hover:bg-muted"
              onClick={(event) => {
                event.preventDefault()
                closeAndScroll(link.href.slice(1))
              }}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <SheetFooter className="gap-2">
          <SheetClose asChild>
            <Button variant="outline" asChild className="w-full">
              <Link href="/auth/login">Sign in</Link>
            </Button>
          </SheetClose>
          <SheetClose asChild>
            <Button asChild className="w-full">
              <Link href="/auth/signup">Start</Link>
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
