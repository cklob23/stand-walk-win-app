import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  FAQ_PRICING_LINK_TEXT,
  buildHomeJsonLd,
  homeFaqs,
  homeNavLinks,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from './home-content.ts'

describe('home content', () => {
  it('keeps the existing homepage title and description', () => {
    assert.equal(SITE_TITLE, 'Stand Walk Run - Grow Together in Faith')
    assert.equal(
      SITE_DESCRIPTION,
      'A 6-week discipleship journey connecting Leaders and Learners for spiritual growth and mentorship.',
    )
    assert.equal(SITE_URL, 'https://standwalkrun.com')
  })

  it('exposes the five header anchors', () => {
    assert.deepEqual(
      homeNavLinks.map((link) => link.href),
      ['#how', '#roles', '#features', '#journey', '#faq'],
    )
  })

  it('builds FAQPage JSON-LD from the same eight FAQ items the page renders', () => {
    assert.equal(homeFaqs.length, 8)
    const jsonLd = buildHomeJsonLd(homeFaqs)
    const faqPage = jsonLd['@graph'].find((node) => node['@type'] === 'FAQPage')
    assert.ok(faqPage)
    const entities = (faqPage as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] }).mainEntity
    assert.equal(entities.length, 8)
    assert.deepEqual(
      entities.map((item) => item.name),
      homeFaqs.map((faq) => faq.question),
    )
    assert.deepEqual(
      entities.map((item) => item.acceptedAnswer.text),
      homeFaqs.map((faq) => faq.answer),
    )
    assert.match(homeFaqs[0].answer, new RegExp(FAQ_PRICING_LINK_TEXT))
    assert.equal(homeFaqs.some((faq) => /privacy policy/i.test(faq.answer)), false)
  })

  it('includes Organization and WebSite nodes', () => {
    const types = buildHomeJsonLd()['@graph'].map((node) => node['@type'])
    assert.deepEqual(types, ['Organization', 'WebSite', 'FAQPage'])
  })
})
