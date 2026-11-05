import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    BANNED_QA_PHRASES,
    BANNED_TYPOS,
    MEANING_LINES_LEFT_AS_IS,
    QUESTION_5_PROMPT,
    QUESTION_5_PROMPT_017,
    Q2_PRAYER_NOTE,
    SALVATION_PRAYER,
    VICTORY_JOURNAL_PRAYER,
    WEEK45_TITLES,
    WEEK6_TITLES,
    allPaulCopy,
    allPaulWeek13Copy,
    allPaulWeek45Copy,
} from './paul-journey-content.ts'

const here = dirname(fileURLToPath(import.meta.url))
const sql017 = readFileSync(join(here, '..', 'scripts', '017-paul-journey-content.sql'), 'utf8')
const sql018 = readFileSync(join(here, '..', 'scripts', '018-paul-journey-content-fixes.sql'), 'utf8')
const sql018Precheck = readFileSync(join(here, '..', 'scripts', '018-precheck.sql'), 'utf8')
const sql019 = readFileSync(join(here, '..', 'scripts', '019-paul-week45-content.sql'), 'utf8')
const sql019Precheck = readFileSync(join(here, '..', 'scripts', '019-precheck.sql'), 'utf8')

const WEEK45_AMEN_TAILS = [
    'In Jesus\' mighty name I pray, Amen.',
    'it\'s in Christ\'s holy name I pray, Amen.',
    'it\'s in Jesus\' mighty name I pray, Amen.',
    'In Jesus\' name I pray, Amen.',
    'for it\'s in the mighty name of Jesus I pray, Amen.',
    'the Holy Spirit. Amen',
]

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
        const week13 = allPaulWeek13Copy().join('\n')
        const all = allPaulCopy().join('\n')
        for (const typo of BANNED_TYPOS) {
            assert.equal(all.includes(typo), false, `copy still contains ${typo}`)
        }
        for (const phrase of BANNED_QA_PHRASES) {
            assert.equal(week13.includes(phrase), false, `week 1-3 copy still contains ${phrase}`)
        }
        assert.match(week13, /help thou mine unbelief/)
        assert.equal(week13.includes('Help thou my unbelief'), false)
        assert.match(week13, /Blessed are those who have not seen and yet have believed/)
        assert.match(week13, /the gospel \(good news\)/)
        assert.match(week13, /shares the gospel with others/)
        assert.match(week13, /gospel of peace/)
        assert.match(week13, /The four Gospels/)
    })

    it('does not use em or en dashes or double spaces', () => {
        for (const text of allPaulCopy()) {
            assert.equal(text.includes('\u2014'), false)
            assert.equal(text.includes('\u2013'), false)
            assert.equal(text.includes('--'), false)
            assert.equal(text.includes('  '), false, `double space in: ${text.slice(0, 48)}`)
        }
    })

    it('exports every commentary and prayer block', () => {
        assert.equal(allPaulWeek13Copy().length, 29)
        assert.equal(allPaulWeek45Copy().length, 14)
        assert.equal(allPaulCopy().length, 43)
        for (const text of allPaulCopy()) {
            assert.ok(text.trim().length > 10)
        }
    })

    it('keeps 017 free of original typos and scopes updates to Q1\'s journey', () => {
        for (const typo of BANNED_TYPOS) {
            assert.equal(sql017.includes(typo), false, `017 SQL still contains ${typo}`)
        }
        for (const phrase of BANNED_QA_PHRASES) {
            assert.equal(sql017.includes(phrase), false, `017 SQL still contains ${phrase}`)
        }
        assert.match(sql017, /This is the salvation prayer/)
        assert.equal(sql017.includes('This is the Salvation prayer'), false)
        assert.match(sql017, /journey_id IS NOT DISTINCT FROM/)
        assert.match(sql017, /Romans 10:8-10: What does this passage/)
        assert.match(sql017, /description LIKE 'Romans 10:8-10%'/)
        assert.equal(sql017.includes('WHERE week_number = 3 AND title ILIKE'), false)
        assert.equal(sql017.includes('WHERE week_number = 2 AND title ILIKE'), false)
        for (const text of allPaulWeek13Copy()) {
            assert.equal(sql017.includes(text), true, `017 is missing copy: ${text.slice(0, 48)}`)
        }
        for (const text of allPaulWeek45Copy()) {
            assert.equal(sql017.includes(text), false, `017 should not include week 4-5 copy: ${text.slice(0, 48)}`)
        }
    })

    it('makes 018 the prod copy-fix script and keeps it journey-scoped', () => {
        for (const typo of [...BANNED_TYPOS, ...BANNED_QA_PHRASES]) {
            assert.equal(sql018.includes(typo), false, `018 SQL still contains ${typo}`)
        }
        assert.match(sql018, /This is the salvation prayer/)
        assert.match(sql018, /Romans 10:8-10: What does this passage/)
        assert.match(sql018, /RAISE EXCEPTION/)
        assert.match(sql018, /Q1 was found but journey_id is NULL/)
        assert.match(sql018, /GET DIAGNOSTICS/)
        assert.match(sql018, /journey_id IS NOT DISTINCT FROM/)
        assert.equal(/\bINSERT\s+INTO\s+assignments\b/i.test(sql018), false)
        assert.equal(/\bassignment_progress\b/.test(sql018), false)
        assert.equal(sql018.includes('WHERE week_number = 3 AND title ILIKE'), false)
        for (const text of allPaulWeek13Copy()) {
            assert.equal(sql018.includes(text), true, `018 is missing copy: ${text.slice(0, 48)}`)
        }
        assert.equal(sql018.includes(QUESTION_5_PROMPT_017), true)
        for (const text of allPaulWeek45Copy()) {
            assert.equal(sql018.includes(text), false, `018 should not include week 4-5 copy: ${text.slice(0, 48)}`)
        }
    })

    it('ships a read-only 018 precheck for other-journey title overlap', () => {
        assert.match(sql018Precheck, /journey_count|COUNT\(\*\)/)
        assert.match(sql018Precheck, /Understanding Born Again/)
        assert.match(sql018Precheck, /light of man/)
        assert.match(sql018Precheck, /populated_row_count|IS NOT NULL/)
        assert.equal(/\bUPDATE\b/i.test(sql018Precheck), false)
        assert.equal(/\bINSERT\b/i.test(sql018Precheck), false)
        assert.equal(/\bDELETE\b/i.test(sql018Precheck), false)
    })

    it('adds week 4-5 copy in 019 and mirrors it in TypeScript', () => {
        for (const typo of BANNED_TYPOS) {
            assert.equal(sql019.includes(typo), false, `019 SQL still contains ${typo}`)
        }
        assert.match(sql019, /RAISE EXCEPTION/)
        assert.match(sql019, /Q1 was found but journey_id is NULL/)
        assert.match(sql019, /GET DIAGNOSTICS/)
        assert.match(sql019, /journey_id IS NOT DISTINCT FROM/)
        assert.match(sql019, /assignments.journey_id is missing/)
        assert.equal(/\bINSERT\s+INTO\s+assignments\b/i.test(sql019), false)
        assert.equal(/\bassignment_progress\b/.test(sql019), false)
        assert.equal(sql019.includes('week_number = 6'), false)
        assert.equal(sql019.includes("title ILIKE 'Connect with Believers'"), false)
        for (const title of WEEK45_TITLES) {
            assert.match(sql019, new RegExp(`title ILIKE '${title}'`))
        }
        for (const title of WEEK6_TITLES) {
            assert.equal(
                sql019.includes(`title ILIKE '${title}'`),
                false,
                `019 should not update ${title}`,
            )
        }
        for (const text of allPaulWeek45Copy()) {
            assert.equal(sql019.includes(text), true, `019 is missing copy: ${text.slice(0, 48)}`)
        }
        for (const text of allPaulWeek13Copy()) {
            assert.equal(sql019.includes(text), false, `019 should not rewrite week 1-3: ${text.slice(0, 48)}`)
        }
    })

    it('does not include Week 6 copy anywhere in Paul content', () => {
        const joined = allPaulCopy().join('\n')
        for (const title of WEEK6_TITLES) {
            assert.equal(joined.includes(title), false, `TS copy includes week 6 title ${title}`)
            assert.equal(
                sql019.includes(`title ILIKE '${title}'`),
                false,
                `019 updates week 6 title ${title}`,
            )
        }
        assert.equal(sql019.includes('Always be Prepared'), false)
        assert.equal(sql019.includes('The Hope within You'), false)
    })

    it('keeps Paul meaning-level lines and Amen endings on week 4-5 prayers', () => {
        const week45 = allPaulWeek45Copy().join('\n')
        for (const line of MEANING_LINES_LEFT_AS_IS) {
            assert.equal(week45.includes(line), true, `missing meaning line: ${line}`)
            assert.equal(sql019.includes(line), true, `019 missing meaning line: ${line}`)
        }
        for (const tail of WEEK45_AMEN_TAILS) {
            assert.equal(week45.includes(tail), true, `missing Amen ending: ${tail}`)
        }
        assert.match(week45, /I pray, Amen\./)
        assert.match(VICTORY_JOURNAL_PRAYER, /the Holy Spirit\. Amen$/)
        assert.equal(VICTORY_JOURNAL_PRAYER.includes('Holy Spirit. Amen.'), false)
    })

    it('ships a read-only 019 precheck for week 4-5 title overlap', () => {
        assert.match(sql019Precheck, /journey_count|COUNT\(\*\)/)
        assert.match(sql019Precheck, /Walking with Others/)
        assert.match(sql019Precheck, /Winning Through Accountability/)
        assert.match(sql019Precheck, /Connect with Believers/)
        assert.match(sql019Precheck, /week_number = 6/)
        assert.match(sql019Precheck, /commentary_populated|IS NOT NULL/)
        assert.equal(/\bUPDATE\b/i.test(sql019Precheck), false)
        assert.equal(/\bINSERT\b/i.test(sql019Precheck), false)
        assert.equal(/\bDELETE\b/i.test(sql019Precheck), false)
    })
})
