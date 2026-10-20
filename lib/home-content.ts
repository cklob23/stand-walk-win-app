export const SITE_URL = 'https://standwalkrun.com'
export const SITE_NAME = 'Stand Walk Run'
export const SITE_TITLE = 'Stand Walk Run - Grow Together in Faith'
export const SITE_DESCRIPTION =
  'A 6-week discipleship journey connecting Leaders and Learners for spiritual growth and mentorship.'
export const OG_IMAGE_PATH = '/home/og.jpg'
export const OG_IMAGE_ALT =
  'Stand Walk Run learner dashboard showing a 6-week discipleship journey'

export const homeNavLinks = [
  { href: '#how', label: 'How it works' },
  { href: '#roles', label: 'Leaders and Learners' },
  { href: '#features', label: 'Features' },
  { href: '#journey', label: 'The journey' },
  { href: '#faq', label: 'FAQ' },
] as const

export const FAQ_PRICING_LINK_TEXT = 'See plans for individual leaders and churches'

export type HomeFaq = {
  question: string
  answer: string
  open?: boolean
  pricingLink?: boolean
}

export const homeFaqs: HomeFaq[] = [
  {
    question: 'How much does it cost?',
    open: true,
    pricingLink: true,
    answer:
      `Learners never pay. A Leader pays for a plan, or a church or organization buys plans for its leaders. The plan sets how many Learners each Leader can pair with. ${FAQ_PRICING_LINK_TEXT}.`,
  },
  {
    question: 'Is a weekly meeting required?',
    open: true,
    answer:
      "Yes. Every week includes at least one meeting between the Leader and Learner as part of that week's assignments. You book it right in the app, for FaceTime, Zoom, a phone call, or in person.",
  },
  {
    question: 'How does a Learner join?',
    answer:
      'The Leader invites them. Every Leader gets a 6-character pairing code to share with the person they want to disciple. The Learner signs up free with that code and is connected right away.',
  },
  {
    question: 'What devices does it work on?',
    answer:
      'Stand Walk Run works in any web browser on your phone, tablet, or computer. There is nothing to download, and you can turn on notifications for new messages and updates.',
  },
  {
    question: 'Is what I share private?',
    answer:
      'Your messages are only between you and your partner, and journal entries stay private unless you choose to share them. Your Leader sees your assignment responses so they can encourage you. Both of you also agree to keep conversations confidential when you sign the covenant.',
  },
  {
    question: 'Can a Leader disciple more than one person?',
    answer:
      'Yes. Each plan sets how many Learners a Leader can pair with, and Leaders switch between them from the dashboard.',
  },
  {
    question: 'What happens after the 6 weeks?',
    answer:
      'You celebrate together. The Learner can then graduate to become a Leader and invite someone of their own, or start another journey as new ones become available.',
  },
  {
    question: 'Are there other journeys?',
    answer:
      'New Believer Foundations is the first journey. More journeys for other groups are on the way.',
  },
]

export function buildHomeJsonLd(faqs: HomeFaq[] = homeFaqs) {
  return {
    '@context': 'https://schema.org' as const,
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/icon.png`,
        description: SITE_DESCRIPTION,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE_URL}/#faq`,
        url: `${SITE_URL}/`,
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      },
    ],
  }
}
