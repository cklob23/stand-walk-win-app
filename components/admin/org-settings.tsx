'use client'

import { useState, useRef } from 'react'
import { Upload, Palette, Type, Save, Loader2, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { updateOrgBranding } from '@/app/actions/org-branding'
import { useBranding } from '@/contexts/branding-context'

interface OrgBranding {
    logo_url: string | null
    church_name: string | null
    slogan: string | null
    primary_color: string | null
    secondary_color: string | null
}

interface OrgSettingsProps {
    organizationId: string
    organizationName: string
    initialBranding: OrgBranding
}

// These match the app's actual theme colors from globals.css
// Primary: #0f6353 (teal/sage)
// Secondary: #f0ede6 (warm cream)
const DEFAULT_PRIMARY = '#0f6353'
const DEFAULT_SECONDARY = '#f0ede6'

export function OrgSettings({ organizationId, organizationName, initialBranding }: OrgSettingsProps) {
    const { toast } = useToast()
    const { updateBranding: updateGlobalBranding } = useBranding()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [branding, setBranding] = useState<OrgBranding>(initialBranding)
    const [isUploading, setIsUploading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    // If logo_url is a pathname (not a full URL), construct the API URL
    const getLogoUrl = (logoPath: string | null) => {
        if (!logoPath) return null
        if (logoPath.startsWith('http')) return logoPath
        return `/api/logo?pathname=${encodeURIComponent(logoPath)}`
    }
    const [previewLogo, setPreviewLogo] = useState<string | null>(getLogoUrl(initialBranding.logo_url))

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Preview
        const reader = new FileReader()
        reader.onload = (e) => setPreviewLogo(e.target?.result as string)
        reader.readAsDataURL(file)

        setIsUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch('/api/upload/logo', {
                method: 'POST',
                body: formData,
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed')
            }

            // Store pathname for private blob access
            const logoPath = data.pathname
            const logoUrl = `/api/logo?pathname=${encodeURIComponent(logoPath)}`
            setBranding(prev => ({ ...prev, logo_url: logoPath }))
            setPreviewLogo(logoUrl)

            // Update global branding context in real-time
            updateGlobalBranding({ logoUrl: logoPath })

            toast({
                title: 'Logo uploaded',
                description: 'Your organization logo has been updated.',
            })
        } catch (error) {
            toast({
                title: 'Upload failed',
                description: error instanceof Error ? error.message : 'Failed to upload logo',
                variant: 'destructive',
            })
            setPreviewLogo(initialBranding.logo_url)
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleRemoveLogo = async () => {
        try {
            // Update local state immediately
            setBranding(prev => ({ ...prev, logo_url: null }))
            setPreviewLogo(null)

            // Update global branding context in real-time
            updateGlobalBranding({ logoUrl: null })

            // Save to database to clear the logo
            const result = await updateOrgBranding(organizationId, {
                church_name: branding.church_name || null,
                slogan: branding.slogan || null,
                primary_color: branding.primary_color || null,
                secondary_color: branding.secondary_color || null,
                logo_url: null, // Clear the logo
            })

            if (result.error) {
                throw new Error(result.error)
            }

            toast({
                title: 'Logo removed',
                description: 'Your organization logo has been removed.',
            })
        } catch (error) {
            toast({
                title: 'Failed to remove logo',
                description: error instanceof Error ? error.message : 'An error occurred',
                variant: 'destructive',
            })
        }
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const result = await updateOrgBranding(organizationId, {
                church_name: branding.church_name || null,
                slogan: branding.slogan || null,
                primary_color: branding.primary_color || null,
                secondary_color: branding.secondary_color || null,
                logo_url: branding.logo_url,
            })

            if (result.error) {
                throw new Error(result.error)
            }

            // Update global branding context in real-time
            updateGlobalBranding({
                churchName: branding.church_name || null,
                slogan: branding.slogan || null,
                primaryColor: branding.primary_color || null,
                secondaryColor: branding.secondary_color || null,
                logoUrl: branding.logo_url,
            })

            toast({
                title: 'Settings saved',
                description: 'Your organization branding has been updated.',
            })
        } catch (error) {
            toast({
                title: 'Save failed',
                description: error instanceof Error ? error.message : 'Failed to save settings',
                variant: 'destructive',
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleResetColors = () => {
        setBranding(prev => ({
            ...prev,
            primary_color: null,
            secondary_color: null,
        }))
        // Update global branding context in real-time to reset colors
        updateGlobalBranding({
            primaryColor: null,
            secondaryColor: null,
        })
    }

    return (
        <div className="space-y-6">
            {/* Logo Upload */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />
                        Organization Logo
                    </CardTitle>
                    <CardDescription>
                        Upload your church or organization logo. This will appear in the header, favicon, and throughout the app.
                        Recommended size: 200x200px. Max file size: 2MB.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <div className="h-24 w-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden bg-muted/50">
                                {previewLogo ? (
                                    <img
                                        src={previewLogo}
                                        alt="Organization logo"
                                        className="h-full w-full object-contain"
                                    />
                                ) : (
                                    <Upload className="h-8 w-8 text-muted-foreground/50" />
                                )}
                            </div>
                            {previewLogo && (
                                <button
                                    onClick={handleRemoveLogo}
                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 z-10"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <div className="space-y-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                onChange={handleLogoUpload}
                                className="hidden"
                                id="logo-upload"
                            />
                            <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Upload Logo
                                    </>
                                )}
                            </Button>
                            <p className="text-xs text-muted-foreground">PNG, JPEG, SVG, or WebP</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Organization Name & Slogan */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Type className="h-5 w-5" />
                        Organization Name & Slogan
                    </CardTitle>
                    <CardDescription>
                        Customize the app title and add your organization slogan. The organization name will appear as the main title,
                        with &quot;Stand Walk Run&quot; as the subtitle. Leave blank to show &quot;Stand Walk Run&quot; as the main title.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="org-name">Organization Name</Label>
                        <Input
                            id="org-name"
                            placeholder="Stand Walk Run"
                            value={branding.church_name || ''}
                            onChange={(e) => setBranding(prev => ({ ...prev, church_name: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            Leave blank to display &quot;Stand Walk Run&quot; as the app title.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="slogan">Slogan / Motto</Label>
                        <Textarea
                            id="slogan"
                            placeholder="Enter your organization slogan or motto..."
                            value={branding.slogan || ''}
                            onChange={(e) => setBranding(prev => ({ ...prev, slogan: e.target.value }))}
                            rows={2}
                        />
                        <p className="text-xs text-muted-foreground">
                            This will be displayed below the header on the dashboard.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Color Theme */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Color Theme
                    </CardTitle>
                    <CardDescription>
                        Customize the app colors to match your organization branding. These colors will be applied throughout the app.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="primary-color">Primary Color</Label>
                            <div className="flex gap-2">
                                <div
                                    className="h-10 w-10 rounded-md border cursor-pointer"
                                    style={{ backgroundColor: branding.primary_color || DEFAULT_PRIMARY }}
                                    onClick={() => document.getElementById('primary-color-picker')?.click()}
                                />
                                <Input
                                    id="primary-color"
                                    type="text"
                                    placeholder={DEFAULT_PRIMARY}
                                    value={branding.primary_color || ''}
                                    onChange={(e) => setBranding(prev => ({ ...prev, primary_color: e.target.value }))}
                                    className="flex-1"
                                />
                                <input
                                    id="primary-color-picker"
                                    type="color"
                                    value={branding.primary_color || DEFAULT_PRIMARY}
                                    onChange={(e) => setBranding(prev => ({ ...prev, primary_color: e.target.value }))}
                                    className="sr-only"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Main brand color for buttons, links, and accents
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="secondary-color">Secondary Color</Label>
                            <div className="flex gap-2">
                                <div
                                    className="h-10 w-10 rounded-md border cursor-pointer"
                                    style={{ backgroundColor: branding.secondary_color || DEFAULT_SECONDARY }}
                                    onClick={() => document.getElementById('secondary-color-picker')?.click()}
                                />
                                <Input
                                    id="secondary-color"
                                    type="text"
                                    placeholder={DEFAULT_SECONDARY}
                                    value={branding.secondary_color || ''}
                                    onChange={(e) => setBranding(prev => ({ ...prev, secondary_color: e.target.value }))}
                                    className="flex-1"
                                />
                                <input
                                    id="secondary-color-picker"
                                    type="color"
                                    value={branding.secondary_color || DEFAULT_SECONDARY}
                                    onChange={(e) => setBranding(prev => ({ ...prev, secondary_color: e.target.value }))}
                                    className="sr-only"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Used for hover states and secondary elements
                            </p>
                        </div>
                    </div>

                    {/* Color Preview - uses actual app buttons for accurate preview */}
                    <div className="rounded-lg border p-4 space-y-3">
                        <p className="text-sm font-medium">Preview</p>
                        <p className="text-xs text-muted-foreground">
                            These buttons use the app&apos;s actual styles. When you set custom colors, they will update throughout the app.
                        </p>
                        <div className="flex flex-wrap gap-2 items-center">
                            <Button size="sm">
                                Primary Button
                            </Button>
                            <Button size="sm" variant="secondary">
                                Secondary Button
                            </Button>
                            <Button size="sm" variant="link" className="text-primary">
                                Link Text
                            </Button>
                        </div>
                        {(branding.primary_color || branding.secondary_color) && (
                            <div className="pt-2 border-t">
                                <p className="text-xs text-muted-foreground mb-2">Custom colors preview:</p>
                                <div className="flex flex-wrap gap-2 items-center">
                                    <button
                                        className="px-3 py-1.5 rounded-md text-white text-sm font-medium"
                                        style={{ backgroundColor: branding.primary_color || DEFAULT_PRIMARY }}
                                    >
                                        Primary
                                    </button>
                                    {branding.secondary_color && (
                                        <button
                                            className="px-3 py-1.5 rounded-md text-sm font-medium border"
                                            style={{
                                                backgroundColor: branding.secondary_color,
                                                color: '#1f2937'
                                            }}
                                        >
                                            Secondary
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <Button variant="outline" size="sm" onClick={handleResetColors}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset to Default Colors
                    </Button>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving} size="lg">
                    {isSaving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Branding Settings
                        </>
                    )}
                </Button>
            </div>
        </div >
    )
}
