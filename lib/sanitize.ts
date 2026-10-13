import DOMPurify from 'isomorphic-dompurify'

/**
 * Membersihkan konten HTML dari potensi serangan XSS (Cross-Site Scripting)
 * sebelum dirender ke DOM browser.
 */
export function sanitizeHtml(dirty?: string | null): string {
  if (!dirty || typeof dirty !== 'string') return ''

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p',
      'b',
      'i',
      'em',
      'strong',
      'u',
      's',
      'strike',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'ul',
      'ol',
      'li',
      'blockquote',
      'code',
      'pre',
      'a',
      'span',
      'br',
      'hr',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  })
}
