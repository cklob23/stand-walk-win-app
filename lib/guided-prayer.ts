export function hasGuidedPrayerText(guidedPrayer?: string | null): boolean {
    return typeof guidedPrayer === 'string' && guidedPrayer.trim().length > 0
}

export function showGuidedPrayerComingSoon(
    assignmentType: string,
    guidedPrayer?: string | null
): boolean {
    if (hasGuidedPrayerText(guidedPrayer)) return false
    if (assignmentType === 'prayer') return true
    return guidedPrayer === ''
}
