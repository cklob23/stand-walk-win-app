'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import {
    BookOpen, ChevronLeft, ChevronRight, BookMarked, ArrowLeft,
    Highlighter, MessageSquare, Trash2, X, Check,
    Volume2, VolumeX, Pause, Play, Type,
    BookHeart, Share2, PenLine, Send, Loader2
} from 'lucide-react'
import useSWR from 'swr'
import {
    type BibleHighlight,
    type HighlightColor,
    getHighlightsForChapter,
    toggleHighlight,
    updateHighlightNote,
    deleteHighlight,
    shareHighlightWithPartner,
    saveNoteToJournal,
    saveBiblePreference,
    saveBibleReadingPlace,
    sendVerseToPartner,
    saveMultipleVersesToJournal,
    sendMultipleVersesToPartner,
    shareMultipleVersesWithPartner,
} from '@/lib/bible-highlight-actions'
import { ScriptureText } from '@/components/bible/scripture-text'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from 'sonner'

interface BibleBook {
    id: string
    name: string
}

interface BibleChapter {
    chapter: number
}

interface BibleVerse {
    book: string
    chapter: number
    verse: number
    text: string
}

interface TranslationInfo {
    identifier: string
    name: string
}

const ENGLISH_TRANSLATIONS: TranslationInfo[] = [
    { identifier: 'KJV', name: 'King James Version' },
    { identifier: 'NKJV', name: 'New King James Version' },
    { identifier: 'ASV', name: 'American Standard Version' },
    { identifier: 'ESV', name: 'English Standard Version' },
    { identifier: 'NIV', name: 'New International Version' },
    { identifier: 'NLT', name: 'New Living Translation' },
    { identifier: 'NASB', name: 'New American Standard' },
    { identifier: 'CSB17', name: 'Christian Standard Bible' },
    { identifier: 'MSG', name: 'The Message' },
    { identifier: 'AMP', name: 'Amplified Bible' },
]

const TEXT_SIZES = [
    { value: 'sm', label: 'Small', class: 'text-sm' },
    { value: 'base', label: 'Medium', class: 'text-base' },
    { value: 'lg', label: 'Large', class: 'text-lg' },
    { value: 'xl', label: 'Extra Large', class: 'text-xl' },
    { value: '2xl', label: 'Jumbo', class: 'text-2xl' },
]

const fetcher = (url: string) => fetch(url).then(r => r.json())

const HIGHLIGHT_COLORS: { color: HighlightColor; bg: string; ring: string; label: string }[] = [
    { color: 'yellow', bg: 'bg-yellow-200/60', ring: 'ring-yellow-400', label: 'Yellow' },
    { color: 'green', bg: 'bg-green-200/60', ring: 'ring-green-400', label: 'Green' },
    { color: 'blue', bg: 'bg-blue-200/60', ring: 'ring-blue-400', label: 'Blue' },
    { color: 'pink', bg: 'bg-pink-200/60', ring: 'ring-pink-400', label: 'Pink' },
    { color: 'orange', bg: 'bg-orange-200/60', ring: 'ring-orange-400', label: 'Orange' },
]

function getHighlightBg(color: string): string {
    return HIGHLIGHT_COLORS.find(c => c.color === color)?.bg || ''
}

interface BibleReaderProps {
    weekScripture?: string | null
    weekNumber?: number | null
    pairingId?: string | null
    savedTranslation?: string | null
    savedTextSize?: string | null
    savedBook?: string | null
    savedChapter?: number | null
    savedSkipVerseNumbers?: boolean
    savedVoiceURI?: string | null
}

export function BibleReader({ weekScripture, weekNumber, pairingId, savedTranslation, savedTextSize, savedBook, savedChapter, savedSkipVerseNumbers = false, savedVoiceURI }: BibleReaderProps) {
    const searchParams = useSearchParams()
    const router = useRouter()

    // Determine initial state: URL params > saved place > books view
    const urlBook = searchParams.get('book')
    const urlChapter = searchParams.get('chapter')
    const urlVerses = searchParams.get('verses')
    const initialBook = urlBook || savedBook || null
    const initialChapter = urlChapter ? Number(urlChapter) : (!urlBook && savedChapter ? savedChapter : null)
    const initialView = (initialBook && initialChapter) ? 'reading' as const
        : initialBook ? 'chapters' as const
            : 'books' as const

    // Parse verse range like "3-7" or "16" into start/end
    const parseVerseRange = (range: string | null): { start: number; end: number } | null => {
        if (!range) return null
        const parts = range.split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : start
        if (isNaN(start) || isNaN(end)) return null
        return { start, end }
    }

    // State
    const [translation, setTranslation] = useState(
        searchParams.get('v') || savedTranslation || 'KJV'
    )
    const [textSize, setTextSize] = useState(savedTextSize || 'base')
    const [selectedBook, setSelectedBook] = useState<string | null>(initialBook)
    const [selectedChapter, setSelectedChapter] = useState<number | null>(initialChapter)
    const [view, setView] = useState<'books' | 'chapters' | 'reading'>(initialView)
    const [showSettings, setShowSettings] = useState(false)
    const [weekVerseRange, setWeekVerseRange] = useState<{ start: number; end: number } | null>(
        parseVerseRange(urlVerses)
    )
    // Flash-highlight verses from URL (e.g., when clicking "Read in Bible" from shared items)
    const [flashVerses, setFlashVerses] = useState<Set<number>>(() => {
        const range = parseVerseRange(urlVerses)
        if (!range) return new Set()
        const set = new Set<number>()
        for (let v = range.start; v <= range.end; v++) set.add(v)
        return set
    })

    // Highlighting state
    const [highlights, setHighlights] = useState<BibleHighlight[]>([])
    const [activeColor, setActiveColor] = useState<HighlightColor>('yellow')
    const [highlightMode, setHighlightMode] = useState(false)
    const [selectedVerse, setSelectedVerse] = useState<number | null>(null)
    const [editingNote, setEditingNote] = useState<string | null>(null)
    const [noteText, setNoteText] = useState('')
    const [savingNote, setSavingNote] = useState(false)
    const [savingHighlight, setSavingHighlight] = useState<number | null>(null)
    const [savingJournal, setSavingJournal] = useState(false)
    const [journalSaved, setJournalSaved] = useState(false)
    const [sharingHighlight, setSharingHighlight] = useState(false)
    const [sendingVerse, setSendingVerse] = useState(false)
    const [verseSent, setVerseSent] = useState(false)
    const [audioStartVerse, setAudioStartVerse] = useState<number | null>(null)

    // Multi-verse selection (via highlighting)
    const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set())
    const [showJournalDialog, setShowJournalDialog] = useState(false)
    const [journalTitle, setJournalTitle] = useState('')
    const [multiNote, setMultiNote] = useState('')
    const [savingMultiJournal, setSavingMultiJournal] = useState(false)
    const [sendingMultiVerse, setSendingMultiVerse] = useState(false)
    const [sharingMultiVerse, setSharingMultiVerse] = useState(false)
    const [showSendDialog, setShowSendDialog] = useState(false)
    const [sendNote, setSendNote] = useState('')
    const [editingVerseRef, setEditingVerseRef] = useState(false)
    const [verseRefInput, setVerseRefInput] = useState('')

    // Audio state
    const [isPlaying, setIsPlaying] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [currentReadingVerse, setCurrentReadingVerse] = useState<number | null>(null)
    const [pausedAtVerse, setPausedAtVerse] = useState<number | null>(null)
    const isMobile = useIsMobile()

    // Desktop: browser speechSynthesis
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
    const speechSupportedRef = useRef(typeof window !== 'undefined' && 'speechSynthesis' in window)
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
    const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(savedVoiceURI || '')

    // Mobile: cloud TTS
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const abortControllerRef = useRef<AbortController | null>(null)
    const [selectedCloudVoice, setSelectedCloudVoice] = useState<string>(savedVoiceURI || 'en-US-Wavenet-D')
    const [audioLoading, setAudioLoading] = useState(false)

    const CLOUD_TTS_VOICES = [
        { id: 'en-US-Wavenet-D', name: 'David', description: 'Warm male' },
        { id: 'en-US-Wavenet-C', name: 'Clara', description: 'Clear female' },
        { id: 'en-US-Wavenet-A', name: 'Adam', description: 'Deep male' },
        { id: 'en-US-Wavenet-E', name: 'Emily', description: 'Gentle female' },
        { id: 'en-US-Wavenet-B', name: 'Brian', description: 'Calm male' },
        { id: 'en-US-Wavenet-F', name: 'Fiona', description: 'Bright female' },
        { id: 'en-GB-Wavenet-B', name: 'James', description: 'British male' },
        { id: 'en-GB-Wavenet-A', name: 'Charlotte', description: 'British female' },
        { id: 'en-AU-Wavenet-B', name: 'Liam', description: 'Australian male' },
        { id: 'en-AU-Wavenet-C', name: 'Sophie', description: 'Australian female' },
    ]

    const [skipVerseNumbers, setSkipVerseNumbers] = useState(savedSkipVerseNumbers)
    const skipVerseNumbersRef = useRef(savedSkipVerseNumbers)


    // Data fetching
    const { data: booksData, isLoading: booksLoading } = useSWR(
        `/api/bible?action=books&translation=${translation}`,
        fetcher
    )

    const { data: chaptersData, isLoading: chaptersLoading } = useSWR(
        selectedBook ? `/api/bible?action=chapters&translation=${translation}&book=${selectedBook}` : null,
        fetcher
    )

    const { data: versesData, isLoading: versesLoading } = useSWR(
        selectedBook && selectedChapter
            ? `/api/bible?action=verses&translation=${translation}&book=${selectedBook}&chapter=${selectedChapter}`
            : null,
        fetcher
    )

    const books: BibleBook[] = booksData?.books || []
    const chapters: BibleChapter[] = chaptersData?.chapters || []
    const verses: BibleVerse[] = versesData?.verses || []

    // Load browser voices for desktop
    useEffect(() => {
        if (isMobile || !speechSupportedRef.current) return

        const noveltyVoices = new Set([
            'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles',
            'cellos', 'good news', 'jester', 'junior', 'kathy', 'organ',
            'ralph', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox',
            'princess', 'bruce', 'fred', 'hysterical', 'deranged', 'pipe organ',
        ])

        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices()
            const englishVoices = voices
                .filter(v => {
                    if (!v.lang.startsWith('en')) return false
                    const nameLower = v.name.toLowerCase()
                    return !noveltyVoices.has(nameLower) && !noveltyVoices.has(nameLower.replace(/^apple /, ''))
                })
                .sort((a, b) => {
                    const nameA = a.name.toLowerCase()
                    const nameB = b.name.toLowerCase()
                    const aNatural = nameA.includes('natural') || nameA.includes('premium') || nameA.includes('enhanced')
                    const bNatural = nameB.includes('natural') || nameB.includes('premium') || nameB.includes('enhanced')
                    if (aNatural !== bNatural) return aNatural ? -1 : 1
                    if (a.localService !== b.localService) return a.localService ? 1 : -1
                    const aGoogle = nameA.includes('google') || nameA.includes('microsoft')
                    const bGoogle = nameB.includes('google') || nameB.includes('microsoft')
                    if (aGoogle !== bGoogle) return aGoogle ? -1 : 1
                    return a.name.localeCompare(b.name)
                })
            setAvailableVoices(englishVoices)
            if (selectedVoiceURI) {
                const savedExists = englishVoices.some(v => v.voiceURI === selectedVoiceURI)
                if (!savedExists && englishVoices.length > 0) setSelectedVoiceURI(englishVoices[0].voiceURI)
            } else if (englishVoices.length > 0) {
                setSelectedVoiceURI(englishVoices[0].voiceURI)
            }
        }

        loadVoices()
        window.speechSynthesis.onvoiceschanged = loadVoices
        return () => { window.speechSynthesis.onvoiceschanged = null }
    }, [isMobile, selectedVoiceURI])

    // Keep ref in sync so mid-playback reads the latest value
    useEffect(() => {
        skipVerseNumbersRef.current = skipVerseNumbers
    }, [skipVerseNumbers])

    // Preference save debounce
    const prefTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const savePrefs = useCallback((trans: string, size: string, skip?: boolean, voice?: string) => {
        if (prefTimeoutRef.current) clearTimeout(prefTimeoutRef.current)
        prefTimeoutRef.current = setTimeout(() => {
            saveBiblePreference(trans, size, skip, voice)
        }, 1000)
    }, [])

    // Load highlights when chapter changes
    useEffect(() => {
        if (selectedBook && selectedChapter && view === 'reading') {
            getHighlightsForChapter(selectedBook, selectedChapter).then(setHighlights)
                .catch(() => setHighlights([]))
        } else {
            setHighlights([])
        }
    }, [selectedBook, selectedChapter, view])

    // Cleanup audio on unmount or chapter change
    useEffect(() => {
        return () => {
            // Stop desktop speech
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel()
            }
            // Stop mobile cloud audio
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
                abortControllerRef.current = null
            }
        }
    }, [selectedBook, selectedChapter])

    // Scroll to and flash-highlight verses from URL params
    useEffect(() => {
        if (flashVerses.size === 0 || verses.length === 0) return
        const firstVerse = Math.min(...flashVerses)
        // Small delay to let DOM render
        const scrollTimer = setTimeout(() => {
            const el = document.getElementById(`verse-${firstVerse}`)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }, 300)
        // Apply flash via inline styles to override Tailwind classes
        const flashTimer = setTimeout(() => {
            flashVerses.forEach(vNum => {
                const el = document.getElementById(`verse-${vNum}`)
                if (el) {
                    el.style.backgroundColor = 'oklch(0.82 0.14 85)'
                    el.style.boxShadow = '0 0 0 3px oklch(0.82 0.14 85 / 0.5)'
                    el.style.borderRadius = '4px'
                    el.style.transition = 'background-color 1.5s ease-out, box-shadow 1.5s ease-out'
                    // Start fade after holding
                    setTimeout(() => {
                        el.style.backgroundColor = ''
                        el.style.boxShadow = ''
                        setTimeout(() => {
                            el.style.borderRadius = ''
                            el.style.transition = ''
                        }, 1600)
                    }, 1500)
                }
            })
        }, 500)
        // Clear flash state
        const clearTimer = setTimeout(() => {
            setFlashVerses(new Set())
        }, 4000)
        return () => {
            clearTimeout(scrollTimer)
            clearTimeout(flashTimer)
            clearTimeout(clearTimer)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verses.length, flashVerses.size])

    const getVerseHighlight = (verseNum: number): BibleHighlight | undefined => {
        return highlights.find(h => Number(h.verse) === Number(verseNum))
    }

    const isWeekStudyVerse = (verseNum: number): boolean => {
        if (!weekVerseRange) return false
        return verseNum >= weekVerseRange.start && verseNum <= weekVerseRange.end
    }

    const handleVerseClick = async (verseNum: number) => {
        if (!highlightMode || !selectedBook || !selectedChapter) return
        setSavingHighlight(verseNum)
        try {
            const result = await toggleHighlight(selectedBook, selectedChapter, Number(verseNum), activeColor, translation)
            if (result.removed) {
                setHighlights(prev => prev.filter(h => Number(h.verse) !== Number(verseNum)))
                setSelectedVerse(null)
            } else if (result.highlight) {
                setHighlights(prev => {
                    const idx = prev.findIndex(h => Number(h.verse) === Number(verseNum))
                    if (idx >= 0) {
                        const copy = [...prev]
                        copy[idx] = result.highlight!
                        return copy
                    }
                    return [...prev, result.highlight!]
                })
                // Open the popover for the newly highlighted verse
                setSelectedVerse(verseNum)
                setJournalSaved(false)
                setVerseSent(false)
            }
        } catch { /* silent */ }
        setSavingHighlight(null)
    }

    const handleOpenNote = (verseNum: number) => {
        const h = getVerseHighlight(verseNum)
        if (h) {
            setEditingNote(h.id)
            setNoteText(h.note || '')
            setSelectedVerse(verseNum)
        }
    }

    const handleSaveNote = async () => {
        if (!editingNote) return
        setSavingNote(true)
        try {
            const updated = await updateHighlightNote(editingNote, noteText)
            if (updated) {
                setHighlights(prev => prev.map(h => h.id === editingNote ? updated : h))
            }
        } catch { /* silent */ }
        setSavingNote(false)
        setEditingNote(null)
        setSelectedVerse(null)
        setNoteText('')
    }

    const handleDeleteHighlight = async (highlightId: string, verseNum: number) => {
        try {
            await deleteHighlight(highlightId)
            setHighlights(prev => prev.filter(h => h.id !== highlightId))
            if (selectedVerse === verseNum) {
                setSelectedVerse(null)
                setEditingNote(null)
            }
        } catch { /* silent */ }
    }

    // Save reading place whenever chapter changes
    useEffect(() => {
        if (selectedBook && selectedChapter && view === 'reading') {
            saveBibleReadingPlace(selectedBook, selectedChapter, translation)
        }
    }, [selectedBook, selectedChapter, view, translation])

    const handleShareHighlight = async (hl: BibleHighlight, v: BibleVerse) => {
        if (!pairingId) return
        setSharingHighlight(true)
        try {
            const bookName = books.find(b => b.id === selectedBook)?.name || selectedBook || ''
            const updated = await shareHighlightWithPartner(
                hl.id, !hl.shared_with_partner, pairingId, bookName, v.text
            )
            if (updated) {
                setHighlights(prev => prev.map(h => h.id === hl.id ? updated : h))
                if (!hl.shared_with_partner) {
                    toast.success('Shared with your partner!')
                }
            }
        } catch { /* silent */ }
        setSharingHighlight(false)
    }

    // Find group of adjacent highlighted verses (same color) around a given verse
    const getHighlightGroup = (verseNum: number): number[] => {
        const hl = getVerseHighlight(verseNum)
        if (!hl) return [verseNum]
        const color = hl.color
        const group = new Set<number>([verseNum])
        // Expand backwards
        let prev = verseNum - 1
        while (prev >= 1) {
            const ph = getVerseHighlight(prev)
            if (ph && ph.color === color) { group.add(prev); prev-- }
            else break
        }
        // Expand forwards
        let next = verseNum + 1
        while (next <= verses.length) {
            const nh = getVerseHighlight(next)
            if (nh && nh.color === color) { group.add(next); next++ }
            else break
        }
        return Array.from(group).sort((a, b) => a - b)
    }

    // Group consecutive numbers into ranges: [1,2,3,8] => "1-3, 8"
    const buildRangeStr = (nums: number[]): string => {
        if (nums.length === 0) return ''
        const sorted = [...nums].sort((a, b) => a - b)
        const groups: number[][] = []
        let current = [sorted[0]]
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === current[current.length - 1] + 1) {
                current.push(sorted[i])
            } else {
                groups.push(current)
                current = [sorted[i]]
            }
        }
        groups.push(current)
        return groups.map(g => g.length === 1 ? `${g[0]}` : `${g[0]}-${g[g.length - 1]}`).join(', ')
    }

    const getSelectedRangeLabel = (): string => {
        if (selectedVerses.size === 0) return ''
        const nums = Array.from(selectedVerses).sort((a, b) => a - b)
        const bookName = books.find(b => b.id === selectedBook)?.name || selectedBook || ''
        return `${bookName} ${selectedChapter}:${buildRangeStr(nums)}`
    }

    // Parse a verse reference string like "3:13-15, 18" or "John 3:13-15, 18" into a Set of verse numbers
    const parseVerseRefInput = (input: string): Set<number> => {
        // Extract the part after the colon (verse numbers)
        const colonIdx = input.lastIndexOf(':')
        const verseStr = colonIdx >= 0 ? input.slice(colonIdx + 1) : input
        const nums = new Set<number>()
        const parts = verseStr.split(',').map(s => s.trim()).filter(Boolean)
        for (const part of parts) {
            if (part.includes('-')) {
                const [startStr, endStr] = part.split('-').map(s => s.trim())
                const start = parseInt(startStr, 10)
                const end = parseInt(endStr, 10)
                if (!isNaN(start) && !isNaN(end)) {
                    for (let i = start; i <= end; i++) nums.add(i)
                }
            } else {
                const n = parseInt(part, 10)
                if (!isNaN(n)) nums.add(n)
            }
        }
        // Only keep valid verse numbers that exist in the current chapter
        const validVerseNums = new Set(verses.map(v => v.verse))
        return new Set([...nums].filter(n => validVerseNums.has(n)))
    }

    const handleVerseRefCommit = () => {
        if (verseRefInput.trim()) {
            const parsed = parseVerseRefInput(verseRefInput)
            if (parsed.size > 0) {
                setSelectedVerses(parsed)
            }
        }
        setEditingVerseRef(false)
    }

    const getDefaultMultiTitle = (): string => {
        const rangeLabel = getSelectedRangeLabel()
        const hasNotes = Array.from(selectedVerses).some(vn => getVerseHighlight(vn)?.note)
        return hasNotes ? `Scripture and notes from ${rangeLabel}` : `Scripture from ${rangeLabel}`
    }

    // Collect existing notes from selected/highlighted verses for pre-populating the journal dialog
    const getSelectedNotesText = (verseSet?: Set<number>): string => {
        const versesToCheck = verseSet || selectedVerses
        return Array.from(versesToCheck)
            .sort((a, b) => a - b)
            .map(vn => {
                const hl = getVerseHighlight(vn)
                return hl?.note ? hl.note : null
            })
            .filter(Boolean)
            .join('\n')
    }

    const handleMultiSaveToJournal = async () => {
        if (!pairingId || selectedVerses.size === 0) return
        setSavingMultiJournal(true)
        try {
            const bookName = books.find(b => b.id === selectedBook)?.name || selectedBook || ''
            const verseEntries = Array.from(selectedVerses)
                .sort((a, b) => a - b)
                .map(vn => {
                    const v = verses.find(vv => vv.verse === vn)
                    const hl = getVerseHighlight(vn)
                    return { verse: vn, text: v?.text || '', note: hl?.note || null }
                })
            // If user wrote a combined note, attach it as the note on all entries
            if (multiNote.trim()) {
                verseEntries.forEach(e => {
                    e.note = multiNote.trim()
                })
            }
            const result = await saveMultipleVersesToJournal(
                pairingId, bookName, selectedChapter!, verseEntries, journalTitle || undefined
            )
            if (result.success) {
                toast.success('Saved to your prayer journal!')
                setSelectedVerses(new Set())
                setShowJournalDialog(false)
                setJournalTitle('')
                setMultiNote('')
            } else {
                toast.error(result.error || 'Failed to save')
            }
        } catch {
            toast.error('Failed to save to journal.')
        }
        setSavingMultiJournal(false)
    }

    const handleMultiSendToPartner = async () => {
        if (!pairingId || selectedVerses.size === 0) return
        setSendingMultiVerse(true)
        try {
            const bookName = books.find(b => b.id === selectedBook)?.name || selectedBook || ''
            const verseEntries = Array.from(selectedVerses)
                .sort((a, b) => a - b)
                .map(vn => {
                    const v = verses.find(vv => vv.verse === vn)
                    const hl = getVerseHighlight(vn)
                    return { verse: vn, text: v?.text || '', note: hl?.note || null }
                })
            // Attach user's combined note if provided
            if (sendNote.trim()) {
                verseEntries.forEach(e => {
                    e.note = sendNote.trim()
                })
            }
            const result = await sendMultipleVersesToPartner(pairingId, bookName, selectedChapter!, verseEntries)
            if (result.success) {
                toast.success('Verses sent to your partner!')
                setSelectedVerses(new Set())
                setShowSendDialog(false)
                setSendNote('')
            }
        } catch {
            toast.error('Failed to send verses.')
        }
        setSendingMultiVerse(false)
    }

    const handleSendVerse = async (v: BibleVerse, note?: string | null) => {
        if (!pairingId) return
        setSendingVerse(true)
        setVerseSent(false)
        try {
            const bookName = books.find(b => b.id === selectedBook)?.name || selectedBook || ''
            const result = await sendVerseToPartner(pairingId, bookName, v.chapter, v.verse, v.text, note || undefined)
            if (result.success) setVerseSent(true)
        } catch { /* silent */ }
        setSendingVerse(false)
    }

    const [singleJournalVerse, setSingleJournalVerse] = useState<{ hl: BibleHighlight; v: BibleVerse } | null>(null)
    const [singleJournalTitle, setSingleJournalTitle] = useState('')

    const handleSaveToJournal = async (hl: BibleHighlight, v: BibleVerse) => {
        if (!pairingId) return
        // Open title dialog for single verse
        const bookName = books.find(b => b.id === selectedBook)?.name || selectedBook || ''
        const scriptureRef = `${bookName} ${v.chapter}:${v.verse}`
        const defaultTitle = hl.note
            ? `Scripture and notes from ${scriptureRef}`
            : `Scripture from ${scriptureRef}`
        setSingleJournalTitle(defaultTitle)
        setSingleJournalVerse({ hl, v })
    }

    const confirmSingleJournalSave = async () => {
        if (!pairingId || !singleJournalVerse) return
        setSavingJournal(true)
        setJournalSaved(false)
        try {
            const bookName = books.find(b => b.id === selectedBook)?.name || selectedBook || ''
            const { hl, v } = singleJournalVerse
            const result = await saveNoteToJournal(
                hl.id, pairingId, bookName, v.chapter, v.verse, v.text, false, singleJournalTitle || undefined
            )
            if (result.success) {
                setJournalSaved(true)
                toast.success('Saved to your prayer journal!')
                setSingleJournalVerse(null)
                setSingleJournalTitle('')
            } else {
                toast.error(result.error || 'Failed to save to journal.')
            }
        } catch {
            toast.error('Failed to save to journal.')
        }
        setSavingJournal(false)
    }

    const handleMultiShareWithPartner = async () => {
        if (!pairingId || selectedVerses.size === 0) return
        setSharingMultiVerse(true)
        try {
            const bookName = books.find(b => b.id === selectedBook)?.name || selectedBook || ''
            const verseEntries = Array.from(selectedVerses)
                .sort((a, b) => a - b)
                .map(vn => {
                    const v = verses.find(vv => vv.verse === vn)
                    const hl = getVerseHighlight(vn)
                    return { verse: vn, text: v?.text || '', note: hl?.note || null }
                })
            const result = await shareMultipleVersesWithPartner(pairingId, bookName, selectedChapter!, verseEntries)
            if (result.success) {
                toast.success('Shared with your partner!')
                setSelectedVerses(new Set())
            }
        } catch {
            toast.error('Failed to share.')
        }
        setSharingMultiVerse(false)
    }

    // ---- DESKTOP: Browser speechSynthesis ----
    const handlePlayDesktop = (initialStartVerse?: number) => {
        if (!speechSupportedRef.current || verses.length === 0) return
        let startFromVerse = initialStartVerse

        if (isPaused && !startFromVerse) {
            if (pausedAtVerse !== null) {
                window.speechSynthesis.cancel()
                setIsPaused(false)
                startFromVerse = pausedAtVerse
                setPausedAtVerse(null)
            } else {
                window.speechSynthesis.resume()
                setIsPaused(false)
                setIsPlaying(true)
                return
            }
        }

        window.speechSynthesis.cancel()

        const bookName = books.find(b => b.id === selectedBook)?.name || ''
        let verseIndex = 0
        if (startFromVerse) {
            const idx = verses.findIndex(v => v.verse === startFromVerse)
            if (idx >= 0) verseIndex = idx
        } else if (audioStartVerse) {
            const idx = verses.findIndex(v => v.verse === audioStartVerse)
            if (idx >= 0) verseIndex = idx
        }

        const readNextVerse = () => {
            if (verseIndex >= verses.length) {
                setIsPlaying(false)
                setCurrentReadingVerse(null)
                return
            }
            const v = verses[verseIndex]
            const verseText = v.text.replace(/\n/g, ' ').trim()
            let text: string
            if (skipVerseNumbersRef.current) {
                text = verseIndex === 0 ? `${bookName} chapter ${selectedChapter}. ${verseText}` : verseText
            } else {
                text = verseIndex === 0 ? `${bookName} chapter ${selectedChapter}. Verse ${v.verse}. ${verseText}` : `Verse ${v.verse}. ${verseText}`
            }
            const utt = new SpeechSynthesisUtterance(text)
            utt.rate = 0.9
            utt.pitch = 1
            if (selectedVoiceURI) {
                const voice = availableVoices.find(av => av.voiceURI === selectedVoiceURI)
                if (voice) utt.voice = voice
            }
            utteranceRef.current = utt
            setCurrentReadingVerse(v.verse)
            utt.onend = () => { verseIndex++; readNextVerse() }
            utt.onerror = () => { setIsPlaying(false); setCurrentReadingVerse(null) }
            window.speechSynthesis.speak(utt)
        }

        setIsPlaying(true)
        setIsPaused(false)
        readNextVerse()
    }

    const handlePauseDesktop = () => {
        if (!speechSupportedRef.current) return
        window.speechSynthesis.pause()
        setIsPaused(true)
        setIsPlaying(false)
        setPausedAtVerse(currentReadingVerse)
    }

    const handleStopDesktop = () => {
        if (!speechSupportedRef.current) return
        window.speechSynthesis.cancel()
        setIsPlaying(false)
        setIsPaused(false)
        setCurrentReadingVerse(null)
        setPausedAtVerse(null)
    }

    // ---- MOBILE: Cloud TTS ----
    const handlePlayMobile = async (initialStartVerse?: number) => {
        if (verses.length === 0) return
        let startFromVerse = initialStartVerse

        if (isPaused && !startFromVerse && audioRef.current) {
            if (pausedAtVerse !== null) {
                handleStopMobile()
                startFromVerse = pausedAtVerse
            } else {
                audioRef.current.play()
                setIsPaused(false)
                setIsPlaying(true)
                return
            }
        }

        handleStopMobile()

        const bookName = books.find(b => b.id === selectedBook)?.name || ''
        let verseIndex = 0
        if (startFromVerse) {
            const idx = verses.findIndex(v => v.verse === startFromVerse)
            if (idx >= 0) verseIndex = idx
        } else if (audioStartVerse) {
            const idx = verses.findIndex(v => v.verse === audioStartVerse)
            if (idx >= 0) verseIndex = idx
        }

        const textParts: string[] = []
        const verseMap: { charStart: number; verseNum: number }[] = []
        let charOffset = 0
        for (let i = verseIndex; i < verses.length; i++) {
            const v = verses[i]
            const verseText = v.text.replace(/\n/g, ' ').trim()
            let line: string
            if (skipVerseNumbersRef.current) {
                line = i === verseIndex ? `${bookName} chapter ${selectedChapter}. ${verseText}` : verseText
            } else {
                line = i === verseIndex ? `${bookName} chapter ${selectedChapter}. Verse ${v.verse}. ${verseText}` : `Verse ${v.verse}. ${verseText}`
            }
            verseMap.push({ charStart: charOffset, verseNum: v.verse })
            charOffset += line.length + 1
            textParts.push(line)
        }

        const fullText = textParts.join('\n')
        setAudioLoading(true)
        setIsPlaying(true)
        setIsPaused(false)

        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: fullText, voice: selectedCloudVoice }),
                signal: controller.signal,
            })
            if (!response.ok) throw new Error('TTS generation failed')

            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const audio = new Audio(url)
            audioRef.current = audio

            const totalDuration = await new Promise<number>((resolve) => {
                audio.addEventListener('loadedmetadata', () => resolve(audio.duration), { once: true })
                setTimeout(() => resolve(0), 5000)
            })

            if (totalDuration > 0 && verseMap.length > 0) {
                const totalChars = charOffset
                audio.ontimeupdate = () => {
                    const progress = audio.currentTime / totalDuration
                    const charPos = Math.floor(progress * totalChars)
                    let cv = verseMap[0].verseNum
                    for (let i = verseMap.length - 1; i >= 0; i--) {
                        if (charPos >= verseMap[i].charStart) { cv = verseMap[i].verseNum; break }
                    }
                    setCurrentReadingVerse(cv)
                }
            } else {
                setCurrentReadingVerse(verses[verseIndex].verse)
            }

            audio.onended = () => { setIsPlaying(false); setCurrentReadingVerse(null); URL.revokeObjectURL(url) }
            audio.onerror = () => { setIsPlaying(false); setCurrentReadingVerse(null); setAudioLoading(false); URL.revokeObjectURL(url); toast.error('Audio playback failed.') }

            setAudioLoading(false)
            audio.play()
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'AbortError') return
            setIsPlaying(false); setCurrentReadingVerse(null); setAudioLoading(false)
            toast.error('Could not generate audio. Please try again.')
        }
    }

    const handlePauseMobile = () => {
        if (!audioRef.current) return
        audioRef.current.pause()
        setIsPaused(true)
        setIsPlaying(false)
        setPausedAtVerse(currentReadingVerse)
    }

    const handleStopMobile = () => {
        if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null }
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.ontimeupdate = null
            audioRef.current.onended = null
            audioRef.current.onerror = null
            const src = audioRef.current.src
            audioRef.current = null
            if (src.startsWith('blob:')) URL.revokeObjectURL(src)
        }
        setIsPlaying(false); setIsPaused(false); setCurrentReadingVerse(null); setPausedAtVerse(null); setAudioLoading(false)
    }

    // ---- Unified handlers that delegate based on device ----
    const handlePlayChapter = (initialStartVerse?: number) => {
        if (isMobile) { handlePlayMobile(initialStartVerse) } else { handlePlayDesktop(initialStartVerse) }
    }
    const handlePauseAudio = () => {
        if (isMobile) { handlePauseMobile() } else { handlePauseDesktop() }
    }
    const handleStopAudio = () => {
        if (isMobile) { handleStopMobile() } else { handleStopDesktop() }
    }

    // Update URL params when selections change
    const updateURL = useCallback((book: string | null, chapter: number | null, v: string) => {
        const params = new URLSearchParams()
        if (book) params.set('book', book)
        if (chapter) params.set('chapter', String(chapter))
        if (v !== 'KJV') params.set('v', v)
        const query = params.toString()
        router.replace(`/dashboard/bible${query ? `?${query}` : ''}`, { scroll: false })
    }, [router])

    const handleSelectBook = (bookId: string) => {
        setSelectedBook(bookId)
        setSelectedChapter(null)
        setView('chapters')
        updateURL(bookId, null, translation)
    }

    const handleSelectChapter = (chapter: number) => {
        setSelectedChapter(chapter)
        setView('reading')
        updateURL(selectedBook, chapter, translation)
        handleStopAudio()
    }

    const handleTranslationChange = (v: string) => {
        setTranslation(v)
        updateURL(selectedBook, selectedChapter, v)
        savePrefs(v, textSize, skipVerseNumbers, isMobile ? selectedCloudVoice : selectedVoiceURI)
        handleStopAudio()
    }

    const handleTextSizeChange = (size: string) => {
        setTextSize(size)
        savePrefs(translation, size, skipVerseNumbers, isMobile ? selectedCloudVoice : selectedVoiceURI)
    }

    const handleBack = () => {
        handleStopAudio()
        if (view === 'reading') {
            setView('chapters')
            setSelectedChapter(null)
            updateURL(selectedBook, null, translation)
        } else if (view === 'chapters') {
            setView('books')
            setSelectedBook(null)
            setSelectedChapter(null)
            updateURL(null, null, translation)
        }
    }

    // Navigate to next/prev chapter
    const handlePrevChapter = () => {
        handleStopAudio()
        setWeekVerseRange(null)
        if (selectedChapter && selectedChapter > 1) {
            const prev = selectedChapter - 1
            setSelectedChapter(prev)
            updateURL(selectedBook, prev, translation)
        }
    }

    const handleNextChapter = () => {
        handleStopAudio()
        setWeekVerseRange(null)
        if (selectedChapter && chapters.length > 0 && selectedChapter < chapters.length) {
            const next = selectedChapter + 1
            setSelectedChapter(next)
            updateURL(selectedBook, next, translation)
        }
    }

    // Parse "John 3:16" or "John 3:3-7 - "text..."" style scripture references
    const parseScriptureRef = useCallback((ref: string): { bookId: string; chapter: number; verseRange: { start: number; end: number } | null } | null => {
        if (!ref || books.length === 0) return null
        // Strip any embedded quote text after ' - "'
        const cleanRef = ref.split(/\s*-\s*\u201C|\s*-\s*"/)[0].trim()
        const match = cleanRef.match(/^(.+?)\s+(\d+)(?::(\d+(?:\s*-\s*\d+)?))?$/)
        if (!match) return null
        const bookName = match[1].trim().toLowerCase()
        const chapter = parseInt(match[2], 10)
        const verseStr = match[3]?.replace(/\s/g, '') || null
        const book = books.find(b =>
            b.name.toLowerCase() === bookName ||
            b.name.toLowerCase().startsWith(bookName)
        )
        if (!book) return null
        return { bookId: book.id, chapter, verseRange: parseVerseRange(verseStr) }
    }, [books])

    // Handle "This Week's Scripture" click
    const handleWeekScripture = useCallback(() => {
        if (!weekScripture) return
        const parsed = parseScriptureRef(weekScripture)
        if (parsed) {
            setSelectedBook(parsed.bookId)
            setSelectedChapter(parsed.chapter)
            setWeekVerseRange(parsed.verseRange)
            setView('reading')
            updateURL(parsed.bookId, parsed.chapter, translation)
        }
    }, [weekScripture, parseScriptureRef, updateURL, translation])

    // Auto-detect if current chapter matches week scripture and highlight it
    useEffect(() => {
        if (!weekScripture || !selectedBook || !selectedChapter || books.length === 0) return
        const parsed = parseScriptureRef(weekScripture)
        if (parsed && parsed.bookId === selectedBook && parsed.chapter === selectedChapter && parsed.verseRange) {
            setWeekVerseRange(parsed.verseRange)
        }
    }, [weekScripture, selectedBook, selectedChapter, books.length, parseScriptureRef])

    // URL params are handled via initial state, no effect needed

    const selectedBookName = books.find(b => b.id === selectedBook)?.name || selectedBook
    const translationName = ENGLISH_TRANSLATIONS.find(t => t.identifier === translation)?.name || translation
    const textSizeClass = TEXT_SIZES.find(s => s.value === textSize)?.class || 'text-base'

    // Old / New testament divider
    // Bolls.life: OT books are IDs 1-39
    const isOTBook = (id: string) => Number(id) >= 1 && Number(id) <= 39

    return (
        <div className="space-y-4">
            {/* Header Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    {view !== 'books' && (
                        <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
                            <ArrowLeft className="h-4 w-4" />
                            <span className="sr-only sm:not-sr-only">Back</span>
                        </Button>
                    )}
                    <div>
                        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-primary" />
                            {view === 'books' && 'Bible'}
                            {view === 'chapters' && selectedBookName}
                            {view === 'reading' && `${selectedBookName} ${selectedChapter}`}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            {translationName} ({translation})
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Text size toggle */}
                    <Button
                        variant={showSettings ? 'default' : 'outline'}
                        size="sm"
                        className={`h-9 gap-1.5 ${showSettings ? '' : 'bg-card'}`}
                        onClick={() => setShowSettings(!showSettings)}
                    >
                        <Type className="h-4 w-4" />
                        <span className="sr-only sm:not-sr-only text-xs">Settings</span>
                    </Button>

                    {/* Version selector */}
                    <Select value={translation} onValueChange={handleTranslationChange}>
                        <SelectTrigger className="w-auto h-9 text-sm bg-card">
                            <span>{translation}</span>
                        </SelectTrigger>
                        <SelectContent>
                            {ENGLISH_TRANSLATIONS.map((t) => (
                                <SelectItem key={t.identifier} value={t.identifier}>
                                    {t.name} ({t.identifier})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Settings panel */}
            {showSettings && (
                <Card>
                    <CardContent className="py-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Text Size</label>
                            <div className="flex items-center gap-2 flex-wrap">
                                {TEXT_SIZES.map((s) => (
                                    <Button
                                        key={s.value}
                                        variant={textSize === s.value ? 'default' : 'outline'}
                                        size="sm"
                                        className={`h-8 text-xs ${textSize !== s.value ? 'bg-card' : ''}`}
                                        onClick={() => handleTextSizeChange(s.value)}
                                    >
                                        {s.label}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Preferred Translation</label>
                            <p className="text-xs text-muted-foreground">
                                Your preference is saved and will be used each time you open the Bible.
                            </p>
                            <Select value={translation} onValueChange={handleTranslationChange}>
                                <SelectTrigger className="w-full sm:w-[280px] h-9 text-sm bg-card">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ENGLISH_TRANSLATIONS.map((t) => (
                                        <SelectItem key={t.identifier} value={t.identifier}>
                                            {t.name} ({t.identifier})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                                    <Volume2 className="h-4 w-4" />
                                    Reading Voice
                                </label>
                                <p className="text-xs text-muted-foreground">
                                    {isMobile
                                        ? 'Choose a cloud voice for the audio Bible.'
                                        : 'Choose a voice for the audio Bible. Natural and premium voices sound more human.'}
                                </p>

                                {isMobile ? (
                                    /* Mobile: Google Cloud TTS voices */
                                    <Select value={selectedCloudVoice} onValueChange={(v) => {
                                        const wasPlaying = isPlaying || isPaused
                                        const resumeVerse = currentReadingVerse
                                        if (wasPlaying) {
                                            handleStopAudio()
                                            setIsPaused(true)
                                            setPausedAtVerse(resumeVerse)
                                        }
                                        setSelectedCloudVoice(v)
                                        savePrefs(translation, textSize, skipVerseNumbers, v)
                                    }}>
                                        <SelectTrigger className="w-full h-9 text-sm bg-card">
                                            <SelectValue placeholder="Select a voice..." />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            {CLOUD_TTS_VOICES.map((voice) => (
                                                <SelectItem key={voice.id} value={voice.id}>
                                                    <span className="flex items-center gap-1.5">
                                                        {voice.name}
                                                        <span className="text-muted-foreground text-xs">{voice.description}</span>
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    /* Desktop: Browser speechSynthesis voices */
                                    availableVoices.length > 0 ? (
                                        <Select value={selectedVoiceURI} onValueChange={(v) => {
                                            const wasPlaying = isPlaying || isPaused
                                            const resumeVerse = currentReadingVerse
                                            if (wasPlaying) {
                                                handleStopAudio()
                                                setIsPaused(true)
                                                setPausedAtVerse(resumeVerse)
                                            }
                                            setSelectedVoiceURI(v)
                                            savePrefs(translation, textSize, skipVerseNumbers, v)
                                        }}>
                                            <SelectTrigger className="w-full sm:w-[320px] h-9 text-sm bg-card">
                                                <SelectValue placeholder="Select a voice..." />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[300px]">
                                                {availableVoices.map((voice) => {
                                                    const nameLower = voice.name.toLowerCase()
                                                    const isNatural = nameLower.includes('natural') || nameLower.includes('premium') || nameLower.includes('enhanced')
                                                    let displayName = voice.name.replace(/Microsoft |Google |Apple /i, '').replace(/ \(Natural\)/i, '')
                                                    const langMap: Record<string, string> = { 'en-US': 'US', 'en-GB': 'UK', 'en-AU': 'AU', 'en-IN': 'IN', 'en-IE': 'IE', 'en-ZA': 'ZA' }
                                                    const langLabel = langMap[voice.lang] || ''
                                                    return (
                                                        <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                                                            <span className="flex items-center gap-1.5">
                                                                {displayName}
                                                                {langLabel && <Badge variant="outline" className="text-[10px] h-4 px-1">{langLabel}</Badge>}
                                                                {isNatural && <Badge variant="secondary" className="text-[10px] h-4 px-1">Natural</Badge>}
                                                            </span>
                                                        </SelectItem>
                                                    )
                                                })}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">Loading voices...</p>
                                    )
                                )}
                            </div>

                            {view === 'reading' && verses.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Audio Start Verse</label>
                                    <p className="text-xs text-muted-foreground">
                                        Choose which verse the audio should begin reading from.
                                    </p>
                                    <Select
                                        value={audioStartVerse ? String(audioStartVerse) : 'start'}
                                        onValueChange={(val) => setAudioStartVerse(val === 'start' ? null : Number(val))}
                                    >
                                        <SelectTrigger className="w-[200px] h-9 text-sm bg-card">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="start">From beginning</SelectItem>
                                            {verses.map((vItem) => (
                                                <SelectItem key={vItem.verse} value={String(vItem.verse)}>
                                                    Verse {vItem.verse}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Skip verse numbers toggle */}
                            <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-card">
                                <div className="space-y-0.5">
                                    <label htmlFor="skip-verse-numbers" className="text-sm font-medium text-foreground cursor-pointer">
                                        Skip verse numbers
                                    </label>
                                    <p className="text-xs text-muted-foreground">
                                        Read continuously without announcing each verse number
                                    </p>
                                </div>
                                <button
                                    id="skip-verse-numbers"
                                    role="switch"
                                    aria-checked={skipVerseNumbers}
                                    onClick={() => { const next = !skipVerseNumbers; setSkipVerseNumbers(next); savePrefs(translation, textSize, next, isMobile ? selectedCloudVoice : selectedVoiceURI) }}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${skipVerseNumbers ? 'bg-primary' : 'bg-muted'
                                        }`}
                                >
                                    <span
                                        className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform ${skipVerseNumbers ? 'translate-x-4' : 'translate-x-0'
                                            }`}
                                    />
                                </button>
                            </div>

                            {/* Voice preview */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1.5 bg-card"
                                disabled={audioLoading}
                                onClick={async () => {
                                    const previewText = 'For God so loved the world, that he gave his only begotten Son.'
                                    if (isMobile) {
                                        handleStopAudio()
                                        setAudioLoading(true)
                                        try {
                                            const res = await fetch('/api/tts', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ text: previewText, voice: selectedCloudVoice }),
                                            })
                                            if (!res.ok) throw new Error('Preview failed')
                                            const blob = await res.blob()
                                            const url = URL.createObjectURL(blob)
                                            const audio = new Audio(url)
                                            audio.onended = () => URL.revokeObjectURL(url)
                                            audio.play()
                                        } catch {
                                            toast.error('Could not preview voice.')
                                        }
                                        setAudioLoading(false)
                                    } else {
                                        window.speechSynthesis.cancel()
                                        const utt = new SpeechSynthesisUtterance(previewText)
                                        utt.rate = 0.9
                                        if (selectedVoiceURI) {
                                            const voice = availableVoices.find(v => v.voiceURI === selectedVoiceURI)
                                            if (voice) utt.voice = voice
                                        }
                                        window.speechSynthesis.speak(utt)
                                    }
                                }}
                            >
                                <Play className="h-3 w-3" />
                                {audioLoading ? 'Loading...' : 'Preview Voice'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* This Week's Scripture Banner */}
            {weekScripture && (
                <Card className="border-primary/30 bg-primary/15 cursor-pointer hover:bg-primary/20 transition-colors" onClick={handleWeekScripture}>
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                        <BookMarked className="h-5 w-5 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">
                                {weekNumber ? `Week ${weekNumber} Scripture` : "This Week's Scripture"}
                            </p>
                            <p className={`text-muted-foreground font-serif italic line-clamp-2 ${textSizeClass === 'text-sm' ? 'text-xs' : textSizeClass === 'text-base' ? 'text-sm' : textSizeClass === 'text-lg' ? 'text-base' : textSizeClass === 'text-xl' ? 'text-lg' : 'text-xl'}`}>
                                <ScriptureText reference={weekScripture} translation={translation} />
                            </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                    </CardContent>
                </Card>
            )}

            {/* Books View */}
            {view === 'books' && (
                <div className="space-y-4">
                    {booksLoading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <Skeleton key={i} className="h-10 rounded-md" />
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* Old Testament */}
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-foreground px-1">Old Testament</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                                    {books.filter(b => isOTBook(b.id)).map((book) => (
                                        <Button
                                            key={book.id}
                                            variant="outline"
                                            size="sm"
                                            className="justify-start text-sm h-9 bg-card"
                                            onClick={() => handleSelectBook(book.id)}
                                        >
                                            {book.name}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            {/* New Testament */}
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-foreground px-1">New Testament</h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                                    {books.filter(b => !isOTBook(b.id)).map((book) => (
                                        <Button
                                            key={book.id}
                                            variant="outline"
                                            size="sm"
                                            className="justify-start text-sm h-9 bg-card"
                                            onClick={() => handleSelectBook(book.id)}
                                        >
                                            {book.name}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Chapters View */}
            {view === 'chapters' && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Select a Chapter</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {chaptersLoading ? (
                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                                {Array.from({ length: 20 }).map((_, i) => (
                                    <Skeleton key={i} className="h-10 rounded-md" />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                                {chapters.map((ch) => (
                                    <Button
                                        key={ch.chapter}
                                        variant="outline"
                                        className="h-10 w-full bg-card"
                                        onClick={() => handleSelectChapter(ch.chapter)}
                                    >
                                        {ch.chapter}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Reading View */}
            {view === 'reading' && (
                <Card>
                    <CardHeader className="pb-3 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-base">
                                {selectedBookName} {selectedChapter}
                            </CardTitle>
                            <Badge variant="secondary" className="text-xs">
                                {ENGLISH_TRANSLATIONS.find(t => t.identifier === translation)?.identifier.toUpperCase()}
                            </Badge>
                        </div>

                        {/* Toolbar */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Highlight toggle */}
                            <Button
                                variant={highlightMode ? 'default' : 'outline'}
                                size="sm"
                                className={`h-8 gap-1.5 text-xs ${highlightMode ? '' : 'bg-card'}`}
                                onClick={() => {
                                    const entering = !highlightMode
                                    setHighlightMode(entering)
                                    setSelectedVerse(null)
                                    setEditingNote(null)
                                    if (!entering) {
                                        // Exiting highlight mode - clear selections
                                        setSelectedVerses(new Set())
                                    }
                                }}
                            >
                                <Highlighter className="h-3.5 w-3.5" />
                                {highlightMode ? 'Done' : 'Highlight'}
                            </Button>

                            {/* Selected verse count indicator */}
                            {selectedVerses.size > 0 && !highlightMode && (
                                <span className="text-xs text-muted-foreground font-sans">
                                    {selectedVerses.size} verse{selectedVerses.size > 1 ? 's' : ''} selected
                                </span>
                            )}

                            {highlightMode && (
                                <div className="flex items-center gap-1">
                                    {HIGHLIGHT_COLORS.map((c) => (
                                        <button
                                            key={c.color}
                                            className={`h-6 w-6 rounded-full ${c.bg} border-2 transition-all ${activeColor === c.color
                                                ? `${c.ring} ring-2 ring-offset-1 border-transparent scale-110`
                                                : 'border-border hover:scale-105'
                                                }`}
                                            onClick={() => setActiveColor(c.color)}
                                            aria-label={`${c.label} highlight`}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Audio controls */}
                            {!highlightMode && (
                                <div className="flex items-center gap-1 ml-auto">
                                    {isPlaying ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-1 text-xs bg-card"
                                                onClick={handlePauseAudio}
                                            >
                                                <Pause className="h-3.5 w-3.5" />
                                                Pause
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 text-xs"
                                                onClick={handleStopAudio}
                                            >
                                                <VolumeX className="h-3.5 w-3.5" />
                                            </Button>
                                        </>
                                    ) : isPaused ? (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 gap-1 text-xs bg-card"
                                                onClick={() => handlePlayChapter()}
                                            >
                                                <Play className="h-3.5 w-3.5" />
                                                Resume
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 text-xs"
                                                onClick={handleStopAudio}
                                            >
                                                <VolumeX className="h-3.5 w-3.5" />
                                            </Button>
                                        </>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-1.5 text-xs bg-card"
                                            onClick={() => handlePlayChapter()}
                                            disabled={versesLoading || verses.length === 0 || audioLoading}
                                        >
                                            <Volume2 className="h-3.5 w-3.5" />
                                            {audioLoading ? 'Loading...' : 'Listen'}
                                        </Button>
                                    )}
                                </div>
                            )}

                            {highlightMode && (
                                <p className="text-xs text-muted-foreground ml-auto">
                                    Tap verses to highlight {selectedVerses.size > 0 ? '- save or send from above' : ''}
                                </p>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Floating action bar for selected/highlighted verses */}
                        {selectedVerses.size > 0 && (
                            <div className="sticky top-0 z-10 bg-card border border-border rounded-lg p-3 mb-4 shadow-sm space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    {editingVerseRef ? (
                                        <Input
                                            autoFocus
                                            value={verseRefInput}
                                            onChange={(e) => setVerseRefInput(e.target.value)}
                                            onBlur={handleVerseRefCommit}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleVerseRefCommit()
                                                if (e.key === 'Escape') setEditingVerseRef(false)
                                            }}
                                            className="h-7 text-sm font-medium flex-1 min-w-0"
                                        />
                                    ) : (
                                        <button
                                            type="button"
                                            className="text-sm font-medium font-sans text-foreground truncate text-left hover:text-primary transition-colors underline decoration-dotted underline-offset-2 cursor-text"
                                            onClick={() => {
                                                setVerseRefInput(getSelectedRangeLabel())
                                                setEditingVerseRef(true)
                                            }}
                                            title="Click to edit verse reference"
                                        >
                                            {getSelectedRangeLabel()} ({selectedVerses.size} verse{selectedVerses.size > 1 ? 's' : ''})
                                        </button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs shrink-0"
                                        onClick={() => { setSelectedVerses(new Set()); setEditingVerseRef(false) }}
                                    >
                                        <X className="h-3 w-3 mr-1" />
                                        Clear
                                    </Button>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Button
                                        size="sm"
                                        className="h-8 text-xs gap-1.5 flex-1"
                                        onClick={() => {
                                            setJournalTitle(getDefaultMultiTitle())
                                            setMultiNote(getSelectedNotesText())
                                            setShowJournalDialog(true)
                                        }}
                                        disabled={savingMultiJournal}
                                    >
                                        <BookHeart className="h-3.5 w-3.5" />
                                        Save to Journal
                                    </Button>
                                    {pairingId && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs gap-1.5 flex-1 bg-card"
                                                onClick={() => setShowSendDialog(true)}
                                                disabled={sendingMultiVerse}
                                            >
                                                <Send className="h-3.5 w-3.5" />
                                                Send
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 text-xs gap-1.5 flex-1 bg-card"
                                                onClick={handleMultiShareWithPartner}
                                                disabled={sharingMultiVerse}
                                            >
                                                {sharingMultiVerse ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                                                Share
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {versesLoading ? (
                            <div className="space-y-3">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <Skeleton key={i} className="h-5 w-full rounded" />
                                ))}
                            </div>
                        ) : verses.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No verses found for this chapter.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {weekVerseRange && (
                                    <div className="flex items-center gap-2 text-xs text-primary font-sans bg-primary/15 rounded-md px-3 py-1.5 border border-primary/20">
                                        <BookMarked className="h-3.5 w-3.5 shrink-0" />
                                        <span>
                                            {weekNumber ? `Week ${weekNumber} study:` : 'Study:'} Verses {weekVerseRange.start}
                                            {weekVerseRange.end !== weekVerseRange.start ? `-${weekVerseRange.end}` : ''} highlighted below
                                        </span>
                                    </div>
                                )}
                                <div className="flex gap-6">
                                    {/* Main verse text */}
                                    <div className={`flex-1 min-w-0 space-y-1 font-serif leading-relaxed text-foreground ${textSizeClass}`}>
                                        {verses.map((v) => {
                                            const hl = getVerseHighlight(v.verse)
                                            const isSaving = savingHighlight === v.verse
                                            const isBeingRead = currentReadingVerse === v.verse
                                            const isStudyVerse = isWeekStudyVerse(v.verse)

                                            return (
                                                <Popover
                                                    key={v.verse}
                                                    open={selectedVerse === v.verse}
                                                    onOpenChange={(open) => {
                                                        if (!open) {
                                                            setSelectedVerse(null)
                                                            setEditingNote(null)
                                                            setNoteText('')
                                                            setJournalSaved(false)
                                                            setVerseSent(false)
                                                        }
                                                    }}
                                                >
                                                    <PopoverTrigger asChild>
                                                        <span
                                                            id={`verse-${v.verse}`}
                                                            role="button"
                                                            tabIndex={0}
                                                            className={`inline rounded-sm transition-all cursor-pointer ${isStudyVerse
                                                                ? 'bg-primary/15 border-l-2 border-primary pl-1 -ml-1 rounded-l-none'
                                                                : hl ? `${getHighlightBg(hl.color)} px-0.5 -mx-0.5` : ''
                                                                } ${selectedVerses.has(v.verse) && !hl
                                                                    ? 'bg-primary/15 ring-1 ring-primary/40 rounded px-0.5 -mx-0.5'
                                                                    : highlightMode
                                                                        ? 'hover:bg-primary/10 rounded px-0.5 -mx-0.5'
                                                                        : 'hover:bg-muted/50 rounded px-0.5 -mx-0.5'
                                                                } ${isSaving ? 'opacity-50' : ''} ${isBeingRead ? 'ring-2 ring-primary/40 rounded bg-primary/5' : ''
                                                                }`}
                                                            onClick={() => {
                                                                if (highlightMode) {
                                                                    const existingHighlight = getVerseHighlight(v.verse)
                                                                    if (existingHighlight) {
                                                                        // Already highlighted: just toggle selection, don't remove highlight
                                                                        setSelectedVerses(prev => {
                                                                            const next = new Set(prev)
                                                                            if (next.has(v.verse)) next.delete(v.verse)
                                                                            else next.add(v.verse)
                                                                            return next
                                                                        })
                                                                        setSelectedVerse(v.verse)
                                                                        setJournalSaved(false)
                                                                        setVerseSent(false)
                                                                    } else {
                                                                        // Not highlighted: highlight it and select it
                                                                        handleVerseClick(v.verse)
                                                                        setSelectedVerses(prev => {
                                                                            const next = new Set(prev)
                                                                            next.add(v.verse)
                                                                            return next
                                                                        })
                                                                    }
                                                                } else {
                                                                    setSelectedVerse(selectedVerse === v.verse ? null : v.verse)
                                                                    setJournalSaved(false)
                                                                    setVerseSent(false)
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault()
                                                                    if (highlightMode) {
                                                                        const existingHighlight = getVerseHighlight(v.verse)
                                                                        if (existingHighlight) {
                                                                            setSelectedVerses(prev => {
                                                                                const next = new Set(prev)
                                                                                if (next.has(v.verse)) next.delete(v.verse)
                                                                                else next.add(v.verse)
                                                                                return next
                                                                            })
                                                                            setSelectedVerse(v.verse)
                                                                        } else {
                                                                            handleVerseClick(v.verse)
                                                                            setSelectedVerses(prev => {
                                                                                const next = new Set(prev)
                                                                                next.add(v.verse)
                                                                                return next
                                                                            })
                                                                        }
                                                                    } else {
                                                                        setSelectedVerse(selectedVerse === v.verse ? null : v.verse)
                                                                        setJournalSaved(false)
                                                                        setVerseSent(false)
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <sup className="text-xs font-sans font-semibold text-primary mr-0.5 select-none">
                                                                {v.verse}
                                                            </sup>
                                                            <span>
                                                                {v.text.replace(/\n/g, ' ').trim()}{' '}
                                                            </span>
                                                            {hl?.note && (
                                                                <MessageSquare className="inline h-3 w-3 text-muted-foreground mb-1 ml-0.5" />
                                                            )}
                                                            {hl?.shared_with_partner && (
                                                                <Share2 className="inline h-3 w-3 text-primary mb-1 ml-0.5" />
                                                            )}
                                                        </span>
                                                    </PopoverTrigger>

                                                    <PopoverContent
                                                        className="w-80 p-3"
                                                        align="start"
                                                        side="bottom"
                                                        onOpenAutoFocus={(e) => e.preventDefault()}
                                                    >
                                                        {(() => {
                                                            const highlightGroup = hl ? getHighlightGroup(v.verse) : [v.verse]
                                                            const isGroup = highlightGroup.length > 1
                                                            const groupLabel = isGroup
                                                                ? `Verse ${buildRangeStr(highlightGroup)}`
                                                                : `Verse ${v.verse}`
                                                            return (
                                                                <div className="space-y-3">
                                                                    {/* Header with verse number/range and color picker */}
                                                                    <div className="flex items-center justify-between">
                                                                        <p className="text-sm font-medium font-sans">{groupLabel}</p>
                                                                        <div className="flex items-center gap-1">
                                                                            {HIGHLIGHT_COLORS.map((c) => (
                                                                                <button
                                                                                    key={c.color}
                                                                                    className={`h-5 w-5 rounded-full ${c.bg} border transition-all ${hl?.color === c.color
                                                                                        ? `${c.ring} ring-1 ring-offset-1 border-transparent`
                                                                                        : 'border-border hover:scale-110'
                                                                                        }`}
                                                                                    onClick={async () => {
                                                                                        if (selectedBook && selectedChapter) {
                                                                                            const result = await toggleHighlight(selectedBook, selectedChapter, v.verse, c.color, translation)
                                                                                            if (result.highlight) {
                                                                                                setHighlights(prev => {
                                                                                                    const idx = prev.findIndex(h => Number(h.verse) === v.verse)
                                                                                                    if (idx >= 0) {
                                                                                                        const copy = [...prev]
                                                                                                        copy[idx] = result.highlight!
                                                                                                        return copy
                                                                                                    }
                                                                                                    return [...prev, result.highlight!]
                                                                                                })
                                                                                            } else if (result.removed) {
                                                                                                setHighlights(prev => prev.filter(h => Number(h.verse) !== v.verse))
                                                                                            }
                                                                                        }
                                                                                    }}
                                                                                    aria-label={`${c.label} highlight`}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Note editing (only for highlighted verses) */}
                                                                    {hl && editingNote === hl.id ? (
                                                                        <div className="space-y-2">
                                                                            <Textarea
                                                                                value={noteText}
                                                                                onChange={(e) => setNoteText(e.target.value)}
                                                                                placeholder="Add your note..."
                                                                                className="text-sm min-h-[80px] resize-none font-sans"
                                                                                autoFocus
                                                                            />
                                                                            <div className="flex items-center gap-2 justify-end">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="h-7 text-xs"
                                                                                    onClick={() => {
                                                                                        setEditingNote(null)
                                                                                        setNoteText('')
                                                                                    }}
                                                                                >
                                                                                    <X className="h-3 w-3 mr-1" />
                                                                                    Cancel
                                                                                </Button>
                                                                                <Button
                                                                                    size="sm"
                                                                                    className="h-7 text-xs"
                                                                                    onClick={handleSaveNote}
                                                                                    disabled={savingNote}
                                                                                >
                                                                                    <Check className="h-3 w-3 mr-1" />
                                                                                    {savingNote ? 'Saving...' : 'Save'}
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            {/* Show existing note */}
                                                                            {hl?.note && (
                                                                                <p className="text-sm text-muted-foreground italic bg-muted/50 rounded p-2 font-sans">
                                                                                    {hl.note}
                                                                                </p>
                                                                            )}

                                                                            {/* Action buttons -- available for ALL verses */}
                                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                                {/* Highlight/Note for highlighted verses */}
                                                                                {hl && (
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        className="h-7 text-xs gap-1 bg-transparent font-sans"
                                                                                        onClick={() => handleOpenNote(v.verse)}
                                                                                    >
                                                                                        <PenLine className="h-3 w-3" />
                                                                                        {hl.note ? 'Edit Note' : 'Add Note'}
                                                                                    </Button>
                                                                                )}

                                                                                {/* Share with partner */}
                                                                                {pairingId && hl && (
                                                                                    isGroup ? (
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            className="h-7 text-xs gap-1 bg-transparent font-sans"
                                                                                            onClick={async () => {
                                                                                                const bookName = books.find(b => b.id === selectedBook)?.name || selectedBook || ''
                                                                                                const entries = highlightGroup.map(vn => {
                                                                                                    const vData = verses.find(vv => vv.verse === vn)
                                                                                                    const vhl = getVerseHighlight(vn)
                                                                                                    return { verse: vn, text: vData?.text || '', note: vhl?.note || null }
                                                                                                })
                                                                                                const result = await shareMultipleVersesWithPartner(pairingId, bookName, selectedChapter!, entries)
                                                                                                if (result.success) {
                                                                                                    toast.success('Shared with your partner!')
                                                                                                    setSelectedVerse(null)
                                                                                                }
                                                                                            }}
                                                                                            disabled={sharingHighlight}
                                                                                        >
                                                                                            <Share2 className="h-3 w-3" />
                                                                                            Share
                                                                                        </Button>
                                                                                    ) : (
                                                                                        <Button
                                                                                            variant={hl.shared_with_partner ? 'default' : 'outline'}
                                                                                            size="sm"
                                                                                            className={`h-7 text-xs gap-1 font-sans ${!hl.shared_with_partner ? 'bg-transparent' : ''}`}
                                                                                            onClick={() => handleShareHighlight(hl, v)}
                                                                                            disabled={sharingHighlight}
                                                                                        >
                                                                                            <Share2 className="h-3 w-3" />
                                                                                            {hl.shared_with_partner ? 'Shared' : 'Share'}
                                                                                        </Button>
                                                                                    )
                                                                                )}

                                                                                {/* Save to Journal */}
                                                                                {pairingId && hl && (
                                                                                    isGroup ? (
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            className="h-7 text-xs gap-1 bg-transparent font-sans"
                                                                                            onClick={() => {
                                                                                                // Pre-populate selectedVerses with the group and open journal dialog
                                                                                                const groupSet = new Set(highlightGroup)
                                                                                                setSelectedVerses(groupSet)
                                                                                                setJournalTitle((() => {
                                                                                                    const bookName = books.find(b => b.id === selectedBook)?.name || selectedBook || ''
                                                                                                    const rangeLabel = `${bookName} ${selectedChapter}:${buildRangeStr(highlightGroup)}`
                                                                                                    const hasNotes = highlightGroup.some(vn => getVerseHighlight(vn)?.note)
                                                                                                    return hasNotes ? `Scripture and notes from ${rangeLabel}` : `Scripture from ${rangeLabel}`
                                                                                                })())
                                                                                                setMultiNote(getSelectedNotesText(groupSet))
                                                                                                setShowJournalDialog(true)
                                                                                                setSelectedVerse(null)
                                                                                            }}
                                                                                        >
                                                                                            <BookHeart className="h-3 w-3" />
                                                                                            Journal
                                                                                        </Button>
                                                                                    ) : (
                                                                                        <Button
                                                                                            variant={journalSaved ? 'default' : 'outline'}
                                                                                            size="sm"
                                                                                            className={`h-7 text-xs gap-1 font-sans ${!journalSaved ? 'bg-transparent' : ''}`}
                                                                                            onClick={() => handleSaveToJournal(hl, v)}
                                                                                            disabled={savingJournal || journalSaved}
                                                                                        >
                                                                                            <BookHeart className="h-3 w-3" />
                                                                                            {journalSaved ? 'Saved' : savingJournal ? 'Saving...' : 'Journal'}
                                                                                        </Button>
                                                                                    )
                                                                                )}

                                                                                {/* Send verse to chat */}
                                                                                {pairingId && (
                                                                                    isGroup ? (
                                                                                        <Button
                                                                                            variant="outline"
                                                                                            size="sm"
                                                                                            className="h-7 text-xs gap-1 bg-transparent font-sans"
                                                                                            onClick={() => {
                                                                                                setSelectedVerses(new Set(highlightGroup))
                                                                                                setShowSendDialog(true)
                                                                                                setSelectedVerse(null)
                                                                                            }}
                                                                                        >
                                                                                            <Send className="h-3 w-3" />
                                                                                            Send
                                                                                        </Button>
                                                                                    ) : (
                                                                                        <Button
                                                                                            variant={verseSent ? 'default' : 'outline'}
                                                                                            size="sm"
                                                                                            className={`h-7 text-xs gap-1 font-sans ${!verseSent ? 'bg-transparent' : ''}`}
                                                                                            onClick={() => handleSendVerse(v, hl?.note)}
                                                                                            disabled={sendingVerse || verseSent}
                                                                                        >
                                                                                            <Send className="h-3 w-3" />
                                                                                            {verseSent ? 'Sent' : sendingVerse ? 'Sending...' : 'Send'}
                                                                                        </Button>
                                                                                    )
                                                                                )}

                                                                                {/* Listen from here -- available for ALL verses */}
                                                                                {(
                                                                                    <Button
                                                                                        variant="outline"
                                                                                        size="sm"
                                                                                        className="h-7 text-xs gap-1 font-sans bg-transparent"
                                                                                        onClick={() => {
                                                                                            handlePlayChapter(v.verse)
                                                                                            setSelectedVerse(null)
                                                                                        }}
                                                                                    >
                                                                                        <Volume2 className="h-3 w-3" />
                                                                                        Listen from here
                                                                                    </Button>
                                                                                )}

                                                                                {/* Remove highlight */}
                                                                                {hl && (
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        className="h-7 text-xs gap-1 text-destructive hover:text-destructive font-sans"
                                                                                        onClick={() => handleDeleteHighlight(hl.id, v.verse)}
                                                                                    >
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                        Remove
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )
                                                        })()}
                                                    </PopoverContent>
                                                </Popover>
                                            )
                                        })}
                                    </div>

                                    {/* Annotation sidebar - desktop only */}
                                    {highlights.some(h => h.note) && (
                                        <aside className="hidden lg:block w-56 shrink-0 space-y-3 pt-1">
                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide font-sans">
                                                Notes
                                            </p>
                                            {(() => {
                                                // Group notes by highlight groups to show ranges
                                                const notedHighlights = highlights
                                                    .filter(h => h.note)
                                                    .sort((a, b) => Number(a.verse) - Number(b.verse))
                                                const seen = new Set<number>()
                                                const entries: { key: string; label: string; note: string; verse: number }[] = []
                                                for (const h of notedHighlights) {
                                                    const vNum = Number(h.verse)
                                                    if (seen.has(vNum)) continue
                                                    const group = getHighlightGroup(vNum)
                                                    group.forEach(v => seen.add(v))
                                                    entries.push({
                                                        key: h.id,
                                                        label: group.length > 1 ? `v.${buildRangeStr(group)}` : `v.${h.verse}`,
                                                        note: h.note!,
                                                        verse: vNum,
                                                    })
                                                }
                                                return entries.map(entry => (
                                                    <button
                                                        key={entry.key}
                                                        className="block w-full text-left group"
                                                        onClick={() => {
                                                            setSelectedVerse(entry.verse)
                                                            setJournalSaved(false)
                                                            setVerseSent(false)
                                                        }}
                                                    >
                                                        <div className={`rounded-md border p-2.5 transition-colors hover:border-primary/40 hover:bg-muted/50 ${selectedVerse === entry.verse ? 'border-primary/50 bg-primary/5' : 'border-border'
                                                            }`}>
                                                            <p className="text-[10px] font-semibold text-primary font-sans mb-1">
                                                                {entry.label}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground leading-relaxed font-sans line-clamp-4">
                                                                {entry.note}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))
                                            })()}
                                        </aside>
                                    )}
                                </div>
                            </div>
                        )}



                        {/* Journal title dialog for multi-verse save */}
                        {showJournalDialog && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                <div className="bg-card rounded-lg border border-border shadow-lg w-full max-w-md p-5 space-y-4">
                                    <h3 className="text-base font-semibold font-sans text-foreground">Save to Journal</h3>
                                    <p className="text-sm text-muted-foreground">{getSelectedRangeLabel()}</p>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground" htmlFor="journal-title">Entry Title</label>
                                        <Input
                                            id="journal-title"
                                            value={journalTitle}
                                            onChange={(e) => setJournalTitle(e.target.value)}
                                            placeholder="Enter a title for this journal entry..."
                                            className="text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground" htmlFor="journal-note">Notes (optional)</label>
                                        <Textarea
                                            id="journal-note"
                                            value={multiNote}
                                            onChange={(e) => setMultiNote(e.target.value)}
                                            placeholder="Add your thoughts or notes about these verses..."
                                            className="text-sm resize-none"
                                            rows={3}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => { setShowJournalDialog(false); setJournalTitle(''); setMultiNote('') }}
                                            disabled={savingMultiJournal}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleMultiSaveToJournal}
                                            disabled={savingMultiJournal}
                                        >
                                            {savingMultiJournal ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <BookHeart className="h-3.5 w-3.5 mr-1" />}
                                            {savingMultiJournal ? 'Saving...' : 'Save'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Send to chat dialog for multi-verse */}
                        {showSendDialog && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                <div className="bg-card rounded-lg border border-border shadow-lg w-full max-w-md p-5 space-y-4">
                                    <h3 className="text-base font-semibold font-sans text-foreground">Send to Chat</h3>
                                    <p className="text-sm text-muted-foreground">{getSelectedRangeLabel()}</p>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground" htmlFor="send-note">Add a note (optional)</label>
                                        <Textarea
                                            id="send-note"
                                            value={sendNote}
                                            onChange={(e) => setSendNote(e.target.value)}
                                            placeholder="Share your thoughts about these verses..."
                                            className="text-sm resize-none"
                                            rows={3}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => { setShowSendDialog(false); setSendNote('') }}
                                            disabled={sendingMultiVerse}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleMultiSendToPartner}
                                            disabled={sendingMultiVerse}
                                        >
                                            {sendingMultiVerse ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                                            {sendingMultiVerse ? 'Sending...' : 'Send'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Single verse journal title dialog */}
                        {singleJournalVerse && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                                <div className="bg-card rounded-lg border border-border shadow-lg w-full max-w-md p-5 space-y-4">
                                    <h3 className="text-base font-semibold font-sans text-foreground">Save to Journal</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {books.find(b => b.id === selectedBook)?.name} {singleJournalVerse.v.chapter}:{singleJournalVerse.v.verse}
                                    </p>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground" htmlFor="single-journal-title">Entry Title</label>
                                        <Input
                                            id="single-journal-title"
                                            value={singleJournalTitle}
                                            onChange={(e) => setSingleJournalTitle(e.target.value)}
                                            placeholder="Enter a title..."
                                            className="text-sm"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => { setSingleJournalVerse(null); setSingleJournalTitle('') }}
                                            disabled={savingJournal}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={confirmSingleJournalSave}
                                            disabled={savingJournal}
                                        >
                                            {savingJournal ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <BookHeart className="h-3.5 w-3.5 mr-1" />}
                                            {savingJournal ? 'Saving...' : 'Save'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Chapter navigation */}
                        <div className="flex items-center justify-between pt-6 mt-6 border-t">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 bg-card"
                                onClick={handlePrevChapter}
                                disabled={!selectedChapter || selectedChapter <= 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Chapter {selectedChapter} of {chapters.length}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 bg-card"
                                onClick={handleNextChapter}
                                disabled={!selectedChapter || selectedChapter >= chapters.length}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
