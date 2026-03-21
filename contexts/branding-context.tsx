'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface OrgBranding {
    logoUrl: string | null
    churchName: string | null
    slogan: string | null
    primaryColor: string | null
    secondaryColor: string | null
    organizationName: string | null
}

interface BrandingContextType {
    branding: OrgBranding
    isLoading: boolean
    updateBranding: (updates: Partial<OrgBranding>) => void
}

const defaultBranding: OrgBranding = {
    logoUrl: null,
    churchName: null,
    slogan: null,
    primaryColor: null,
    secondaryColor: null,
    organizationName: null,
}

const BrandingContext = createContext<BrandingContextType>({
    branding: defaultBranding,
    isLoading: true,
    updateBranding: () => { },
})

export function useBranding() {
    return useContext(BrandingContext)
}

interface BrandingProviderProps {
    children: ReactNode
    initialBranding?: OrgBranding | null
}

export function BrandingProvider({ children, initialBranding }: BrandingProviderProps) {
    const [branding, setBranding] = useState<OrgBranding>(initialBranding || defaultBranding)
    const [isLoading, setIsLoading] = useState(!initialBranding)

    useEffect(() => {
        if (initialBranding) {
            setBranding(initialBranding)
            setIsLoading(false)
        }
    }, [initialBranding])

    // Function to update branding in real-time
    const updateBranding = (updates: Partial<OrgBranding>) => {
        setBranding(prev => ({ ...prev, ...updates }))
    }

    // Apply custom colors to CSS variables
    useEffect(() => {
        // Only apply colors if they are valid hex colors
        const isValidHex = (color: string | null) => color && /^#[0-9A-Fa-f]{6}$/.test(color)

        if (isValidHex(branding.primaryColor)) {
            // Use hex color directly - Tailwind v4 CSS variables accept any valid CSS color
            document.documentElement.style.setProperty('--primary', branding.primaryColor!)
            document.documentElement.style.setProperty('--primary-foreground', '#ffffff')
        } else {
            // Reset to default (let globals.css take over)
            document.documentElement.style.removeProperty('--primary')
            document.documentElement.style.removeProperty('--primary-foreground')
        }

        if (isValidHex(branding.secondaryColor)) {
            document.documentElement.style.setProperty('--secondary', branding.secondaryColor!)
            // Set appropriate foreground for secondary (darker text for light backgrounds)
            document.documentElement.style.setProperty('--secondary-foreground', '#1f2937')
        } else {
            document.documentElement.style.removeProperty('--secondary')
            document.documentElement.style.removeProperty('--secondary-foreground')
        }

        // Cleanup on unmount
        return () => {
            document.documentElement.style.removeProperty('--primary')
            document.documentElement.style.removeProperty('--primary-foreground')
            document.documentElement.style.removeProperty('--secondary')
            document.documentElement.style.removeProperty('--secondary-foreground')
        }
    }, [branding.primaryColor, branding.secondaryColor])

    // Apply custom favicon when logo is set
    useEffect(() => {
        if (branding.logoUrl) {
            // Convert pathname to full URL for favicon
            const faviconUrl = branding.logoUrl.startsWith('http') || branding.logoUrl.startsWith('/api/')
                ? branding.logoUrl
                : `/api/logo?pathname=${encodeURIComponent(branding.logoUrl)}`

            // Update favicon
            let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null
            if (!link) {
                link = document.createElement('link')
                link.rel = 'icon'
                document.head.appendChild(link)
            }
            link.href = faviconUrl
        } else {
            // Reset to default favicon
            const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null
            if (link) {
                link.href = '/favicon.ico'
            }
        }
    }, [branding.logoUrl])

    return (
        <BrandingContext.Provider value={{ branding, isLoading, updateBranding }}>
            {children}
        </BrandingContext.Provider>
    )
}

// Helper function to convert hex color to HSL format for CSS variables
function hexToHsl(hex: string): string {
    // Remove # if present
    hex = hex.replace(/^#/, '')

    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16) / 255
    const g = parseInt(hex.substring(2, 4), 16) / 255
    const b = parseInt(hex.substring(4, 6), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    const l = (max + min) / 2

    if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6
                break
            case g:
                h = ((b - r) / d + 2) / 6
                break
            case b:
                h = ((r - g) / d + 4) / 6
                break
        }
    }

    // Return HSL values formatted for CSS (without 'hsl()' wrapper)
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}
