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
  lastAnswer: string | null
  setLastAnswer: (answer: string | null) => void
}

export const useGameStore = create<GameState>((set, get) => ({
  score: 0,
  combo: 0,
  maxCombo: 0,
  isPlaying: false,
  isGameOver: false,
  isPaused: false,
  levelData: null,
  audioBuffer: null,
  audioContext: null,
  audioSource: null,
  audioStartTime: 0,
  currentQuestionText: null, // Initial State
  correctCount: 0,

  setLevelData: (data) => set({ levelData: data }),
  setAudioBuffer: (buffer) => set({ audioBuffer: buffer }),
  setAudioContext: (ctx, source, startTime) => set({ audioContext: ctx, audioSource: source, audioStartTime: startTime }),
  setCurrentQuestionText: (text) => set({ currentQuestionText: text }),
  
  lastAnswer: null,
  setLastAnswer: (ans) => set({ lastAnswer: ans }),

  setPaused: (paused) => set({ isPaused: paused }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  incrementCorrectCount: () => set((state) => ({ correctCount: state.correctCount + 1 })),

  // Hand Tracking State
  leftHandPos: { x: 0, y: 0, angle: 0 } as { x: number, y: number, angle: number } | null,
  rightHandPos: { x: 0, y: 0, angle: 0 } as { x: number, y: number, angle: number } | null,
  setHandPositions: (left, right) => set({ leftHandPos: left, rightHandPos: right }),

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
}))
