export const MATERIAL_AUDIO_MAX_BYTES = 10 * 1024 * 1024

const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'mp4',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
}

export function validateMaterialAudioFile(file: File): string | null {
  if (!(file.type in AUDIO_EXTENSIONS)) {
    return 'Format audio harus MP3, MP4/M4A, atau OGG.'
  }
  if (file.size <= 0 || file.size > MATERIAL_AUDIO_MAX_BYTES) {
    return 'Ukuran audio harus lebih dari 0 dan maksimal 10 MB.'
  }
  return null
}

export function getMaterialAudioExtension(mimeType: string): string | null {
  return AUDIO_EXTENSIONS[mimeType] ?? null
}

export function readMaterialAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio')
    const objectUrl = URL.createObjectURL(file)
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
        reject(new Error('Durasi audio tidak dapat dibaca.'))
        return
      }
      resolve(audio.duration)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Berkas audio tidak dapat dibaca.'))
    }
    audio.src = objectUrl
  })
}

export async function uploadMaterialAudioFile(
  file: File,
  path: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Sesi login berakhir. Silakan masuk kembali.')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new Error('Konfigurasi penyimpanan audio tidak tersedia.')

  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/material-audio/${encodedPath}`)
    request.setRequestHeader('Authorization', `Bearer ${data.session.access_token}`)
    request.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')
    request.setRequestHeader('Content-Type', file.type)
    request.setRequestHeader('x-upsert', 'false')
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onerror = () => reject(new Error('Koneksi gagal saat mengunggah audio.'))
    request.ontimeout = () => reject(new Error('Unggahan audio melewati batas waktu.'))
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100)
        resolve()
      } else {
        reject(new Error('Audio gagal diunggah. Periksa akses dan koneksi Anda.'))
      }
    }
    request.timeout = 120_000
    request.send(file)
  })
}
