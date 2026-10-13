export type EmbedType = 'youtube' | 'google-drive' | null

export type EmbedInfo = {
  type: EmbedType
  embedUrl: string | null
  originalUrl: string
}

/**
 * Mengurai URL video (YouTube atau Google Drive) menjadi URL embed iframe yang aman dan siap pakai.
 */
export function parseVideoEmbed(url?: string | null): EmbedInfo {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { type: null, embedUrl: null, originalUrl: '' }
  }

  const trimmed = url.trim()

  // 1. YouTube Detection
  // Matches: youtube.com/watch?v=xyz, youtu.be/xyz, youtube.com/embed/xyz, youtube.com/shorts/xyz
  const ytMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  )

  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`,
      originalUrl: trimmed,
    }
  }

  // 2. Google Drive Detection
  // Matches: drive.google.com/file/d/{id}/..., drive.google.com/open?id={id}
  const gdMatch = trimmed.match(
    /(?:https?:\/\/)?drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/,
  )

  const gdId = gdMatch ? gdMatch[1] || gdMatch[2] : null
  if (gdId) {
    return {
      type: 'google-drive',
      embedUrl: `https://drive.google.com/file/d/${gdId}/preview`,
      originalUrl: trimmed,
    }
  }

  return {
    type: null,
    embedUrl: null,
    originalUrl: trimmed,
  }
}
