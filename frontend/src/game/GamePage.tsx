import { useState, useEffect } from 'react'
import { HandTracker } from './HandTracker'
import { Link, useLocation } from 'react-router-dom'
import { useGameStore } from './GameManager'
import Scene from './Scene'
import { UI } from './UI'
import { analyzeAudio } from './audio/beatDetector'
import { generateLevel, PLACEHOLDER_QUESTIONS } from './audio/levelGenerator'
import { useAuth } from '../contexts/Auth'
import { supabase } from '../supabaseClient'

function GamePage() {
  const { setHandPositions, setLevelData, setAudioBuffer, isGameOver, levelData, correctCount, maxCombo, score } = useGameStore()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  
  const location = useLocation()
  const { mode } = location.state || {}

  // Upload Stats on Game Over
  useEffect(() => {
    if (isGameOver && user && levelData) {
        // Calculate Accuracy
        // Total questions is the number of events in timeline (assuming 1 event = 1 question)
        const totalQuestions = levelData.timeline.length
        
        // Prevent division by zero
        // User Request: 0-1 range, 2 decimal points
        const accuracy = totalQuestions > 0 
            ? Number((correctCount / totalQuestions).toFixed(2))
            : 0

        // Determine Document ID
        const documentId = (location.state as any)?.documentId

        // Constrain payload
        const payload: any = {
            player_id: user.id,
            score: score,
            accuracy: accuracy, // Float (e.g., 85.5)
            best_streak: maxCombo
        }

        if (documentId) {
             payload.document_id = documentId
        }

        console.log("Uploading Game Stats:", payload)

        // Using fetch to call the backend endpoint (Assuming backend is running on port 8000)
        // Adjust URL as needed (e.g. from env var)
        const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
        
        supabase.auth.getSession().then(({ data: { session } }) => {
            fetch(`${API_URL}/game/results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token || ''}` // Optional if RLS depends on it, but endpoint might not enforce auth token check yet
                },
                body: JSON.stringify(payload)
            })
            .then(res => {
                if (res.ok) console.log("Stats uploaded successfully")
                else console.error("Failed to upload stats", res.statusText)
            })
            .catch(err => console.error("Error uploading stats:", err))
        })
    }
  }, [isGameOver, user, levelData]) // Runs when isGameOver becomes true

  const handleHandsDetected = (left: {x: number, y: number, angle: number} | null, right: {x: number, y: number, angle: number} | null) => {
      setHandPositions(left, right)
  }

  const processAudio = async (arrayBuffer: ArrayBuffer) => {
    setLoading(true)
    try {
      // Decode copy for analysis
      const audioData = await analyzeAudio(arrayBuffer.slice(0)) 
      
      const generatedLevel = generateLevel(audioData, PLACEHOLDER_QUESTIONS, 'MEDIUM') // Default to Medium
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const playbackBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0)) // Decode fresh copy
      ctx.close()
      
      setLevelData(generatedLevel)
      setAudioBuffer(playbackBuffer)
      setHasGenerated(true)
      
      // Auto-start or wait for user? Hologram waits.
      // startGame() 
      
    } catch (error) {
      console.error('Error processing audio:', error)
      alert("Failed to process audio file.")
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const arrayBuffer = await file.arrayBuffer()
    await processAudio(arrayBuffer)
  }

  // Auto-load logic
  useEffect(() => {
    if (mode === 'auto') {
      setLoading(true)
      fetch('/Beat Saber.mp3')
        .then(res => res.arrayBuffer())
        .then(buffer => processAudio(buffer))
        .catch(err => {
            console.error(err)
            setLoading(false)
        })
    }
  }, [mode])

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', color: '#fff', position: 'relative' }}>
      <Link to="/" style={{ position: 'absolute', top: 20, left: 20, zIndex: 100, color: 'white', textDecoration: 'none' }}>
        Back to Home
      </Link>
      
      {/* HandTracker - Always Visible (PiP) so user can set up */}
      <div style={{ 
          position: 'absolute', 
          top: 20, 
          right: 20, 
          width: '320px', 
          height: '240px', 
          zIndex: 100,
          border: '2px solid rgba(255, 255, 255, 0.5)',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'black',
          boxShadow: '0 0 20px rgba(0,0,0,0.5)'
      }}>
          <HandTracker onHandsDetected={handleHandsDetected} />
      </div>

      {hasGenerated ? (
          <>
            {/* 3D Scene - Game Background */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
                <SceneOverlay /> 
            </div>
            
            {/* Game UI (Score, Combo, Start Button Overlay) */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, pointerEvents: 'none' }}>
                <UI />
            </div>
          </>
      ) : (
          /* UPLOAD UI - Centered */
          <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%', 
              zIndex: 20,
              position: 'relative' 
          }}>
              
              <p style={{ marginBottom: '20px' }}>
                {loading ? 'Loading...' : 'Upload a song to generate a level'}
              </p>

              {!loading && (
                  <input 
                    type="file" 
                    accept="audio/mp3, audio/wav" 
                    onChange={handleFileUpload}
                    disabled={loading}
                    style={{ 
                        padding: '10px', 
                        fontSize: '1.2rem', 
                        background: '#333', 
                        border: '1px solid #666', 
                        color: 'white',
                        borderRadius: '8px'
                    }}
                  />
              )}

              {loading && <p style={{ marginTop: '20px', color: '#00ffff' }}>Processing AI Level Generation...</p>}
          </div>
      )}

    </div>
  )
}

function SceneOverlay() {
    return <Scene /> 
}

export default GamePage
