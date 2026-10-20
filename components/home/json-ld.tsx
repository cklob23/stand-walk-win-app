import { buildHomeJsonLd, homeFaqs } from '@/lib/home-content'

export function HomeJsonLd() {
  const jsonLd = buildHomeJsonLd(homeFaqs)

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
