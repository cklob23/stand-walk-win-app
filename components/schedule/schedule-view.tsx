'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { saveAvailability, bookMeeting, cancelMeeting, completeMeeting, updateMeetingLink } from '@/lib/schedule-actions'
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

interface ScheduleViewProps {
    profile: Profile
    pairing: Pairing
    partner: Profile | null
    availabilitySlots: AvailabilitySlot[]
    upcomingMeetings: ScheduledMeeting[]
    pastMeetings: ScheduledMeeting[]
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
function getMeetingAction(meeting: ScheduledMeeting, partnerPhone?: string | null): { href: string; label: string } | null {
    const type = meeting.meeting_type

    if (type === 'facetime' || type === 'phone') {
        // Use meeting_link if set (already a tel: or facetime: URI), otherwise fall back to partner's phone
        if (meeting.meeting_link) {
            const isCallUri = meeting.meeting_link.startsWith('tel:') || meeting.meeting_link.startsWith('facetime:')
            if (isCallUri) {
                return {
                    href: meeting.meeting_link,
                    label: type === 'facetime' ? 'FaceTime' : 'Call',
                }
            }
            // It's some other link, open directly
            return { href: meeting.meeting_link, label: 'Join Meeting' }
        }
        if (partnerPhone) {
            return {
                href: buildCallLink(partnerPhone, type),
                label: type === 'facetime' ? 'FaceTime' : 'Call',
            }
        }
        return null
    }

    // Zoom / in-person - just use the meeting link if set
    if (meeting.meeting_link) {
        return { href: meeting.meeting_link, label: 'Join Meeting' }
    }
    return null
}

export function ScheduleView({
    profile,
    pairing,
    partner,
    availabilitySlots: initialSlots,
    upcomingMeetings,
    pastMeetings,
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
                <div className="lg:col-span-2 space-y-6">
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
                            leaderName={partner?.full_name || 'Leader'}
                            leaderPhone={partner?.phone || null}
                        />
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <UpcomingMeetings
                        meetings={upcomingMeetings}
                        profile={profile}
                        partnerName={partner?.full_name || 'Partner'}
                        partnerPhone={partner?.phone || null}
                    />
                    <PastMeetings
                        meetings={pastMeetings}
                        partnerName={partner?.full_name || 'Partner'}
                    />
                </div>
            </div>
        </div>
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
    leaderName,
    leaderPhone,
}: {
    pairingId: string
    availabilitySlots: AvailabilitySlot[]
    upcomingMeetings: ScheduledMeeting[]
    leaderName: string
    leaderPhone: string | null
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
    const [meetingLink, setMeetingLink] = useState('')
    const [phoneNumber, setPhoneNumber] = useState(leaderPhone || '')
    const [notes, setNotes] = useState('')
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

    // Build a set of already booked date+time strings for quick lookup
    const bookedSet = new Set(
        upcomingMeetings.map((m) => `${m.meeting_date}_${m.start_time.slice(0, 5)}`)
    )

    const handleSelectSlot = (date: string, dayOfWeek: number, startTime: string, endTime: string) => {
        setSelectedSlot({ date, dayOfWeek, startTime, endTime })
        setMeetingType('zoom')
        setMeetingLink('')
        setPhoneNumber(leaderPhone || '')
        setNotes('')
        setBookingDialog(true)
    }

    const handleBook = async () => {
        if (!selectedSlot) return
        setIsBooking(true)

        // Build the meeting link: for phone/facetime, store as tel:/facetime: URI
        let resolvedLink: string | undefined = meetingLink || undefined
        if (meetingType === 'phone' || meetingType === 'facetime') {
            const number = phoneNumber.trim()
            if (number) {
                resolvedLink = buildCallLink(number, meetingType)
            }
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
                        Select an available time slot from {leaderName}'s schedule for the next 2 weeks.
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
                                {upcomingDates.map((date) => (
                                    <div key={date} className="space-y-1.5">
                                        <p className="text-xs text-muted-foreground ml-1">{formatDate(date)}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {daySlots.map((slot) => {
                                                const startTime = slot.start_time.slice(0, 5)
                                                const endTime = slot.end_time.slice(0, 5)
                                                const isBooked = bookedSet.has(`${date}_${startTime}`)

                                                return (
                                                    <Button
                                                        key={slot.id + date}
                                                        variant={isBooked ? 'secondary' : 'outline'}
                                                        size="sm"
                                                        disabled={isBooked}
                                                        onClick={() => handleSelectSlot(date, dayIdx, startTime, endTime)}
                                                        className={isBooked ? 'opacity-50 line-through' : 'hover:bg-primary/10 hover:text-primary hover:border-primary/30'}
                                                    >
                                                        <Clock className="h-3 w-3 mr-1.5" />
                                                        {formatTime(startTime)} - {formatTime(endTime)}
                                                        {isBooked && <span className="ml-1 text-xs">(Booked)</span>}
                                                    </Button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            {/* Booking confirmation dialog */}
            <Dialog open={bookingDialog} onOpenChange={setBookingDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Meeting</DialogTitle>
                        <DialogDescription>
                            {selectedSlot && (
                                <>
                                    {DAY_NAMES[selectedSlot.dayOfWeek]}, {formatDate(selectedSlot.date)} at{' '}
                                    {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
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
                                                className="justify-start gap-2"
                                            >
                                                <Icon className="h-4 w-4" />
                                                {config.label}
                                            </Button>
                                        )
                                    }
                                )}
                            </div>
                        </div>

                        {(meetingType === 'facetime' || meetingType === 'phone') && (
                            <div className="space-y-2">
                                <Label>Phone Number</Label>
                                {leaderPhone ? (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-md border px-3 py-2 bg-muted/30">
                                            <Phone className="h-3.5 w-3.5 shrink-0" />
                                            <span>{formatPhone(leaderPhone)}</span>
                                            <Badge variant="secondary" className="text-xs ml-auto">{leaderName}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Using {leaderName}'s number on file. You can change it below.
                                        </p>
                                        <Input
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            placeholder="Enter a different number..."
                                            className="text-sm"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <Input
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            placeholder="Enter phone number..."
                                            className="text-sm"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {leaderName} hasn't added a phone number to their profile yet.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {meetingType === 'zoom' && (
                            <div className="space-y-2">
                                <Label>Zoom Link (optional)</Label>
                                <Input
                                    value={meetingLink}
                                    onChange={(e) => setMeetingLink(e.target.value)}
                                    placeholder="https://zoom.us/j/..."
                                />
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

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBookingDialog(false)} disabled={isBooking}>
                            Cancel
                        </Button>
                        <Button onClick={handleBook} disabled={isBooking}>
                            {isBooking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Book Meeting
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

// ========================
// Upcoming Meetings sidebar
// ========================
function UpcomingMeetings({
    meetings,
    profile,
    partnerName,
    partnerPhone,
}: {
    meetings: ScheduledMeeting[]
    profile: Profile
    partnerName: string
    partnerPhone: string | null
}) {
    const router = useRouter()
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [linkEditId, setLinkEditId] = useState<string | null>(null)
    const [linkValue, setLinkValue] = useState('')

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

    return (
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
                                        const action = getMeetingAction(meeting, partnerPhone)
                                        if (!action) return null
                                        const isCallLink = action.href.startsWith('tel:') || action.href.startsWith('facetime:')
                                        const phoneDisplay = extractPhoneFromLink(meeting.meeting_link)
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
                                                {isCallLink && phoneDisplay && (
                                                    <span className="text-xs text-muted-foreground">{formatPhone(phoneDisplay)}</span>
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
                                            onClick={() => handleComplete(meeting.id)}
                                            disabled={isLoading}
                                        >
                                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                                            Done
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
