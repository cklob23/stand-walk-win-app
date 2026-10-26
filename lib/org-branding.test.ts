import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brandingFromOrganization, DEFAULT_ORG_BRANDING } from './org-branding.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('org branding', () => {
    it('lives in a server-safe module with no use client directive', () => {
        const source = readFileSync(join(here, 'org-branding.ts'), 'utf8')
        assert.equal(source.includes("'use client'"), false)
        assert.equal(source.includes('"use client"'), false)
    })

    it('maps organization branding fields and the org name', () => {
        assert.deepEqual(
            brandingFromOrganization({
                name: '101 Church',
                branding_logo_url: '/logos/101.png',
                branding_church_name: '101 Church',
                branding_slogan: 'Church for everyday people.',
                branding_primary_color: '#123456',
                branding_secondary_color: '#abcdef',
            }),
            {
                logoUrl: '/logos/101.png',
                churchName: '101 Church',
                slogan: 'Church for everyday people.',
                primaryColor: '#123456',
                secondaryColor: '#abcdef',
                organizationName: '101 Church',
            },
        )
    })

    it('keeps organizationName when church name is unset', () => {
        assert.deepEqual(
            brandingFromOrganization({
                name: '101 Church',
                branding_church_name: null,
            }),
            {
                ...DEFAULT_ORG_BRANDING,
                organizationName: '101 Church',
            },
        )
    })

    it('returns null when there is no organization', () => {
        assert.equal(brandingFromOrganization(null), null)
        assert.equal(brandingFromOrganization(undefined), null)
    })
})

describe('admin layout branding import', () => {
    it('does not call brandingFromOrganization from a use client module', () => {
        const layout = readFileSync(join(here, '..', 'app', 'admin', 'dashboard', 'layout.tsx'), 'utf8')
        assert.match(layout, /from ['"]@\/lib\/org-branding['"]/)
        assert.equal(/brandingFromOrganization[\s\S]*from ['"]@\/contexts\/branding-context['"]/.test(layout), false)
    })
})

describe('admin header overflow', () => {
    it('lets a long org title shrink and keeps the avatar on screen', () => {
        const header = readFileSync(join(here, '..', 'components', 'admin', 'admin-header.tsx'), 'utf8')
        assert.match(header, /flex min-w-0 flex-1 items-center/)
        assert.match(header, /flex shrink-0 items-center gap-4/)
        assert.equal(header.includes('organization.name'), false)
    })
})
