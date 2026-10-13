import { getSimulationFrameSources, ALLOWED_SIMULATION_DOMAINS } from './embed'

export const DEFAULT_MEDIA_FRAME_SOURCES = [
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://drive.google.com',
]

/**
 * Menghasilkan directive frame-src yang memuat domain whitelist simulasi ('self', https://domain, https://*.domain)
 * serta media video yang didukung aplikasi.
 */
export function getFrameSrcSources(extraSources: string[] = []): string[] {
  const sources = new Set<string>([
    ...getSimulationFrameSources(),
    ...DEFAULT_MEDIA_FRAME_SOURCES,
    ...extraSources,
  ])
  return Array.from(sources)
}

/**
 * Menggabungkan directive frame-src dengan CSP yang sudah ada (jika ada).
 * Mempertahankan directive lain dan menggabungkan token frame-src tanpa menduplikasi.
 */
export function mergeContentSecurityPolicy(existingCsp: string = ''): string {
  const frameSources = getFrameSrcSources()

  if (!existingCsp.trim()) {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      `frame-src ${frameSources.join(' ')}`,
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ')
  }

  const directives = existingCsp
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)

  let frameSrcFound = false
  const updatedDirectives = directives.map((directive) => {
    if (directive.toLowerCase().startsWith('frame-src')) {
      frameSrcFound = true
      const existingTokens = directive.split(/\s+/).slice(1)
      const mergedTokens = Array.from(new Set([...existingTokens, ...frameSources]))
      return `frame-src ${mergedTokens.join(' ')}`
    }
    return directive
  })

  if (!frameSrcFound) {
    updatedDirectives.push(`frame-src ${frameSources.join(' ')}`)
  }

  return updatedDirectives.join('; ')
}

export { ALLOWED_SIMULATION_DOMAINS }
