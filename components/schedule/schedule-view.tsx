'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FeatureTour } from '@/components/onboarding/feature-tour'
import { scheduleSteps } from '@/lib/tour-steps'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer'
import { useIsMobile } from '@/hooks/use-mobile'
import { AddToCalendarButton } from '@/components/add-to-calendar-button'
import {
    Calendar,
    Clock,
    Plus,
    Trash2,
    Video,
    Phone,
    MapPin,
    Monitor,
    Loader2,
    X,
    CheckCircle2,
    XCircle,
    Link as LinkIcon,
    ArrowLeft,
    Pencil,
    AlertCircle,
    Check,
    MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { saveAvailability, bookMeeting, cancelMeeting, completeMeeting, updateMeeting, updateMeetingLink, updateContactInfo, acceptMeeting, declineMeeting, proposeNewTime } from '@/lib/scheduling-actions'
import type { Profile, Pairing, AvailabilitySlot, ScheduledMeeting } from '@/lib/types'
import Link from 'next/link'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MEETING_TYPE_CONFIG = {
    facetime: { label: 'FaceTime', icon: Video, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    zoom: { label: 'Zoom', icon: Monitor, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    phone: { label: 'Phone', icon: Phone, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    in_person: { label: 'In Person', icon: MapPin, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
}

// Generate time options from 6AM to 10PM in 30-min increments
function generateTimeOptions() {
    const options: string[] = []
    for (let h = 6; h <= 22; h++) {
        for (const m of ['00', '30']) {
            if (h === 22 && m === '30') continue
            options.push(`${h.toString().padStart(2, '0')}:${m}`)
        }
    }
    return options
}

function formatTime(time: string) {
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function formatDate(dateStr: string) {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Get dates for the next 2 weeks for a given day_of_week
function getUpcomingDatesForDay(dayOfWeek: number, weeksAhead: number = 2): string[] {
    const dates: string[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = 0; i < weeksAhead * 7; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        if (d.getDay() === dayOfWeek) {
            dates.push(d.toISOString().split('T')[0])
        }
    }
    return dates
}

const TIME_OPTIONS = generateTimeOptions()

// Break an availability slot into 1-hour sub-slots
function getHourSlots(startTime: string, endTime: string): { start: string; end: string }[] {
    const slots: { start: string; end: string }[] = []
    const [startH, startM] = startTime.split(':').map(Number)
    const [endH, endM] = endTime.split(':').map(Number)
    const startMins = startH * 60 + startM
    const endMins = endH * 60 + endM

    for (let m = startMins; m + 60 <= endMins; m += 60) {
        const sH = Math.floor(m / 60).toString().padStart(2, '0')
        const sM = (m % 60).toString().padStart(2, '0')
        const eH = Math.floor((m + 60) / 60).toString().padStart(2, '0')
        const eM = ((m + 60) % 60).toString().padStart(2, '0')
        slots.push({ start: `${sH}:${sM}`, end: `${eH}:${eM}` })
    }
    return slots
}

interface ScheduleViewProps {
    profile: Profile
    pairing: Pairing
    partner: Profile | null
    availabilitySlots: AvailabilitySlot[]
    upcomingMeetings: ScheduledMeeting[]
    pendingMeetings: ScheduledMeeting[]
    pastMeetings: ScheduledMeeting[]
    weekTopic?: string | null
    weekNumber?: number | null
    initialNotes?: string | null
}

// Helper to build a callable link from a phone number and meeting type
function buildCallLink(phone: string, type: 'facetime' | 'phone'): string {
    const cleaned = phone.replace(/[^0-9+]/g, '')
    return type === 'facetime' ? `facetime:${cleaned}` : `tel:${cleaned}`
}

// Helper to extract a displayable phone number from a meeting link
function extractPhoneFromLink(link: string | null): string | null {
    if (!link) return null
    const match = link.match(/^(?:tel:|facetime:)(.+)$/)
    return match ? match[1] : null
}

// Helper to format a phone number for display
function formatPhone(phone: string): string {
    const digits = phone.replace(/[^0-9]/g, '')
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    }
    if (digits.length === 11 && digits[0] === '1') {
        return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    }
    return phone
}

// Get the appropriate action label and href for a meeting
function getMeetingAction(meeting: ScheduledMeeting, partnerPhone?: string | null, partnerZoomLink?: string | null): { href: string; label: string; phoneDisplay?: string } | null {
    const type = meeting.meeting_type

    if (type === 'facetime' || type === 'phone') {
        // Always use the partner's phone so each viewer calls the other person
        if (partnerPhone) {
            return {
                href: buildCallLink(partnerPhone, type),
                label: type === 'facetime' ? 'FaceTime' : 'Call',
                phoneDisplay: partnerPhone,
            }
        }
        return null
    }

    if (type === 'zoom') {
        // Use meeting_link if set, otherwise fall back to partner's zoom link
        if (meeting.meeting_link) {
            return { href: meeting.meeting_link, label: 'Join Zoom' }
        }
        if (partnerZoomLink) {
            return { href: partnerZoomLink, label: 'Join Zoom' }
        }
        return null
    }

    // in_person
    if (meeting.meeting_link) {
        return { href: meeting.meeting_link, label: 'Details' }
    }
    return null
}

export function ScheduleView({
    profile,
    pairing,
    partner,
    availabilitySlots: initialSlots,
    upcomingMeetings,
    pendingMeetings,
    pastMeetings,
    weekTopic,
    weekNumber,
    initialNotes,
}: ScheduleViewProps) {
    const router = useRouter()
    const isLeader = profile.role === 'leader'

    return (
        <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Link href="/dashboard">
                    <Button variant="ghost" size="icon" className="shrink-0">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
                    <p className="text-sm text-muted-foreground">
                        {isLeader
                            ? 'Set your availability and manage meetings'
                            : `Book a meeting with ${partner?.full_name || 'your leader'}`}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main area */}
                <div data-tour="schedule-main" className="lg:col-span-2 space-y-6">
                    {/* Contact Info Card -- for both roles */}
                    <ContactInfoCard
                        profile={profile}
                        isLeader={isLeader}
                        partnerName={partner?.full_name || 'Partner'}
                    />

                    {isLeader ? (
                        <AvailabilityEditor
                            pairingId={pairing.id}
                            initialSlots={initialSlots}
                        />
                    ) : (
                        <BookingView
                            pairingId={pairing.id}
                            availabilitySlots={initialSlots}
                            upcomingMeetings={upcomingMeetings}
                            pastMeetings={pastMeetings}
                            leaderName={partner?.full_name || 'Leader'}
                            leaderPhone={partner?.phone || null}
                            leaderZoomLink={partner?.zoom_link || null}
                            initialNotes={initialNotes}
                        />
                    )}
                </div>

                {/* Sidebar */}
                <div data-tour="schedule-upcoming" className="space-y-6">
                    {/* Pending Meeting Requests */}
                    {pendingMeetings.length > 0 && (
                        <PendingMeetings
                            meetings={pendingMeetings}
                            profile={profile}
                            partner={partner}
                            pairingId={pairing.id}
                            availabilitySlots={initialSlots}
                        />
                    )}
                    <UpcomingMeetings
                        meetings={upcomingMeetings}
                        profile={profile}
                        partnerName={partner?.full_name || 'Partner'}
                        partnerPhone={partner?.phone || null}
                        partnerZoomLink={partner?.zoom_link || null}
                        availabilitySlots={initialSlots}
                        weekTopic={weekTopic}
                        weekNumber={weekNumber}
                    />
                    <PastMeetings
                        meetings={pastMeetings}
                        partnerName={partner?.full_name || 'Partner'}
                    />
                </div>
            </div>

            {/* Onboarding Tour */}
            <FeatureTour tourId="schedule" steps={scheduleSteps} />
        </div>
    )
}

// ========================
// Contact Info Card (both roles)
// ========================
function ContactInfoCard({
    profile,
    isLeader,
    partnerName,
}: {
    profile: Profile
    isLeader: boolean
    partnerName: string
}) {
    const router = useRouter()
    const [phone, setPhone] = useState(profile.phone || '')
    const [zoomLink, setZoomLink] = useState(profile.zoom_link || '')
    const [isSaving, setIsSaving] = useState(false)
    const [isEditing, setIsEditing] = useState(false)

    const hasPhone = !!profile.phone
    const hasZoom = !!profile.zoom_link

    // Auto-show edit mode if leader has neither phone nor zoom
    const needsSetup = isLeader && !hasPhone && !hasZoom

    if (!needsSetup && !isEditing && hasPhone) {
        // Compact display mode
        return (
            <Card>
                <CardContent className="py-1">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-wrap">
                            {profile.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-foreground">{formatPhone(profile.phone)}</span>
                                </div>
                            )}
                            {profile.zoom_link && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Monitor className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-foreground truncate max-w-[200px]">{profile.zoom_link}</span>
                                </div>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsEditing(true)}
                            className="text-xs text-muted-foreground"
                        >
                            Edit
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    const handleSave = async () => {
        setIsSaving(true)
        const result = await updateContactInfo({
            phone: phone.trim(),
            zoomLink: zoomLink.trim(),
        })
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Contact info updated!')
            setIsEditing(false)
            router.refresh()
        }
        setIsSaving(false)
    }

    return (
        <Card className={needsSetup ? 'border-primary/30 bg-primary/5' : ''}>
            <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    {isLeader ? 'Your Contact Info' : 'Your Phone Number'}
                </CardTitle>
                <CardDescription>
                    {isLeader
                        ? `${partnerName} will use this to call or join your meetings.`
                        : `Your leader will use this to reach you for calls and FaceTime.`}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="contact-phone">Phone Number</Label>
                    <Input
                        id="contact-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Enter your phone number..."
                        type="tel"
                    />
                    <p className="text-xs text-muted-foreground">
                        Used for phone calls and FaceTime meetings.
                    </p>
                </div>

                {isLeader && (
                    <div className="space-y-2">
                        <Label htmlFor="contact-zoom">Zoom Meeting Link</Label>
                        <Input
                            id="contact-zoom"
                            value={zoomLink}
                            onChange={(e) => setZoomLink(e.target.value)}
                            placeholder="https://zoom.us/j/..."
                        />
                        <p className="text-xs text-muted-foreground">
                            Your personal Zoom link for video meetings.
                        </p>
                    </div>
                )}

                <div className="flex gap-2">
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        size="sm"
                    >
                        {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Save Contact Info
                    </Button>
                    {!needsSetup && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setPhone(profile.phone || '')
                                setZoomLink(profile.zoom_link || '')
                                setIsEditing(false)
                            }}
                            disabled={isSaving}
                        >
                            Cancel
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

// ========================
// Leader: Availability Editor
// ========================
function AvailabilityEditor({
    pairingId,
    initialSlots,
}: {
    pairingId: string
    initialSlots: AvailabilitySlot[]
}) {
    const router = useRouter()
    const [slots, setSlots] = useState<{ day_of_week: number; start_time: string; end_time: string }[]>(
        initialSlots.map((s) => ({
            day_of_week: s.day_of_week,
            start_time: s.start_time.slice(0, 5),
            end_time: s.end_time.slice(0, 5),
        }))
    )
    const [isSaving, setIsSaving] = useState(false)

    const addSlot = () => {
        setSlots([...slots, { day_of_week: 1, start_time: '09:00', end_time: '10:00' }])
    }

    const removeSlot = (index: number) => {
        setSlots(slots.filter((_, i) => i !== index))
    }

    const updateSlot = (index: number, field: string, value: string | number) => {
        const updated = [...slots]
        updated[index] = { ...updated[index], [field]: value }
        setSlots(updated)
    }

    const handleSave = async () => {
        // Validate that end times are after start times
        for (const slot of slots) {
            if (slot.end_time <= slot.start_time) {
                toast.error('End time must be after start time for all slots.')
                return
            }
        }

        setIsSaving(true)
        const result = await saveAvailability(pairingId, slots)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Availability saved!')
            router.refresh()
        }
        setIsSaving(false)
    }

    // Group slots by day for the summary
    const slotsByDay = slots.reduce(
        (acc, slot) => {
            if (!acc[slot.day_of_week]) acc[slot.day_of_week] = []
            acc[slot.day_of_week].push(slot)
            return acc
        },
        {} as Record<number, typeof slots>
    )

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Your Weekly Availability
                </CardTitle>
                <CardDescription>
                    Set your recurring weekly time slots when you are available for meetings. Your learner will be able to book from these times.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Weekly overview */}
                {Object.keys(slotsByDay).length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-3 border-b">
                        {DAY_NAMES.map((name, idx) => {
                            const daySlots = slotsByDay[idx]
                            return (
                                <div
                                    key={name}
                                    className={`text-xs px-2.5 py-1 rounded-full border ${daySlots
                                            ? 'bg-primary/10 text-primary border-primary/20 font-medium'
                                            : 'text-muted-foreground border-transparent'
                                        }`}
                                >
                                    {DAY_NAMES_SHORT[idx]}
                                    {daySlots && <span className="ml-1">({daySlots.length})</span>}
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Slot list */}
                {slots.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        <p className="text-sm">No availability set yet.</p>
                        <p className="text-xs">Add your first time slot below.</p>
                    </div>
                )}

                <div className="space-y-3">
                    {slots.map((slot, index) => (
                        <div key={index} className="flex items-center gap-2 flex-wrap">
                            <Select
                                value={slot.day_of_week.toString()}
                                onValueChange={(v) => updateSlot(index, 'day_of_week', parseInt(v))}
                            >
                                <SelectTrigger className="w-[130px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DAY_NAMES.map((name, idx) => (
                                        <SelectItem key={idx} value={idx.toString()}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={slot.start_time}
                                onValueChange={(v) => updateSlot(index, 'start_time', v)}
                            >
                                <SelectTrigger className="w-[110px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIME_OPTIONS.map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {formatTime(t)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <span className="text-muted-foreground text-sm">to</span>

                            <Select
                                value={slot.end_time}
                                onValueChange={(v) => updateSlot(index, 'end_time', v)}
                            >
                                <SelectTrigger className="w-[110px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TIME_OPTIONS.map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {formatTime(t)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeSlot(index)}
                                className="text-muted-foreground hover:text-destructive shrink-0"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button variant="outline" onClick={addSlot} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Time Slot
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Save Availability
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

// ========================
// Learner: Booking View
// ========================
function BookingView({
    pairingId,
    availabilitySlots,
    upcomingMeetings,
    pastMeetings,
    leaderName,
    leaderPhone,
    leaderZoomLink,
    initialNotes,
}: {
    pairingId: string
    availabilitySlots: AvailabilitySlot[]
    upcomingMeetings: ScheduledMeeting[]
    pastMeetings: ScheduledMeeting[]
    leaderName: string
    leaderPhone: string | null
    leaderZoomLink: string | null
    initialNotes?: string | null
}) {
    const router = useRouter()
    const [bookingDialog, setBookingDialog] = useState(false)
    const [selectedSlot, setSelectedSlot] = useState<{
        date: string
        dayOfWeek: number
        startTime: string
        endTime: string
    } | null>(null)
    const [meetingType, setMeetingType] = useState<'facetime' | 'zoom' | 'phone' | 'in_person'>('zoom')
    const [notes, setNotes] = useState(initialNotes || '')
    const [isBooking, setIsBooking] = useState(false)

    // Group availability by day
    const slotsByDay = availabilitySlots.reduce(
        (acc, slot) => {
            if (!acc[slot.day_of_week]) acc[slot.day_of_week] = []
            acc[slot.day_of_week].push(slot)
            return acc
        },
        {} as Record<number, AvailabilitySlot[]>
    )

    // Build a set of booked hour ranges for quick overlap lookup
    // Each booked meeting marks all its 1-hour sub-slots as taken
    // Also track completed meetings separately for visual distinction
    const bookedHourSet = new Set<string>()
    const completedHourSet = new Set<string>()
    const allMeetings = [...upcomingMeetings, ...pastMeetings]
    for (const m of allMeetings) {
        const mStart = m.start_time.slice(0, 5)
        const mEnd = m.end_time.slice(0, 5)
        const subSlots = getHourSlots(mStart, mEnd)
        const targetSet = m.status === 'completed' ? completedHourSet : bookedHourSet
        // If the meeting is exactly 1 hour or less, just add it directly
        if (subSlots.length === 0) {
            targetSet.add(`${m.meeting_date}_${mStart}`)
        }
        for (const s of subSlots) {
            targetSet.add(`${m.meeting_date}_${s.start}`)
        }
    }

    const handleSelectSlot = (date: string, dayOfWeek: number, startTime: string, endTime: string) => {
        setSelectedSlot({ date, dayOfWeek, startTime, endTime })
        setMeetingType('zoom')
        setNotes(initialNotes || '')
        setBookingDialog(true)
    }

    const handleBook = async () => {
        if (!selectedSlot) return
        setIsBooking(true)

        // Build the meeting link: for zoom, store the leader's zoom link
        // For phone/facetime, do NOT store a phone number — each viewer resolves
        // their partner's phone dynamically so the leader sees the learner's number
        // and the learner sees the leader's number.
        let resolvedLink: string | undefined = undefined
        if (meetingType === 'zoom') {
            resolvedLink = leaderZoomLink || undefined
        }

        const result = await bookMeeting({
            pairingId,
            meetingDate: selectedSlot.date,
            startTime: selectedSlot.startTime,
            endTime: selectedSlot.endTime,
            meetingType,
            meetingLink: resolvedLink,
            notes: notes || undefined,
        })

        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Meeting booked!')
            setBookingDialog(false)
            router.refresh()
        }
        setIsBooking(false)
    }

    if (availabilitySlots.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Book a Meeting
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                        <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">{leaderName} hasn't set their availability yet.</p>
                        <p className="text-xs mt-1">Check back later or send them a message.</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        Book a Meeting
                    </CardTitle>
                    <CardDescription>
                        Select a 1-hour time slot from {leaderName}'s availability for the next 2 weeks.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {DAY_NAMES.map((dayName, dayIdx) => {
                        const daySlots = slotsByDay[dayIdx]
                        if (!daySlots) return null

                        const upcomingDates = getUpcomingDatesForDay(dayIdx)
                        if (upcomingDates.length === 0) return null

                        return (
                            <div key={dayIdx} className="space-y-2">
                                <h3 className="text-sm font-semibold text-foreground">{dayName}</h3>
                                {upcomingDates.map((date) => {
                                    // Collect all 1-hour sub-slots across all availability windows for this date
                                    const allHourSlots: { start: string; end: string; slotId: string }[] = []
                                    for (const slot of daySlots) {
                                        const startTime = slot.start_time.slice(0, 5)
                                        const endTime = slot.end_time.slice(0, 5)
                                        const hours = getHourSlots(startTime, endTime)
                                        for (const h of hours) {
                                            allHourSlots.push({ start: h.start, end: h.end, slotId: slot.id })
                                        }
                                    }

                                    if (allHourSlots.length === 0) return null

                                    return (
                                        <div key={date} className="space-y-1.5">
                                            <p className="text-xs text-muted-foreground ml-1">{formatDate(date)}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {allHourSlots.map((hourSlot) => {
                                                    const key = `${date}_${hourSlot.start}`
                                                    const isBooked = bookedHourSet.has(key)
                                                    const isCompleted = completedHourSet.has(key)
                                                    const isUnavailable = isBooked || isCompleted

                                                    return (
                                                        <Button
                                                            key={`${hourSlot.slotId}_${date}_${hourSlot.start}`}
                                                            variant={isUnavailable ? 'secondary' : 'outline'}
                                                            size="sm"
                                                            disabled={isUnavailable}
                                                            onClick={() => handleSelectSlot(date, dayIdx, hourSlot.start, hourSlot.end)}
                                                            className={
                                                                isCompleted
                                                                    ? 'opacity-50 line-through bg-muted text-muted-foreground'
                                                                    : isBooked
                                                                        ? 'opacity-50 line-through'
                                                                        : 'hover:bg-primary/10 hover:text-primary hover:border-primary/30'
                                                            }
                                                        >
                                                            {isCompleted ? (
                                                                <CheckCircle2 className="h-3 w-3 mr-1.5 text-muted-foreground" />
                                                            ) : (
                                                                <Clock className="h-3 w-3 mr-1.5" />
                                                            )}
                                                            {formatTime(hourSlot.start)} - {formatTime(hourSlot.end)}
                                                            {isBooked && !isCompleted && <span className="ml-1 text-xs">(Booked)</span>}
                                                            {isCompleted && <span className="ml-1 text-xs">(Completed)</span>}
                                                        </Button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            {/* Booking confirmation - Drawer on mobile, Dialog on desktop */}
            <BookingConfirmation
                open={bookingDialog}
                onOpenChange={setBookingDialog}
                selectedSlot={selectedSlot}
                meetingType={meetingType}
                setMeetingType={setMeetingType}
                notes={notes}
                setNotes={setNotes}
                leaderPhone={leaderPhone}
                leaderZoomLink={leaderZoomLink}
                leaderName={leaderName}
                isBooking={isBooking}
                onBook={handleBook}
            />
        </>
    )
}

// ========================
// Upcoming Meetings sidebar
// ========================
// ========================
// Responsive Booking Confirmation (Drawer on mobile, Dialog on desktop)
// ========================
function BookingConfirmation({
    open,
    onOpenChange,
    selectedSlot,
    meetingType,
    setMeetingType,
    notes,
    setNotes,
    leaderPhone,
    leaderZoomLink,
    leaderName,
    isBooking,
    onBook,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedSlot: { date: string; dayOfWeek: number; startTime: string; endTime: string } | null
    meetingType: 'facetime' | 'zoom' | 'phone' | 'in_person'
    setMeetingType: (type: 'facetime' | 'zoom' | 'phone' | 'in_person') => void
    notes: string
    setNotes: (notes: string) => void
    leaderPhone: string | null
    leaderZoomLink: string | null
    leaderName: string
    isBooking: boolean
    onBook: () => void
}) {
    const isMobile = useIsMobile()

    const subtitle = selectedSlot
        ? `${DAY_NAMES[selectedSlot.dayOfWeek]}, ${formatDate(selectedSlot.date)} at ${formatTime(selectedSlot.startTime)} - ${formatTime(selectedSlot.endTime)}`
        : ''

    const formContent = (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Meeting Type</Label>
                <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(MEETING_TYPE_CONFIG) as [string, typeof MEETING_TYPE_CONFIG.facetime][]).map(
                        ([key, config]) => {
                            const Icon = config.icon
                            const isSelected = meetingType === key
                            return (
                                <Button
                                    key={key}
                                    variant={isSelected ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setMeetingType(key as typeof meetingType)}
                                    className={`justify-center gap-2 ${isSelected ? '' : 'bg-transparent'}`}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    <span>{config.label}</span>
                                </Button>
                            )
                        }
                    )}
                </div>
            </div>

            {(meetingType === 'facetime' || meetingType === 'phone') && (
                <div className="space-y-2">
                    <Label>{meetingType === 'facetime' ? 'FaceTime' : 'Phone Call'}</Label>
                    {leaderPhone ? (
                        <div className="flex items-center gap-2 text-sm rounded-md border px-3 py-2 bg-muted/30">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span>{formatPhone(leaderPhone)}</span>
                            <Badge variant="secondary" className="text-xs ml-auto shrink-0">{leaderName}</Badge>
                        </div>
                    ) : (
                        <div className="rounded-md border border-dashed px-3 py-3 text-center">
                            <p className="text-sm text-muted-foreground">
                                {leaderName} {"hasn't"} added a phone number yet.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Ask your leader to add their number on the Schedule page.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {meetingType === 'zoom' && (
                <div className="space-y-2">
                    <Label>Zoom Meeting</Label>
                    {leaderZoomLink ? (
                        <div className="flex items-center gap-2 text-sm rounded-md border px-3 py-2 bg-muted/30 min-w-0 overflow-hidden">
                            <Monitor className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate min-w-0 flex-1">{leaderZoomLink}</span>
                            <Badge variant="secondary" className="text-xs shrink-0">{leaderName}</Badge>
                        </div>
                    ) : (
                        <div className="rounded-md border border-dashed px-3 py-3 text-center">
                            <p className="text-sm text-muted-foreground">
                                {leaderName} {"hasn't"} added a Zoom link yet.
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Ask your leader to add their Zoom link on the Schedule page.
                            </p>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any topics or agenda items..."
                    rows={2}
                />
            </div>
        </div>
    )

    const footerButtons = (
        <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBooking} className="w-full sm:w-auto">
                Cancel
            </Button>
            <Button onClick={onBook} disabled={isBooking} className="w-full sm:w-auto">
                {isBooking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Book Meeting
            </Button>
        </>
    )

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent>
                    <DrawerHeader className="text-left">
                        <DrawerTitle>Confirm Meeting</DrawerTitle>
                        <DrawerDescription>{subtitle}</DrawerDescription>
                    </DrawerHeader>
                    <div className="px-4 pb-2 overflow-y-auto">
                        {formContent}
                    </div>
                    <DrawerFooter>
                        <Button onClick={onBook} disabled={isBooking} className="w-full">
                            {isBooking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Book Meeting
                        </Button>
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBooking} className="w-full">
                            Cancel
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Confirm Meeting</DialogTitle>
                    <DialogDescription>{subtitle}</DialogDescription>
                </DialogHeader>
                <div className="py-2 min-w-0">
                    {formContent}
                </div>
                <DialogFooter>
                    {footerButtons}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ========================
// Upcoming Meetings Sidebar
// ========================
function UpcomingMeetings({
    meetings,
    profile,
    partnerName,
    partnerPhone,
    partnerZoomLink,
    availabilitySlots,
    weekTopic,
    weekNumber,
}: {
    meetings: ScheduledMeeting[]
    profile: Profile
    partnerName: string
    partnerPhone: string | null
    partnerZoomLink: string | null
    availabilitySlots: AvailabilitySlot[]
    weekTopic?: string | null
    weekNumber?: number | null
}) {
    const router = useRouter()
    const isMobile = useIsMobile()
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [linkEditId, setLinkEditId] = useState<string | null>(null)
    const [linkValue, setLinkValue] = useState('')

    // Edit meeting state
    const [editMeeting, setEditMeeting] = useState<ScheduledMeeting | null>(null)
    const [editType, setEditType] = useState<'facetime' | 'zoom' | 'phone' | 'in_person'>('zoom')
    const [editSlot, setEditSlot] = useState<{ date: string; start: string; end: string } | null>(null)
    const [editNotes, setEditNotes] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    const openEdit = (meeting: ScheduledMeeting) => {
        setEditMeeting(meeting)
        setEditType(meeting.meeting_type as typeof editType)
        setEditSlot({
            date: meeting.meeting_date,
            start: meeting.start_time.slice(0, 5),
            end: meeting.end_time.slice(0, 5),
        })
        setEditNotes(meeting.notes || '')
    }

    const handleSaveEdit = async () => {
        if (!editMeeting || !editSlot) return
        setIsSaving(true)

        // Build meeting link: use any available zoom link from partner, self, or existing meeting
        let meetingLink: string | null = null
        if (editType === 'zoom') {
            meetingLink = partnerZoomLink || profile.zoom_link || editMeeting.meeting_link || null
        }

        const result = await updateMeeting(editMeeting.id, {
            meetingType: editType,
            meetingDate: editSlot.date,
            startTime: editSlot.start,
            endTime: editSlot.end,
            meetingLink,
            notes: editNotes || null,
        })

        if (result.error) toast.error(result.error)
        else {
            toast.success('Meeting updated!')
            setEditMeeting(null)
            router.refresh()
        }
        setIsSaving(false)
    }

    // Build available hour slots from availability for the edit dialog
    const slotsByDay = availabilitySlots.reduce(
        (acc, slot) => {
            if (!acc[slot.day_of_week]) acc[slot.day_of_week] = []
            acc[slot.day_of_week].push(slot)
            return acc
        },
        {} as Record<number, AvailabilitySlot[]>
    )

    const bookedHourSet = new Set<string>()
    for (const m of meetings) {
        // Skip the meeting being edited so its own slot shows as available
        if (editMeeting && m.id === editMeeting.id) continue
        const mStart = m.start_time.slice(0, 5)
        const mEnd = m.end_time.slice(0, 5)
        const subSlots = getHourSlots(mStart, mEnd)
        if (subSlots.length === 0) {
            bookedHourSet.add(`${m.meeting_date}_${mStart}`)
        }
        for (const s of subSlots) {
            bookedHourSet.add(`${m.meeting_date}_${s.start}`)
        }
    }

    const handleCancel = async (id: string) => {
        setLoadingId(id)
        const result = await cancelMeeting(id)
        if (result.error) toast.error(result.error)
        else {
            toast.success('Meeting cancelled.')
            router.refresh()
        }
        setLoadingId(null)
    }

    const handleComplete = async (id: string) => {
        setLoadingId(id)
        const result = await completeMeeting(id)
        if (result.error) toast.error(result.error)
        else {
            toast.success('Meeting marked as complete!')
            router.refresh()
        }
        setLoadingId(null)
    }

    const handleSaveLink = async (id: string) => {
        setLoadingId(id)
        const result = await updateMeetingLink(id, linkValue)
        if (result.error) toast.error(result.error)
        else {
            toast.success('Link updated!')
            setLinkEditId(null)
            router.refresh()
        }
        setLoadingId(null)
    }

    // Edit form content shared between Dialog and Drawer
    const editFormContent = editMeeting && (
        <div className="space-y-4">
            {/* Meeting Type */}
            <div className="space-y-2">
                <Label>Meeting Type</Label>
                <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(MEETING_TYPE_CONFIG) as [string, typeof MEETING_TYPE_CONFIG.facetime][]).map(
                        ([key, config]) => {
                            const TypeIcon = config.icon
                            const isSelected = editType === key
                            return (
                                <Button
                                    key={key}
                                    variant={isSelected ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setEditType(key as typeof editType)}
                                    className={`justify-center gap-2 ${isSelected ? '' : 'bg-transparent'}`}
                                >
                                    <TypeIcon className="h-4 w-4 shrink-0" />
                                    <span>{config.label}</span>
                                </Button>
                            )
                        }
                    )}
                </div>
            </div>

            {/* Time Slot Picker */}
            <div className="space-y-2">
                <Label>Time Slot</Label>
                <div className="max-h-48 overflow-y-auto space-y-3 rounded-md border p-2">
                    {DAY_NAMES.map((dayName, dayIdx) => {
                        const daySlots = slotsByDay[dayIdx]
                        if (!daySlots) return null

                        const upcomingDates = getUpcomingDatesForDay(dayIdx)
                        if (upcomingDates.length === 0) return null

                        const hasAnySlots = upcomingDates.some((date) =>
                            daySlots.some((slot) => {
                                const hours = getHourSlots(slot.start_time.slice(0, 5), slot.end_time.slice(0, 5))
                                return hours.some((h) => !bookedHourSet.has(`${date}_${h.start}`))
                            })
                        )
                        if (!hasAnySlots) return null

                        return (
                            <div key={dayIdx} className="space-y-1">
                                <p className="text-xs font-semibold text-foreground">{dayName}</p>
                                {upcomingDates.map((date) => {
                                    const allHourSlots: { start: string; end: string }[] = []
                                    for (const slot of daySlots) {
                                        const hours = getHourSlots(slot.start_time.slice(0, 5), slot.end_time.slice(0, 5))
                                        for (const h of hours) allHourSlots.push(h)
                                    }
                                    const available = allHourSlots.filter((h) => !bookedHourSet.has(`${date}_${h.start}`))
                                    if (available.length === 0) return null

                                    return (
                                        <div key={date} className="space-y-1">
                                            <p className="text-xs text-muted-foreground ml-1">{formatDate(date)}</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {available.map((hourSlot) => {
                                                    const isCurrentSlot = editSlot?.date === date && editSlot?.start === hourSlot.start
                                                    return (
                                                        <Button
                                                            key={`${date}_${hourSlot.start}`}
                                                            variant={isCurrentSlot ? 'default' : 'outline'}
                                                            size="sm"
                                                            className={`h-7 text-xs ${isCurrentSlot ? '' : 'bg-transparent'}`}
                                                            onClick={() => setEditSlot({ date, start: hourSlot.start, end: hourSlot.end })}
                                                        >
                                                            <Clock className="h-3 w-3 mr-1" />
                                                            {formatTime(hourSlot.start)} - {formatTime(hourSlot.end)}
                                                        </Button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>
                {editSlot && (
                    <p className="text-xs text-muted-foreground">
                        Selected: {formatDate(editSlot.date)} at {formatTime(editSlot.start)} - {formatTime(editSlot.end)}
                    </p>
                )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Any topics or agenda items..."
                    rows={2}
                />
            </div>
        </div>
    )

    return (
        <>
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        Upcoming Meetings
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {meetings.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No upcoming meetings.</p>
                    ) : (
                        <div className="space-y-3">
                            {meetings.map((meeting) => {
                                const config = MEETING_TYPE_CONFIG[meeting.meeting_type as keyof typeof MEETING_TYPE_CONFIG]
                                const Icon = config?.icon || Video
                                const isLoading = loadingId === meeting.id

                                return (
                                    <div key={meeting.id} className="border rounded-lg p-3 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{formatDate(meeting.meeting_date)}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatTime(meeting.start_time.slice(0, 5))} - {formatTime(meeting.end_time.slice(0, 5))}
                                                </p>
                                            </div>
                                            <Badge variant="secondary" className={`text-xs ${config?.color || ''}`}>
                                                <Icon className="h-3 w-3 mr-1" />
                                                {config?.label || meeting.meeting_type}
                                            </Badge>
                                        </div>

                                        <p className="text-xs text-muted-foreground">with {partnerName}</p>

                                        {(() => {
                                            const action = getMeetingAction(meeting, partnerPhone, partnerZoomLink)
                                            if (!action) return null
                                            const isCallLink = action.href.startsWith('tel:') || action.href.startsWith('facetime:')
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <a
                                                        href={action.href}
                                                        {...(isCallLink ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        {isCallLink ? <Phone className="h-3 w-3" /> : <LinkIcon className="h-3 w-3" />}
                                                        {action.label}
                                                    </a>
                                                    {isCallLink && action.phoneDisplay && (
                                                        <span className="text-xs text-muted-foreground">{formatPhone(action.phoneDisplay)}</span>
                                                    )}
                                                </div>
                                            )
                                        })()}

                                        {meeting.notes && (
                                            <p className="text-xs text-muted-foreground italic">{meeting.notes}</p>
                                        )}

                                        {/* Link editor */}
                                        {linkEditId === meeting.id && (
                                            <div className="flex gap-1.5">
                                                <Input
                                                    value={linkValue}
                                                    onChange={(e) => setLinkValue(e.target.value)}
                                                    placeholder="Paste meeting link..."
                                                    className="text-xs h-7"
                                                />
                                                <Button size="sm" className="h-7 px-2" onClick={() => handleSaveLink(meeting.id)} disabled={isLoading}>
                                                    Save
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setLinkEditId(null)}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}

                                        <div className="flex gap-1.5 flex-wrap">
                                            {!meeting.meeting_link && meeting.meeting_type !== 'phone' && meeting.meeting_type !== 'facetime' && linkEditId !== meeting.id && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => {
                                                        setLinkEditId(meeting.id)
                                                        setLinkValue('')
                                                    }}
                                                >
                                                    <LinkIcon className="h-3 w-3 mr-1" />
                                                    Add Link
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={() => openEdit(meeting)}
                                            >
                                                <Pencil className="h-3 w-3 mr-1" />
                                                Edit
                                            </Button>
                                            <AddToCalendarButton meeting={meeting} partnerName={partnerName} partnerPhone={partnerPhone} weekTopic={weekTopic} weekNumber={weekNumber} />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={() => handleComplete(meeting.id)}
                                                disabled={isLoading}
                                            >
                                                {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                                                Complete
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                                                onClick={() => handleCancel(meeting.id)}
                                                disabled={isLoading}
                                            >
                                                <XCircle className="h-3 w-3 mr-1" />
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Meeting Dialog/Drawer */}
            {isMobile ? (
                <Drawer open={!!editMeeting} onOpenChange={(open) => { if (!open) setEditMeeting(null) }}>
                    <DrawerContent>
                        <DrawerHeader className="text-left">
                            <DrawerTitle>Edit Meeting</DrawerTitle>
                            <DrawerDescription>
                                Change the meeting type, time, or notes.
                            </DrawerDescription>
                        </DrawerHeader>
                        <div className="px-4 pb-2 overflow-y-auto">
                            {editFormContent}
                        </div>
                        <DrawerFooter>
                            <Button onClick={handleSaveEdit} disabled={isSaving || !editSlot} className="w-full">
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                Save Changes
                            </Button>
                            <Button variant="outline" onClick={() => setEditMeeting(null)} disabled={isSaving} className="w-full">
                                Cancel
                            </Button>
                        </DrawerFooter>
                    </DrawerContent>
                </Drawer>
            ) : (
                <Dialog open={!!editMeeting} onOpenChange={(open) => { if (!open) setEditMeeting(null) }}>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle>Edit Meeting</DialogTitle>
                            <DialogDescription>
                                Change the meeting type, time, or notes.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-2 min-w-0">
                            {editFormContent}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditMeeting(null)} disabled={isSaving}>
                                Cancel
                            </Button>
                            <Button onClick={handleSaveEdit} disabled={isSaving || !editSlot}>
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )
}

// ========================
// Past Meetings sidebar
// ========================
function PastMeetings({
    meetings,
    partnerName,
}: {
    meetings: ScheduledMeeting[]
    partnerName: string
}) {
    const [expanded, setExpanded] = useState(false)

    if (meetings.length === 0) return null

    const displayed = expanded ? meetings : meetings.slice(0, 3)

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Past Meetings</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {displayed.map((meeting) => {
                        const config = MEETING_TYPE_CONFIG[meeting.meeting_type as keyof typeof MEETING_TYPE_CONFIG]
                        return (
                            <div key={meeting.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                                <div>
                                    <p className="text-sm text-foreground">{formatDate(meeting.meeting_date)}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatTime(meeting.start_time.slice(0, 5))} with {partnerName}
                                    </p>
                                </div>
                                <Badge
                                    variant="secondary"
                                    className={`text-xs ${meeting.status === 'completed'
                                            ? 'bg-success/10 text-success'
                                            : 'bg-muted text-muted-foreground'
                                        }`}
                                >
                                    {meeting.status === 'completed' ? 'Completed' : 'Cancelled'}
                                </Badge>
                            </div>
                        )
                    })}
                </div>
                {meetings.length > 3 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded(!expanded)}
                        className="mt-2 w-full text-xs"
                    >
                        {expanded ? 'Show less' : `Show all (${meetings.length})`}
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}

// ========================
// Pending Meeting Requests
// ========================
function PendingMeetings({
    meetings,
    profile,
    partner,
    pairingId,
    availabilitySlots,
}: {
    meetings: ScheduledMeeting[]
    profile: Profile
    partner: Profile | null
    pairingId: string
    availabilitySlots: AvailabilitySlot[]
}) {
    const router = useRouter()
    const isMobile = useIsMobile()
    const isLeader = profile.role === 'leader'
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [actionType, setActionType] = useState<'accept' | 'decline' | 'propose' | null>(null)
    const [selectedMeeting, setSelectedMeeting] = useState<ScheduledMeeting | null>(null)
    const [responseNote, setResponseNote] = useState('')
    const [declineReason, setDeclineReason] = useState('')

    // Propose new time state
    const [proposeType, setProposeType] = useState<'facetime' | 'zoom' | 'phone' | 'in_person'>('zoom')
    const [proposeSlot, setProposeSlot] = useState<{ date: string; start: string; end: string } | null>(null)
    const [proposeNotes, setProposeNotes] = useState('')

    // Filter meetings to show:
    // - Leaders see pending_approval (requests from learners)
    // - Learners see counter_proposed (counter-proposals from leaders)
    const relevantMeetings = meetings.filter(m => {
        if (isLeader) {
            return m.status === 'pending_approval' && m.proposed_by !== profile.id
        } else {
            return m.status === 'counter_proposed' && m.proposed_by !== profile.id
        }
    })

    if (relevantMeetings.length === 0) return null

    const handleAccept = async () => {
        if (!selectedMeeting) return
        setLoadingId(selectedMeeting.id)
        const result = await acceptMeeting(selectedMeeting.id, responseNote || undefined)
        if (result.error) toast.error(result.error)
        else {
            toast.success('Meeting accepted!')
            setSelectedMeeting(null)
            setActionType(null)
            setResponseNote('')
            router.refresh()
        }
        setLoadingId(null)
    }

    const handleDecline = async () => {
        if (!selectedMeeting) return
        setLoadingId(selectedMeeting.id)
        const result = await declineMeeting(selectedMeeting.id, declineReason || undefined)
        if (result.error) toast.error(result.error)
        else {
            toast.success('Meeting declined.')
            setSelectedMeeting(null)
            setActionType(null)
            setDeclineReason('')
            router.refresh()
        }
        setLoadingId(null)
    }

    const handleProposeNewTime = async () => {
        if (!selectedMeeting || !proposeSlot) return
        setLoadingId(selectedMeeting.id)

        // Build meeting link
        let meetingLink: string | undefined = undefined
        if (proposeType === 'zoom') {
            meetingLink = profile.zoom_link || partner?.zoom_link || undefined
        }

        const result = await proposeNewTime({
            originalMeetingId: selectedMeeting.id,
            meetingDate: proposeSlot.date,
            startTime: proposeSlot.start,
            endTime: proposeSlot.end,
            meetingType: proposeType,
            meetingLink,
            notes: proposeNotes || undefined,
        })

        if (result.error) toast.error(result.error)
        else {
            toast.success('New time proposed!')
            setSelectedMeeting(null)
            setActionType(null)
            setProposeSlot(null)
            setProposeNotes('')
            router.refresh()
        }
        setLoadingId(null)
    }

    // Build available slots for proposing new time
    const slotsByDay = availabilitySlots.reduce(
        (acc, slot) => {
            if (!acc[slot.day_of_week]) acc[slot.day_of_week] = []
            acc[slot.day_of_week].push(slot)
            return acc
        },
        {} as Record<number, AvailabilitySlot[]>
    )

    const dialogContent = selectedMeeting && (
        <div className="space-y-4">
            {/* Meeting info */}
            <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">
                    {formatDate(selectedMeeting.meeting_date)} at {formatTime(selectedMeeting.start_time.slice(0, 5))}
                </p>
                <p className="text-sm text-muted-foreground">
                    {MEETING_TYPE_CONFIG[selectedMeeting.meeting_type as keyof typeof MEETING_TYPE_CONFIG]?.label || selectedMeeting.meeting_type} meeting
                </p>
                {selectedMeeting.notes && (
                    <p className="text-sm mt-2 italic">&quot;{selectedMeeting.notes}&quot;</p>
                )}
            </div>

            {actionType === 'accept' && (
                <div className="space-y-2">
                    <Label>Response Note (optional)</Label>
                    <Textarea
                        value={responseNote}
                        onChange={(e) => setResponseNote(e.target.value)}
                        placeholder="Add a note for your partner..."
                        rows={2}
                    />
                </div>
            )}

            {actionType === 'decline' && (
                <div className="space-y-2">
                    <Label>Reason (optional)</Label>
                    <Textarea
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        placeholder="Let them know why you can't make it..."
                        rows={2}
                    />
                </div>
            )}

            {actionType === 'propose' && (
                <>
                    {/* Meeting Type */}
                    <div className="space-y-2">
                        <Label>Meeting Type</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {(Object.entries(MEETING_TYPE_CONFIG) as [string, typeof MEETING_TYPE_CONFIG.facetime][]).map(
                                ([key, config]) => {
                                    const TypeIcon = config.icon
                                    const isSelected = proposeType === key
                                    return (
                                        <Button
                                            key={key}
                                            variant={isSelected ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => setProposeType(key as typeof proposeType)}
                                            className={`justify-center gap-2 ${isSelected ? '' : 'bg-transparent'}`}
                                        >
                                            <TypeIcon className="h-4 w-4 shrink-0" />
                                            <span>{config.label}</span>
                                        </Button>
                                    )
                                }
                            )}
                        </div>
                    </div>

                    {/* Time Slot Picker */}
                    <div className="space-y-2">
                        <Label>Select New Time</Label>
                        <div className="max-h-48 overflow-y-auto space-y-3 rounded-md border p-2">
                            {DAY_NAMES.map((dayName, dayIdx) => {
                                const daySlots = slotsByDay[dayIdx]
                                if (!daySlots) return null

                                const upcomingDates = getUpcomingDatesForDay(dayIdx)
                                if (upcomingDates.length === 0) return null

                                return (
                                    <div key={dayIdx} className="space-y-1">
                                        <p className="text-xs font-semibold text-foreground">{dayName}</p>
                                        {upcomingDates.map((date) => {
                                            const allHourSlots: { start: string; end: string }[] = []
                                            for (const slot of daySlots) {
                                                const hours = getHourSlots(slot.start_time.slice(0, 5), slot.end_time.slice(0, 5))
                                                for (const h of hours) allHourSlots.push(h)
                                            }
                                            if (allHourSlots.length === 0) return null

                                            return (
                                                <div key={date} className="space-y-1">
                                                    <p className="text-xs text-muted-foreground ml-1">{formatDate(date)}</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {allHourSlots.map((hourSlot) => {
                                                            const isCurrentSlot = proposeSlot?.date === date && proposeSlot?.start === hourSlot.start
                                                            return (
                                                                <Button
                                                                    key={`${date}_${hourSlot.start}`}
                                                                    variant={isCurrentSlot ? 'default' : 'outline'}
                                                                    size="sm"
                                                                    className={`h-7 text-xs ${isCurrentSlot ? '' : 'bg-transparent'}`}
                                                                    onClick={() => setProposeSlot({ date, start: hourSlot.start, end: hourSlot.end })}
                                                                >
                                                                    <Clock className="h-3 w-3 mr-1" />
                                                                    {formatTime(hourSlot.start)} - {formatTime(hourSlot.end)}
                                                                </Button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })}
                        </div>
                        {proposeSlot && (
                            <p className="text-xs text-muted-foreground">
                                Selected: {formatDate(proposeSlot.date)} at {formatTime(proposeSlot.start)} - {formatTime(proposeSlot.end)}
                            </p>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                            value={proposeNotes}
                            onChange={(e) => setProposeNotes(e.target.value)}
                            placeholder="Explain why you're proposing a different time..."
                            rows={2}
                        />
                    </div>
                </>
            )}
        </div>
    )

    const dialogActions = (
        <>
            <Button variant="outline" onClick={() => { setSelectedMeeting(null); setActionType(null) }}>
                Cancel
            </Button>
            {actionType === 'accept' && (
                <Button onClick={handleAccept} disabled={loadingId !== null}>
                    {loadingId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept Meeting'}
                </Button>
            )}
            {actionType === 'decline' && (
                <Button variant="destructive" onClick={handleDecline} disabled={loadingId !== null}>
                    {loadingId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Decline Meeting'}
                </Button>
            )}
            {actionType === 'propose' && (
                <Button onClick={handleProposeNewTime} disabled={loadingId !== null || !proposeSlot}>
                    {loadingId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Proposal'}
                </Button>
            )}
        </>
    )

    return (
        <>
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        {isLeader ? 'Meeting Requests' : 'Pending Proposals'}
                        <Badge variant="secondary" className="ml-auto bg-amber-100 text-amber-800">
                            {relevantMeetings.length}
                        </Badge>
                    </CardTitle>
                    <CardDescription>
                        {isLeader
                            ? 'Your learner has requested the following meetings'
                            : 'Your leader has proposed new meeting times'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {relevantMeetings.map((meeting) => {
                        const config = MEETING_TYPE_CONFIG[meeting.meeting_type as keyof typeof MEETING_TYPE_CONFIG]
                        const TypeIcon = config?.icon || Video

                        return (
                            <div
                                key={meeting.id}
                                className="p-3 rounded-lg border bg-background space-y-3"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-medium text-sm">
                                            {formatDate(meeting.meeting_date)}
                                        </p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatTime(meeting.start_time.slice(0, 5))} - {formatTime(meeting.end_time.slice(0, 5))}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className={`text-xs ${config?.color || ''}`}>
                                        <TypeIcon className="h-3 w-3 mr-1" />
                                        {config?.label || meeting.meeting_type}
                                    </Badge>
                                </div>

                                {meeting.notes && (
                                    <p className="text-xs text-muted-foreground italic bg-muted p-2 rounded">
                                        &quot;{meeting.notes}&quot;
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        className="gap-1"
                                        onClick={() => {
                                            setSelectedMeeting(meeting)
                                            setActionType('accept')
                                        }}
                                        disabled={loadingId !== null}
                                    >
                                        <Check className="h-3 w-3" />
                                        Accept
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1"
                                        onClick={() => {
                                            setSelectedMeeting(meeting)
                                            setActionType('propose')
                                            setProposeType(meeting.meeting_type as typeof proposeType)
                                        }}
                                        disabled={loadingId !== null}
                                    >
                                        <Clock className="h-3 w-3" />
                                        New Time
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="gap-1 text-destructive hover:text-destructive"
                                        onClick={() => {
                                            setSelectedMeeting(meeting)
                                            setActionType('decline')
                                        }}
                                        disabled={loadingId !== null}
                                    >
                                        <X className="h-3 w-3" />
                                        Decline
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            {/* Action Dialog/Drawer */}
            {isMobile ? (
                <Drawer open={!!selectedMeeting && !!actionType} onOpenChange={(open) => { if (!open) { setSelectedMeeting(null); setActionType(null) } }}>
                    <DrawerContent>
                        <DrawerHeader>
                            <DrawerTitle>
                                {actionType === 'accept' && 'Accept Meeting'}
                                {actionType === 'decline' && 'Decline Meeting'}
                                {actionType === 'propose' && 'Propose New Time'}
                            </DrawerTitle>
                            <DrawerDescription>
                                {actionType === 'accept' && 'Confirm this meeting time'}
                                {actionType === 'decline' && 'Let your partner know you cannot make this time'}
                                {actionType === 'propose' && 'Suggest an alternative meeting time'}
                            </DrawerDescription>
                        </DrawerHeader>
                        <div className="px-4 pb-4">{dialogContent}</div>
                        <DrawerFooter>{dialogActions}</DrawerFooter>
                    </DrawerContent>
                </Drawer>
            ) : (
                <Dialog open={!!selectedMeeting && !!actionType} onOpenChange={(open) => { if (!open) { setSelectedMeeting(null); setActionType(null) } }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {actionType === 'accept' && 'Accept Meeting'}
                                {actionType === 'decline' && 'Decline Meeting'}
                                {actionType === 'propose' && 'Propose New Time'}
                            </DialogTitle>
                            <DialogDescription>
                                {actionType === 'accept' && 'Confirm this meeting time'}
                                {actionType === 'decline' && 'Let your partner know you cannot make this time'}
                                {actionType === 'propose' && 'Suggest an alternative meeting time'}
                            </DialogDescription>
                        </DialogHeader>
                        {dialogContent}
                        <DialogFooter>{dialogActions}</DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )
}
