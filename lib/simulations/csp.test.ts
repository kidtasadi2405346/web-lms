import { describe, it, expect } from 'vitest'
import {
  mergeContentSecurityPolicy,
  getFrameSrcSources,
  getMediaSrcSources,
  ALLOWED_SIMULATION_DOMAINS,
} from './csp'
import nextConfig from '../../next.config'

describe('Content Security Policy (CSP) Frame-Src Whitelist', () => {
  it('membatasi media-src ke self dan origin Supabase Storage', () => {
    expect(getMediaSrcSources('https://project.supabase.co/storage/v1')).toEqual([
      "'self'",
      'https://project.supabase.co',
    ])

    const csp = mergeContentSecurityPolicy()
    expect(csp).toContain("media-src 'self'")
  })

  it('menghasilkan daftar frame-src yang mencakup seluruh domain whitelist simulasi', () => {
    const sources = getFrameSrcSources()
    expect(sources).toContain("'self'")
    for (const domain of ALLOWED_SIMULATION_DOMAINS) {
      expect(sources).toContain(`https://${domain}`)
      expect(sources).toContain(`https://*.${domain}`)
    }
  })

  it('membangun CSP default dengan frame-src yang lengkap', () => {
    const csp = mergeContentSecurityPolicy()
    expect(csp).toContain('frame-src')
    for (const domain of ALLOWED_SIMULATION_DOMAINS) {
      expect(csp).toContain(`https://${domain}`)
      expect(csp).toContain(`https://*.${domain}`)
    }
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("base-uri 'self'")
  })

  it('menggabungkan CSP baru ke dalam existing CSP tanpa menimpa directive lain', () => {
    const existing = "default-src 'none'; script-src 'self' https://trusted.cdn.com"
    const merged = mergeContentSecurityPolicy(existing)

    expect(merged).toContain("default-src 'none'")
    expect(merged).toContain("script-src 'self' https://trusted.cdn.com")
    expect(merged).toContain('frame-src')
    for (const domain of ALLOWED_SIMULATION_DOMAINS) {
      expect(merged).toContain(`https://${domain}`)
    }
  })

  it('menggabungkan ke directive frame-src yang sudah ada tanpa menduplikasi token', () => {
    const existing = "frame-src 'self' https://partner.org; img-src 'self'"
    const merged = mergeContentSecurityPolicy(existing)

    expect(merged).toContain("https://partner.org")
    expect(merged).toContain("img-src 'self'")
    for (const domain of ALLOWED_SIMULATION_DOMAINS) {
      expect(merged).toContain(`https://${domain}`)
    }

    // Pastikan 'self' tidak berulang berkali-kali dalam satu frame-src
    const frameSrcPart = merged.split(';').find((p) => p.trim().startsWith('frame-src'))
    expect(frameSrcPart).toBeDefined()
    const tokens = frameSrcPart!.trim().split(/\s+/)
    const selfCount = tokens.filter((t) => t === "'self'").length
    expect(selfCount).toBe(1)
  })

  it('mempertahankan media-src yang ada dan menambahkan sumber media Supabase', () => {
    const merged = mergeContentSecurityPolicy("media-src 'self'; img-src 'self'")
    expect(merged).toContain("media-src 'self'")
    expect(merged).toContain('img-src \'self\'')
  })

  it('memastikan konfigurasi next.config.ts menyematkan CSP yang berisi domain whitelist', async () => {
    if (typeof nextConfig.headers === 'function') {
      const headersConfig = await nextConfig.headers()
      const rootHeader = headersConfig.find((h) => h.source === '/:path*')
      expect(rootHeader).toBeDefined()
      const cspHeader = rootHeader?.headers.find(
        (h) => h.key.toLowerCase() === 'content-security-policy',
      )
      expect(cspHeader).toBeDefined()
      for (const domain of ALLOWED_SIMULATION_DOMAINS) {
        expect(cspHeader?.value).toContain(`https://${domain}`)
      }
    } else {
      throw new Error('nextConfig.headers should be defined as a function')
    }
  })
})
