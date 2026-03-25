'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import {
    BookOpen, ChevronLeft, ChevronRight, BookMarked, ArrowLeft,
    Highlighter, MessageSquare, Trash2, X, Check,
    Volume2, VolumeX, Pause, Play, Type,
    BookHeart, Share2, PenLine, Send, Loader2, Sparkles, RefreshCw
} from 'lucide-react'
import useSWR from 'swr'
import {
    type BibleHighlight,
    type HighlightColor,
    getHighlightsForChapter,
    getAllHighlights,
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
    sendExplanationToPartner,
    saveExplanationToJournal,
} from '@/lib/bible-highlight-actions'
import { ScriptureText } from '@/components/bible/scripture-text'
import { FeatureTour } from '@/components/onboarding/feature-tour'
import { bibleSteps, bibleReadingSteps } from '@/lib/tour-steps'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from 'sonner'
import { BOOK_ID_TO_NAME, BOOK_MAP } from '@/lib/bible-utils'

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
    { identifier: 'NIV', name: 'New International Version' },
    { identifier: 'ESV', name: 'English Standard Version' },
    { identifier: 'NLT', name: 'New Living Translation' },
    { identifier: 'KJV', name: 'King James Version' },
    { identifier: 'NKJV', name: 'New King James Version' },
    { identifier: 'NASB', name: 'New American Standard' },
    { identifier: 'CSB17', name: 'Christian Standard Bible' },
    { identifier: 'ASV', name: 'American Standard Version' },
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

interface VoicePreference {
    type: 'openai' | 'google' | 'browser'
    uri: string
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
    savedReadingSpeed?: number | null
    savedVoicePreferences?: VoicePreference[] | null
    userRole?: string | null
}

export function BibleReader({ weekScripture, weekNumber, pairingId, savedTranslation, savedTextSize, savedBook, savedChapter, savedSkipVerseNumbers = true, savedVoiceURI, savedReadingSpeed, savedVoicePreferences, userRole }: BibleReaderProps) {
    const searchParams = useSearchParams()
    const router = useRouter()

    // Determine initial state: URL params take user directly to reading.
    // Saved place is remembered but user always starts at books view unless
    // they arrive via a direct link (e.g. weekly scripture link with URL params).
    const urlBook = searchParams.get('book')
    const urlChapter = searchParams.get('chapter')
    const urlVerses = searchParams.get('verses')
    const hasUrlParams = !!urlBook
    const initialBook = urlBook || savedBook || null
    const initialChapter = urlChapter ? Number(urlChapter) : (!urlBook && savedChapter ? savedChapter : null)
    const initialView = hasUrlParams
        ? (initialBook && initialChapter) ? 'reading' as const
            : initialBook ? 'chapters' as const
                : 'books' as const
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
        searchParams.get('v') || savedTranslation || 'ESV'
    )
    const [textSize, setTextSize] = useState(savedTextSize || 'base')
    const [selectedBook, setSelectedBook] = useState<string | null>(initialBook)
    const [selectedChapter, setSelectedChapter] = useState<number | null>(initialChapter)
    const [view, setView] = useState<'books' | 'chapters' | 'reading'>(initialView)
    const [showSettings, setShowSettings] = useState(false)
    const [showHighlightsModal, setShowHighlightsModal] = useState(false)
    const [allHighlights, setAllHighlights] = useState<BibleHighlight[]>([])
    const [loadingHighlights, setLoadingHighlights] = useState(false)
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
    const [previewLoading, setPreviewLoading] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [currentReadingVerse, setCurrentReadingVerse] = useState<number | null>(null)
    const [pausedAtVerse, setPausedAtVerse] = useState<number | null>(null)
    const [ttsProgress, setTtsProgress] = useState(0) // 0 to 1 progress through chapter
    const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null) // seconds left
    const [autoPlayNextChapter, setAutoPlayNextChapter] = useState(false)

    // AI Explain feature
    const [showExplainDialog, setShowExplainDialog] = useState(false)
    const [explainReference, setExplainReference] = useState('')
    const [explainText, setExplainText] = useState('')
    const [explainLoading, setExplainLoading] = useState(false)
    const [explainContent, setExplainContent] = useState('')
    const [explainError, setExplainError] = useState(false)
    const [explainSharing, setExplainSharing] = useState(false)
    const [selectedExplainLines, setSelectedExplainLines] = useState<Set<number>>(new Set())
    const [showExplainJournalDialog, setShowExplainJournalDialog] = useState(false)
    const [explainJournalTitle, setExplainJournalTitle] = useState('')
    const [explainJournalNote, setExplainJournalNote] = useState('')
    const [explainJournalSaving, setExplainJournalSaving] = useState(false)
    const explainAbortRef = useRef<AbortController | null>(null)
    const isMobile = useIsMobile()
    // Detect Apple platforms (iOS, iPadOS, macOS) to prefer cloud voices
    // Safari/WebKit speechSynthesis voices are lower quality than Google Cloud TTS
    const [isAppleDevice, setIsAppleDevice] = useState(false)
    useEffect(() => {
        if (typeof navigator === 'undefined') return
        const ua = navigator.userAgent
        const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        const isMacSafari = /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome/.test(ua)
        setIsAppleDevice(isIOS || isMacSafari)
    }, [])
    // Use cloud voices for ALL platforms - browser speechSynthesis is unreliable on desktop
    // Cloud TTS provides consistent, high-quality audio across all devices
    const useCloudVoices = true

    // Desktop: browser speechSynthesis
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
    const speechSupportedRef = useRef(typeof window !== 'undefined' && 'speechSynthesis' in window)
    const ttsSessionRef = useRef(0) // Incremented on each new play session to ignore stale callbacks
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])
    // Helper to get voice from preferences by type
    const getVoiceFromPreferences = (type: 'openai' | 'google' | 'browser'): string | null => {
        if (!savedVoicePreferences) return null
        const pref = savedVoicePreferences.find(p => p.type === type)
        return pref?.uri || null
    }

    // Initialize browser voice from preferences (for desktop) or fall back to savedVoiceURI
    const browserVoicePref = getVoiceFromPreferences('browser')
    const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>(browserVoicePref || savedVoiceURI || '')

    // Initialize cloud voice from preferences - prefer OpenAI Echo as default
    const cloudVoicePref = getVoiceFromPreferences('openai') || getVoiceFromPreferences('google')
    const initialCloudVoice = cloudVoicePref ||
        (savedVoiceURI?.startsWith('en-') || savedVoiceURI?.startsWith('openai-') ? savedVoiceURI : 'openai-echo')

    // Cloud TTS verse-by-verse with pre-buffering
    const [selectedCloudVoice, setSelectedCloudVoice] = useState<string>(initialCloudVoice)
    const [audioLoading, setAudioLoading] = useState(false)
    const mobileAudioRef = useRef<HTMLAudioElement | null>(null)
    type MobileQueueItem = {
        verseIndices: number[]     // verse indices covered by this batch
        verseNums: number[]        // verse numbers for highlights
        audio: HTMLAudioElement | null
        loading: boolean
        blobUrl?: string
    }
    const mobileQueueRef = useRef<MobileQueueItem[]>([])
    const mobilePlayingRef = useRef(false)
    const mobileCurrentIdxRef = useRef(0)
    const mobileStoppedRef = useRef(false)

    const CLOUD_TTS_VOICES = [
        // OpenAI voices (high quality, natural sounding)
        { id: 'openai-nova', name: 'Nova', description: 'Warm female', provider: 'openai' as const },
        { id: 'openai-echo', name: 'Echo', description: 'Clear male', provider: 'openai' as const },
        { id: 'openai-alloy', name: 'Alloy', description: 'Neutral balanced', provider: 'openai' as const },
        { id: 'openai-fable', name: 'Fable', description: 'Expressive male', provider: 'openai' as const },
        { id: 'openai-onyx', name: 'Onyx', description: 'Deep male', provider: 'openai' as const },
        { id: 'openai-shimmer', name: 'Shimmer', description: 'Gentle female', provider: 'openai' as const },
        // Google Wavenet voices
        { id: 'en-US-Wavenet-D', name: 'David', description: 'Warm male', provider: 'google' as const },
        { id: 'en-US-Wavenet-C', name: 'Clara', description: 'Clear female', provider: 'google' as const },
        { id: 'en-US-Wavenet-A', name: 'Adam', description: 'Deep male', provider: 'google' as const },
        { id: 'en-US-Wavenet-E', name: 'Emily', description: 'Gentle female', provider: 'google' as const },
        { id: 'en-US-Wavenet-B', name: 'Brian', description: 'Calm male', provider: 'google' as const },
        { id: 'en-US-Wavenet-F', name: 'Fiona', description: 'Bright female', provider: 'google' as const },
        { id: 'en-GB-Wavenet-B', name: 'James', description: 'British male', provider: 'google' as const },
        { id: 'en-GB-Wavenet-A', name: 'Charlotte', description: 'British female', provider: 'google' as const },
        { id: 'en-AU-Wavenet-B', name: 'Liam', description: 'Australian male', provider: 'google' as const },
        { id: 'en-AU-Wavenet-C', name: 'Sophie', description: 'Australian female', provider: 'google' as const },
    ]

    const getVoiceProvider = (voiceId: string) => voiceId.startsWith('openai-') ? 'openai' : 'google'
    const getOpenAIVoiceName = (voiceId: string) => voiceId.replace('openai-', '')

    const [skipVerseNumbers, setSkipVerseNumbers] = useState(savedSkipVerseNumbers)
    const skipVerseNumbersRef = useRef(savedSkipVerseNumbers)
    const [speechRate, setSpeechRate] = useState(savedReadingSpeed ?? 1.0)
    const speechRateRef = useRef(savedReadingSpeed ?? 1.0)

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

    // Load browser voices for non-cloud-voice devices only
    useEffect(() => {
        if (useCloudVoices || !speechSupportedRef.current) return

        // macOS novelty/robotic voices to exclude
        const noveltyVoices = new Set([
            'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles',
            'cellos', 'good news', 'jester', 'junior', 'kathy', 'organ',
            'ralph', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox',
            'princess', 'bruce', 'fred', 'hysterical', 'deranged', 'pipe organ',
        ])

        // Score a voice by quality tier (lower = better)
        const getVoiceScore = (v: SpeechSynthesisVoice): number => {
            const n = v.name.toLowerCase()
            // Tier 0: iOS Siri enhanced/premium neural voices
            if (n.includes('(enhanced)') || n.includes('(premium)')) return 0
            // Tier 1: Explicit natural/neural markers (various platforms)
            if (n.includes('natural') || n.includes('neural')) return 1
            // Tier 2: Google TTS voices (high-quality on Android Chrome)
            if (n.startsWith('google ')) return 2
            // Tier 3: Microsoft Online (Neural) voices on Edge
            if (n.includes('microsoft') && n.includes('online')) return 3
            // Tier 4: Other Microsoft voices
            if (n.includes('microsoft')) return 4
            // Tier 5: Cloud/remote voices (usually higher quality than local)
            if (!v.localService) return 5
            // Tier 6: Known good iOS compact voices (Samantha, Daniel, Karen etc.)
            const iosQualityVoices = ['samantha', 'daniel', 'karen', 'moira', 'rishi', 'tessa', 'aaron', 'nicky', 'allison', 'ava', 'susan', 'tom', 'kate', 'lee', 'oliver']
            if (iosQualityVoices.some(name => n.includes(name))) return 6
            // Tier 7: Everything else
            return 7
        }

        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices()
            const englishVoices = voices
                .filter(v => {
                    if (!v.lang.startsWith('en')) return false
                    const nameLower = v.name.toLowerCase()
                    return !noveltyVoices.has(nameLower) && !noveltyVoices.has(nameLower.replace(/^apple /, ''))
                })
                .sort((a, b) => {
                    const scoreA = getVoiceScore(a)
                    const scoreB = getVoiceScore(b)
                    if (scoreA !== scoreB) return scoreA - scoreB
                    return a.name.localeCompare(b.name)
                })
            setAvailableVoices(englishVoices)

            // Set default voice if no saved preference
            if (selectedVoiceURI) {
                const savedExists = englishVoices.some(v => v.voiceURI === selectedVoiceURI)
                if (!savedExists && englishVoices.length > 0) {
                    // Find Brian Online as fallback default for browser voices
                    const brianVoice = englishVoices.find(v =>
                        v.name.toLowerCase().includes('brian') && !v.localService
                    )
                    setSelectedVoiceURI(brianVoice?.voiceURI || englishVoices[0].voiceURI)
                }
            } else if (englishVoices.length > 0) {
                // No saved voice - default to Brian Online (cloud voice) if available
                const brianVoice = englishVoices.find(v =>
                    v.name.toLowerCase().includes('brian') && !v.localService
                )
                setSelectedVoiceURI(brianVoice?.voiceURI || englishVoices[0].voiceURI)
            }
        }

        loadVoices()
        window.speechSynthesis.onvoiceschanged = loadVoices
        return () => { window.speechSynthesis.onvoiceschanged = null }
    }, [useCloudVoices, selectedVoiceURI])

    // Keep ref in sync so mid-playback reads the latest value
    useEffect(() => {
        skipVerseNumbersRef.current = skipVerseNumbers
    }, [skipVerseNumbers])

    useEffect(() => {
        speechRateRef.current = speechRate
    }, [speechRate])

    // Preference save debounce
    const prefTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Determine voice type from voice URI
    const getVoiceType = (voiceUri: string): 'openai' | 'google' | 'browser' => {
        if (voiceUri.startsWith('openai-')) return 'openai'
        if (voiceUri.startsWith('en-') && voiceUri.includes('Wavenet')) return 'google'
        return 'browser'
    }

    const savePrefs = useCallback((trans: string, size: string, skip?: boolean, voice?: string, speed?: number) => {
        if (prefTimeoutRef.current) clearTimeout(prefTimeoutRef.current)
        prefTimeoutRef.current = setTimeout(() => {
            const voiceType = voice ? getVoiceType(voice) : undefined
            const voicePref = voice && voiceType ? { type: voiceType, uri: voice } : undefined
            saveBiblePreference(trans, size, skip, voice, speed, voicePref)
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

    // Cleanup speech on unmount or chapter change
    useEffect(() => {
        return () => {
            // Desktop cleanup
            if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel()
            }
            // Mobile cleanup
            mobileStoppedRef.current = true
            if (mobileAudioRef.current) {
                mobileAudioRef.current.pause()
                mobileAudioRef.current = null
            }
            for (const item of mobileQueueRef.current) {
                if (item.blobUrl) URL.revokeObjectURL(item.blobUrl)
            }
            mobileQueueRef.current = []
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
                setSelectedVerses(prev => {
                    const next = new Set(prev)
                    next.delete(verseNum)
                    return next
                })
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
            // For groups, collect all existing notes from the group
            const group = getHighlightGroup(verseNum)
            const groupNotes: string[] = []
            for (const gv of group) {
                const gh = getVerseHighlight(gv)
                if (gh?.note) groupNotes.push(gh.note)
            }
            setEditingNote(h.id)
            // Pre-populate with all collected group notes (deduplicated)
            const uniqueNotes = [...new Set(groupNotes)]
            setNoteText(uniqueNotes.length > 0 ? uniqueNotes.join('\n\n') : '')
            setSelectedVerse(verseNum)
        }
    }

    const handleSaveNote = async () => {
        if (!editingNote) return
        setSavingNote(true)
        try {
            // Find which verse this highlight belongs to
            const editingHl = highlights.find(h => h.id === editingNote)
            if (editingHl) {
                const verseNum = Number(editingHl.verse)
                const group = getHighlightGroup(verseNum)
                // Save the note to all verses in the group
                for (const gv of group) {
                    const gh = getVerseHighlight(gv)
                    if (gh) {
                        const updated = await updateHighlightNote(gh.id, noteText)
                        if (updated) {
                            setHighlights(prev => prev.map(h => h.id === gh.id ? updated : h))
                        }
                    }
                }
            } else {
                // Fallback: just update the single highlight
                const updated = await updateHighlightNote(editingNote, noteText)
                if (updated) {
                    setHighlights(prev => prev.map(h => h.id === editingNote ? updated : h))
                }
            }
        } catch { /* silent */ }
        setSavingNote(false)
        setEditingNote(null)
        setNoteText('')
        // Keep the action popup open so users can do other actions (send, journal, etc.)
    }

    const handleDeleteHighlight = async (highlightId: string, verseNum: number, removeGroup = false) => {
        try {
            if (removeGroup) {
                // Find all verses in the same highlight group (adjacent same-color highlights)
                const group = getHighlightGroup(verseNum)
                // Delete all highlights in the group
                const groupHighlightIds = group
                    .map(vn => getVerseHighlight(vn))
                    .filter(Boolean)
                    .map(h => h!.id)
                await Promise.all(groupHighlightIds.map(id => deleteHighlight(id)))
                setHighlights(prev => prev.filter(h => !groupHighlightIds.includes(h.id)))
                // Remove all group verses from selectedVerses
                setSelectedVerses(prev => {
                    const next = new Set(prev)
                    group.forEach(vn => next.delete(vn))
                    return next
                })
            } else {
                await deleteHighlight(highlightId)
                setHighlights(prev => prev.filter(h => h.id !== highlightId))
                // Also remove from multi-select set
                setSelectedVerses(prev => {
                    const next = new Set(prev)
                    next.delete(verseNum)
                    return next
                })
            }
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
                hl.id, !hl.shared_with_partner, pairingId, bookName, v.text, translation
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
        const notes = Array.from(versesToCheck)
            .sort((a, b) => a - b)
            .map(vn => {
                const hl = getVerseHighlight(vn)
                return hl?.note ? hl.note : null
            })
            .filter(Boolean) as string[]
        // Deduplicate notes (group verses share the same note text)
        return [...new Set(notes)].join('\n')
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
                pairingId, bookName, selectedChapter!, verseEntries, journalTitle || undefined, translation
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
            const result = await sendMultipleVersesToPartner(pairingId, bookName, selectedChapter!, verseEntries, translation)
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
            const result = await sendVerseToPartner(pairingId, bookName, v.chapter, v.verse, v.text, note || undefined, translation)
            if (result.success) setVerseSent(true)
        } catch { /* silent */ }
        setSendingVerse(false)
    }

    const [singleJournalVerse, setSingleJournalVerse] = useState<{ hl: BibleHighlight; v: BibleVerse } | null>(null)
    const [singleJournalTitle, setSingleJournalTitle] = useState('')
    const [singleJournalNote, setSingleJournalNote] = useState('')

    const handleSaveToJournal = async (hl: BibleHighlight, v: BibleVerse) => {
        if (!pairingId) return
        // Close the popover first so the dialog is fully visible
        setSelectedVerse(null)
        // Pre-populate with defaults
        const bookName = books.find(b => b.id === selectedBook)?.name || selectedBook || ''
        const scriptureRef = `${bookName} ${v.chapter}:${v.verse}`
        const defaultTitle = `Verse from ${scriptureRef}`
        setSingleJournalTitle(defaultTitle)
        setSingleJournalNote(hl.note || '')
        setSingleJournalVerse({ hl, v })
    }

    const confirmSingleJournalSave = async () => {
        if (!pairingId || !singleJournalVerse) return
        setSavingJournal(true)
        setJournalSaved(false)
        try {
            const bookName = books.find(b => b.id === selectedBook)?.name || selectedBook || ''
            const { hl, v } = singleJournalVerse
            // If user edited the note, update the highlight first
            if (singleJournalNote !== (hl.note || '')) {
                const updated = await updateHighlightNote(hl.id, singleJournalNote)
                if (updated) {
                    setHighlights(prev => prev.map(h => h.id === hl.id ? updated : h))
                }
            }
            const result = await saveNoteToJournal(
                hl.id, pairingId, bookName, v.chapter, v.verse, v.text, false, singleJournalTitle || undefined, translation
            )
            if (result.success) {
                setJournalSaved(true)
                toast.success('Saved to your prayer journal!')
                setSingleJournalVerse(null)
                setSingleJournalTitle('')
                setSingleJournalNote('')
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
            const result = await shareMultipleVersesWithPartner(pairingId, bookName, selectedChapter!, verseEntries, translation)
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
                // Resuming from a paused-at-verse: restart speech from that verse
                // Clear old utterance callbacks before cancelling to avoid stale resets
                if (utteranceRef.current) {
                    utteranceRef.current.onend = null
                    utteranceRef.current.onerror = null
                }
                window.speechSynthesis.cancel()
                setIsPaused(false)
                startFromVerse = pausedAtVerse
                setPausedAtVerse(null)
            } else {
                // Simple resume (browser still has the utterance paused)
                window.speechSynthesis.resume()
                setIsPaused(false)
                setIsPlaying(true)
                // Restore the verse highlight that was showing when paused
                if (pausedAtVerse !== null) {
                    setCurrentReadingVerse(pausedAtVerse)
                }
                return
            }
        }

        // Clear old utterance callbacks before cancelling to prevent stale onerror from resetting state
        if (utteranceRef.current) {
            utteranceRef.current.onend = null
            utteranceRef.current.onerror = null
        }
        window.speechSynthesis.cancel()

        // Increment session so any lingering callbacks from prior sessions are ignored
        const session = ++ttsSessionRef.current

        const bookName = books.find(b => b.id === selectedBook)?.name || ''
        let verseIndex = 0
        if (startFromVerse) {
            const idx = verses.findIndex(v => v.verse === startFromVerse)
            if (idx >= 0) verseIndex = idx
        } else if (audioStartVerse) {
            const idx = verses.findIndex(v => v.verse === audioStartVerse)
            if (idx >= 0) verseIndex = idx
        }

        // Set playing state BEFORE creating utterances
        setIsPlaying(true)
        setIsPaused(false)

        // Track progress based on total chapter verses (not just remaining)
        const totalVerses = verses.length
        setTtsProgress(totalVerses > 0 ? verseIndex / totalVerses : 0)
        clearAutoAdvance()

        // Build all utterances upfront and use the browser's speech queue
        // This eliminates the gap between verses since the browser pre-queues them
        const utterances: { utt: SpeechSynthesisUtterance; verseNum: number; idx: number }[] = []
        for (let i = verseIndex; i < verses.length; i++) {
            const v = verses[i]
            const verseText = v.text.replace(/\n/g, ' ').trim()
            let text: string
            if (skipVerseNumbersRef.current) {
                text = i === verseIndex ? `${bookName} chapter ${selectedChapter}. ${verseText}` : verseText
            } else {
                text = i === verseIndex ? `${bookName} chapter ${selectedChapter}. Verse ${v.verse}. ${verseText}` : `Verse ${v.verse}. ${verseText}`
            }
            const utt = new SpeechSynthesisUtterance(text)
            utt.rate = speechRateRef.current
            utt.pitch = 1.05
            if (selectedVoiceURI) {
                const voice = availableVoices.find(av => av.voiceURI === selectedVoiceURI)
                if (voice) utt.voice = voice
            }
            utterances.push({ utt, verseNum: v.verse, idx: i })
        }

        // Attach event handlers and queue all utterances at once
        utterances.forEach(({ utt, verseNum, idx }, arrIdx) => {
            utt.onstart = () => {
                if (ttsSessionRef.current !== session) return
                setCurrentReadingVerse(verseNum)
                setTtsProgress(totalVerses > 0 ? idx / totalVerses : 0)
            }
            utt.onend = () => {
                if (ttsSessionRef.current !== session) return
                // If last utterance, mark complete
                if (arrIdx === utterances.length - 1) {
                    setIsPlaying(false)
                    setCurrentReadingVerse(null)
                    setTtsProgress(1)
                    setAutoAdvanceCountdown(3)
                }
            }
            utt.onerror = (e) => {
                if (ttsSessionRef.current !== session) return
                if (e && ((e as any).error === 'interrupted' || (e as any).error === 'canceled')) return
                setIsPlaying(false)
                setCurrentReadingVerse(null)
            }
            utteranceRef.current = utt
            window.speechSynthesis.speak(utt)
        })
    }

    const handlePauseDesktop = () => {
        window.speechSynthesis.pause()
        setIsPaused(true)
        setIsPlaying(false)
        setPausedAtVerse(currentReadingVerse)
        // Keep currentReadingVerse set so the verse stays highlighted while paused
    }

    const handleStopDesktop = () => {
        // Increment session to invalidate any pending callbacks
        ttsSessionRef.current++
        // Clear callbacks before cancel to prevent stale onerror
        if (utteranceRef.current) {
            utteranceRef.current.onend = null
            utteranceRef.current.onerror = null
        }
        window.speechSynthesis.cancel()
        setIsPlaying(false)
        setIsPaused(false)
        setCurrentReadingVerse(null)
        setPausedAtVerse(null)
    }

    // ---- MOBILE: Cloud TTS verse-by-verse with pre-buffering ----

    // Fetch a single verse audio blob
    const fetchVerseAudio = async (text: string, voice: string): Promise<{ audio: HTMLAudioElement; blobUrl: string }> => {
        const provider = getVoiceProvider(voice)
        let res: Response
        if (provider === 'openai') {
            res = await fetch('/api/tts-openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice: getOpenAIVoiceName(voice), speed: speechRateRef.current }),
            })
        } else {
            res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice, speakingRate: speechRateRef.current }),
            })
        }
        if (!res.ok) {
            throw new Error(`TTS failed: ${res.status}`)
        }
        const blob = await res.blob()
        if (blob.size === 0) {
            throw new Error('TTS returned empty audio')
        }
        const blobUrl = URL.createObjectURL(blob)
        const audio = new Audio(blobUrl)
        // Preload the audio data
        await new Promise<void>((resolve, reject) => {
            audio.addEventListener('canplaythrough', () => resolve(), { once: true })
            audio.addEventListener('error', () => reject(new Error('Audio load error')), { once: true })
            audio.load()
        })
        return { audio, blobUrl }
    }

    // Build the text for a verse at a given index
    const buildVerseText = (verseIdx: number, isFirst: boolean) => {
        const v = verses[verseIdx]
        if (!v) return ''
        const bookName = books.find(b => b.id === selectedBook)?.name || ''
        const verseText = v.text.replace(/\n/g, ' ').trim()
        if (skipVerseNumbersRef.current) {
            return isFirst ? `${bookName} chapter ${selectedChapter}. ${verseText}` : verseText
        }
        return isFirst ? `${bookName} chapter ${selectedChapter}. Verse ${v.verse}. ${verseText}` : `Verse ${v.verse}. ${verseText}`
    }

    // Number of verses to batch into a single TTS request for smoother transitions
    const BATCH_SIZE = 3

    // Pre-buffer upcoming batches in the queue
    const preBufferAhead = (startQueueIdx: number, voice: string) => {
        const queue = mobileQueueRef.current
        const BUFFER_AHEAD = 3
        for (let i = startQueueIdx; i < Math.min(startQueueIdx + BUFFER_AHEAD, queue.length); i++) {
            const item = queue[i]
            if (item && !item.audio && !item.loading) {
                item.loading = true
                // Build batched text for all verses in this batch item
                let text = ''
                item.verseIndices.forEach((vIdx, j) => {
                    const part = buildVerseText(vIdx, i === 0 && j === 0)
                    text += (j > 0 ? ' ' : '') + part
                })
                fetchVerseAudio(text, voice).then(({ audio, blobUrl }) => {
                    item.audio = audio
                    item.blobUrl = blobUrl
                    item.loading = false
                }).catch(() => {
                    item.loading = false
                })
            }
        }
    }

    // Ref to hold verse highlight interval timers (cleared on stop)
    const verseHighlightTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Play the next batch item in the queue
    const playMobileQueueItem = async (queueIdx: number, voice: string) => {
        if (mobileStoppedRef.current) return
        const queue = mobileQueueRef.current
        if (queueIdx >= queue.length) {
            // Finished all batches
            setIsPlaying(false)
            setCurrentReadingVerse(null)
            setAudioLoading(false)
            mobilePlayingRef.current = false
            setTtsProgress(1) // 100% complete
            setAutoAdvanceCountdown(3)
            return
        }

        mobileCurrentIdxRef.current = queueIdx
        const item = queue[queueIdx]

        // Update progress based on first verse in this batch
        const totalChapterVerses = verses.length
        setTtsProgress(totalChapterVerses > 0 ? item.verseIndices[0] / totalChapterVerses : 0)

        // Set verse highlight to first verse in batch
        setCurrentReadingVerse(item.verseNums[0])

        // Pre-buffer upcoming batches
        preBufferAhead(queueIdx + 1, voice)

        // Wait for this batch's audio if not ready yet
        if (!item.audio) {
            if (queueIdx === 0) setAudioLoading(true)
            let text = ''
            item.verseIndices.forEach((vIdx, j) => {
                const part = buildVerseText(vIdx, queueIdx === 0 && j === 0)
                text += (j > 0 ? ' ' : '') + part
            })
            try {
                item.loading = true
                const { audio, blobUrl } = await fetchVerseAudio(text, voice)
                if (mobileStoppedRef.current) { URL.revokeObjectURL(blobUrl); return }
                item.audio = audio
                item.blobUrl = blobUrl
                item.loading = false
            } catch {
                setIsPlaying(false)
                setCurrentReadingVerse(null)
                setAudioLoading(false)
                mobilePlayingRef.current = false
                toast.error('Could not load audio. Please try again.')
                return
            }
        }

        if (mobileStoppedRef.current) return
        setAudioLoading(false)

        const audio = item.audio!
        mobileAudioRef.current = audio

        // Animate verse highlights within a batch using estimated timing
        // Split the audio duration evenly across verses in the batch
        if (item.verseNums.length > 1) {
            // We estimate timing after audio starts -- use timeupdate to cycle through verses
            let currentVerseInBatch = 0
            const totalVersesInBatch = item.verseNums.length
            // Estimate each verse's share based on text length
            const verseLengths = item.verseIndices.map(idx => {
                const v = verses[idx]
                return v ? v.text.length : 50
            })
            const totalLength = verseLengths.reduce((a, b) => a + b, 0)
            const verseTimeFractions = verseLengths.map(l => l / totalLength)

            const onTimeUpdate = () => {
                if (mobileStoppedRef.current || !audio.duration) return
                const progress = audio.currentTime / audio.duration
                let cumulative = 0
                for (let i = 0; i < totalVersesInBatch; i++) {
                    cumulative += verseTimeFractions[i]
                    if (progress < cumulative) {
                        if (currentVerseInBatch !== i) {
                            currentVerseInBatch = i
                            setCurrentReadingVerse(item.verseNums[i])
                            // Update tts progress
                            setTtsProgress(totalChapterVerses > 0 ? item.verseIndices[i] / totalChapterVerses : 0)
                        }
                        break
                    }
                }
            }
            audio.addEventListener('timeupdate', onTimeUpdate)
            audio.onended = () => {
                audio.removeEventListener('timeupdate', onTimeUpdate)
                if (mobileStoppedRef.current) return
                if (item.blobUrl) URL.revokeObjectURL(item.blobUrl)
                playMobileQueueItem(queueIdx + 1, voice)
            }
        } else {
            audio.onended = () => {
                if (mobileStoppedRef.current) return
                if (item.blobUrl) URL.revokeObjectURL(item.blobUrl)
                playMobileQueueItem(queueIdx + 1, voice)
            }
        }

        audio.onerror = () => {
            if (mobileStoppedRef.current) return
            toast.error('Audio playback error. Please try again.')
            setIsPlaying(false)
            setCurrentReadingVerse(null)
            mobilePlayingRef.current = false
        }

        audio.play().catch(() => {
            toast.error('Failed to play audio. Please try again.')
            setIsPlaying(false)
            setCurrentReadingVerse(null)
            mobilePlayingRef.current = false
        })
    }

    const handlePlayMobile = (initialStartVerse?: number) => {
        if (verses.length === 0) return
        let startFromVerse = initialStartVerse

        // Resume from pause
        if (isPaused && !startFromVerse && mobileAudioRef.current) {
            mobileAudioRef.current.play()
            setIsPaused(false)
            setIsPlaying(true)
            // Restore the verse highlight that was showing when paused
            if (pausedAtVerse !== null) {
                setCurrentReadingVerse(pausedAtVerse)
            }
            return
        }

        // If paused and requesting new play, restart from paused position
        if (isPaused && !startFromVerse && pausedAtVerse !== null) {
            startFromVerse = pausedAtVerse
        }

        // Stop any existing playback
        handleStopMobile()

        let verseIndex = 0
        if (startFromVerse) {
            const idx = verses.findIndex(v => v.verse === startFromVerse)
            if (idx >= 0) verseIndex = idx
        } else if (audioStartVerse) {
            const idx = verses.findIndex(v => v.verse === audioStartVerse)
            if (idx >= 0) verseIndex = idx
        }

        // Build the batched queue (group verses in batches of BATCH_SIZE)
        mobileStoppedRef.current = false
        mobilePlayingRef.current = true
        const queue: MobileQueueItem[] = []
        for (let i = verseIndex; i < verses.length; i += BATCH_SIZE) {
            const endIdx = Math.min(i + BATCH_SIZE, verses.length)
            const verseIndices: number[] = []
            const verseNums: number[] = []
            for (let j = i; j < endIdx; j++) {
                verseIndices.push(j)
                verseNums.push(verses[j].verse)
            }
            queue.push({ verseIndices, verseNums, audio: null, loading: false })
        }
        mobileQueueRef.current = queue

        setIsPlaying(true)
        setIsPaused(false)
        setAudioLoading(true) // Show loading immediately on the Listen button
        // Set initial progress based on starting position within entire chapter
        setTtsProgress(verses.length > 0 ? verseIndex / verses.length : 0)
        clearAutoAdvance()

        // Start pre-buffering the first 3 batches immediately
        const voice = selectedCloudVoice
        const INITIAL_BUFFER = 3
        for (let i = 0; i < Math.min(INITIAL_BUFFER, queue.length); i++) {
            const item = queue[i]
            item.loading = true
            let text = ''
            item.verseIndices.forEach((vIdx, j) => {
                const part = buildVerseText(vIdx, i === 0 && j === 0)
                text += (j > 0 ? ' ' : '') + part
            })
            fetchVerseAudio(text, voice).then(({ audio, blobUrl }) => {
                item.audio = audio
                item.blobUrl = blobUrl
                item.loading = false
            }).catch(() => { item.loading = false })
        }

        // Start playing the first batch
        playMobileQueueItem(0, voice)
    }

    const handlePauseMobile = () => {
        if (mobileAudioRef.current) {
            mobileAudioRef.current.pause()
            setIsPaused(true)
            setIsPlaying(false)
            setPausedAtVerse(currentReadingVerse)
            // Keep currentReadingVerse set so the verse stays highlighted while paused
        }
    }

    const handleStopMobile = () => {
        mobileStoppedRef.current = true
        mobilePlayingRef.current = false
        if (verseHighlightTimerRef.current) {
            clearInterval(verseHighlightTimerRef.current)
            verseHighlightTimerRef.current = null
        }
        if (mobileAudioRef.current) {
            mobileAudioRef.current.pause()
            mobileAudioRef.current.onended = null
            mobileAudioRef.current.onerror = null
            mobileAudioRef.current = null
        }
        // Clean up all blob URLs in the queue
        for (const item of mobileQueueRef.current) {
            if (item.blobUrl) URL.revokeObjectURL(item.blobUrl)
        }
        mobileQueueRef.current = []
        setIsPlaying(false)
        setIsPaused(false)
        setCurrentReadingVerse(null)
        setPausedAtVerse(null)
        setAudioLoading(false)
    }

    // ---- Unified handlers ----
    const handleExplainVerse = async (reference: string, verseText: string) => {
        setExplainReference(reference)
        setExplainText(verseText)
        setExplainContent('')
        setExplainError(false)
        setExplainLoading(true)
        setExplainSharing(false)
        setSelectedExplainLines(new Set())
        setShowExplainDialog(true)
        setSelectedVerse(null)

        // Abort any previous request
        if (explainAbortRef.current) explainAbortRef.current.abort()
        const abortController = new AbortController()
        explainAbortRef.current = abortController

        try {
            const res = await fetch('/api/bible/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reference, verseText, translation }),
                signal: abortController.signal,
            })
            if (!res.ok) throw new Error('Failed to get explanation')
            const reader = res.body?.getReader()
            if (!reader) throw new Error('No reader')
            const decoder = new TextDecoder()
            let content = ''
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                content += decoder.decode(value, { stream: true })
                setExplainContent(content)
            }
        } catch (e: unknown) {
            if (e instanceof Error && e.name !== 'AbortError') {
                setExplainError(true)
            }
        } finally {
            setExplainLoading(false)
        }
    }

    // Check if current voice selection is a cloud voice (OpenAI or Google)
    // This is only used to determine playback method on desktop when NOT using cloud voices by default
    const isCloudVoiceSelected = selectedCloudVoice.startsWith('openai-') ||
        (selectedCloudVoice.startsWith('en-') && selectedCloudVoice.includes('Wavenet'))

    // Determine if we should use cloud TTS for playback
    // On mobile/Apple: always use cloud voices
    // On desktop: use browser speechSynthesis (don't use cloud voices even if one is "selected" in state)
    const shouldUseCloudTTS = useCloudVoices

    const handlePlayChapter = (initialStartVerse?: number) => {
        // Use cloud playback only for mobile/Apple devices
        if (shouldUseCloudTTS) handlePlayMobile(initialStartVerse)
        else handlePlayDesktop(initialStartVerse)
    }
    const handlePauseAudio = () => {
        // Use cloud pause only for mobile/Apple
        if (shouldUseCloudTTS) handlePauseMobile()
        else handlePauseDesktop()
    }
    const clearAutoAdvance = useCallback(() => {
        setAutoAdvanceCountdown(null)
    }, [])

    const handleStopAudio = () => {
        // Use cloud stop only for mobile/Apple
        if (shouldUseCloudTTS) handleStopMobile()
        else handleStopDesktop()
        setTtsProgress(0)
        clearAutoAdvance()
    }

    // Update URL params when selections change
    const updateURL = useCallback((book: string | null, chapter: number | null, v: string) => {
        const params = new URLSearchParams()
        if (book) params.set('book', book)
        if (chapter) params.set('chapter', String(chapter))
        if (v !== 'NIV') params.set('v', v)
        const query = params.toString()
        router.replace(`/dashboard/bible${query ? `?${query}` : ''}`, { scroll: false })
    }, [router])

    // Auto-advance countdown: tick down from 3 to 0, then navigate
    useEffect(() => {
        if (autoAdvanceCountdown === null) return
        // Check if we can actually advance
        if (!selectedChapter || !chapters.length || selectedChapter >= chapters.length) {
            setAutoAdvanceCountdown(null)
            return
        }
        if (autoAdvanceCountdown <= 0) {
            // Time's up -- navigate to next chapter
            setAutoAdvanceCountdown(null)
            setTtsProgress(0)
            const next = selectedChapter + 1
            setWeekVerseRange(null)
            setSelectedChapter(next)
            updateURL(selectedBook, next, translation)
            setAutoPlayNextChapter(true)
            return
        }
        // Tick down every second
        const timer = setTimeout(() => {
            setAutoAdvanceCountdown(prev => prev !== null ? prev - 1 : null)
        }, 1000)
        return () => clearTimeout(timer)
    }, [autoAdvanceCountdown, selectedChapter, chapters.length, selectedBook, translation, updateURL])

    // Auto-play when new chapter verses load after auto-advance
    useEffect(() => {
        // Wait until verses are fully loaded (not loading) and we have content
        if (autoPlayNextChapter && verses.length > 0 && !versesLoading) {
            setAutoPlayNextChapter(false)
            setTtsProgress(0)
            // Small delay to let the new chapter render
            setTimeout(() => {
                handlePlayChapter()
            }, 300)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoPlayNextChapter, verses, versesLoading])

    const handleSelectBook = (bookId: string) => {
        setSelectedBook(bookId)
        setSelectedChapter(null)
        setView('chapters')
        updateURL(bookId, null, translation)
    }

    // Load all highlights for the modal
    const handleOpenHighlightsModal = async () => {
        setShowHighlightsModal(true)
        setLoadingHighlights(true)
        try {
            const highlights = await getAllHighlights()
            setAllHighlights(highlights)
        } catch {
            toast.error('Failed to load highlights')
        } finally {
            setLoadingHighlights(false)
        }
    }

    // Navigate to a highlight and trigger the verse selection
    // Accepts optional startVerse/endVerse to select a range of verses
    const handleGoToHighlight = (highlight: BibleHighlight, startVerse?: number, endVerse?: number) => {
        setShowHighlightsModal(false)
        // Navigate to the book and chapter
        setSelectedBook(highlight.book_id)
        setSelectedChapter(highlight.chapter)
        setView('reading')
        updateURL(highlight.book_id, highlight.chapter, highlight.translation || translation)
        // Set the verse selection to trigger the action popover
        // If startVerse/endVerse provided, select the entire range
        const start = startVerse ?? highlight.verse
        const end = endVerse ?? highlight.verse
        setTimeout(() => {
            const versesToSelect = new Set<number>()
            for (let v = start; v <= end; v++) {
                versesToSelect.add(v)
            }
            setSelectedVerses(versesToSelect)
            setSelectedVerse(start)
        }, 500)
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
        savePrefs(v, textSize, skipVerseNumbers, useCloudVoices ? selectedCloudVoice : selectedVoiceURI, speechRate)
        handleStopAudio()
    }

    const handleTextSizeChange = (size: string) => {
        setTextSize(size)
        savePrefs(translation, size, skipVerseNumbers, useCloudVoices ? selectedCloudVoice : selectedVoiceURI, speechRate)
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
        setTtsProgress(0)
        clearAutoAdvance()
        if (selectedChapter && selectedChapter > 1) {
            const prev = selectedChapter - 1
            setSelectedChapter(prev)
            updateURL(selectedBook, prev, translation)
        }
    }

    const handleNextChapter = () => {
        handleStopAudio()
        setWeekVerseRange(null)
        setTtsProgress(0)
        clearAutoAdvance()
        if (selectedChapter && chapters.length > 0 && selectedChapter < chapters.length) {
            const next = selectedChapter + 1
            setSelectedChapter(next)
            updateURL(selectedBook, next, translation)
        }
    }

    // Parse "John 3:16" or "John 3:3-7 - "text..."" style scripture references
    const parseScriptureRef = useCallback((ref: string): { bookId: string; chapter: number; verseRange: { start: number; end: number } | null } | null => {
        if (!ref) return null
        // Strip any embedded quote text after ' - "'
        const cleanRef = ref.split(/\s*-\s*\u201C|\s*-\s*"/)[0].trim()
        const match = cleanRef.match(/^(.+?)\s+(\d+)(?::(\d+(?:\s*-\s*\d+)?))?$/)
        if (!match) return null
        const bookName = match[1].trim().toLowerCase()
        const chapter = parseInt(match[2], 10)
        const verseStr = match[3]?.replace(/\s/g, '') || null
        // Use BOOK_MAP for reliable lookup regardless of translation's verbose names
        const bookId = BOOK_MAP[bookName]
        if (!bookId) return null
        return { bookId, chapter, verseRange: parseVerseRange(verseStr) }
    }, [])

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
    // Clear the highlight when navigating to any other book/chapter
    useEffect(() => {
        if (!weekScripture || !selectedBook || !selectedChapter || books.length === 0) return
        const parsed = parseScriptureRef(weekScripture)
        if (parsed && parsed.bookId === selectedBook && parsed.chapter === selectedChapter && parsed.verseRange) {
            setWeekVerseRange(parsed.verseRange)
        } else {
            setWeekVerseRange(null)
        }
    }, [weekScripture, selectedBook, selectedChapter, books.length, parseScriptureRef])

    // URL params are handled via initial state, no effect needed

    const selectedBookName = selectedBook ? (BOOK_ID_TO_NAME[selectedBook] || books.find(b => b.id === selectedBook)?.name || selectedBook) : ''
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
                    {view === 'reading' ? (
                        <>
                            <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1 shrink-0">
                                <ArrowLeft className="h-4 w-4" />
                                <span className="sr-only sm:not-sr-only">Back</span>
                            </Button>
                            <div className="min-w-0">
                                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-primary shrink-0" />
                                    {selectedBookName} {selectedChapter}
                                </h2>
                                <button
                                    onClick={handleBack}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                >
                                    <ChevronLeft className="h-3 w-3" />
                                    Books & Chapters
                                </button>
                            </div>
                        </>
                    ) : view === 'chapters' ? (
                        <>
                            <Button data-tour="bible-back" variant="ghost" size="sm" onClick={handleBack} className="gap-1">
                                <ArrowLeft className="h-4 w-4" />
                                <span className="sr-only sm:not-sr-only">Back</span>
                            </Button>
                            <div>
                                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-primary" />
                                    {selectedBookName}
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    {translationName} ({translation})
                                </p>
                            </div>
                        </>
                    ) : (
                        <div>
                            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                <BookOpen className="h-5 w-5 text-primary" />
                                Bible
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                {translationName} ({translation})
                            </p>
                        </div>
                    )}
                </div>

                <div data-tour="bible-settings" className="flex items-center gap-2 flex-wrap">
                    {/* My Highlights button */}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 bg-card"
                        onClick={handleOpenHighlightsModal}
                    >
                        <Highlighter className="h-4 w-4" />
                        <span className="sr-only sm:not-sr-only text-xs">Highlights</span>
                    </Button>

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
                                    Choose a voice for the audio Bible. Voices marked Neural or Enhanced sound the most human.
                                </p>

                                {useCloudVoices ? (
                                    <Select value={selectedCloudVoice} onValueChange={(v) => {
                                        const wasPlaying = isPlaying || isPaused
                                        const resumeVerse = currentReadingVerse
                                        if (wasPlaying) {
                                            handleStopAudio()
                                            setIsPaused(true)
                                            setPausedAtVerse(resumeVerse)
                                        }
                                        setSelectedCloudVoice(v)
                                        savePrefs(translation, textSize, skipVerseNumbers, v, speechRate)
                                    }}>
                                        <SelectTrigger className="w-full sm:w-[320px] h-9 text-sm bg-card">
                                            <SelectValue placeholder="Select a voice..." />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            <SelectGroup>
                                                <SelectLabel className="text-xs font-semibold text-primary/70">OpenAI Voices</SelectLabel>
                                                {CLOUD_TTS_VOICES.filter(v => v.provider === 'openai').map((voice) => (
                                                    <SelectItem key={voice.id} value={voice.id}>
                                                        <span className="flex items-center gap-1.5">
                                                            {voice.name}
                                                            <span className="text-muted-foreground text-xs">{voice.description}</span>
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                            <SelectGroup>
                                                <SelectLabel className="text-xs font-semibold text-primary/70">Google Voices</SelectLabel>
                                                {CLOUD_TTS_VOICES.filter(v => v.provider === 'google').map((voice) => (
                                                    <SelectItem key={voice.id} value={voice.id}>
                                                        <span className="flex items-center gap-1.5">
                                                            {voice.name}
                                                            <span className="text-muted-foreground text-xs">{voice.description}</span>
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Select
                                        value={selectedVoiceURI || ''}
                                        onValueChange={(v) => {
                                            const wasPlaying = isPlaying || isPaused
                                            const resumeVerse = currentReadingVerse
                                            if (wasPlaying) {
                                                handleStopAudio()
                                                setIsPaused(true)
                                                setPausedAtVerse(resumeVerse)
                                            }
                                            // On desktop, only use browser voices
                                            setSelectedVoiceURI(v)
                                            savePrefs(translation, textSize, skipVerseNumbers, v, speechRate)
                                        }}
                                    >
                                        <SelectTrigger className="w-full sm:w-[320px] h-9 text-sm bg-card">
                                            <SelectValue placeholder="Select a voice..." />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px]">
                                            {/* Browser Voices for Desktop */}
                                            {availableVoices.length > 0 ? (
                                                <SelectGroup>
                                                    <SelectLabel className="text-xs font-semibold text-primary/70">Available Voices</SelectLabel>
                                                    {availableVoices.map((voice) => {
                                                        const nameLower = voice.name.toLowerCase()
                                                        const isNeural = nameLower.includes('(enhanced)') || nameLower.includes('(premium)') || nameLower.includes('natural') || nameLower.includes('neural')
                                                        const isGoogleBrowser = nameLower.startsWith('google ')
                                                        const displayName = voice.name
                                                            .replace(/Microsoft |Google |Apple /i, '')
                                                            .replace(/ \(Natural\)| \(Enhanced\)| \(Premium\)/i, '')
                                                            .replace(/ Online$/i, '')
                                                        const langMap: Record<string, string> = { 'en-US': 'US', 'en-GB': 'UK', 'en-AU': 'AU', 'en-IN': 'IN', 'en-IE': 'IE', 'en-ZA': 'ZA' }
                                                        const langLabel = langMap[voice.lang] || ''
                                                        let qualityLabel = ''
                                                        if (isNeural) qualityLabel = 'Neural'
                                                        else if (isGoogleBrowser) qualityLabel = 'Google'
                                                        else if (!voice.localService) qualityLabel = 'Online'
                                                        return (
                                                            <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                                                                <span className="flex items-center gap-1.5">
                                                                    {displayName}
                                                                    {langLabel && <Badge variant="outline" className="text-[10px] h-4 px-1">{langLabel}</Badge>}
                                                                    {qualityLabel && <Badge variant="secondary" className="text-[10px] h-4 px-1">{qualityLabel}</Badge>}
                                                                </span>
                                                            </SelectItem>
                                                        )
                                                    })}
                                                </SelectGroup>
                                            ) : (
                                                <SelectItem value="" disabled>Loading voices...</SelectItem>
                                            )}
                                        </SelectContent>
                                    </Select>
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
                                    onClick={() => { const next = !skipVerseNumbers; setSkipVerseNumbers(next); savePrefs(translation, textSize, next, useCloudVoices ? selectedCloudVoice : selectedVoiceURI, speechRate) }}
                                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${skipVerseNumbers ? 'bg-primary' : 'bg-muted'
                                        }`}
                                >
                                    <span
                                        className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm ring-0 transition-transform ${skipVerseNumbers ? 'translate-x-4' : 'translate-x-0'
                                            }`}
                                    />
                                </button>
                            </div>

                            {/* Reading Speed */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-foreground">Reading Speed</label>
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {speechRate === 1 ? '1.0x' : `${speechRate.toFixed(2)}x`}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="1.5"
                                    step="0.05"
                                    value={speechRate}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value)
                                        setSpeechRate(val)
                                        savePrefs(translation, textSize, skipVerseNumbers, useCloudVoices ? selectedCloudVoice : selectedVoiceURI, val)
                                    }}
                                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm"
                                />
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>Slower</span>
                                    <span>Normal</span>
                                    <span>Faster</span>
                                </div>
                            </div>

                            {/* Voice preview */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1.5 bg-card"
                                disabled={previewLoading}
                                onClick={async () => {
                                    const previewText = 'For God so loved the world, that he gave his only begotten Son.'
                                    // Use cloud TTS only for mobile/Apple devices
                                    if (shouldUseCloudTTS) {
                                        setPreviewLoading(true)
                                        try {
                                            const provider = getVoiceProvider(selectedCloudVoice)
                                            let res: Response
                                            if (provider === 'openai') {
                                                res = await fetch('/api/tts-openai', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ text: previewText, voice: getOpenAIVoiceName(selectedCloudVoice), speed: speechRate }),
                                                })
                                            } else {
                                                res = await fetch('/api/tts', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ text: previewText, voice: selectedCloudVoice, speakingRate: speechRate }),
                                                })
                                            }
                                            if (!res.ok) throw new Error('Preview failed')
                                            const blob = await res.blob()
                                            const url = URL.createObjectURL(blob)
                                            const audio = new Audio(url)
                                            audio.onended = () => URL.revokeObjectURL(url)
                                            audio.play()
                                        } catch {
                                            toast.error('Could not preview voice.')
                                        } finally {
                                            setPreviewLoading(false)
                                        }
                                    } else {
                                        // Desktop browser speech synthesis preview (fallback, rarely used now)
                                        setPreviewLoading(true)
                                        window.speechSynthesis.cancel()
                                        const utt = new SpeechSynthesisUtterance(previewText)
                                        utt.rate = speechRate
                                        utt.pitch = 1.05
                                        if (selectedVoiceURI) {
                                            const voice = availableVoices.find(v => v.voiceURI === selectedVoiceURI)
                                            if (voice) utt.voice = voice
                                        }
                                        utt.onend = () => setPreviewLoading(false)
                                        utt.onerror = () => setPreviewLoading(false)
                                        window.speechSynthesis.speak(utt)
                                    }
                                }}
                            >
                                {previewLoading ? (
                                    <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-3 w-3" />
                                        Preview Voice
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* This Week's Scripture Banner */}
            {weekScripture && (
                <Card className="border-primary/30 bg-primary/15 cursor-pointer hover:bg-primary/20 transition-colors" onClick={handleWeekScripture}>
                    <CardContent className="py-2 px-3 flex items-center gap-2.5">
                        <BookMarked className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">
                                {weekNumber ? `Week ${weekNumber} Scripture` : "This Week's Scripture"}
                            </p>
                            <p className={`text-muted-foreground font-serif italic line-clamp-3 ${textSizeClass}`}>
                                <ScriptureText reference={weekScripture} translation={translation} />
                            </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-primary shrink-0" />
                    </CardContent>
                </Card>
            )}

            {/* Books View */}
            {view === 'books' && (
                <div data-tour="bible-books" className="space-y-4">
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
                                            className="justify-start text-sm h-9 bg-card truncate"
                                            onClick={() => handleSelectBook(book.id)}
                                        >
                                            {BOOK_ID_TO_NAME[book.id] || book.name}
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
                                            className="justify-start text-sm h-9 bg-card truncate"
                                            onClick={() => handleSelectBook(book.id)}
                                        >
                                            {BOOK_ID_TO_NAME[book.id] || book.name}
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
                        <div data-tour="bible-toolbar" className="flex items-center gap-2 flex-wrap">
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
                                    {audioLoading || (autoPlayNextChapter && versesLoading) ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-1.5 text-xs bg-card"
                                            disabled
                                        >
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Loading...
                                        </Button>
                                    ) : isPlaying ? (
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
                                            disabled={versesLoading || verses.length === 0}
                                        >
                                            <Volume2 className="h-3.5 w-3.5" />
                                            Listen
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
                    <CardContent data-tour="bible-verses">
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
                                                                        // Already highlighted: load group into selection and show/toggle popover
                                                                        const group = getHighlightGroup(v.verse)
                                                                        setSelectedVerses(new Set(group))
                                                                        setSelectedVerse(selectedVerse === v.verse ? null : v.verse)
                                                                        setJournalSaved(false)
                                                                        setVerseSent(false)
                                                                    } else {
                                                                        // Not highlighted: highlight it and add to selection
                                                                        handleVerseClick(v.verse)
                                                                        setSelectedVerses(prev => {
                                                                            const next = new Set(prev)
                                                                            next.add(v.verse)
                                                                            return next
                                                                        })
                                                                    }
                                                                } else {
                                                                    // Normal mode: toggle popover, load group if highlighted
                                                                    const existingHighlight = getVerseHighlight(v.verse)
                                                                    if (existingHighlight) {
                                                                        const group = getHighlightGroup(v.verse)
                                                                        setSelectedVerses(new Set(group))
                                                                    }
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
                                                                            const group = getHighlightGroup(v.verse)
                                                                            setSelectedVerses(new Set(group))
                                                                            setSelectedVerse(selectedVerse === v.verse ? null : v.verse)
                                                                            setJournalSaved(false)
                                                                            setVerseSent(false)
                                                                        } else {
                                                                            handleVerseClick(v.verse)
                                                                            setSelectedVerses(prev => {
                                                                                const next = new Set(prev)
                                                                                next.add(v.verse)
                                                                                return next
                                                                            })
                                                                        }
                                                                    } else {
                                                                        const existingHighlight = getVerseHighlight(v.verse)
                                                                        if (existingHighlight) {
                                                                            const group = getHighlightGroup(v.verse)
                                                                            setSelectedVerses(new Set(group))
                                                                        }
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
                                                        side="top"
                                                        sideOffset={8}
                                                        collisionPadding={16}
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
                                                                            {/* Show existing notes from group */}
                                                                            {(() => {
                                                                                const groupNotes: string[] = []
                                                                                for (const gv of highlightGroup) {
                                                                                    const gh = getVerseHighlight(gv)
                                                                                    if (gh?.note) groupNotes.push(gh.note)
                                                                                }
                                                                                const uniqueNotes = [...new Set(groupNotes)]
                                                                                if (uniqueNotes.length > 0) {
                                                                                    return (
                                                                                        <p className="text-sm text-muted-foreground italic bg-muted/50 rounded p-2 font-sans whitespace-pre-line">
                                                                                            {uniqueNotes.join('\n\n')}
                                                                                        </p>
                                                                                    )
                                                                                }
                                                                                return null
                                                                            })()}

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
                                                                                        {(() => {
                                                                                            const hasAnyNote = highlightGroup.some(gv => getVerseHighlight(gv)?.note)
                                                                                            return hasAnyNote ? 'Edit Note' : 'Add Note'
                                                                                        })()}
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
                                                                                                const result = await shareMultipleVersesWithPartner(pairingId, bookName, selectedChapter!, entries, translation)
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
                                                                                                // Close popover first so dialog is fully visible
                                                                                                setSelectedVerse(null)
                                                                                                // Pre-populate selectedVerses with the group and open journal dialog
                                                                                                const groupSet = new Set(highlightGroup)
                                                                                                setSelectedVerses(groupSet)
                                                                                                setJournalTitle((() => {
                                                                                                    const bookName = books.find(b => b.id === selectedBook)?.name || selectedBook || ''
                                                                                                    const rangeLabel = `${bookName} ${selectedChapter}:${buildRangeStr(highlightGroup)}`
                                                                                                    return `Verses from ${rangeLabel}`
                                                                                                })())
                                                                                                setMultiNote(getSelectedNotesText(groupSet))
                                                                                                setShowJournalDialog(true)
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

                                                                                {/* AI Explain */}
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="h-7 text-xs gap-1 font-sans bg-transparent text-primary border-primary/30 hover:bg-primary/5"
                                                                                    onClick={() => {
                                                                                        const bookName = books.find(b => b.id === selectedBook)?.name || ''
                                                                                        if (isGroup && highlightGroup.length > 1) {
                                                                                            const ref = `${bookName} ${selectedChapter}:${buildRangeStr(highlightGroup)}`
                                                                                            const text = highlightGroup
                                                                                                .map(vn => {
                                                                                                    const vData = verses.find(vv => vv.verse === vn)
                                                                                                    return vData ? `${vn} ${vData.text}` : ''
                                                                                                })
                                                                                                .filter(Boolean)
                                                                                                .join(' ')
                                                                                            handleExplainVerse(ref, text)
                                                                                        } else {
                                                                                            const ref = `${bookName} ${selectedChapter}:${v.verse}`
                                                                                            handleExplainVerse(ref, v.text)
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <Sparkles className="h-3 w-3" />
                                                                                    Explain
                                                                                </Button>

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
                                                                                        onClick={() => {
                                                                                            handleDeleteHighlight(hl.id, v.verse, isGroup)
                                                                                            setSelectedVerse(null)
                                                                                        }}
                                                                                    >
                                                                                        <Trash2 className="h-3 w-3" />
                                                                                        {isGroup ? 'Remove All' : 'Remove'}
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
                            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
                                <div className="bg-card rounded-t-xl sm:rounded-lg border border-border shadow-lg w-full sm:max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto">
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
                            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
                                <div className="bg-card rounded-t-xl sm:rounded-lg border border-border shadow-lg w-full sm:max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                                    <h3 className="text-base font-semibold font-sans text-foreground">Save to Journal</h3>
                                    <p className="text-sm text-muted-foreground italic bg-muted/50 rounded p-2.5 font-serif leading-relaxed">
                                        {books.find(b => b.id === selectedBook)?.name} {singleJournalVerse.v.chapter}:{singleJournalVerse.v.verse} - {'"'}{singleJournalVerse.v.text.slice(0, 120)}{singleJournalVerse.v.text.length > 120 ? '...' : ''}{'"'}
                                    </p>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground" htmlFor="single-journal-title">Title</label>
                                        <Input
                                            id="single-journal-title"
                                            value={singleJournalTitle}
                                            onChange={(e) => setSingleJournalTitle(e.target.value)}
                                            placeholder="Enter a title for this journal entry..."
                                            className="text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-foreground" htmlFor="single-journal-note">Notes (optional)</label>
                                        <Textarea
                                            id="single-journal-note"
                                            value={singleJournalNote}
                                            onChange={(e) => setSingleJournalNote(e.target.value)}
                                            placeholder="Add your thoughts or notes about this verse..."
                                            className="text-sm resize-none"
                                            rows={3}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => { setSingleJournalVerse(null); setSingleJournalTitle(''); setSingleJournalNote('') }}
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
                            {/* Next button with audio progress fill */}
                            {(isPlaying || isPaused || ttsProgress > 0 || autoAdvanceCountdown !== null) && selectedChapter && selectedChapter < chapters.length ? (
                                <button
                                    className="relative inline-flex items-center gap-1 rounded-md border border-border text-sm font-medium h-9 px-3 overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => {
                                        clearAutoAdvance()
                                        handleStopAudio()
                                        handleNextChapter()
                                    }}
                                >
                                    {/* Progress fill background */}
                                    <span
                                        className="absolute inset-0 bg-primary/15 transition-all duration-700 ease-linear"
                                        style={{ width: `${ttsProgress * 100}%` }}
                                    />
                                    {/* Button content */}
                                    <span className="relative z-10 flex items-center gap-1 text-foreground">
                                        {autoAdvanceCountdown !== null ? (
                                            <>Next in {autoAdvanceCountdown}s</>
                                        ) : (
                                            <>Next</>
                                        )}
                                        <ChevronRight className="h-4 w-4" />
                                    </span>
                                </button>
                            ) : (
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
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
            {/* My Highlights Modal */}
            <Dialog open={showHighlightsModal} onOpenChange={setShowHighlightsModal}>
                <DialogContent className="max-w-lg max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
                    <div className="px-5 pt-5 pb-3 border-b border-border/50">
                        <DialogHeader className="space-y-1">
                            <DialogTitle className="text-base font-semibold text-foreground font-sans flex items-center gap-2">
                                <Highlighter className="h-4 w-4 text-primary" />
                                My Highlights
                            </DialogTitle>
                            <p className="text-sm text-muted-foreground">
                                All your highlighted verses across the Bible
                            </p>
                        </DialogHeader>
                    </div>
                    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 min-h-0">
                        {loadingHighlights ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : allHighlights.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Highlighter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No highlights yet</p>
                                <p className="text-xs mt-1">Select text in the Bible to create highlights</p>
                            </div>
                        ) : (
                            (() => {
                                // Group consecutive verses together
                                type HighlightGroup = {
                                    bookId: string
                                    chapter: number
                                    startVerse: number
                                    endVerse: number
                                    color: string
                                    translation: string | null
                                    notes: string[]
                                    highlights: BibleHighlight[]
                                }

                                // Sort highlights by book, chapter, verse for grouping
                                const sorted = [...allHighlights].sort((a, b) => {
                                    if (a.book_id !== b.book_id) return a.book_id.localeCompare(b.book_id)
                                    if (a.chapter !== b.chapter) return a.chapter - b.chapter
                                    return a.verse - b.verse
                                })

                                const groups: HighlightGroup[] = []

                                for (const h of sorted) {
                                    const lastGroup = groups[groups.length - 1]
                                    // Check if this highlight can be merged with the last group
                                    if (
                                        lastGroup &&
                                        lastGroup.bookId === h.book_id &&
                                        lastGroup.chapter === h.chapter &&
                                        lastGroup.color === h.color &&
                                        lastGroup.translation === (h.translation || null) &&
                                        h.verse === lastGroup.endVerse + 1
                                    ) {
                                        // Extend the existing group
                                        lastGroup.endVerse = h.verse
                                        lastGroup.highlights.push(h)
                                        if (h.note) lastGroup.notes.push(h.note)
                                    } else {
                                        // Start a new group
                                        groups.push({
                                            bookId: h.book_id,
                                            chapter: h.chapter,
                                            startVerse: h.verse,
                                            endVerse: h.verse,
                                            color: h.color,
                                            translation: h.translation || null,
                                            notes: h.note ? [h.note] : [],
                                            highlights: [h],
                                        })
                                    }
                                }

                                const colorClasses: Record<string, string> = {
                                    yellow: 'bg-yellow-200/60 border-yellow-300',
                                    green: 'bg-green-200/60 border-green-300',
                                    blue: 'bg-blue-200/60 border-blue-300',
                                    pink: 'bg-pink-200/60 border-pink-300',
                                    orange: 'bg-orange-200/60 border-orange-300',
                                }

                                return groups.map((group, idx) => {
                                    const bookName = BOOK_ID_TO_NAME[group.bookId] || group.bookId
                                    const verseRange = group.startVerse === group.endVerse
                                        ? `${group.startVerse}`
                                        : `${group.startVerse}-${group.endVerse}`
                                    const combinedNotes = group.notes.filter((n, i, arr) => arr.indexOf(n) === i).join(' • ')

                                    return (
                                        <button
                                            key={`${group.bookId}-${group.chapter}-${group.startVerse}-${idx}`}
                                            onClick={() => handleGoToHighlight(group.highlights[0], group.startVerse, group.endVerse)}
                                            className={`w-full text-left p-3 rounded-lg border transition-colors hover:bg-accent/50 ${colorClasses[group.color] || 'bg-muted border-border'}`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium text-foreground">
                                                    {bookName} {group.chapter}:{verseRange}
                                                </span>
                                                <Badge variant="outline" className="text-xs">
                                                    {group.translation || 'NIV'}
                                                </Badge>
                                            </div>
                                            {combinedNotes && (
                                                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                                    {combinedNotes}
                                                </p>
                                            )}
                                        </button>
                                    )
                                })
                            })()
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* AI Explain Dialog */}
            <Dialog open={showExplainDialog} onOpenChange={(open) => {
                if (!open && explainAbortRef.current) explainAbortRef.current.abort()
                setShowExplainDialog(open)
            }}>
                <DialogContent className="max-w-lg max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
                    {/* Header */}
                    <div className="px-5 pt-5 pb-3 border-b border-border/50">
                        <DialogHeader className="space-y-1">
                            <DialogTitle className="text-base font-semibold text-foreground font-sans">
                                {explainReference}
                            </DialogTitle>
                            <p className="text-xs text-muted-foreground font-sans">{ENGLISH_TRANSLATIONS.find(t => t.identifier === translation)?.name || translation}</p>
                        </DialogHeader>
                        {/* Quoted verse text */}
                        <blockquote className="mt-3 border-l-2 border-primary/30 pl-3 text-[13px] italic text-muted-foreground font-serif leading-relaxed">
                            {explainText.length > 250 ? explainText.slice(0, 250).trim() + '...' : explainText}
                        </blockquote>
                    </div>

                    {/* Scrollable content */}
                    <div className="flex-1 overflow-y-auto px-5 py-4">
                        {/* Loading state */}
                        {explainLoading && !explainContent && (
                            <div className="flex items-center gap-2.5 text-sm text-muted-foreground py-6 justify-center">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <span className="font-sans">Thinking...</span>
                            </div>
                        )}
                        {/* Error state */}
                        {explainError && !explainContent && (
                            <div className="flex flex-col items-center gap-3 py-6">
                                <p className="text-sm text-destructive font-sans">Failed to generate explanation.</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs gap-1.5 font-sans"
                                    onClick={() => handleExplainVerse(explainReference, explainText)}
                                >
                                    <RefreshCw className="h-3 w-3" />
                                    Try Again
                                </Button>
                            </div>
                        )}
                        {/* Rendered explanation - tap lines to select */}
                        {explainContent && (() => {
                            // Build selectable blocks from the content lines
                            const lines = explainContent.split('\n')
                            const blocks: { raw: string; lineIndex: number }[] = []
                            lines.forEach((line, i) => {
                                const trimmed = line.trim()
                                if (trimmed) blocks.push({ raw: trimmed, lineIndex: i })
                            })

                            const hasSelection = selectedExplainLines.size > 0

                            return (
                                <div className="space-y-0 font-sans">
                                    {hasSelection && !explainLoading && (
                                        <div className="flex items-center justify-between mb-3 px-1">
                                            <p className="text-[11px] text-primary font-medium font-sans">
                                                {selectedExplainLines.size} section{selectedExplainLines.size > 1 ? 's' : ''} selected
                                            </p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[11px] px-2 text-muted-foreground"
                                                onClick={() => setSelectedExplainLines(new Set())}
                                            >
                                                Clear
                                            </Button>
                                        </div>
                                    )}
                                    {lines.map((line, i) => {
                                        const trimmed = line.trim()
                                        if (!trimmed) return <div key={i} className="h-2.5" />

                                        const isSelected = selectedExplainLines.has(i)
                                        const dimmed = hasSelection && !isSelected

                                        const toggleLine = () => {
                                            if (explainLoading) return
                                            setSelectedExplainLines(prev => {
                                                const next = new Set(prev)
                                                if (next.has(i)) next.delete(i)
                                                else next.add(i)
                                                return next
                                            })
                                        }

                                        const selectableClass = `rounded-md px-1.5 -mx-1.5 py-0.5 transition-all cursor-pointer select-none ${isSelected
                                                ? 'bg-primary/10 ring-1 ring-primary/30'
                                                : dimmed
                                                    ? 'opacity-40 hover:opacity-70'
                                                    : 'hover:bg-muted/50 active:bg-muted'
                                            }`

                                        // ### or ## headers -> section title
                                        if (/^#{1,3}\s+/.test(trimmed)) {
                                            const text = trimmed.replace(/^#{1,3}\s+/, '').replace(/\*\*/g, '')
                                            return <h4 key={i} role="button" onClick={toggleLine} className={`text-sm font-semibold text-foreground mt-4 mb-1.5 first:mt-0 ${selectableClass}`}>{text}</h4>
                                        }

                                        // **Bold line** (entire line is bold) -> section title
                                        if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
                                            return <h4 key={i} role="button" onClick={toggleLine} className={`text-sm font-semibold text-foreground mt-4 mb-1.5 first:mt-0 ${selectableClass}`}>{trimmed.replace(/\*\*/g, '')}</h4>
                                        }

                                        // Numbered header like "1. **Summary**" or "1. Summary"
                                        if (/^\d+\.\s/.test(trimmed)) {
                                            const text = trimmed.replace(/\*\*/g, '')
                                            if (text.length < 60 && !text.includes('. ')) {
                                                return <h4 key={i} role="button" onClick={toggleLine} className={`text-sm font-semibold text-foreground mt-4 mb-1.5 first:mt-0 ${selectableClass}`}>{text}</h4>
                                            }
                                        }

                                        // Bullet point with inline bold rendering
                                        if (/^[-*]\s/.test(trimmed)) {
                                            const bulletText = trimmed.replace(/^[-*]\s+/, '')
                                            const parts = bulletText.split(/\*\*(.*?)\*\*/g)
                                            return (
                                                <div key={i} role="button" onClick={toggleLine} className={`flex gap-2 ml-1 my-1 ${selectableClass}`}>
                                                    <span className="text-primary/60 mt-[3px] text-xs shrink-0">{'●'}</span>
                                                    <p className="text-sm leading-relaxed text-foreground/85">
                                                        {parts.map((part, j) =>
                                                            j % 2 === 1
                                                                ? <strong key={j} className="font-semibold text-foreground">{part}</strong>
                                                                : <span key={j}>{part}</span>
                                                        )}
                                                    </p>
                                                </div>
                                            )
                                        }

                                        // Regular paragraph with inline bold
                                        const parts = trimmed.split(/\*\*(.*?)\*\*/g)
                                        return (
                                            <p key={i} role="button" onClick={toggleLine} className={`text-sm leading-relaxed text-foreground/85 my-1.5 ${selectableClass}`}>
                                                {parts.map((part, j) =>
                                                    j % 2 === 1
                                                        ? <strong key={j} className="font-semibold text-foreground">{part}</strong>
                                                        : <span key={j}>{part}</span>
                                                )}
                                            </p>
                                        )
                                    })}
                                    {explainLoading && <span className="inline-block w-1.5 h-4 bg-primary/50 animate-pulse ml-0.5 align-text-bottom rounded-sm" />}
                                </div>
                            )
                        })()}
                    </div>

                    {/* Share with Partner button */}
                    {explainContent && !explainLoading && !explainError && pairingId && (() => {
                        const hasSelection = selectedExplainLines.size > 0
                        const lines = explainContent.split('\n')
                        const textToShare = hasSelection
                            ? Array.from(selectedExplainLines).sort((a, b) => a - b).map(i => lines[i]?.trim()).filter(Boolean).join('\n\n')
                            : explainContent

                        return (
                            <div className="px-5 py-3 border-t border-border/50 space-y-1.5">
                                {hasSelection && (
                                    <p className="text-[10px] text-primary/70 font-sans text-center">
                                        {selectedExplainLines.size} section{selectedExplainLines.size > 1 ? 's' : ''} will be shared
                                    </p>
                                )}
                                {!hasSelection && (
                                    <p className="text-[10px] text-muted-foreground font-sans text-center">
                                        Tap sections to select specific parts, or send all
                                    </p>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-8 text-xs gap-1.5 font-sans"
                                    onClick={async () => {
                                        setExplainSharing(true)
                                        const result = await sendExplanationToPartner(pairingId!, explainReference, textToShare)
                                        if (result.success) {
                                            toast.success(
                                                hasSelection ? 'Selected sections sent!' : 'Explanation sent!',
                                                {
                                                    action: {
                                                        label: 'Go to Messages',
                                                        onClick: () => router.push('/dashboard/messages'),
                                                    },
                                                }
                                            )
                                            setSelectedExplainLines(new Set())
                                        } else {
                                            toast.error('Failed to share explanation')
                                        }
                                        setExplainSharing(false)
                                    }}
                                    disabled={explainSharing}
                                >
                                    {explainSharing ? (
                                        <><Loader2 className="h-3 w-3 animate-spin" /> Sending...</>
                                    ) : hasSelection ? (
                                        <><Send className="h-3 w-3" /> Send Selection to Partner</>
                                    ) : (
                                        <><Send className="h-3 w-3" /> Send All to Partner</>
                                    )}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full h-8 text-xs gap-1.5 font-sans"
                                    onClick={() => {
                                        setExplainJournalTitle(`AI Explanation - ${explainReference}`)
                                        setExplainJournalNote('')
                                        setShowExplainJournalDialog(true)
                                    }}
                                >
                                    <BookHeart className="h-3 w-3" /> Save to Journal
                                </Button>
                            </div>
                        )
                    })()}

                    {/* AI Explanation Journal Save Dialog */}
                    {showExplainJournalDialog && (
                        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowExplainJournalDialog(false) } }}>
                            <div className="bg-card rounded-t-xl sm:rounded-lg border border-border shadow-lg w-full sm:max-w-md p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                                <h3 className="text-base font-semibold font-sans text-foreground">Save Explanation to Journal</h3>
                                <p className="text-xs text-muted-foreground font-sans">{explainReference}</p>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground" htmlFor="explain-journal-title">Title</label>
                                    <Input
                                        id="explain-journal-title"
                                        value={explainJournalTitle}
                                        onChange={(e) => setExplainJournalTitle(e.target.value)}
                                        placeholder="Entry title..."
                                        className="text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground" htmlFor="explain-journal-note">Notes (optional)</label>
                                    <Textarea
                                        id="explain-journal-note"
                                        value={explainJournalNote}
                                        onChange={(e) => setExplainJournalNote(e.target.value)}
                                        placeholder="Add your thoughts or reflections..."
                                        className="text-sm resize-none"
                                        rows={3}
                                    />
                                </div>
                                <div className="flex items-center gap-2 justify-end">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowExplainJournalDialog(false)}
                                        disabled={explainJournalSaving}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={async () => {
                                            if (!pairingId) return
                                            setExplainJournalSaving(true)
                                            const hasSelection = selectedExplainLines.size > 0
                                            const lines = explainContent.split('\n')
                                            const textToSave = hasSelection
                                                ? Array.from(selectedExplainLines).sort((a, b) => a - b).map(i => lines[i]?.trim()).filter(Boolean).join('\n\n')
                                                : explainContent
                                            const result = await saveExplanationToJournal(
                                                pairingId,
                                                explainReference,
                                                textToSave,
                                                explainJournalTitle.trim() || undefined,
                                                explainJournalNote.trim() || undefined
                                            )
                                            if (result.success) {
                                                toast.success('Saved to your prayer journal!', {
                                                    action: {
                                                        label: 'View Journal',
                                                        onClick: () => router.push('/dashboard/journal'),
                                                    },
                                                })
                                                setShowExplainJournalDialog(false)
                                                setSelectedExplainLines(new Set())
                                            } else {
                                                toast.error(result.error || 'Failed to save to journal')
                                            }
                                            setExplainJournalSaving(false)
                                        }}
                                        disabled={explainJournalSaving}
                                    >
                                        {explainJournalSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <BookHeart className="h-3.5 w-3.5 mr-1" />}
                                        {explainJournalSaving ? 'Saving...' : 'Save'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Onboarding Tours */}

            {view === 'books' && <FeatureTour tourId="bible" steps={bibleSteps} />}
            <FeatureTour tourId="bible-reading" steps={bibleReadingSteps} waitFor={view === 'reading'} />
        </div>
    )
}
