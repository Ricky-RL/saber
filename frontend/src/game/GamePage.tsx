import { useState, useEffect } from 'react'
import { HandTracker } from './HandTracker'
import { Link, useLocation } from 'react-router-dom'
import { useGameStore } from './GameManager'
import Scene from './Scene'
import { UI } from './UI'
import { analyzeAudio } from './audio/beatDetector'
import { generateLevel } from './audio/levelGenerator'
import { useAuth } from '../contexts/Auth'
import { supabase } from '../supabaseClient'

function GamePage() {
  const { setHandPositions, setLevelData, setAudioBuffer, isGameOver, levelData, correctCount, maxCombo, score, setEquippedItems } = useGameStore()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  
  const location = useLocation()
  // const { mode } = location.state || {} <- Removed unused mode

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

  // Fetch Equipped Items on Load
  useEffect(() => {
    if (user?.id) {
        const fetchEquipped = async () => {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/store/equipped/${user.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setEquippedItems(data);
                }
            } catch (e) {
                console.error("Error fetching equipped items in game", e);
            }
        };
        fetchEquipped();
    }
  }, [user]);

  const handleHandsDetected = (left: {x: number, y: number, angle: number} | null, right: {x: number, y: number, angle: number} | null) => {
      setHandPositions(left, right)
  }

  // --- HARDCODED AUDIO SETUP ---
  const HARDCODED_AUDIO_URL = '/Beat Saber.mp3'

  const processAudioAndStartLevel = async (arrayBuffer: ArrayBuffer, quizQuestions: any[] = []) => {
    setLoading(true)
    try {
      // Decode copy for analysis
      const audioData = await analyzeAudio(arrayBuffer.slice(0)) 
      
      // GENERATE LEVEL WITH QUIZ QUESTIONS
      const generatedLevel = generateLevel(audioData, quizQuestions, 'MEDIUM') 
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const playbackBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0)) // Decode fresh copy
      ctx.close()
      
      setLevelData(generatedLevel)
      setAudioBuffer(playbackBuffer)
      setHasGenerated(true)
      
    } catch (error) {
      console.error('Error processing audio:', error)
      alert("Failed to process audio file.")
    } finally {
      setLoading(false)
    }
  }

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
        alert("Please upload a PDF file.")
        return
    }

    setLoading(true)
    
    try {
        // 1. Fetch Hardcoded Audio First (Parallelize in real app, but sequential is safer for now)
        const audioResponse = await fetch(HARDCODED_AUDIO_URL)
        if (!audioResponse.ok) throw new Error("Failed to load game audio")
        const audioBuffer = await audioResponse.arrayBuffer()

        // 2. Upload PDF & Generate Quiz
        /*
        const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
        const formData = new FormData()
        formData.append('file', file)
        formData.append('user_id', user?.id || 'guest')

        const quizResponse = await fetch(`${API_URL}/generate-quiz`, {
            method: 'POST',
            body: formData,
            // headers: { 'Authorization': ... } // If needed later
        })

        if (!quizResponse.ok) {
            const err = await quizResponse.json()
            throw new Error(err.detail || "Quiz generation failed")
        }

        const quizData = await quizResponse.json()
        */
       
        // HARDCODED DATA
        const quizData = {
            "document_id": "DOC_a5831ebb",
            "genre": "Regression Testing",
            "questions": [
                {
                    "id": 1,
                    "type": "mcq",
                    "question": "What is regression testing?",
                    "options": [
                        "Return to former state",
                        "Ensure no new faults",
                        "Improve software quality",
                        "Add new capabilities"
                    ],
                    "correct_answer": "Ensure no new faults"
                },
                {
                    "id": 2,
                    "type": "true_false",
                    "question": "Regression testing is only needed for corrective maintenance.",
                    "options": [],
                    "correct_answer": false
                },
                {
                    "id": 3,
                    "type": "mcq",
                    "question": "Which maintenance type requires regression testing?",
                    "options": [
                        "Corrective only",
                        "Adaptive only",
                        "Perfective only",
                        "All types"
                    ],
                    "correct_answer": "All types"
                },
                {
                    "id": 4,
                    "type": "true_false",
                    "question": "Regression testing is required for all maintenance types.",
                    "options": [],
                    "correct_answer": true
                },
                {
                    "id": 5,
                    "type": "mcq",
                    "question": "What does regression testing reveal?",
                    "options": [
                        "New features",
                        "Side effects",
                        "Unused code",
                        "Performance issues"
                    ],
                    "correct_answer": "Side effects"
                },
                {
                    "id": 6,
                    "type": "mcq",
                    "question": "Why might a test fail after a change?",
                    "options": [
                        "Code improved",
                        "Specs changed",
                        "Test code perfect",
                        "No new bugs"
                    ],
                    "correct_answer": "Specs changed"
                },
                {
                    "id": 7,
                    "type": "true_false",
                    "question": "A regression bug in an existing feature is less critical than a bug in new functionality.",
                    "options": [],
                    "correct_answer": false
                },
                {
                    "id": 8,
                    "type": "mcq",
                    "question": "What is a challenge of regression testing?",
                    "options": [
                        "Low execution time",
                        "Small test suite",
                        "High maintenance cost",
                        "Simple test selection"
                    ],
                    "correct_answer": "High maintenance cost"
                },
                {
                    "id": 9,
                    "type": "true_false",
                    "question": "Test suite size is proportional to change size in regression testing.",
                    "options": [],
                    "correct_answer": false
                },
                {
                    "id": 10,
                    "type": "mcq",
                    "question": "What does test selection aim to achieve?",
                    "options": [
                        "Run all tests",
                        "Select relevant tests",
                        "Increase execution time",
                        "Remove valid tests"
                    ],
                    "correct_answer": "Select relevant tests"
                },
                {
                    "id": 11,
                    "type": "true_false",
                    "question": "Test prioritization is used when not all selected tests can be executed.",
                    "options": [],
                    "correct_answer": true
                },
                {
                    "id": 12,
                    "type": "mcq",
                    "question": "Which is a criterion for test prioritization?",
                    "options": [
                        "Code complexity",
                        "Test coverage",
                        "Developer preference",
                        "Bug frequency"
                    ],
                    "correct_answer": "Test coverage"
                },
                {
                    "id": 13,
                    "type": "true_false",
                    "question": "Minimization reduces a test suite by removing redundant tests.",
                    "options": [],
                    "correct_answer": true
                },
                {
                    "id": 14,
                    "type": "mcq",
                    "question": "What is a 'silent horror' in testing?",
                    "options": [
                        "Test fails incorrectly",
                        "Test passes incorrectly",
                        "Production code fails",
                        "Test code is buggy"
                    ],
                    "correct_answer": "Test passes incorrectly"
                },
                {
                    "id": 15,
                    "type": "true_false",
                    "question": "Test code is less likely to contain errors than production code.",
                    "options": [],
                    "correct_answer": false
                }
            ],
            "user_id": "d818162b-ab40-4626-a2a6-0d92cefd3746"
        }

        console.log("Quiz Generated (HARDCODED):", quizData)

        // 3. Start Game with Audio + Questions
        // Map backend questions to Game format if needed, but assuming they match broadly.
        // Backend returns: { questions: [ { id, type, question, options, correct_answer } ... ] }
        // We need to map this to QuestionData format expected by generateLevel.

        const mappedQuestions = quizData.questions.map((q: any) => {
            // Check type mapping
            let qType = 'MCQ'
            if (q.type === 'true_false') qType = 'TRUE_FALSE'

            // Map Answers
            let answers = []
            if (qType === 'TRUE_FALSE') {
                 // Backend: correct_answer is boolean true/false
                 // Content: question
                 answers = [
                     { text: "F", isCorrect: q.correct_answer === false }, 
                     { text: "T", isCorrect: q.correct_answer === true }
                 ]
            } else {
                // MCQ
                // Backend: options [], correct_answer (string matching one option)
                answers = q.options.map((opt: string) => ({
                    text: opt,
                    isCorrect: opt === q.correct_answer
                }))
            }

            return {
                id: q.id || `q_${Math.random()}`,
                type: qType,
                content: {
                    questionText: q.question,
                    answers: answers
                }
            }
        })
        
        await processAudioAndStartLevel(audioBuffer, mappedQuestions)

    } catch (error: any) {
        console.error("Error setting up game:", error)
        alert(`Error: ${error.message}`)
        setLoading(false)
    }
  }

  // Auto-load logic (Development shortcut - preserves old behavior if needed, or remove?)
  // Keeping it but disabling auto-start if no document.
  // Actually, user wants "unless we have a document (pdf) ready... you can't run the game"
  // So 'auto' mode might need to be repurposed or ignored for now.
  /*
  useEffect(() => {
    if (mode === 'auto') {
      // ...
    }
  }, [mode])
  */ 

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
              
              <h2 style={{ marginBottom: '20px', fontFamily: 'Orbitron' }}>STUDY SABER</h2>
              <p style={{ marginBottom: '40px', color: '#aaa', maxWidth: '400px', textAlign: 'center' }}>
                {loading ? 'Analyzing Document & Generating Quiz...' : 'Upload your study notes (PDF) to convert them into a rhythm game level! The game will last 60 seconds.'}
              </p>

              {!loading && (
                  <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
                    <button style={{ 
                        padding: '15px 30px', 
                        fontSize: '1.2rem', 
                        background: '#00ffff', 
                        border: 'none', 
                        color: 'black',
                        borderRadius: '30px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontFamily: 'Orbitron',
                        boxShadow: '0 0 15px #00ffff'
                    }}>
                        UPLOAD PDF
                    </button>
                    <input 
                        type="file" 
                        accept="application/pdf" 
                        onChange={handleDocumentUpload}
                        style={{ 
                            position: 'absolute', 
                            left: 0, 
                            top: 0, 
                            opacity: 0, 
                            width: '100%', 
                            height: '100%', 
                            cursor: 'pointer'
                        }}
                    />
                  </div>
              )}

              {loading && (
                  <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #333', borderTop: '4px solid #00ffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                      <p style={{ marginTop: '15px', color: '#00ffff' }}>AI is crafting your quiz...</p>
                      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                  </div>
              )}
          </div>
      )}

    </div>
  )
}

function SceneOverlay() {
    return <Scene /> 
}

export default GamePage
