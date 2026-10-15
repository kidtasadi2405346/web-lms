import { describe, expect, it } from 'vitest'
import {
  getMaterialAudioExtension,
  MATERIAL_AUDIO_MAX_BYTES,
  validateMaterialAudioFile,
} from './material-audio-upload'

function fakeAudioFile(type: string, size: number): File {
  return { type, size } as File
}

describe('material audio upload validation', () => {
  it('accepts the configured audio MIME types within the size limit', () => {
    for (const mimeType of ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg']) {
      expect(validateMaterialAudioFile(fakeAudioFile(mimeType, MATERIAL_AUDIO_MAX_BYTES))).toBeNull()
      expect(getMaterialAudioExtension(mimeType)).toBeTruthy()
    }
  })

  it('rejects unsupported formats, empty files, and files over 10 MB', () => {
    expect(validateMaterialAudioFile(fakeAudioFile('audio/wav', 10))).toContain('Format audio')
    expect(validateMaterialAudioFile(fakeAudioFile('audio/mpeg', 0))).toContain('Ukuran audio')
    expect(validateMaterialAudioFile(fakeAudioFile('audio/mpeg', MATERIAL_AUDIO_MAX_BYTES + 1))).toContain('Ukuran audio')
  })
})