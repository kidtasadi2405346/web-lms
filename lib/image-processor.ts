/**
 * Utilitas untuk validasi dan kompresi gambar sebelum diunggah ke Supabase Storage.
 * - Mengecilkan sisi terpanjang maksimal 1600px.
 * - Mengonversi ke WebP kualitas 0.85 (atau fallback ke JPEG).
 * - Menjaga ukuran di bawah 2MB.
 */

export interface ProcessedImageResult {
  file: File
  width: number
  height: number
}

export async function processImageForUpload(file: File, maxDimension = 1600): Promise<ProcessedImageResult> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Format gambar tidak didukung. Harap gunakan JPEG, PNG, WebP, atau GIF.')
  }

  // Jika GIF, tidak diubah agar animasinya tidak rusak
  if (file.type === 'image/gif') {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Ukuran file GIF melebihi batas 2 MB.')
    }
    return { file, width: 0, height: 0 }
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      let width = img.naturalWidth
      let height = img.naturalHeight

      // Resize jika dimensi melebihi maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        // Fallback jika canvas context gagal
        if (file.size > 2 * 1024 * 1024) {
          reject(new Error('Ukuran file melebihi batas 2 MB.'))
        } else {
          resolve({ file, width: img.naturalWidth, height: img.naturalHeight })
        }
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Gagal memproses gambar.'))
            return
          }

          if (blob.size > 2 * 1024 * 1024) {
            reject(new Error('Ukuran gambar setelah kompresi masih melebihi 2 MB.'))
            return
          }

          const processedFile = new File([blob], `${Date.now()}.webp`, {
            type: 'image/webp',
          })

          resolve({ file: processedFile, width, height })
        },
        'image/webp',
        0.85
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Gagal membaca berkas gambar.'))
    }

    img.src = url
  })
}
