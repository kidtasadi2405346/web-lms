import { describe, it, expect } from 'vitest'
import {
  parseEmbedUrl,
  simulationEmbedConfigSchema,
  ALLOWED_SIMULATION_DOMAINS,
  getSimulationFrameSources,
} from './embed'

describe('parseEmbedUrl Security & Whitelist Tests', () => {
  it('harus menerima URL PhET yang valid', () => {
    const res = parseEmbedUrl('https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_all.html')
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.hostname).toBe('phet.colorado.edu')
    }
  })

  it('harus menerima subdomain resmi PhET atau Falstad atau Tinkercad', () => {
    const falstadRes = parseEmbedUrl('https://www.falstad.com/circuit/circuitjs.html')
    expect(falstadRes.ok).toBe(true)

    const circuitRes = parseEmbedUrl('https://circuit.falstad.com/test')
    expect(circuitRes.ok).toBe(true)

    const tinkercadRes = parseEmbedUrl('https://www.tinkercad.com/things/123-circuit')
    expect(tinkercadRes.ok).toBe(true)
  })

  it('harus menormalisasi huruf kapital dan titik di akhir hostname', () => {
    const upperRes = parseEmbedUrl('https://PHET.COLORADO.EDU/sims/html/ohms-law')
    expect(upperRes.ok).toBe(true)
    if (upperRes.ok) {
      expect(upperRes.hostname).toBe('phet.colorado.edu')
    }

    const trailingDot = parseEmbedUrl('https://falstad.com./circuit')
    expect(trailingDot.ok).toBe(true)
    if (trailingDot.ok) {
      expect(trailingDot.hostname).toBe('falstad.com')
    }
  })

  it('harus menolak protokol non-HTTPS (HTTP, javascript, data, blob)', () => {
    const httpRes = parseEmbedUrl('http://phet.colorado.edu/sims/html/faraday')
    expect(httpRes.ok).toBe(false)
    if (!httpRes.ok) {
      expect(httpRes.reason).toContain('HTTPS')
    }

    const jsRes = parseEmbedUrl('javascript:alert("hacked")')
    expect(jsRes.ok).toBe(false)

    const dataRes = parseEmbedUrl('data:text/html,<script>alert(1)</script>')
    expect(dataRes.ok).toBe(false)

    const blobRes = parseEmbedUrl('blob:https://phet.colorado.edu/uuid')
    expect(blobRes.ok).toBe(false)
  })

  it('harus menolak URL yang menyisipkan kredensial/userinfo (@)', () => {
    const userRes = parseEmbedUrl('https://phet.colorado.edu@evil.com/sim')
    expect(userRes.ok).toBe(false)
    if (!userRes.ok) {
      expect(userRes.reason).toContain('kredensial')
    }

    const passRes = parseEmbedUrl('https://admin:secret@falstad.com/circuit')
    expect(passRes.ok).toBe(false)
  })

  it('harus menolak trik domain palsu (evil subdomain, spoofing suffix, atau path spoofing)', () => {
    // 1. Domain phet sebagai subdomain dari evil.com
    const evilSub = parseEmbedUrl('https://phet.colorado.edu.evil.com/sim')
    expect(evilSub.ok).toBe(false)

    // 2. Trik evil-phet
    const evilPrefix = parseEmbedUrl('https://evil-phet.colorado.edu.evil.com/sim')
    expect(evilPrefix.ok).toBe(false)

    // 3. Trik domain mirip tanpa titik pemisah
    const similarDomain = parseEmbedUrl('https://evilfalstad.com/circuit')
    expect(similarDomain.ok).toBe(false)

    // 4. Nama domain di path, bukan di hostname
    const pathSpoof = parseEmbedUrl('https://evil.com/phet.colorado.edu')
    expect(pathSpoof.ok).toBe(false)
  })

  it('harus menolak domain Punycode / IDN homograph attack', () => {
    const punycodeRes = parseEmbedUrl('https://xn--phet-colorado-edu.com')
    expect(punycodeRes.ok).toBe(false)
  })

  it('harus menolak input kosong atau bukan string', () => {
    expect(parseEmbedUrl('') .ok).toBe(false)
    expect(parseEmbedUrl('   ').ok).toBe(false)
    expect(parseEmbedUrl(null).ok).toBe(false)
    expect(parseEmbedUrl(undefined).ok).toBe(false)
  })
})

describe('simulationEmbedConfigSchema Zod Validation Tests', () => {
  it('berhasil memvalidasi payload config url yang valid', () => {
    const valid = { url: 'https://phet.colorado.edu/sims/html/circuit-construction-kit-dc' }
    const result = simulationEmbedConfigSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('gagal memvalidasi payload config url yang ditolak atau tidak valid', () => {
    const invalid = { url: 'https://evil.com/circuit' }
    const result = simulationEmbedConfigSchema.safeParse(invalid)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('tidak diizinkan')
    }
  })

  it('gagal jika url kosong', () => {
    const empty = { url: '   ' }
    const result = simulationEmbedConfigSchema.safeParse(empty)
    expect(result.success).toBe(false)
  })
})

describe('getSimulationFrameSources CSP Generator Tests', () => {
  it('menghasilkan direktif frame-src yang memuat seluruh domain whitelist dan self', () => {
    const sources = getSimulationFrameSources()
    expect(sources).toContain("'self'")
    ALLOWED_SIMULATION_DOMAINS.forEach((domain) => {
      expect(sources).toContain(`https://${domain}`)
      expect(sources).toContain(`https://*.${domain}`)
    })
    expect(sources).toContain('https://www.youtube-nocookie.com')
    expect(sources).toContain('https://drive.google.com')
  })
})
