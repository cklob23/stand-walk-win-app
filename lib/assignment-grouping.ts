import type { Assignment } from './types'

/**
 * Represents a logical assignment that may consist of multiple questions.
 * When multiple SQL rows share the same (week_number, title, assignment_type),
 * they are merged into one group. The "primary" row (lowest order_index) is used
 * for progress tracking; the others become additional questions rendered with their
 * own scripture/Read buttons but sharing a single response textarea.
 */
export interface GroupedAssignment extends Assignment {
    /**
     * Descriptions of additional question rows that share this assignment's
     * title, week, and type. The primary description is still on `description`.
     */
    additionalQuestions: { id: string; description: string }[]
}

/**
 * Group assignments by (week_number, title, assignment_type).
 * Within a group, the row with the lowest order_index is the primary;
 * all other rows' descriptions are attached as additionalQuestions.
 *
 * Order within and across groups is preserved by order_index (then created_at).
 */
export function groupAssignments(assignments: Assignment[]): GroupedAssignment[] {
    // Sort once by week, then order_index
    const sorted = [...assignments].sort((a, b) => {
        if (a.week_number !== b.week_number) return a.week_number - b.week_number
        return a.order_index - b.order_index
    })

    const groupMap = new Map<string, GroupedAssignment>()
    const orderedKeys: string[] = []

    for (const a of sorted) {
        // Normalize the key so trivial whitespace/casing differences in title
        // (e.g. from manual SQL inserts) don't break grouping.
        const normalizedTitle = (a.title ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
        const key = `${a.week_number}::${a.assignment_type}::${normalizedTitle}`
        const existing = groupMap.get(key)
        if (!existing) {
            groupMap.set(key, { ...a, additionalQuestions: [] })
            orderedKeys.push(key)
        } else {
            existing.additionalQuestions.push({ id: a.id, description: a.description })
        }
    }

    return orderedKeys.map(k => groupMap.get(k)!)
}

/**
 * Get all assignment IDs that belong to a grouped assignment (primary + additional).
 * Useful when you need to check progress that may have been recorded against any of the rows.
 */
export function getAllIdsForGroup(group: GroupedAssignment): string[] {
    return [group.id, ...group.additionalQuestions.map(q => q.id)]
}
