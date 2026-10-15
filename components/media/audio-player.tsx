'use client'

import { useEffect, useRef, useState } from 'react'
import {
  FileText,
  ListMusic,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export type MaterialAudioTrack = {
  id: string
  title: string
  file_path: string
  duration_seconds: number | null
  transcript: string | null
  order_index: number
}

interface AudioPlayerProps {
  materialId: string
  audios: MaterialAudioTrack[]
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const totalSeconds = Math.floor(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function formatAccessibleTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${minutes} menit ${remainingSeconds} detik`
}

function readSavedPosition(materialId: string, audioId: string): number {
  try {
    const saved = Number(window.localStorage.getItem(`mini-lms-audio:${materialId}:${audioId}`))
    return Number.isFinite(saved) && saved > 3 ? saved : 0
  } catch {
    return 0
  }
}

export function AudioPlayer({ materialId, audios }: AudioPlayerProps) {
  const tracks = [...audios].sort((first, second) => first.order_index - second.order_index)
  const audioRef = useRef<HTMLAudioElement>(null)
  const signedUrls = useRef(new Map<string, string>())
  const requestId = useRef(0)
  const retryCount = useRef(0)
  const activeIndexRef = useRef(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(tracks[0]?.duration_seconds ?? 0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const [resumeAt, setResumeAt] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const activeTrack = tracks[activeIndex] ?? tracks[0]
  useEffect(() => {
    if (!activeTrack) return
    const savedPosition = readSavedPosition(materialId, activeTrack.id)
    const knownDuration = activeTrack.duration_seconds ?? 0
    setResumeAt(savedPosition > 0 && (!knownDuration || savedPosition < knownDuration - 5) ? savedPosition : 0)
  }, [activeTrack?.duration_seconds, activeTrack?.id, materialId])
  if (!activeTrack) return null

  async function startTrack(index: number, refreshUrl = false, retries = 0): Promise<void> {
    const track = tracks[index]
    const audio = audioRef.current
    if (!track || !audio) return

    const thisRequest = ++requestId.current
    const previousIndex = activeIndexRef.current
    activeIndexRef.current = index
    setActiveIndex(index)
    setError(null)
    retryCount.current = retries

    if (previousIndex !== index) {
      audio.pause()
      setCurrentTime(0)
      setDuration(track.duration_seconds ?? 0)
      setShowTranscript(false)
      const savedPosition = readSavedPosition(materialId, track.id)
      const knownDuration = track.duration_seconds ?? 0
      setResumeAt(savedPosition > 0 && (!knownDuration || savedPosition < knownDuration - 5) ? savedPosition : 0)
    }

    try {
      let signedUrl = refreshUrl ? undefined : signedUrls.current.get(track.id)
      if (!signedUrl) {
        const supabase = createClient()
        const { data, error: signedUrlError } = await supabase.storage
          .from('material-audio')
          .createSignedUrl(track.file_path, 60 * 60)
        if (signedUrlError || !data?.signedUrl) throw new Error('Tautan audio gagal dibuat.')
        signedUrl = data.signedUrl
        signedUrls.current.set(track.id, signedUrl)
      }

      if (thisRequest !== requestId.current) return
      if (audio.src !== signedUrl) {
        audio.pause()
        audio.src = signedUrl
        audio.load()
      }
      audio.playbackRate = playbackRate
      audio.volume = isMuted ? 0 : volume
      audio.muted = isMuted
      await audio.play()
      if (thisRequest !== requestId.current) {
        audio.pause()
        return
      }
      setIsPlaying(true)
    } catch {
      if (thisRequest !== requestId.current) return
      if (retries < 1) {
        signedUrls.current.delete(track.id)
        await startTrack(index, true, retries + 1)
        return
      }
      setIsPlaying(false)
      setError('Audio tidak dapat diputar. Periksa koneksi, lalu coba lagi.')
    }
  }

  function handlePlayPause() {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }
    retryCount.current = 0
    void startTrack(activeIndex, false, 0)
  }

  function handleTimeUpdate() {
    const audio = audioRef.current
    if (!audio || !activeTrack) return
    setCurrentTime(audio.currentTime)
    if (Number.isFinite(audio.duration)) setDuration(audio.duration)
    try {
      if (audio.currentTime > 1) {
        window.localStorage.setItem(
          `mini-lms-audio:${materialId}:${activeTrack.id}`,
          String(audio.currentTime),
        )
      }
    } catch {
      // Position memory is optional when browser storage is unavailable.
    }
  }

  function handleSeek(value: number) {
    const audio = audioRef.current
    if (!audio) return
    const nextTime = Math.max(0, Math.min(value, duration || audio.duration || value))
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
    setResumeAt(0)
  }

  function handleKeyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return
    if (event.key === ' ') {
      if (target instanceof HTMLButtonElement) return
      event.preventDefault()
      handlePlayPause()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      handleSeek(currentTime - 10)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      handleSeek(currentTime + 10)
    }
  }

  function handleEnded() {
    setIsPlaying(false)
    if (activeIndex < tracks.length - 1) {
      retryCount.current = 0
      void startTrack(activeIndex + 1)
    }
  }

  function handleAudioError() {
    const track = tracks[activeIndex]
    if (!track) return
    if (retryCount.current < 1) {
      retryCount.current = 1
      signedUrls.current.delete(track.id)
      void startTrack(activeIndex, true, 1)
    } else {
      setIsPlaying(false)
      setError('Audio tidak dapat dimuat. Coba putar ulang atau periksa koneksi Anda.')
    }
  }

  function handleResume() {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = resumeAt
    setCurrentTime(resumeAt)
    setResumeAt(0)
  }

  return (
    <section
      className="space-y-4 rounded-lg border bg-card p-4 sm:p-5"
      aria-label="Pemutar audio pembelajaran"
      tabIndex={0}
      onKeyDown={handleKeyboard}
    >
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          const audio = audioRef.current
          if (audio && Number.isFinite(audio.duration)) setDuration(audio.duration)
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleEnded}
        onError={handleAudioError}
      />

      <div className="flex items-start gap-3">
        <ListMusic className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Audio pembelajaran</h2>
          <p className="mt-1 break-words text-sm text-muted-foreground">{activeTrack.title}</p>
        </div>
      </div>

      <div className="space-y-2">
        <input
          type="range"
          min={0}
          max={Math.max(duration, 0)}
          step={0.1}
          value={Math.min(currentTime, duration || currentTime)}
          onChange={(event) => handleSeek(Number(event.target.value))}
          aria-label="Posisi audio"
          aria-valuetext={`${formatAccessibleTime(currentTime)} dari ${formatAccessibleTime(duration)}`}
          className="h-2 w-full cursor-pointer accent-primary"
          disabled={!duration}
        />
        <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label="Mundur 10 detik" title="Mundur 10 detik" onClick={() => handleSeek(currentTime - 10)}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button type="button" variant="default" size="icon" aria-label={isPlaying ? 'Jeda audio' : 'Putar audio'} title={isPlaying ? 'Jeda' : 'Putar'} onClick={handlePlayPause}>
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Maju 10 detik" title="Maju 10 detik" onClick={() => handleSeek(currentTime + 10)}>
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`audio-rate-${materialId}`}>Kecepatan audio</label>
          <select
            id={`audio-rate-${materialId}`}
            value={playbackRate}
            onChange={(event) => {
              const rate = Number(event.target.value)
              setPlaybackRate(rate)
              if (audioRef.current) audioRef.current.playbackRate = rate
            }}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            {[0.75, 1, 1.25, 1.5].map((rate) => <option key={rate} value={rate}>{rate}x</option>)}
          </select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={isMuted ? 'Nyalakan suara' : 'Bisukan audio'}
            title={isMuted ? 'Nyalakan suara' : 'Bisukan audio'}
            aria-pressed={isMuted}
            onClick={() => {
              const nextMuted = !isMuted
              setIsMuted(nextMuted)
              if (audioRef.current) audioRef.current.muted = nextMuted
            }}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <label className="sr-only" htmlFor={`audio-volume-${materialId}`}>Volume audio</label>
          <input
            id={`audio-volume-${materialId}`}
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(event) => {
              const nextVolume = Number(event.target.value)
              setVolume(nextVolume)
              setIsMuted(nextVolume === 0)
              if (audioRef.current) {
                audioRef.current.volume = nextVolume
                audioRef.current.muted = nextVolume === 0
              }
            }}
            aria-valuetext={`Volume ${Math.round((isMuted ? 0 : volume) * 100)} persen`}
            className="w-20 accent-primary"
          />
        </div>
      </div>

      {resumeAt > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={handleResume}>
          Lanjutkan dari {formatAudioTime(resumeAt)}
        </Button>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {activeTrack.transcript && (
        <div className="border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2"
            aria-expanded={showTranscript}
            onClick={() => setShowTranscript((shown) => !shown)}
          >
            <FileText className="h-4 w-4" />
            {showTranscript ? 'Sembunyikan transkrip' : 'Tampilkan transkrip'}
          </Button>
          {showTranscript && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {activeTrack.transcript}
            </p>
          )}
        </div>
      )}

      {tracks.length > 1 && (
        <ol className="space-y-1 border-t pt-3" aria-label="Daftar audio">
          {tracks.map((track, index) => (
            <li key={track.id}>
              <button
                type="button"
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted ${index === activeIndex ? 'bg-muted font-medium' : ''}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                onClick={() => {
                  retryCount.current = 0
                  void startTrack(index)
                }}
              >
                {index === activeIndex && isPlaying ? <Pause className="h-4 w-4 shrink-0" /> : <Play className="h-4 w-4 shrink-0" />}
                <span className="min-w-0 flex-1 break-words">{track.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatAudioTime(track.duration_seconds ?? 0)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
