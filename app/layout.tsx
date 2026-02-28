import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter, Merriweather } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme-provider'
import './globals.css'

const _inter = Inter({ subsets: ["latin"] });
const _merriweather = Merriweather({
  weight: ['300', '400', '700'],
  subsets: ["latin"]
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
}

export const metadata: Metadata = {
  title: 'Stand Walk Run - Grow Together in Faith',
  description: 'A 6-week discipleship journey connecting Leaders and Learners for spiritual growth and mentorship.',
  generator: 'Developed by Caleb Klobe',
  // Prevent Safari Reader View from activating on content-heavy pages
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.jpg',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.jpg',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.jpg',
        type: 'image/jpg',
      },
    ],
    apple: '/apple-icon.jpg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster closeButton duration={8000} />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
