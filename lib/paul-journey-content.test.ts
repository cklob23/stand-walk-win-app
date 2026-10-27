import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    BANNED_TYPOS,
    QUESTION_5_PROMPT,
    Q2_PRAYER_NOTE,
    SALVATION_PRAYER,
    allPaulCopy,
} from './paul-journey-content.ts'

const here = dirname(fileURLToPath(import.meta.url))

describe('Paul journey content', () => {
    it('keeps Question 2 flagged as the Salvation prayer', () => {
        assert.equal(Q2_PRAYER_NOTE, 'This is the Salvation prayer.')
        assert.match(SALVATION_PRAYER, /save me and fill me with Your Holy Spirit/)
        assert.match(SALVATION_PRAYER, /Amen\.$/)
    })

    it('adds Romans 10:8-10 as Question 5', () => {
        assert.equal(
            QUESTION_5_PROMPT,
            'Romans 10:8-10 What does this passage tell us that relates to the idea of being "born again"?',
        )
    })

    it('does not leave Paul\'s placeholder note or known typos in user-facing copy', () => {
        const joined = allPaulCopy().join('\n')
        for (const typo of BANNED_TYPOS) {
            assert.equal(joined.includes(typo), false, `copy still contains ${typo}`)
        }
    })

    it('does not use em dashes', () => {
        for (const text of allPaulCopy()) {
            assert.equal(text.includes('\u2014'), false)
            assert.equal(text.includes('--'), false)
        }
    })

    it('exports every commentary and prayer block', () => {
        assert.equal(allPaulCopy().length, 29)
        for (const text of allPaulCopy()) {
            assert.ok(text.trim().length > 10)
        }
    })

    it('keeps the SQL script free of banned typos and the Q2 placeholder', () => {
        const sql = readFileSync(join(here, '..', 'scripts', '017-paul-journey-content.sql'), 'utf8')
        for (const typo of BANNED_TYPOS) {
            assert.equal(sql.includes(typo), false, `017 SQL still contains ${typo}`)
        }
        assert.match(sql, /This is the Salvation prayer/)
        assert.match(sql, /Beginning Bible Study/)
        assert.match(sql, /The Armor of God/)
        assert.match(sql, /Making a Stand Plan/)
        assert.match(sql, /Prayer for Strength/)
    })
})
