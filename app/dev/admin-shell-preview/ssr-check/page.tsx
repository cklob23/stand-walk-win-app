import { BrandingProvider } from '@/contexts/branding-context'
import { brandingFromOrganization } from '@/lib/org-branding'

/**
 * Server-only smoke page that uses the same import pattern as
 * app/admin/dashboard/layout.tsx. A 500 here means brandingFromOrganization
 * leaked back onto a use client module.
 */
export default function AdminBrandingSsrCheckPage() {
    const branding = brandingFromOrganization({
        name: '101 Church',
        branding_church_name: '101 Church',
        branding_slogan: 'Church for everyday people.',
    })

    return (
        <BrandingProvider initialBranding={branding}>
            <main>
                <p data-ssr-branding="ok">{branding?.churchName}</p>
            </main>
        </BrandingProvider>
    )
}
