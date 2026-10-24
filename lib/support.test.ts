import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SUPPORT_EMAIL } from './support.ts'

describe('support email', () => {
    it('uses the domain support address as the canonical inbox', () => {
        assert.equal(SUPPORT_EMAIL, 'support@standwalkrun.com')
    })
})
