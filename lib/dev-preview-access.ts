/**
 * Local-only screenshot harnesses.
 * Production must 404 these routes and must never skip auth for them or for any
 * real app path.
 */

export const DAILY_PRAYER_PREVIEW_PATH = '/dev/daily-prayer-preview'
export const ADMIN_SHELL_PREVIEW_PATH = '/dev/admin-shell-preview'

const DEV_PREVIEW_PATHS = [DAILY_PRAYER_PREVIEW_PATH, ADMIN_SHELL_PREVIEW_PATH]

function matchesPreviewPath(pathname: string, path: string): boolean {
    return pathname === path || pathname.startsWith(`${path}/`)
}

export function isDailyPrayerPreviewPath(pathname: string): boolean {
    return matchesPreviewPath(pathname, DAILY_PRAYER_PREVIEW_PATH)
}

export function isAdminShellPreviewPath(pathname: string): boolean {
    return matchesPreviewPath(pathname, ADMIN_SHELL_PREVIEW_PATH)
}

export function isDevPreviewPath(pathname: string): boolean {
    return DEV_PREVIEW_PATHS.some((path) => matchesPreviewPath(pathname, path))
}

export function isProductionEnv(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
    return nodeEnv === 'production'
}

/** True only for local preview paths outside production. Real routes never match. */
export function shouldBypassAuthForDevPreview(
    pathname: string,
    nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
    return !isProductionEnv(nodeEnv) && isDevPreviewPath(pathname)
}

export function shouldNotFoundDevPreview(
    pathname: string,
    nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
    return isProductionEnv(nodeEnv) && isDevPreviewPath(pathname)
}
