'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, Download, ExternalLink, Loader2, Table } from 'lucide-react'
import { getFileIcon } from './message-bubble'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

interface AttachmentPreviewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    url: string
    type: 'image' | 'file' | 'link'
    filename?: string // Optional filename for API-served files
    mimeType?: string // Optional MIME type for better detection
}

function getMediaTypeFromExt(ext: string): 'image' | 'video' | 'audio' | 'pdf' | 'office' | 'csv' | 'text' | 'other' {
    const lowerExt = ext.toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'heif', 'avif', 'tiff', 'tif'].includes(lowerExt)) return 'image'
    if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'm4v', '3gp'].includes(lowerExt)) return 'video'
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(lowerExt)) return 'audio'
    if (lowerExt === 'pdf') return 'pdf'
    if (lowerExt === 'csv') return 'csv'
    if (['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'tsx', 'jsx'].includes(lowerExt)) return 'text'
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'].includes(lowerExt)) return 'office'
    return 'other'
}

function getMediaType(url: string, filename?: string, mimeType?: string): 'image' | 'video' | 'audio' | 'pdf' | 'office' | 'csv' | 'text' | 'other' {
    // First try MIME type if provided
    if (mimeType) {
        if (mimeType.startsWith('image/')) return 'image'
        if (mimeType.startsWith('video/')) return 'video'
        if (mimeType.startsWith('audio/')) return 'audio'
        if (mimeType === 'application/pdf') return 'pdf'
        if (mimeType === 'text/csv') return 'csv'
        if (mimeType.startsWith('text/')) return 'text'
        if (mimeType.includes('word') || mimeType.includes('excel') || mimeType.includes('powerpoint') ||
            mimeType.includes('spreadsheet') || mimeType.includes('presentation') || mimeType.includes('document')) return 'office'
    }

    // Then try filename if provided
    if (filename) {
        const ext = filename.split('.').pop() || ''
        if (ext) return getMediaTypeFromExt(ext)
    }

    // Finally try URL
    const ext = url.split('.').pop()?.toLowerCase().split('?')[0] || ''
    return getMediaTypeFromExt(ext)
}

export function AttachmentPreviewModal({ open, onOpenChange, url, type, filename, mimeType }: AttachmentPreviewModalProps) {
    const displayName = filename || decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'File')
    const mediaType = type === 'link' ? 'other' : getMediaType(url, filename, mimeType)
    const FileIcon = getFileIcon(displayName)

    // State for CSV/text preview
    const [csvData, setCsvData] = useState<string[][] | null>(null)
    const [textContent, setTextContent] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Load CSV or text content when modal opens
    useEffect(() => {
        if (!open || !url) return

        if (mediaType === 'csv') {
            setLoading(true)
            setError(null)
            fetch(url)
                .then(res => res.text())
                .then(text => {
                    // Parse CSV - handle both comma and semicolon delimiters
                    const delimiter = text.includes(';') && !text.includes(',') ? ';' : ','
                    const rows = text.split('\n').filter(row => row.trim())
                    const parsed = rows.map(row => {
                        // Simple CSV parsing (handles basic cases)
                        const result: string[] = []
                        let current = ''
                        let inQuotes = false
                        for (const char of row) {
                            if (char === '"') {
                                inQuotes = !inQuotes
                            } else if (char === delimiter && !inQuotes) {
                                result.push(current.trim())
                                current = ''
                            } else {
                                current += char
                            }
                        }
                        result.push(current.trim())
                        return result
                    })
                    setCsvData(parsed.slice(0, 100)) // Limit to 100 rows for performance
                    setLoading(false)
                })
                .catch(() => {
                    setError('Failed to load CSV')
                    setLoading(false)
                })
        } else if (mediaType === 'text') {
            setLoading(true)
            setError(null)
            fetch(url)
                .then(res => res.text())
                .then(text => {
                    setTextContent(text.slice(0, 50000)) // Limit to 50KB for performance
                    setLoading(false)
                })
                .catch(() => {
                    setError('Failed to load file')
                    setLoading(false)
                })
        }

        return () => {
            setCsvData(null)
            setTextContent(null)
            setError(null)
        }
    }, [open, url, mediaType])

    const fetchBlob = async () => {
        const response = await fetch(url)
        return response.blob()
    }

    const handleDownload = async () => {
        try {
            const blob = await fetchBlob()
            const blobUrl = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = blobUrl
            a.download = displayName
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            // Small delay before cleanup so mobile Safari can start the download
            setTimeout(() => {
                document.body.removeChild(a)
                window.URL.revokeObjectURL(blobUrl)
            }, 200)
        } catch {
            // Fallback: open in new tab
            window.open(url, '_blank')
        }
    }

    const handleOpenInBrowser = async () => {
        try {
            const blob = await fetchBlob()
            const blobUrl = window.URL.createObjectURL(blob)
            window.open(blobUrl, '_blank')
        } catch {
            // Fallback: try direct URL
            window.open(url, '_blank')
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] sm:w-[min(95vw,56rem)] max-h-[90vh] p-0 overflow-hidden bg-background border-0 gap-0 [&>button]:hidden">
                <VisuallyHidden>
                    <DialogTitle>{displayName}</DialogTitle>
                </VisuallyHidden>

                {/* Header bar */}
                <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b bg-card overflow-hidden">
                    <FileIcon className="h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm font-medium truncate min-w-0 flex-1">{displayName}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={handleDownload}
                        >
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Download</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={handleOpenInBrowser}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Open in Browser</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Content area */}
                <div className="flex items-center justify-center overflow-auto p-4 min-h-[300px] max-h-[calc(90vh-60px)] bg-black/5">
                    {mediaType === 'image' && url && (
                        <img
                            src={url}
                            alt={displayName}
                            className="max-w-full max-h-[calc(90vh-100px)] object-contain rounded-lg"
                            crossOrigin="anonymous"
                        />
                    )}

                    {mediaType === 'video' && url && (
                        <video
                            src={url}
                            controls
                            autoPlay
                            className="max-w-full max-h-[calc(90vh-100px)] rounded-lg"
                            crossOrigin="anonymous"
                        >
                            Your browser does not support the video element.
                        </video>
                    )}

                    {mediaType === 'audio' && url && (
                        <div className="flex flex-col items-center gap-4 p-8">
                            <FileIcon className="h-16 w-16 text-primary/60" />
                            <p className="text-sm font-medium">{displayName}</p>
                            <audio src={url} controls autoPlay className="w-full max-w-md">
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                    )}

                    {mediaType === 'pdf' && url && (
                        <iframe
                            src={url}
                            title={displayName}
                            className="w-full h-[calc(90vh-100px)] rounded-lg border-0"
                        />
                    )}

                    {mediaType === 'csv' && (
                        <div className="w-full h-[calc(90vh-100px)] overflow-auto bg-background rounded-lg border">
                            {loading && (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            )}
                            {error && (
                                <div className="flex items-center justify-center h-full text-destructive">
                                    {error}
                                </div>
                            )}
                            {csvData && (
                                <table className="w-full text-xs">
                                    <thead className="bg-muted sticky top-0">
                                        <tr>
                                            {csvData[0]?.map((header, i) => (
                                                <th key={i} className="px-3 py-2 text-left font-medium border-b border-r last:border-r-0">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {csvData.slice(1).map((row, rowIdx) => (
                                            <tr key={rowIdx} className="hover:bg-muted/50">
                                                {row.map((cell, cellIdx) => (
                                                    <td key={cellIdx} className="px-3 py-1.5 border-b border-r last:border-r-0 whitespace-nowrap">
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {mediaType === 'text' && (
                        <div className="w-full h-[calc(90vh-100px)] overflow-auto bg-background rounded-lg border p-4">
                            {loading && (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            )}
                            {error && (
                                <div className="flex items-center justify-center h-full text-destructive">
                                    {error}
                                </div>
                            )}
                            {textContent && (
                                <pre className="text-xs whitespace-pre-wrap font-mono">{textContent}</pre>
                            )}
                        </div>
                    )}

                    {mediaType === 'office' && (
                        <div className="flex flex-col items-center gap-4 p-8 text-center w-full max-w-md mx-auto">
                            <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center">
                                <FileIcon className="h-10 w-10 text-primary/60" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">{displayName}</p>
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                                    Office documents (Word, Excel, PowerPoint) cannot be previewed directly in the browser.
                                    Download to view in Microsoft Office, Google Docs, or another compatible application.
                                </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 mt-2 w-full sm:w-auto">
                                <Button size="sm" onClick={handleDownload} className="gap-1.5 w-full sm:w-auto">
                                    <Download className="h-3.5 w-3.5" />
                                    Download File
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground/70 mt-2">
                                Tip: After downloading, you can open with Google Docs or Microsoft 365 online for free
                            </p>
                        </div>
                    )}

                    {mediaType === 'other' && (
                        <div className="flex flex-col items-center gap-4 p-8 text-center">
                            <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center">
                                <FileIcon className="h-10 w-10 text-primary/60" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">{displayName}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Preview not available for this file type
                                </p>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <Button size="sm" onClick={handleDownload} className="gap-1.5">
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleOpenInBrowser} className="gap-1.5">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Open in Browser
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
