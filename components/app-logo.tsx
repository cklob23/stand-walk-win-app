'use client'

import { cn } from '@/lib/utils'
import Image from 'next/image'
import { useBranding } from '@/contexts/branding-context'

interface AppLogoProps {
  className?: string
  iconClassName?: string
  textClassName?: string
  showText?: boolean
  showSubtitle?: boolean
}

export function AppLogo({
  className,
  iconClassName,
  textClassName,
  showText = true,
  showSubtitle = false
}: AppLogoProps) {
  const { branding } = useBranding()

  // Only show custom name if branding_church_name is set, otherwise show "Stand Walk Run"
  const displayName = branding.churchName || 'Stand Walk Run'
  const hasCustomName = !!branding.churchName

  // Handle private blob pathname - convert to API URL if not already a full URL
  const getLogoSrc = (logoPath: string | null) => {
    if (!logoPath) return null
    if (logoPath.startsWith('http') || logoPath.startsWith('/api/')) return logoPath
    return `/api/logo?pathname=${encodeURIComponent(logoPath)}`
  }
  const logoUrl = getLogoSrc(branding.logoUrl)

  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className={cn("relative overflow-hidden rounded-lg", iconClassName || "h-8 w-8 sm:h-9 sm:w-9")}>
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt={displayName}
            fill
            className="object-contain"
            sizes="(max-width: 640px) 36px, 40px"
          />
        ) : (
          /* Using img tag for better cross-platform hosting compatibility */
          <img
            src="/icon.png"
            alt="Stand Walk Run"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </span>
      {showText && (
        <span className="flex flex-col">
          <span className={cn("font-semibold text-foreground leading-tight", textClassName || "text-sm sm:text-base")}>
            {displayName}
          </span>
          {(showSubtitle && hasCustomName) && (
            <span className="text-xs text-muted-foreground leading-tight">
              Stand Walk Run
            </span>
          )}
        </span>
      )}
    </span>
  )
}

// Static version for use outside of branding context (e.g., auth pages)
export function AppLogoStatic({
  className,
  iconClassName,
  textClassName,
  showText = true
}: Omit<AppLogoProps, 'showSubtitle'>) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className={cn("relative overflow-hidden rounded-lg", iconClassName || "h-8 w-8 sm:h-9 sm:w-9")}>
        {/* Using img tag for better cross-platform hosting compatibility */}
        <img
          src="/icon.png"
          alt="Stand Walk Run"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </span>
      {showText && (
        <span className={cn("font-semibold text-foreground", textClassName || "text-sm sm:text-base")}>
          Stand Walk Run
        </span>
      )}
    </span>
  )
}

export function AppIcon({ iconClassName }: AppLogoProps) {
  const { branding } = useBranding()

  const displayName = branding.churchName || branding.organizationName || 'Stand Walk Run'
  const logoUrl = branding.logoUrl
  return (
    <span className={cn("relative overflow-hidden rounded-sm", iconClassName || "h-8 w-8 sm:h-9 sm:w-9")}>
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={displayName}
          fill
          className="object-contain"
          sizes="(max-width: 640px) 36px, 40px"
        />
      ) : (
        <img
          src="/icon.png"
          alt="Stand Walk Run"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </span>
  )
}
