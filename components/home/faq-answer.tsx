import Link from 'next/link'
import { FAQ_PRICING_LINK_TEXT, type HomeFaq } from '@/lib/home-content'

export function HomeFaqAnswer({ faq }: { faq: HomeFaq }) {
  if (!faq.pricingLink) {
    return faq.answer
  }

  const linkIndex = faq.answer.lastIndexOf(FAQ_PRICING_LINK_TEXT)
  if (linkIndex === -1) {
    return faq.answer
  }

  return (
    <>
      {faq.answer.slice(0, linkIndex)}
      <Link href="/pricing" className="font-medium text-primary underline underline-offset-2">
        {FAQ_PRICING_LINK_TEXT}
      </Link>
      {faq.answer.slice(linkIndex + FAQ_PRICING_LINK_TEXT.length)}
    </>
  )
}
