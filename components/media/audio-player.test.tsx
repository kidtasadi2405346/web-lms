// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AudioPlayer, type MaterialAudioTrack } from './audio-player'

const { createSignedUrlMock } = vi.hoisted(() => ({ createSignedUrlMock: vi.fn() }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: createSignedUrlMock,
      }),
    },
  }),
}))

const tracks: MaterialAudioTrack[] = [
  { id: 'audio-1', title: 'Pengantar', file_path: 'material/audio-1.mp3', duration_seconds: 60, transcript: 'Bagian pertama', order_index: 0 },
  { id: 'audio-2', title: 'Contoh soal', file_path: 'material/audio-2.mp3', duration_seconds: 90, transcript: null, order_index: 1 },
]

const playMock = vi.fn(function (this: HTMLAudioElement) {
  this.dispatchEvent(new Event('play'))
  return Promise.resolve()
})
const pauseMock = vi.fn(function (this: HTMLAudioElement) {
  this.dispatchEvent(new Event('pause'))
})

beforeEach(() => {
  playMock.mockClear()
  pauseMock.mockClear()
  createSignedUrlMock.mockReset().mockImplementation(async (path: string) => ({
    data: { signedUrl: `https://storage.test/${path}` },
    error: null,
  }))
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: playMock })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: pauseMock })
  Object.defineProperty(HTMLMediaElement.prototype, 'load', { configurable: true, value: vi.fn() })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AudioPlayer', () => {
  it('plays and pauses audio using custom controls', async () => {
    render(<AudioPlayer materialId="material" audios={tracks} />)

    fireEvent.click(screen.getByRole('button', { name: 'Putar audio' }))
    await waitFor(() => expect(playMock).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: 'Jeda audio' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Jeda audio' }))
    expect(pauseMock).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Putar audio' })).toBeTruthy()
  })

  it('seeks backward and forward by ten seconds and changes playback rate', () => {
    const { container } = render(<AudioPlayer materialId="material" audios={tracks} />)
    const audio = container.querySelector('audio')!
    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 30 })
    fireEvent.timeUpdate(audio)

    fireEvent.click(screen.getByRole('button', { name: 'Mundur 10 detik' }))
    expect(audio.currentTime).toBe(20)
    fireEvent.click(screen.getByRole('button', { name: 'Maju 10 detik' }))
    expect(audio.currentTime).toBe(30)

    fireEvent.change(screen.getByLabelText('Kecepatan audio'), { target: { value: '1.25' } })
    expect(audio.playbackRate).toBe(1.25)
  })

  it('uses one audio element for the playlist and switches its active track', async () => {
    const { container } = render(<AudioPlayer materialId="material" audios={tracks} />)
    expect(container.querySelectorAll('audio')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /Contoh soal/ }))
    await waitFor(() => expect(playMock).toHaveBeenCalledOnce())
    expect(screen.getByText('Contoh soal', { selector: 'p' })).toBeTruthy()
  })

  it('mutes and restores volume from the custom volume control', () => {
    const { container } = render(<AudioPlayer materialId="material" audios={tracks} />)
    const audio = container.querySelector('audio')!

    fireEvent.click(screen.getByRole('button', { name: 'Bisukan audio' }))
    expect(audio.muted).toBe(true)
    fireEvent.change(screen.getByLabelText('Volume audio'), { target: { value: '0.4' } })
    expect(audio.volume).toBe(0.4)
    expect(audio.muted).toBe(false)
  })

  it('requests one fresh signed URL after a playback error', async () => {
    createSignedUrlMock
      .mockResolvedValueOnce({ data: { signedUrl: 'https://storage.test/expired' }, error: null })
      .mockResolvedValueOnce({ data: { signedUrl: 'https://storage.test/refreshed' }, error: null })
    const { container } = render(<AudioPlayer materialId="material" audios={tracks} />)
    const audio = container.querySelector('audio')!

    fireEvent.click(screen.getByRole('button', { name: 'Putar audio' }))
    await waitFor(() => expect(playMock).toHaveBeenCalledOnce())
    fireEvent.error(audio)

    await waitFor(() => expect(createSignedUrlMock).toHaveBeenCalledTimes(2))
    expect(audio.src).toBe('https://storage.test/refreshed')
    expect(playMock).toHaveBeenCalledTimes(2)
  })

  it('handles keyboard shortcuts only while focus is in the player', () => {
    const { container } = render(<AudioPlayer materialId="material" audios={tracks} />)
    const player = screen.getByRole('region', { name: 'Pemutar audio pembelajaran' })
    const audio = container.querySelector('audio')!
    Object.defineProperty(audio, 'currentTime', { configurable: true, writable: true, value: 20 })
    fireEvent.timeUpdate(audio)

    player.focus()
    fireEvent.keyDown(player, { key: 'ArrowLeft' })
    expect(audio.currentTime).toBe(10)

    document.body.focus()
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    expect(audio.currentTime).toBe(10)
  })
})
