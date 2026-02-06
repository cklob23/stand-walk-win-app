import { cn } from '@/lib/utils'

interface AppLogoProps {
  className?: string
  iconClassName?: string
  textClassName?: string
  showText?: boolean
}

function CrossIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Vertical beam */}
      <path d="M12 2v20" />
      {/* Horizontal beam - positioned higher for a Christian cross */}
      <path d="M5 7h14" />
      {/* Small path marks for a rugged/wooden feel */}
      <path d="M12 2l-1 1" />
      <path d="M12 2l1 1" />
      {/* Base */}
      <path d="M9 22h6" />
    </svg>
  )
}

export function AppLogo({ className, iconClassName, textClassName, showText = true }: AppLogoProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className={cn("flex items-center justify-center rounded-lg bg-primary", iconClassName || "h-8 w-8 sm:h-9 sm:w-9")}>
        <CrossIcon className={cn("text-primary-foreground", getIconSize(iconClassName))} />
      </span>
      {showText && (
        <span className={cn("font-semibold text-foreground", textClassName || "text-sm sm:text-base")}>
          Stand Walk Run
        </span>
      )}
    </span>
  )
}

function getIconSize(containerClass?: string): string {
  if (!containerClass) return "h-4 w-4 sm:h-5 sm:w-5"
  if (containerClass.includes('h-10') || containerClass.includes('h-9')) return "h-5 w-5 sm:h-6 sm:w-6"
  if (containerClass.includes('h-14') || containerClass.includes('h-12')) return "h-7 w-7 sm:h-8 sm:w-8"
  if (containerClass.includes('h-7') || containerClass.includes('h-8')) return "h-3.5 w-3.5 sm:h-4 sm:w-4"
  return "h-4 w-4 sm:h-5 sm:w-5"
}
