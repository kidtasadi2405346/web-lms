import DOMPurify from 'isomorphic-dompurify'
import {
  ALLOWED_FONT_SIZES,
  PRESET_COLORS,
  PRESET_HIGHLIGHTS,
} from '@/components/editor/editor-constants'

const ALLOWED_FONT_FAMILY_VALUES = ['serif', 'monospace', 'inherit']
const ALLOWED_FONT_SIZE_VALUES = ALLOWED_FONT_SIZES.map((f) => f.value)
const ALLOWED_COLOR_VALUES = PRESET_COLORS.map((c) => c.value.toLowerCase())
const ALLOWED_HIGHLIGHT_VALUES = PRESET_HIGHLIGHTS.map((h) => h.value.toLowerCase())
const ALLOWED_ALIGN_VALUES = ['left', 'center', 'right', 'justify']

// Pastikan hook uponSanitizeAttribute terpasang hanya sekali jika DOMPurify tersedia
let isHookRegistered = false

function registerSanitizeHooks() {
  if (isHookRegistered) return
  isHookRegistered = true

  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'style') {
      const styleStr = data.attrValue || ''
      // Tolak berbahaya: url(), expression(), position, javascript, etc.
      if (
        /url\(|expression\(|position|z-index|behavior|-moz-binding|javascript:/i.test(
          styleStr
        )
      ) {
        data.attrValue = ''
        return
      }

      // Filter hanya properti yang diizinkan dengan nilai yang sesuai whitelist
      const declarations = styleStr.split(';').map((s) => s.trim()).filter(Boolean)
      const safeDeclarations: string[] = []

      for (const decl of declarations) {
        const colonIndex = decl.indexOf(':')
        if (colonIndex === -1) continue
        const prop = decl.slice(0, colonIndex).trim().toLowerCase()
        const val = decl.slice(colonIndex + 1).trim()
        const lowerVal = val.toLowerCase()

        if (prop === 'font-family') {
          if (
            ALLOWED_FONT_FAMILY_VALUES.some((f) => lowerVal.includes(f)) ||
            lowerVal.includes('monospace') ||
            lowerVal.includes('serif')
          ) {
            safeDeclarations.push(`${prop}: ${val}`)
          }
        } else if (prop === 'font-size') {
          if (ALLOWED_FONT_SIZE_VALUES.includes(val as any)) {
            safeDeclarations.push(`${prop}: ${val}`)
          }
        } else if (prop === 'color') {
          if (
            ALLOWED_COLOR_VALUES.includes(lowerVal) ||
            /^#[0-9a-f]{3,6}$/i.test(val)
          ) {
            safeDeclarations.push(`${prop}: ${val}`)
          }
        } else if (prop === 'background-color') {
          if (
            ALLOWED_HIGHLIGHT_VALUES.includes(lowerVal) ||
            /^#[0-9a-f]{3,6}$/i.test(val)
          ) {
            safeDeclarations.push(`${prop}: ${val}`)
          }
        } else if (prop === 'text-align') {
          if (ALLOWED_ALIGN_VALUES.includes(lowerVal)) {
            safeDeclarations.push(`${prop}: ${val}`)
          }
        }
      }

      data.attrValue = safeDeclarations.join('; ')
    }
  })
}

registerSanitizeHooks()

/**
 * Membersihkan konten HTML dari potensi serangan XSS (Cross-Site Scripting)
 * dan membatasi style hanya pada atribut/nilai yang diizinkan.
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
      'sub',
      'sup',
      'mark',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'align'],
  })
}
