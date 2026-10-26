import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SITE_NAME, getAppTitleParts } from './app-title.ts'

describe('app title parts', () => {
    it('uses Stand Walk Run alone when no org branding name is set', () => {
        assert.equal(SITE_NAME, 'Stand Walk Run')
        assert.deepEqual(getAppTitleParts(null), { title: 'Stand Walk Run', subtitle: null })
        assert.deepEqual(getAppTitleParts(undefined), { title: 'Stand Walk Run', subtitle: null })
        assert.deepEqual(getAppTitleParts(''), { title: 'Stand Walk Run', subtitle: null })
        assert.deepEqual(getAppTitleParts('   '), { title: 'Stand Walk Run', subtitle: null })
    })

    it('uses the org name as the title and Stand Walk Run as the subtitle', () => {
        assert.deepEqual(getAppTitleParts('101 Church'), {
            title: '101 Church',
            subtitle: 'Stand Walk Run',
        })
        assert.deepEqual(getAppTitleParts('  101 Church  '), {
            title: '101 Church',
            subtitle: 'Stand Walk Run',
        })
    })

    it('falls back to the organization name when church name is unset', () => {
        assert.deepEqual(getAppTitleParts(null, '101 Church'), {
            title: '101 Church',
            subtitle: 'Stand Walk Run',
        })
        assert.deepEqual(getAppTitleParts('   ', '  101 Church  '), {
            title: '101 Church',
            subtitle: 'Stand Walk Run',
        })
    })

    it('prefers the church name over the organization name', () => {
        assert.deepEqual(getAppTitleParts('101 Church', 'Stand Walk Run Inc'), {
            title: '101 Church',
            subtitle: 'Stand Walk Run',
        })
    })
})
