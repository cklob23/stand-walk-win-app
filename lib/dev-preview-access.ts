/**
 * Local-only screenshot harness for Today's prayer.
 * Production must 404 the route and must never skip auth for it or for any
 * real app path.
 */

export const DAILY_PRAYER_PREVIEW_PATH = '/dev/daily-prayer-preview'

export function isDailyPrayerPreviewPath(pathname: string): boolean {
    return (
        pathname === DAILY_PRAYER_PREVIEW_PATH
        || pathname.startsWith(`${DAILY_PRAYER_PREVIEW_PATH}/`)
    )
}

export function isProductionEnv(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
    return nodeEnv === 'production'
}

/** True only for the local preview path outside production. Real routes never match. */
export function shouldBypassAuthForDevPreview(
    pathname: string,
    nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
    return !isProductionEnv(nodeEnv) && isDailyPrayerPreviewPath(pathname)
}

export function shouldNotFoundDevPreview(
    pathname: string,
    nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
    return isProductionEnv(nodeEnv) && isDailyPrayerPreviewPath(pathname)
}
