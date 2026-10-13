import { z } from 'zod'

/**
 * Daftar putih domain simulasi resmi (PhET, Falstad Circuit Simulator, Autodesk Tinkercad).
 * Satu-satunya sumber kebenaran untuk validasi simulasi dan Content Security Policy.
 */
export const ALLOWED_SIMULATION_DOMAINS = [
  'phet.colorado.edu',
  'falstad.com',
  'tinkercad.com',
] as const

export type AllowedSimulationDomain = (typeof ALLOWED_SIMULATION_DOMAINS)[number]

export type ParseEmbedUrlResult =
  | { ok: true; url: string; hostname: string }
  | { ok: false; reason: string }

/**
 * Memvalidasi dan mengurai URL embed simulasi dengan standar keamanan tinggi:
 * 1. Menggunakan parser URL standar (new URL), bukan regex/substring pada string mentah.
 * 2. Wajib berskema https: (menolak http, javascript:, data:, blob:, ftp:, dll).
 * 3. Menolak URL dengan username atau password (contoh: https://phet.colorado.edu@evil.com).
 * 4. Menolak IDN / Punycode (homograph attack seperti xn--...).
 * 5. Hostname dinormalisasi (huruf kecil, membuang titik di akhir).
 * 6. Pencocokan domain ketat: persis sama atau berakhiran "." + domain whitelist.
 */
export function parseEmbedUrl(input?: string | null): ParseEmbedUrlResult {
  if (!input || typeof input !== 'string') {
    return { ok: false, reason: 'URL simulasi tidak boleh kosong.' }
  }

  const trimmed = input.trim()
  if (!trimmed) {
    return { ok: false, reason: 'URL simulasi tidak boleh kosong.' }
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, reason: 'Format URL tidak valid.' }
  }

  // 1. Skema wajib https:
  if (parsed.protocol !== 'https:') {
    return {
      ok: false,
      reason: 'URL harus menggunakan protokol aman HTTPS (https://). Protokol HTTP atau skema lain tidak diizinkan.',
    }
  }

  // 2. Tolak userinfo (username / password pada authority)
  if (parsed.username || parsed.password) {
    return {
      ok: false,
      reason: 'URL tidak boleh memuat kredensial autentikasi (username atau password).',
    }
  }

  // 3. Normalisasi hostname
  let hostname = parsed.hostname.toLowerCase()
  while (hostname.endsWith('.')) {
    hostname = hostname.slice(0, -1)
  }

  if (!hostname) {
    return { ok: false, reason: 'Nama host (hostname) tidak valid.' }
  }

  // 4. Tolak Punycode / IDN homograph attacks (misal xn--...)
  if (hostname.startsWith('xn--') || hostname.includes('.xn--') || /[^\u0020-\u007E]/.test(hostname)) {
    return {
      ok: false,
      reason: 'Nama domain memuat karakter non-ASCII atau Punycode yang tidak diizinkan.',
    }
  }

  // 5. Pencocokan domain terhadap daftar putih
  const isAllowed = ALLOWED_SIMULATION_DOMAINS.some(
    (allowed) => hostname === allowed || hostname.endsWith('.' + allowed)
  )

  if (!isAllowed) {
    return {
      ok: false,
      reason: `Domain "${hostname}" tidak diizinkan. Domain simulasi yang diperbolehkan hanya: ${ALLOWED_SIMULATION_DOMAINS.join(
        ', '
      )}.`,
    }
  }

  return {
    ok: true,
    url: parsed.toString(),
    hostname,
  }
}

/**
 * Skema Zod untuk konfigurasi simulasi tipe embed {"url": string}.
 */
export const simulationEmbedConfigSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'URL simulasi tidak boleh kosong')
    .superRefine((val, ctx) => {
      const res = parseEmbedUrl(val)
      if (!res.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: res.reason,
        })
      }
    }),
})

export type SimulationEmbedConfig = z.infer<typeof simulationEmbedConfigSchema>

/**
 * Membangun sumber frame-src Content Security Policy dari daftar domain resmi.
 */
export function getSimulationFrameSources(): string[] {
  const sources: string[] = ["'self'"]
  ALLOWED_SIMULATION_DOMAINS.forEach((domain) => {
    sources.push(`https://${domain}`)
    sources.push(`https://*.${domain}`)
  })
  // Sertakan juga domain video yang digunakan di media viewer
  sources.push('https://www.youtube-nocookie.com', 'https://drive.google.com')
  return sources
}
