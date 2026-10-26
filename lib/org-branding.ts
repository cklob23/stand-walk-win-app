export interface OrgBranding {
    logoUrl: string | null
    churchName: string | null
    slogan: string | null
    primaryColor: string | null
    secondaryColor: string | null
    organizationName: string | null
}

export const DEFAULT_ORG_BRANDING: OrgBranding = {
    logoUrl: null,
    churchName: null,
    slogan: null,
    primaryColor: null,
    secondaryColor: null,
    organizationName: null,
}

export interface OrganizationBrandingSource {
    name?: string | null
    branding_logo_url?: string | null
    branding_church_name?: string | null
    branding_slogan?: string | null
    branding_primary_color?: string | null
    branding_secondary_color?: string | null
}

export function brandingFromOrganization(
    organization: OrganizationBrandingSource | null | undefined,
): OrgBranding | null {
    if (!organization) return null
    return {
        logoUrl: organization.branding_logo_url ?? null,
        churchName: organization.branding_church_name ?? null,
        slogan: organization.branding_slogan ?? null,
        primaryColor: organization.branding_primary_color ?? null,
        secondaryColor: organization.branding_secondary_color ?? null,
        organizationName: organization.name ?? null,
    }
}
