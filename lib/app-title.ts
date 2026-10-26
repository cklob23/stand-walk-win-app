import { SITE_NAME } from './home-content.ts'

export { SITE_NAME }

export function getAppTitleParts(churchName: string | null | undefined): {
    title: string
    subtitle: string | null
} {
    const name = (churchName || '').trim()
    if (name) {
        return { title: name, subtitle: SITE_NAME }
    }
    return { title: SITE_NAME, subtitle: null }
}
