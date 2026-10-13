import DOMPurify from 'isomorphic-dompurify'
import {
  ALLOWED_FONT_SIZES,
  PRESET_COLORS,
  PRESET_HIGHLIGHTS,
} from '../components/editor/editor-constants'

const ALLOWED_FONT_FAMILY_VALUES = ['serif', 'monospace', 'inherit']
const ALLOWED_FONT_SIZE_VALUES = ALLOWED_FONT_SIZES.map((f) => f.value)
const ALLOWED_COLOR_VALUES = PRESET_COLORS.map((c) => c.value.toLowerCase())
const ALLOWED_HIGHLIGHT_VALUES = PRESET_HIGHLIGHTS.map((h) => h.value.toLowerCase())
const ALLOWED_ALIGN_VALUES = ['left', 'center', 'right', 'justify']

// Pastikan hook uponSanitizeAttribute dan uponSanitizeElement terpasang hanya sekali jika DOMPurify tersedia
let isHookRegistered = false

export function isAllowedStorageImageUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr)
    // Cek hostname Supabase atau local supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    let expectedHost = ''
    if (supabaseUrl) {
      try {
        expectedHost = new URL(supabaseUrl).hostname
      } catch {}
    }

    // Hostname harus cocok dengan SUPABASE_URL project ini atau localhost supabase jika development
    const isMatchingHost =
      (expectedHost && parsed.hostname === expectedHost) ||
      parsed.hostname === 'ylnkugyttxtpzxigrsuq.supabase.co' ||
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1'

    if (!isMatchingHost) return false

    // Pathname harus merujuk ke bucket public 'material-images'
    return parsed.pathname.includes('/storage/v1/object/public/material-images/')
  } catch {
    return false
  }
}

function registerSanitizeHooks() {
  if (isHookRegistered) return
  isHookRegistered = true

  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    // Validasi elemen <img>: HANYA izinkan gambar yang berasal dari bucket material-images proyek
    if (data.tagName === 'img') {
      const imgNode = node as HTMLImageElement
      const src = imgNode.getAttribute('src') || ''

      // Tolak data: dan javascript: atau url luar yang bukan dari bucket material-images
      if (
        !src ||
        src.startsWith('data:') ||
        src.startsWith('javascript:') ||
        !isAllowedStorageImageUrl(src)
      ) {
        // Buang node atau batalkan src
        if (imgNode.parentNode) {
          imgNode.parentNode.removeChild(imgNode)
        }
      }
    }
  })

  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    // Validasi link: hanya http dan https, cegah javascript:, pasang target _blank dan rel noopener noreferrer
    if (data.attrName === 'href') {
      const href = (data.attrValue || '').trim()
      const lowerHref = href.toLowerCase()
      if (
        lowerHref.startsWith('javascript:') ||
        lowerHref.startsWith('data:') ||
        lowerHref.startsWith('vbscript:') ||
        (!lowerHref.startsWith('http://') &&
          !lowerHref.startsWith('https://') &&
          !lowerHref.startsWith('/') &&
          !lowerHref.startsWith('#'))
      ) {
        data.attrValue = ''
      } else {
        if (lowerHref.startsWith('http://') || lowerHref.startsWith('https://')) {
          const anchorNode = node as HTMLAnchorElement
          anchorNode.setAttribute('target', '_blank')
          anchorNode.setAttribute('rel', 'noopener noreferrer')
        }
      }
    }

    if (data.attrName === 'style') {
      const styleStr = data.attrValue || ''

      // Filter deklarasi per deklarasi
      const declarations = styleStr.split(';').map((s) => s.trim()).filter(Boolean)
      const safeDeclarations: string[] = []

      for (const decl of declarations) {
        // Abaikan jika deklarasi mengandung url(), expression(), position, javascript, etc.
        if (
          /url\(|expression\(|position|z-index|behavior|-moz-binding|javascript:/i.test(
            decl
          )
        ) {
          continue
        }

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
 * dan membatasi style serta tag image hanya dari storage resmi proyek.
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
      'img',
    ],
    ALLOWED_ATTR: [
      'href',
      'target',
      'rel',
      'class',
      'style',
      'align',
      'src',
      'alt',
      'loading',
      'width',
      'height',
    ],
  })
}
