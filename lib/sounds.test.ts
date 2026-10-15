import { afterEach, describe, expect, it, vi } from 'vitest'
import { playQuizSound, prepareQuizAudio } from './sounds'

describe('playQuizSound', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not throw when Web Audio is unavailable', () => {
    vi.stubGlobal('window', {})
    expect(() => playQuizSound('correct', true)).not.toThrow()
  })

  it('does not create an audio context when sound is disabled', () => {
    const AudioContextMock = vi.fn()
    vi.stubGlobal('window', { AudioContext: AudioContextMock })

    prepareQuizAudio(false)
    playQuizSound('passed', false)

    expect(AudioContextMock).not.toHaveBeenCalled()
  })
})