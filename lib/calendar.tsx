import type { ScheduledMeeting } from '@/lib/types'

const MEETING_TYPE_LABELS: Record<string, string> = {
    facetime: 'FaceTime',
    zoom: 'Zoom',
    phone: 'Phone Call',
    in_person: 'In Person',
}

function buildDateTimes(meeting: ScheduledMeeting) {
    // meeting_date is "YYYY-MM-DD", start_time/end_time are "HH:MM:SS" or "HH:MM"
    const date = meeting.meeting_date
    const start = meeting.start_time.slice(0, 5) // "HH:MM"
    const end = meeting.end_time.slice(0, 5)

    const startDT = new Date(`${date}T${start}:00`)
    const endDT = new Date(`${date}T${end}:00`)

    return { startDT, endDT }
}

function formatICSDate(date: Date): string {
    // Format as YYYYMMDDTHHmmss (local time, no Z suffix)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return (
        date.getFullYear().toString() +
        pad(date.getMonth() + 1) +
        pad(date.getDate()) +
        'T' +
        pad(date.getHours()) +
        pad(date.getMinutes()) +
        pad(date.getSeconds())
    )
}

function formatGoogleDate(date: Date): string {
    // Google Calendar uses UTC format: YYYYMMDDTHHmmssZ
    const pad = (n: number) => n.toString().padStart(2, '0')
    return (
        date.getUTCFullYear().toString() +
        pad(date.getUTCMonth() + 1) +
        pad(date.getUTCDate()) +
        'T' +
        pad(date.getUTCHours()) +
        pad(date.getUTCMinutes()) +
        pad(date.getUTCSeconds()) +
        'Z'
    )
}

interface CalendarOptions {
    partnerPhone?: string | null
    weekTopic?: string | null
    weekNumber?: number | null
}

function buildTitle(partnerName: string): string {
    return `Stand Walk Run - Meeting with ${partnerName}`
}

function getAppUrl(): string {
    if (typeof window !== 'undefined') return window.location.origin
    const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL
    if (vercelUrl) return `https://${vercelUrl}`
    return 'https://standwalkrun.com'
}

function buildScheduleLink(): string {
    return `${getAppUrl()}/dashboard/schedule`
}

// Google Calendar supports HTML <a href> tags in the "details" parameter.
function buildGoogleDescription(meeting: ScheduledMeeting, partnerName: string, options?: CalendarOptions): string {
    const typeLabel = MEETING_TYPE_LABELS[meeting.meeting_type] || 'Meeting'
    const scheduleLink = buildScheduleLink()
    const lines: string[] = []

    lines.push(`${typeLabel} with ${partnerName}`)

    if (options?.weekNumber && options?.weekTopic) {
        lines.push(`Week ${options.weekNumber}: ${options.weekTopic}`)
    } else if (options?.weekNumber) {
        lines.push(`Week ${options.weekNumber}`)
    } else if (options?.weekTopic) {
        lines.push(`Topic: ${options.weekTopic}`)
    }

    lines.push('')

    if (meeting.meeting_type === 'zoom' && meeting.meeting_link) {
        lines.push(`<a href="${meeting.meeting_link}">Join Zoom Meeting</a>`)
    }

    if (meeting.meeting_type === 'facetime') {
        if (options?.partnerPhone) {
            const cleaned = options.partnerPhone.replace(/[^+\d]/g, '')
            lines.push(`<a href="facetime:${cleaned}">FaceTime Video</a>`)
            lines.push(`<a href="facetime-audio:${cleaned}">FaceTime Audio</a>`)
        }
        lines.push(`<a href="${scheduleLink}">Open Stand Walk Run</a>`)
    }

    if (meeting.meeting_type === 'phone') {
        if (options?.partnerPhone) {
            const cleaned = options.partnerPhone.replace(/[^+\d]/g, '')
            lines.push(`<a href="tel:${cleaned}">Call ${partnerName}</a>`)
        }
        lines.push(`<a href="${scheduleLink}">Open Stand Walk Run</a>`)
    }

    if (meeting.meeting_type === 'in_person') {
        lines.push('In Person Meeting')
    }

    if (meeting.meeting_link && meeting.meeting_type !== 'zoom' && meeting.meeting_type !== 'facetime' && meeting.meeting_type !== 'phone') {
        lines.push(`<a href="${meeting.meeting_link}">Join Meeting</a>`)
    }

    if (meeting.notes) {
        lines.push('')
        lines.push(`Notes: ${meeting.notes}`)
    }

    return lines.join('\n')
}

// ICS / Outlook / Apple Calendar - plain text with URLs on their own line.
function buildICSDescription(meeting: ScheduledMeeting, partnerName: string, options?: CalendarOptions): string {
    const typeLabel = MEETING_TYPE_LABELS[meeting.meeting_type] || 'Meeting'
    const scheduleLink = buildScheduleLink()
    const lines: string[] = []

    lines.push(`${typeLabel} with ${partnerName}`)

    if (options?.weekNumber && options?.weekTopic) {
        lines.push(`Week ${options.weekNumber}: ${options.weekTopic}`)
    } else if (options?.weekNumber) {
        lines.push(`Week ${options.weekNumber}`)
    } else if (options?.weekTopic) {
        lines.push(`Topic: ${options.weekTopic}`)
    }

    lines.push('')

    if (meeting.meeting_type === 'zoom' && meeting.meeting_link) {
        lines.push(`Join Zoom Meeting:`)
        lines.push(meeting.meeting_link)
    }

    if (meeting.meeting_type === 'facetime') {
        if (options?.partnerPhone) {
            const cleaned = options.partnerPhone.replace(/[^+\d]/g, '')
            lines.push(`FaceTime Video: facetime:${cleaned}`)
            lines.push(`FaceTime Audio: facetime-audio:${cleaned}`)
            lines.push('')
        }
        lines.push(`Or join from the app:`)
        lines.push(scheduleLink)
    }

    if (meeting.meeting_type === 'phone') {
        if (options?.partnerPhone) {
            const cleaned = options.partnerPhone.replace(/[^+\d]/g, '')
            lines.push(`Call: tel:${cleaned}`)
            lines.push('')
        }
        lines.push(`Or join from the app:`)
        lines.push(scheduleLink)
    }

    if (meeting.meeting_type === 'in_person') {
        lines.push('In Person Meeting')
    }

    if (meeting.meeting_link && meeting.meeting_type !== 'zoom' && meeting.meeting_type !== 'facetime' && meeting.meeting_type !== 'phone') {
        lines.push(`Meeting Link:`)
        lines.push(meeting.meeting_link)
    }

    if (meeting.notes) {
        lines.push('')
        lines.push(`Notes: ${meeting.notes}`)
    }

    return lines.join('\n')
}

export function getGoogleCalendarUrl(meeting: ScheduledMeeting, partnerName: string, options?: CalendarOptions): string {
    const { startDT, endDT } = buildDateTimes(meeting)
    const title = buildTitle(partnerName)
    const description = buildGoogleDescription(meeting, partnerName, options)

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${formatGoogleDate(startDT)}/${formatGoogleDate(endDT)}`,
        details: description,
    })

    return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function buildICSContent(meeting: ScheduledMeeting, partnerName: string, options?: CalendarOptions): string {
    const { startDT, endDT } = buildDateTimes(meeting)
    const title = buildTitle(partnerName)
    const description = buildICSDescription(meeting, partnerName, options).replace(/\n/g, '\\n')
    const uid = `swr-meeting-${meeting.id}@standwalkrun.com`

    let meetingUrl = ''
    if (meeting.meeting_type === 'zoom' && meeting.meeting_link) {
        meetingUrl = meeting.meeting_link
    } else if (meeting.meeting_type === 'phone' || meeting.meeting_type === 'facetime') {
        meetingUrl = buildScheduleLink()
    } else if (meeting.meeting_link) {
        meetingUrl = meeting.meeting_link
    }

    const icsLines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Stand Walk Run//Meeting//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTART:${formatICSDate(startDT)}`,
        `DTEND:${formatICSDate(endDT)}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${description}`,
        `STATUS:CONFIRMED`,
    ]

    if (meetingUrl) {
        icsLines.push(`URL:${meetingUrl}`)
    }

    icsLines.push('END:VEVENT', 'END:VCALENDAR')

    return icsLines.join('\r\n')
}

export async function downloadICSFile(meeting: ScheduledMeeting, partnerName: string, options?: CalendarOptions): Promise<void> {
    const icsContent = buildICSContent(meeting, partnerName, options)
    const fileName = `meeting-${meeting.meeting_date}.ics`
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const file = new File([blob], fileName, { type: 'text/calendar' })

    // Use Web Share API if available (iOS/macOS Safari, some Android browsers)
    // This lets the OS handle the .ics file natively -- on Apple devices it
    // opens the "Add to Calendar" sheet directly instead of downloading a file.
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: `Stand Walk Run - Meeting`,
            })
            return
        } catch (err: unknown) {
            // User cancelled the share sheet -- that's fine, fall through to download
            if (err instanceof Error && err.name === 'AbortError') return
            // For any other error, fall through to download
        }
    }

    // Fallback: traditional download
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
