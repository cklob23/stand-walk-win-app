import Image from 'next/image'
import { cn } from '@/lib/utils'

function BrowserChrome() {
  return (
    <div className="flex items-center gap-1.5 border-b bg-muted/60 px-3 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-border" />
      <span className="h-2.5 w-2.5 rounded-full bg-border" />
      <span className="h-2.5 w-2.5 rounded-full bg-border" />
      <span className="ml-3 rounded-md bg-background px-3 py-0.5 text-[11px] text-muted-foreground">
        standwalkrun.com
      </span>
    </div>
  )
}

function ThemeImage({
  lightSrc,
  darkSrc,
  alt,
  width,
  height,
  className,
  sizes,
  priority,
}: {
  lightSrc: string
  darkSrc?: string
  alt: string
  width: number
  height: number
  className?: string
  sizes?: string
  priority?: boolean
}) {
  return (
    <>
      <Image
        src={lightSrc}
        alt={alt}
        width={width}
        height={height}
        className={cn(className, darkSrc && 'dark:hidden')}
        sizes={sizes}
        priority={priority}
      />
      {darkSrc ? (
        <Image
          src={darkSrc}
          alt={alt}
          width={width}
          height={height}
          className={cn(className, 'hidden dark:block')}
          sizes={sizes}
          priority={priority}
        />
      ) : null}
    </>
  )
}

export function BrowserScreenshot({
  lightSrc,
  darkSrc,
  alt,
  priority,
  className,
}: {
  lightSrc: string
  darkSrc?: string
  alt: string
  priority?: boolean
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow-xl', className)}>
      <BrowserChrome />
      <ThemeImage
        lightSrc={lightSrc}
        darkSrc={darkSrc}
        alt={alt}
        width={1280}
        height={800}
        className="block h-auto w-full"
        sizes="(min-width: 1024px) 640px, 92vw"
        priority={priority}
      />
    </div>
  )
}

export function PhoneScreenshot({
  src,
  alt,
  className,
  priority,
}: {
  src: string
  alt: string
  className?: string
  priority?: boolean
}) {
  return (
    <div
      className={cn(
        'mx-auto w-[230px] overflow-hidden rounded-[2.2rem] border-[6px] border-foreground/85 bg-foreground/85 shadow-xl',
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        width={780}
        height={1400}
        className="block aspect-[390/700] w-full rounded-[1.7rem] object-cover object-top"
        sizes="230px"
        priority={priority}
      />
    </div>
  )
}

export function AppScreenshot({
  lightSrc,
  darkSrc,
  mobileSrc,
  alt,
  priority,
}: {
  lightSrc: string
  darkSrc?: string
  mobileSrc: string
  alt: string
  priority?: boolean
}) {
  return (
    <>
      <div className="hidden sm:block">
        <BrowserScreenshot lightSrc={lightSrc} darkSrc={darkSrc} alt={alt} priority={priority} />
      </div>
      <div className="sm:hidden">
        <PhoneScreenshot src={mobileSrc} alt={alt} />
      </div>
    </>
  )
}
