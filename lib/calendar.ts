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

function buildTitle(meeting: ScheduledMeeting, partnerName: string): string {
    const typeLabel = MEETING_TYPE_LABELS[meeting.meeting_type] || 'Meeting'
    return `Stand Walk Run - ${typeLabel} with ${partnerName}`
}

function buildDescription(meeting: ScheduledMeeting, partnerName: string, partnerPhone?: string | null): string {
    const typeLabel = MEETING_TYPE_LABELS[meeting.meeting_type] || 'Meeting'
    const lines = [`${typeLabel} meeting with ${partnerName}`]

    if (meeting.meeting_type === 'zoom' && meeting.meeting_link) {
        lines.push(`Join Zoom: ${meeting.meeting_link}`)
    }

    if (meeting.meeting_type === 'facetime' && partnerPhone) {
        const cleaned = partnerPhone.replace(/[^0-9+]/g, '')
        lines.push(`FaceTime: facetime:${cleaned}`)
        lines.push(`Phone: ${partnerPhone}`)
    }

    if (meeting.meeting_type === 'phone' && partnerPhone) {
        const cleaned = partnerPhone.replace(/[^0-9+]/g, '')
        lines.push(`Call: tel:${cleaned}`)
        lines.push(`Phone: ${partnerPhone}`)
    }

    // For non-phone/facetime meetings, still include a generic meeting_link if present
    if (meeting.meeting_link && meeting.meeting_type !== 'zoom' && meeting.meeting_type !== 'facetime' && meeting.meeting_type !== 'phone') {
        lines.push(`Link: ${meeting.meeting_link}`)
    }

    if (meeting.notes) {
        lines.push(`Notes: ${meeting.notes}`)
    }
    return lines.join('\n')
}

export function getGoogleCalendarUrl(meeting: ScheduledMeeting, partnerName: string, partnerPhone?: string | null): string {
    const { startDT, endDT } = buildDateTimes(meeting)
    const title = buildTitle(meeting, partnerName)
    const description = buildDescription(meeting, partnerName, partnerPhone)

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${formatGoogleDate(startDT)}/${formatGoogleDate(endDT)}`,
        details: description,
    })

    return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function downloadICSFile(meeting: ScheduledMeeting, partnerName: string, partnerPhone?: string | null): void {
    const { startDT, endDT } = buildDateTimes(meeting)
    const title = buildTitle(meeting, partnerName)
    const description = buildDescription(meeting, partnerName, partnerPhone).replace(/\n/g, '\\n')
    const uid = `swr-meeting-${meeting.id}@standwalkrun.com`

    const icsContent = [
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
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n')

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
