/** Existing Messages upload limits — keep these stable. */
export const MAX_MESSAGE_ATTACHMENTS = 5
export const MAX_MESSAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const MAX_MESSAGE_FILE_SIZE_LABEL = '10 MB'

export const MESSAGE_ATTACHMENT_ACCEPT =
  'image/*,.pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.mp3,.mp4,.mov'

export function maxAttachmentsReachedMessage(max = MAX_MESSAGE_ATTACHMENTS): string {
  return `You can only attach up to ${max} files per message`
}

export function attachmentsTruncatedMessage(
  extraCount: number,
  max = MAX_MESSAGE_ATTACHMENTS,
): string {
  return `You can only attach up to ${max} files per message. ${extraCount} file(s) were not added.`
}

export function fileTooLargeMessage(
  fileName: string,
  label = MAX_MESSAGE_FILE_SIZE_LABEL,
): string {
  return `"${fileName}" exceeds the ${label} file size limit`
}

export function validateMessageAttachments(
  existingCount: number,
  files: File[],
  options?: {
    maxAttachments?: number
    maxFileSizeBytes?: number
    maxFileSizeLabel?: string
  },
): { accepted: File[]; errors: string[] } {
  const maxAttachments = options?.maxAttachments ?? MAX_MESSAGE_ATTACHMENTS
  const maxFileSizeBytes = options?.maxFileSizeBytes ?? MAX_MESSAGE_FILE_SIZE_BYTES
  const maxFileSizeLabel = options?.maxFileSizeLabel ?? MAX_MESSAGE_FILE_SIZE_LABEL
  const remaining = maxAttachments - existingCount
  const errors: string[] = []

  if (remaining <= 0) {
    return { accepted: [], errors: [maxAttachmentsReachedMessage(maxAttachments)] }
  }

  const filesToAdd = Array.from(files).slice(0, remaining)
  if (files.length > remaining) {
    errors.push(attachmentsTruncatedMessage(files.length - remaining, maxAttachments))
  }

  const accepted: File[] = []
  for (const file of filesToAdd) {
    if (file.size > maxFileSizeBytes) {
      errors.push(fileTooLargeMessage(file.name, maxFileSizeLabel))
      continue
    }
    accepted.push(file)
  }

  return { accepted, errors }
}
