'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { X, Download, ExternalLink } from 'lucide-react'
import { getFileIcon } from './message-bubble'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

interface AttachmentPreviewModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    url: string
    type: 'image' | 'file' | 'link'
}

function getMediaType(url: string): 'image' | 'video' | 'audio' | 'pdf' | 'other' {
    const ext = url.split('.').pop()?.toLowerCase().split('?')[0] || ''
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image'
    if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv'].includes(ext)) return 'video'
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) return 'audio'
    if (ext === 'pdf') return 'pdf'
    return 'other'
}

export function AttachmentPreviewModal({ open, onOpenChange, url, type }: AttachmentPreviewModalProps) {
    const fileName = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'File')
    const mediaType = type === 'image' ? getMediaType(url) : (type === 'file' ? getMediaType(url) : 'other')
    const FileIcon = getFileIcon(fileName)

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
            a.download = fileName
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
            <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] sm:w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-background border-0 gap-0 [&>button]:hidden">
                <VisuallyHidden>
                    <DialogTitle>{fileName}</DialogTitle>
                </VisuallyHidden>

                {/* Header bar */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 border-b bg-card">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <FileIcon className="h-5 w-5 shrink-0 text-primary" />
                        <span className="text-sm font-medium truncate min-w-0">{fileName}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 ml-auto sm:ml-0"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs flex-1 sm:flex-none"
                            onClick={handleDownload}
                        >
                            <Download className="h-3.5 w-3.5" />
                            Download
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs flex-1 sm:flex-none"
                            onClick={handleOpenInBrowser}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open in Browser
                        </Button>
                    </div>
                </div>

                {/* Content area */}
                <div className="flex items-center justify-center overflow-auto p-4 min-h-[300px] max-h-[calc(90vh-60px)] bg-black/5">
                    {mediaType === 'image' && (
                        <img
                            src={url}
                            alt={fileName}
                            className="max-w-full max-h-[calc(90vh-100px)] object-contain rounded-lg"
                            crossOrigin="anonymous"
                        />
                    )}

                    {mediaType === 'video' && (
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

                    {mediaType === 'audio' && (
                        <div className="flex flex-col items-center gap-4 p-8">
                            <FileIcon className="h-16 w-16 text-primary/60" />
                            <p className="text-sm font-medium">{fileName}</p>
                            <audio src={url} controls autoPlay className="w-full max-w-md">
                                Your browser does not support the audio element.
                            </audio>
                        </div>
                    )}

                    {mediaType === 'pdf' && (
                        <iframe
                            src={url}
                            title={fileName}
                            className="w-full h-[calc(90vh-100px)] rounded-lg border-0"
                        />
                    )}

                    {mediaType === 'other' && (
                        <div className="flex flex-col items-center gap-4 p-8 text-center">
                            <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center">
                                <FileIcon className="h-10 w-10 text-primary/60" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">{fileName}</p>
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
