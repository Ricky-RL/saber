import { create } from 'zustand'
import type { GameLevelData } from './audio/levelGenerator'

export interface GameState {
  score: number
  combo: number
  maxCombo: number
  isPlaying: boolean
  isPaused: boolean
  isGameOver: boolean
  
  // Level Data
  levelData: GameLevelData | null
  audioBuffer: AudioBuffer | null
  
  // Audio Playback
  audioContext: AudioContext | null
  audioSource: AudioBufferSourceNode | null
  audioStartTime: number 
  
  currentQuestionText: string | null // Added for HTML UI

  // Stats
  correctCount: number

  setLevelData: (data: GameLevelData) => void
  setAudioBuffer: (buffer: AudioBuffer) => void

  setScore: (fn: (prev: number) => number) => void
  setCombo: (fn: (prev: number) => number) => void
  
  startGame: () => void
  endGame: () => void
  
  togglePause: () => void
  setPaused: (paused: boolean) => void
  incrementCorrectCount: () => void

  // Hand Tracking
  // x, y: normalized coordinates
  // angle: rotation in radians (0 = Up, PI = Down)
  leftHandPos: { x: number, y: number, angle: number } | null
  rightHandPos: { x: number, y: number, angle: number } | null
  setHandPositions: (left: { x: number, y: number, angle: number } | null, right: { x: number, y: number, angle: number } | null) => void

  setAudioContext: (ctx: AudioContext | null, source: AudioBufferSourceNode | null, startTime: number) => void
  setCurrentQuestionText: (text: string | null) => void // Setter
  
  // Feedback
  feedback: { type: 'CORRECT' | 'WRONG' | 'MISSED', text: string, correctText?: string } | null
  setFeedback: (feedback: { type: 'CORRECT' | 'WRONG' | 'MISSED', text: string, correctText?: string } | null) => void

  equippedItems: any
  setEquippedItems: (items: any) => void

  webcamVisible: boolean
  setWebcamVisible: (visible: boolean) => void
  
  restartTrigger: number
  triggerRestart: () => void

  // Background
  synthBackgroundEnabled: boolean
  toggleSynthBackground: () => void
}

export const useGameStore = create<GameState>((set, get) => ({
  score: 0,
  combo: 0,
  maxCombo: 0,
  isPlaying: false,
  isPaused: false,
  isGameOver: false,
  levelData: null,
  audioBuffer: null,
  audioContext: null,
  audioSource: null,
  audioStartTime: 0,
  currentQuestionText: null,

  correctCount: 0,

  setLevelData: (data) => set({ levelData: data }),
  setAudioBuffer: (buffer) => set({ audioBuffer: buffer }),

  setScore: (fn) => set((state) => ({ score: fn(state.score) })),
  setCombo: (fn) => {
    set((state) => {
      const newCombo = fn(state.combo)
      return { 
        combo: newCombo,
        maxCombo: Math.max(state.maxCombo, newCombo)
      }
    })
  },

  startGame: () => {
    // Reset spawned flags in timeline
    set((state) => {
        if (state.levelData) {
            state.levelData.timeline.forEach(e => e.spawned = false)
        }
        return { 
          score: 0, 
          combo: 0, 
          maxCombo: 0, 
          correctCount: 0,
          isPlaying: true, 
          isGameOver: false,
        }
    })
  },

  endGame: () => {
    const state = get()
    if (state.audioSource) {
        try { state.audioSource.stop() } catch (e) { /* ignore */ }
    }
    set({ isPlaying: false, isGameOver: true, audioSource: null })
  },

  // Hand Tracking State
  leftHandPos: { x: 0, y: 0, angle: 0 } as { x: number, y: number, angle: number } | null,
  rightHandPos: { x: 0, y: 0, angle: 0 } as { x: number, y: number, angle: number } | null,
  setHandPositions: (left, right) => set({ leftHandPos: left, rightHandPos: right }),

  setAudioContext: (ctx, source, startTime) => set({ audioContext: ctx, audioSource: source, audioStartTime: startTime }),
  setCurrentQuestionText: (text) => set({ currentQuestionText: text }),
  
  feedback: null,
  setFeedback: (fb) => set({ feedback: fb }),

  equippedItems: {},
  setEquippedItems: (items) => set({ equippedItems: items }),

  setPaused: (paused) => set({ isPaused: paused }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  incrementCorrectCount: () => set((state) => ({ correctCount: state.correctCount + 1 })),

  // Settings
  webcamVisible: localStorage.getItem('saber_webcamVisible') === 'false' ? false : true, // Default true
  setWebcamVisible: (visible) => {
      localStorage.setItem('saber_webcamVisible', String(visible))
      set({ webcamVisible: visible })
  },

  // Restart Logic
  restartTrigger: 0,
  triggerRestart: () => set((state) => ({ restartTrigger: state.restartTrigger + 1, isGameOver: false, isPlaying: false })),

  synthBackgroundEnabled: false,
  toggleSynthBackground: () => set((state) => ({ synthBackgroundEnabled: !state.synthBackgroundEnabled })),
}))
