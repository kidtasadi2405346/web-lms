export type QuizSound = 'correct' | 'incorrect' | 'passed' | 'not-passed'

type AudioContextWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

let audioContext: AudioContext | null = null
let audioUnavailable = false

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (audioContext) return audioContext
  if (audioUnavailable) return null

  const AudioContextConstructor =
    window.AudioContext || (window as AudioContextWindow).webkitAudioContext
  if (!AudioContextConstructor) {
    audioUnavailable = true
    return null
  }

  try {
    audioContext = new AudioContextConstructor()
    return audioContext
  } catch {
    audioUnavailable = true
    return null
  }
}

export function prepareQuizAudio(enabled: boolean): void {
  if (!enabled) return

  const context = getAudioContext()
  if (context?.state === 'suspended') void context.resume().catch(() => undefined)
}

export function playQuizSound(sound: QuizSound, enabled: boolean): void {
  if (!enabled) return

  const context = getAudioContext()
  if (!context) return

  try {
    const now = context.currentTime
    const notes: Record<QuizSound, { frequency: number; start: number; duration: number }[]> = {
      correct: [
        { frequency: 620, start: 0, duration: 0.12 },
        { frequency: 830, start: 0.14, duration: 0.16 },
      ],
      incorrect: [{ frequency: 250, start: 0, duration: 0.3 }],
      passed: [
        { frequency: 520, start: 0, duration: 0.12 },
        { frequency: 650, start: 0.13, duration: 0.12 },
        { frequency: 780, start: 0.26, duration: 0.12 },
        { frequency: 1040, start: 0.39, duration: 0.2 },
      ],
      'not-passed': [
        { frequency: 460, start: 0, duration: 0.17 },
        { frequency: 360, start: 0.2, duration: 0.22 },
      ],
    }

    for (const note of notes[sound]) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const noteStart = now + note.start
      const noteEnd = noteStart + note.duration

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(note.frequency, noteStart)
      gain.gain.setValueAtTime(0.0001, noteStart)
      gain.gain.exponentialRampToValueAtTime(0.2, noteStart + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(noteStart)
      oscillator.stop(noteEnd)
    }

    prepareQuizAudio(enabled)
  } catch {
    // Audio is optional; browser and device restrictions must not interrupt the quiz.
  }
}