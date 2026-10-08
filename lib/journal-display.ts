/** Same "Edited" rule for the learner list and Shared With Me. */
export function isReflectionEdited(
    createdAt?: string | null,
    reflectionUpdatedAt?: string | null,
): boolean {
    if (!createdAt || !reflectionUpdatedAt) return false
    const created = new Date(createdAt).getTime()
    const updated = new Date(reflectionUpdatedAt).getTime()
    if (Number.isNaN(created) || Number.isNaN(updated)) return false
    return updated - created > 1000
}

export function reflectionTimestamp(createdAt?: string | null, reflectionUpdatedAt?: string | null): string {
    return reflectionUpdatedAt || createdAt || ''
}
