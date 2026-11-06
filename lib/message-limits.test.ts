import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  MAX_MESSAGE_ATTACHMENTS,
  MAX_MESSAGE_FILE_SIZE_BYTES,
  MAX_MESSAGE_FILE_SIZE_LABEL,
  MESSAGE_ATTACHMENT_ACCEPT,
  attachmentsTruncatedMessage,
  fileTooLargeMessage,
  maxAttachmentsReachedMessage,
  validateMessageAttachments,
} from './message-limits.ts'

const here = dirname(fileURLToPath(import.meta.url))

function fakeFile(name: string, size: number): File {
  const buffer = new Uint8Array(Math.min(size, 16))
  const file = new File([buffer], name, { type: 'image/png' })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('message upload limits', () => {
  it('keeps the existing 5-file and 10 MB caps', () => {
    assert.equal(MAX_MESSAGE_ATTACHMENTS, 5)
    assert.equal(MAX_MESSAGE_FILE_SIZE_BYTES, 10 * 1024 * 1024)
    assert.equal(MAX_MESSAGE_FILE_SIZE_LABEL, '10 MB')
    assert.match(MESSAGE_ATTACHMENT_ACCEPT, /image\/\*/)
    assert.match(MESSAGE_ATTACHMENT_ACCEPT, /\.pdf/)
  })

  it('rejects a sixth file with the same user-facing copy', () => {
    const existing = Array.from({ length: 5 }, (_, i) => fakeFile(`a${i}.png`, 10))
    const result = validateMessageAttachments(existing.length, [fakeFile('extra.png', 10)])
    assert.deepEqual(result.accepted, [])
    assert.deepEqual(result.errors, [maxAttachmentsReachedMessage()])
  })

  it('truncates a batch that would exceed the cap and keeps the first files', () => {
    const files = Array.from({ length: 4 }, (_, i) => fakeFile(`f${i}.png`, 10))
    const result = validateMessageAttachments(3, files)
    assert.equal(result.accepted.length, 2)
    assert.equal(result.accepted[0].name, 'f0.png')
    assert.equal(result.accepted[1].name, 'f1.png')
    assert.deepEqual(result.errors, [attachmentsTruncatedMessage(2)])
  })

  it('wires the shared validator and accept list into the live Messages UI', () => {
    const view = readFileSync(join(here, '../components/messages/messages-view.tsx'), 'utf8')
    const composer = readFileSync(join(here, '../components/messages/message-composer.tsx'), 'utf8')
    assert.match(view, /validateMessageAttachments/)
    assert.match(composer, /MESSAGE_ATTACHMENT_ACCEPT/)
    assert.match(composer, /MAX_MESSAGE_ATTACHMENTS/)
    assert.doesNotMatch(view, /10 \* 1024 \* 1024/)
    assert.doesNotMatch(composer, /10 \* 1024 \* 1024/)
  })

  it('rejects files over 10 MB without dropping valid ones in the same batch', () => {
    const ok = fakeFile('ok.png', 1024)
    const huge = fakeFile('huge.pdf', MAX_MESSAGE_FILE_SIZE_BYTES + 1)
    const result = validateMessageAttachments(0, [ok, huge])
    assert.equal(result.accepted.length, 1)
    assert.equal(result.accepted[0].name, 'ok.png')
    assert.deepEqual(result.errors, [fileTooLargeMessage('huge.pdf')])
  })
})
