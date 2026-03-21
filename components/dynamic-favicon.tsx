'use client'

import { useEffect } from 'react'
import { useBranding } from '@/contexts/branding-context'

/**
 * Dynamically updates the favicon based on organization branding.
 * Falls back to default Stand Walk Run favicon if no custom logo is set.
 */
export function DynamicFavicon() {
    const { branding } = useBranding()

    useEffect(() => {
        // Only run on client
        if (typeof window === 'undefined') return

        const faviconUrl = branding.logoUrl
        console.log('[v0] DynamicFavicon - logoUrl:', faviconUrl)

        // Get existing favicon link elements
        const existingIcons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')

        if (faviconUrl) {
            // Use custom org logo as favicon
            console.log('[v0] DynamicFavicon - Setting custom favicon:', faviconUrl)
            // Remove existing favicons
            existingIcons.forEach(icon => icon.remove())

            // Create new favicon link
            const link = document.createElement('link')
            link.rel = 'icon'
            link.type = 'image/png'
            link.href = faviconUrl
            document.head.appendChild(link)

            // Also update apple-touch-icon if it exists
            const appleIcon = document.querySelector('link[rel="apple-touch-icon"]')
            if (appleIcon) {
                appleIcon.setAttribute('href', faviconUrl)
            }
        } else {
            // Restore default favicons - remove any custom ones first
            const customIcon = document.querySelector('link[rel="icon"][data-custom="true"]')
            if (customIcon) {
                customIcon.remove()
            }

            // Check if default icons exist, if not add them back
            const hasDefaultIcon = document.querySelector('link[rel="icon"][href*="icon-light"], link[rel="icon"][href*="icon.svg"]')
            if (!hasDefaultIcon) {
                // Re-add default icons
                const defaultIcons = [
                    { rel: 'icon', href: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
                    { rel: 'icon', href: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
                    { rel: 'icon', href: '/icon.png', type: 'image/png' },
                ]

                defaultIcons.forEach(iconConfig => {
                    const link = document.createElement('link')
                    link.rel = iconConfig.rel
                    link.href = iconConfig.href
                    if (iconConfig.media) link.media = iconConfig.media
                    if (iconConfig.type) link.type = iconConfig.type
                    document.head.appendChild(link)
                })
            }
        }
    }, [branding.logoUrl])

    // This component doesn't render anything
    return null
}
