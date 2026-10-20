export const DEFAULT_JOURNEY_NAME = 'New Believer Foundations'

export interface DefaultJourneyCandidate {
  id: string
  name?: string | null
  is_default?: boolean | null
  is_available?: boolean | null
}

/**
 * Pick the default / only-active journey the app uses for new pairings.
 * Prefer is_default, then the New Believer Foundations name, then a single
 * available journey.
 */
export function pickDefaultJourneyId(
  journeys: DefaultJourneyCandidate[] | null | undefined,
): string | null {
  if (!journeys || journeys.length === 0) return null

  const flagged = journeys.find((journey) => journey.is_default)
  if (flagged?.id) return flagged.id

  const named = journeys.find(
    (journey) =>
      (journey.name || '').trim().toLowerCase() === DEFAULT_JOURNEY_NAME.toLowerCase(),
  )
  if (named?.id) return named.id

  const available = journeys.filter((journey) => journey.is_available !== false)
  if (available.length === 1 && available[0]?.id) return available[0].id

  return null
}

export async function fetchDefaultJourneyId(
  supabase: { from: (table: string) => any },
): Promise<string | null> {
  const { data, error } = await supabase
    .from('journeys')
    .select('id, name, is_default, is_available')

  if (error || !data) return null
  return pickDefaultJourneyId(data)
}
