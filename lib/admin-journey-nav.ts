export const JOURNEY_HOME_HREF = '/dashboard'
export const ADMIN_HOME_HREF = '/admin/dashboard'
export const BACK_TO_JOURNEY_LABEL = 'Back to Journey'

/**
 * Journey app roles live on profiles.role. Admin portal roles are separate
 * (admin_role / org ownership). Only leaders and learners have a journey home.
 */
export function hasJourneyRole(role: string | null | undefined): boolean {
    return role === 'leader' || role === 'learner'
}

/**
 * Leader and learner dashboards share /dashboard. That page picks the view
 * from the signed-in profile role.
 */
export function getJourneyHomeHref(role: string | null | undefined): string | null {
    return hasJourneyRole(role) ? JOURNEY_HOME_HREF : null
}

/** Logo returns to the journey when the admin is also on one; otherwise stay in admin. */
export function getAdminLogoHref(role: string | null | undefined): string {
    return getJourneyHomeHref(role) ?? ADMIN_HOME_HREF
}
