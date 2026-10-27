import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    BANNED_QA_PHRASES,
    BANNED_TYPOS,
    QUESTION_5_PROMPT,
    QUESTION_5_PROMPT_017,
    Q2_PRAYER_NOTE,
    SALVATION_PRAYER,
    allPaulCopy,
} from './paul-journey-content.ts'

const here = dirname(fileURLToPath(import.meta.url))
const sql017 = readFileSync(join(here, '..', 'scripts', '017-paul-journey-content.sql'), 'utf8')
const sql018 = readFileSync(join(here, '..', 'scripts', '018-paul-journey-content-fixes.sql'), 'utf8')
const sql018Precheck = readFileSync(join(here, '..', 'scripts', '018-precheck.sql'), 'utf8')

describe('Paul journey content', () => {
    it('keeps Question 2 flagged as the salvation prayer', () => {
        assert.equal(Q2_PRAYER_NOTE, 'This is the salvation prayer.')
        assert.match(SALVATION_PRAYER, /save me and fill me with Your Holy Spirit/)
        assert.match(SALVATION_PRAYER, /In Jesus' mighty name I pray\. Amen\.$/)
    })

    it('adds Romans 10:8-10 as Question 5 with a colon after the citation', () => {
        assert.equal(
            QUESTION_5_PROMPT,
            'Romans 10:8-10: What does this passage tell us that relates to the idea of being "born again"?',
        )
        assert.equal(
            QUESTION_5_PROMPT_017,
            'Romans 10:8-10 What does this passage tell us that relates to the idea of being "born again"?',
        )
    })

    it('does not leave Paul\'s placeholder note or known typos in user-facing copy', () => {
        const joined = allPaulCopy().join('\n')
        for (const typo of BANNED_TYPOS) {
            assert.equal(joined.includes(typo), false, `copy still contains ${typo}`)
        }
        for (const phrase of BANNED_QA_PHRASES) {
            assert.equal(joined.includes(phrase), false, `copy still contains ${phrase}`)
        }
    })

    it('does not use em or en dashes', () => {
        for (const text of allPaulCopy()) {
            assert.equal(text.includes('\u2014'), false)
            assert.equal(text.includes('\u2013'), false)
            assert.equal(text.includes('--'), false)
        }
    })

    it('exports every commentary and prayer block', () => {
        assert.equal(allPaulCopy().length, 29)
        for (const text of allPaulCopy()) {
            assert.ok(text.trim().length > 10)
        }
    })

    it('keeps 017 free of original typos and scopes updates to Q1\'s journey', () => {
        for (const typo of BANNED_TYPOS) {
            assert.equal(sql017.includes(typo), false, `017 SQL still contains ${typo}`)
        }
        assert.match(sql017, /This is the Salvation prayer/)
        assert.match(sql017, /journey_id IS NOT DISTINCT FROM/)
        assert.match(sql017, /Romans 10:8-10: What does this passage/)
        assert.match(sql017, /description LIKE 'Romans 10:8-10%'/)
        assert.equal(sql017.includes('WHERE week_number = 3 AND title ILIKE'), false)
        assert.equal(sql017.includes('WHERE week_number = 2 AND title ILIKE'), false)
    })

    it('makes 018 the prod copy-fix script and keeps it journey-scoped', () => {
        for (const typo of [...BANNED_TYPOS, ...BANNED_QA_PHRASES]) {
            assert.equal(sql018.includes(typo), false, `018 SQL still contains ${typo}`)
        }
        assert.match(sql018, /This is the salvation prayer/)
        assert.match(sql018, /Romans 10:8-10: What does this passage/)
        assert.match(sql018, /RAISE EXCEPTION/)
        assert.match(sql018, /GET DIAGNOSTICS/)
        assert.match(sql018, /journey_id IS NOT DISTINCT FROM/)
        assert.equal(/\bINSERT\s+INTO\s+assignments\b/i.test(sql018), false)
        assert.equal(/\bassignment_progress\b/.test(sql018), false)
        assert.equal(sql018.includes('WHERE week_number = 3 AND title ILIKE'), false)
        for (const text of allPaulCopy()) {
            assert.equal(sql018.includes(text), true, `018 is missing copy: ${text.slice(0, 48)}`)
        }
        assert.equal(sql018.includes(QUESTION_5_PROMPT_017), true)
    })

    it('ships a read-only 018 precheck for other-journey title overlap', () => {
        assert.match(sql018Precheck, /journey_count|COUNT\(\*\)/)
        assert.match(sql018Precheck, /Understanding Born Again/)
        assert.equal(/\bUPDATE\b/i.test(sql018Precheck), false)
        assert.equal(/\bINSERT\b/i.test(sql018Precheck), false)
        assert.equal(/\bDELETE\b/i.test(sql018Precheck), false)
    })
})
