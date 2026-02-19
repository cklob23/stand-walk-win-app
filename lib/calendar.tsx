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
    const vercelUrl = process.env.NEXT_PUBLIC_SITE_URL
    if (vercelUrl) return vercelUrl
    return 'https://stand-walk-run.onrender.com'
}

function buildScheduleLink(): string {
    return `${getAppUrl()}/dashboard/schedule`
}

// Google Calendar supports HTML <a href> tags in the "details" parameter.
function buildGoogleDescription(meeting: ScheduledMeeting, partnerName: string, options?: CalendarOptions): string {
    const typeLabel = MEETING_TYPE_LABELS[meeting.meeting_type] || 'Meeting'
    const scheduleLink = buildScheduleLink()
    const lines: string[] = []

    lines.push(`${typeLabel} Meeting with ${partnerName}`)

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
        lines.push(`Join FaceTime from your iPhone or from the meeting entry in the app.`)
        lines.push(`<a href="${scheduleLink}">Open Stand Walk Run</a>`)
        lines.push(`${partnerName}'s Cell: ${options?.partnerPhone}`)
    }

    if (meeting.meeting_type === 'phone') {
        lines.push(`Join the call from the meeting entry in the app or your mobile device.`)
        lines.push(`<a href="${scheduleLink}">Open Stand Walk Run</a>`)
        lines.push(`${partnerName}'s Cell: ${options?.partnerPhone}`)
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

    lines.push(`${typeLabel} Meeting with ${partnerName}`)

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
        lines.push(`Join FaceTime from your iPhone or from the meeting entry in the app.`)
        lines.push(`Open Stand Walk Run: ${scheduleLink}`)
        lines.push(`${partnerName}'s Cell: ${options?.partnerPhone}`)
    }

    if (meeting.meeting_type === 'phone') {
        lines.push(`Join the call from the meeting entry in the app or your mobile device.`)
        lines.push(`Open Stand Walk Run: ${scheduleLink}`)
        lines.push(`${partnerName}'s Cell: ${options?.partnerPhone}`)
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

export function downloadICSFile(meeting: ScheduledMeeting, partnerName: string, options?: CalendarOptions): void {
    const { startDT, endDT } = buildDateTimes(meeting)
    const title = buildTitle(partnerName)
    const description = buildICSDescription(meeting, partnerName, options).replace(/\n/g, '\\n')
    const uid = `swr-meeting-${meeting.id}@standwalkrun.com`

    // Determine a URL for the ICS URL field (gives Outlook/Apple a dedicated "Join" button)
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

    const icsContent = icsLines.join('\r\n')

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `meeting-${meeting.meeting_date}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
