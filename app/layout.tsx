import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter, Merriweather } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const inter = Inter({
  subsets: ["latin"],
  variable: '--font-inter',
})
const merriweather = Merriweather({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  variable: '--font-merriweather',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#121a21' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL('https://standwalkrun.com'),
  title: 'Stand Walk Run - Grow Together in Faith',
  description: 'A 6-week discipleship journey connecting Leaders and Learners for spiritual growth and mentorship.',
  generator: 'Developed by Caleb Klobe',
  // Prevent Safari Reader View from activating on content-heavy pages
  other: {
    'mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.png',
        type: 'image/png',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${merriweather.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster closeButton duration={8000} />
        </ThemeProvider>
      </body>
    </html>
  )
}
