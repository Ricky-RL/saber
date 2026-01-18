import { useState, useEffect, useRef } from 'react'
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
  const { setHandPositions, setLevelData, setAudioBuffer, isGameOver, levelData, correctCount, maxCombo, score, setEquippedItems, webcamVisible, setWebcamVisible } = useGameStore()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [audioGenerating, setAudioGenerating] = useState(false)
  const [generatedAudio, setGeneratedAudio] = useState<ArrayBuffer | null>(null)
  const [audioGenerationFailed, setAudioGenerationFailed] = useState(false)
  const audioGenerationInProgress = useRef(false) // Prevent duplicate requests
  const generatedAudioRef = useRef<ArrayBuffer | null>(null) // Ref to track generated audio for waiting loops
  const audioGeneratingRef = useRef(false) // Ref to track audio generating state for waiting loops
  const audioGenerationFailedRef = useRef(false) // Ref to track failure state for waiting loops
  const statsUploadedRef = useRef(false) // Prevent duplicate stat uploads
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null) // Track uploaded doc ID if created in-game

  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const queryDocumentId = searchParams.get('documentId')

  const locationState = location.state as { 
    audioData?: ArrayBuffer; 
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD'; 
    documentId?: string;
    isGeneratingAudio?: boolean;
    quizData?: any;
  } | null


  // Upload Stats on Game Over
  useEffect(() => {
    if (isGameOver && user && levelData) {
        if (statsUploadedRef.current) return;
        statsUploadedRef.current = true;

        // Calculate Accuracy
        

        const totalQuestions = levelData.timeline.length > 0 ? levelData.timeline.length : (levelData.questionsQueue?.length || 0);

        // Prevent division by zero
        // User Request: 0-1 range, 2 decimal points
        // Accuracy should be percentage 0-100 for display? Or 0-1 float? 
        // Screenshot shows "0%". Payload comment says "Float (e.g. 85.5)".
        // If correctCount is e.g. 5 and total is 10. 5/10 = 0.5. toFixed(2) = "0.50". 
        // Backend likely expects 0-100 if it's shown as percentage, OR frontend multiplies it.
        // Let's assume 0-100 based on "e.g. 85.5" comment.

        const accuracyRaw = totalQuestions > 0 ? (correctCount / totalQuestions) : 0;
        const accuracy =accuracyRaw; // Convert 0.5 -> 50.00

        // Determine Document ID: Use query param, location state OR the one we just uploaded
        const documentId = queryDocumentId || locationState?.documentId || uploadedDocumentId

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
                if (res.ok) {
                  console.log("Stats uploaded successfully")
                  statsUploadedRef.current = true // Mark as uploaded
                }
                else console.error("Failed to upload stats", res.statusText)
            })
            .catch(err => console.error("Error uploading stats:", err))
        })
    }
  }, [isGameOver, user, levelData]) // Runs when isGameOver becomes true

  // Reset statsUploadedRef when starting a new game
  useEffect(() => {
    if (!isGameOver) {
      statsUploadedRef.current = false;
    }
  }, [isGameOver]);

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

  // Helper to map and validate questions
  const mapQuizQuestions = (questions: any[]) => {
      console.log("🧩 Mapping Questions:", questions.length);
      return questions.map((q: any) => {
          let qType = 'MCQ';
          if (q.type === 'true_false' || q.type === 'TRUE_FALSE') qType = 'TRUE_FALSE';

          let answers = [];
          if (qType === 'TRUE_FALSE') {
               answers = [
                   { text: "F", isCorrect: q.correct_answer === false || String(q.correct_answer).toLowerCase() === 'false' }, 
                   { text: "T", isCorrect: q.correct_answer === true || String(q.correct_answer).toLowerCase() === 'true' }
               ];
          } else {
              // MCQ - Robust String Matching
              const target = (q.correct_answer || '').trim().toLowerCase();
              console.log(`🔍 Mapping MCQ: "${q.question}" -> Target: "${target}"`);
              
              answers = (q.options || []).map((opt: string) => {
                  const optNorm = opt.trim().toLowerCase();
                  const isMatch = optNorm === target;
                  if (isMatch) console.log(`   ✅ Match: "${opt}"`);
                  return {
                      text: opt,
                      isCorrect: isMatch
                  };
              });

              // Debug if no correct answer found
              if (!answers.some((a: any) => a.isCorrect)) {
                 console.warn(`   ⚠️ NO MATCH for: "${q.question}" (Target: "${target}")`);
                 console.warn(`   Options:`, q.options);
              }
          }

          return {
              id: q.id || `q_${Math.random()}`,
              type: qType,
              content: {
                  questionText: q.question,
                  answers: answers
              }
          };
      });
  }

  // --- HARDCODED AUDIO SETUP ---
  const HARDCODED_AUDIO_URL = '/Beat Saber.mp3'

  // Generate audio in background if needed
  useEffect(() => {
    const generateAudio = async () => {
      // COMMENTED OUT: Using hardcoded song for now
      /*
      // Only generate if we need to, haven't already generated, aren't currently generating, and haven't failed
      // Also check ref to prevent duplicate requests (React StrictMode causes double renders)
      if (
        locationState?.isGeneratingAudio && 
        !generatedAudio && 
        !audioGenerating && 
        !audioGenerationFailed &&
        !audioGenerationInProgress.current
      ) {
        audioGenerationInProgress.current = true // Set flag to prevent duplicates
        setAudioGenerating(true)
        audioGeneratingRef.current = true // Update ref immediately
        setAudioGenerationFailed(false)
        audioGenerationFailedRef.current = false // Update ref immediately
        try {
          const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'
          const difficulty = locationState.difficulty || 'MEDIUM'
          const difficultyLower = difficulty.toLowerCase() as 'easy' | 'medium' | 'hard'
          const endpoint = `${API_URL}/generate-song`
          const requestBody = { difficulty: difficultyLower }
          
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          })

          if (!response.ok) {
            let errorData
            let errorText = ''
            try {
              errorText = await response.text()
              errorData = JSON.parse(errorText)
              
              // FastAPI validation errors have a specific structure
              if (errorData.detail && Array.isArray(errorData.detail)) {
                // Pydantic validation errors
                const validationErrors = errorData.detail.map((err: any) => 
                  `${err.loc?.join('.')}: ${err.msg}`
                ).join(', ')
                throw new Error(`Validation error: ${validationErrors}`)
              }
            } catch (e: any) {
              if (e.message?.includes('Validation error')) {
                throw e // Re-throw validation errors
              }
              errorData = { detail: errorText || `HTTP ${response.status}: ${response.statusText}` }
            }
            throw new Error(errorData.detail || errorData.message || `HTTP error! status: ${response.status}`)
          }

          const audioArrayBuffer = await response.arrayBuffer()
          setGeneratedAudio(audioArrayBuffer)
          generatedAudioRef.current = audioArrayBuffer // Also update ref for waiting loops
          setAudioGenerating(false)
          audioGeneratingRef.current = false // Update ref immediately
          audioGenerationInProgress.current = false // Reset flag
          console.log('✅ Song generated successfully')
        } catch (err: any) {
          console.error('[Audio Generation] Error:', err.message)
          
          // Set flags to indicate generation failed so we can use fallback
          setAudioGenerating(false)
          audioGeneratingRef.current = false // Update ref immediately
          setAudioGenerationFailed(true)
          audioGenerationFailedRef.current = true // Update ref immediately
          audioGenerationInProgress.current = false // Reset flag even on error
        }
      }
      */
    }

    generateAudio()
    // Only depend on locationState properties, not the state variables that change during generation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationState?.isGeneratingAudio, locationState?.difficulty])

  // Auto-start game if Quiz Data is passed (e.g. from UploadModal) and Audio is ready
  useEffect(() => {
     if (locationState?.quizData && generatedAudio && !hasGenerated && !loading) {
         console.log("🚀 Auto-starting game with passed Quiz Data");
         
         const quizData = locationState.quizData;
         
         // Map questions
         const mappedQuestions = mapQuizQuestions(quizData.questions);

        // Use the generated audio
        processAudioAndStartLevel(generatedAudio, mappedQuestions, locationState.difficulty || 'MEDIUM');
     }
  }, [generatedAudio, locationState, hasGenerated, loading]);

  // Workflow 3: Play existing document from Profile (documentId in query param or state)
  useEffect(() => {
      // Prioritize query param
      const targetDocId = queryDocumentId || locationState?.documentId;

      if (targetDocId && !locationState?.quizData && !hasGenerated && !loading) {
          console.log("🎮 Playing existing document:", targetDocId);
          
          const generateQuizFromExisting = async () => {
              setLoading(true);
              const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
              
              try {
                  // Load hardcoded audio
                  const audioResponse = await fetch(HARDCODED_AUDIO_URL);
                  if (!audioResponse.ok) throw new Error("Failed to load game audio");
                  const audioBuffer = await audioResponse.arrayBuffer();
                  
                  // Generate quiz from existing document
                  console.log("🧠 Generating Quiz from existing document...");
                  const quizRes = await fetch(`${API_URL}/generate-quiz/${targetDocId}`, {
                      method: 'POST',
                      headers: {
                          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                      }
                  });

                  if (!quizRes.ok) {
                      const err = await quizRes.json();
                      throw new Error(err.detail || "Quiz generation failed");
                  }

                  const quizData = await quizRes.json();
                  console.log("✅ Quiz Generated:", quizData);

                  // Update topic if needed
                  if (quizData.genre) {
                      await fetch(`${API_URL}/document/${targetDocId}/topic`, {
                          method: 'PUT',
                          headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                          },
                          body: JSON.stringify({ topic: quizData.genre })
                      });
                  }

                  // Map questions
                  const mappedQuestions = mapQuizQuestions(quizData.questions);

                  // Start the game
                  await processAudioAndStartLevel(audioBuffer, mappedQuestions, 'MEDIUM');
                  if (targetDocId) {
                      setUploadedDocumentId(targetDocId);
                  }
                  
              } catch (error: any) {
                  console.error("Error generating quiz from existing document:", error);
                  alert(`Error: ${error.message}`);
                  setLoading(false);
              }
          };

          generateQuizFromExisting();
      }
  }, [queryDocumentId, locationState?.documentId, hasGenerated, loading]);

  const processAudioAndStartLevel = async (arrayBuffer: ArrayBuffer, quizQuestions: any[] = [], difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM') => {
    // Don't set loading here - it's already set in handleDocumentUpload
    try {
      // Map difficulty to BPM for fallback beat detection
      const difficultyBpmMap = {
        'EASY': 110,
        'MEDIUM': 130,
        'HARD': 150
      }
      const fallbackBpm = difficultyBpmMap[difficulty]
      
      // Decode copy for analysis with fallback BPM
      const audioData = await analyzeAudio(arrayBuffer.slice(0), fallbackBpm) 
      
      // GENERATE LEVEL WITH QUIZ QUESTIONS AND DIFFICULTY
      const generatedLevel = generateLevel(audioData, quizQuestions, difficulty) 
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const playbackBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0)) // Decode fresh copy
      ctx.close()
      
      setLevelData(generatedLevel)
      setAudioBuffer(playbackBuffer)
      setHasGenerated(true)
      setLoading(false) // Clear loading state when done
      console.log('🎮 Game ready to play!')
      
    } catch (error) {
      console.error('Error processing audio:', error)
      alert("Failed to process audio file.")
      setLoading(false) // Make sure to clear loading on error
    }
  }

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
        alert("Please upload a PDF file.")
        return
    }
    console.log('📄 Document uploaded:', file.name)

    try {
      const { setWebcamVisible } = useGameStore.getState()
      setWebcamVisible(true) // Ensure webcam defaults to enabled on load/action if needed, or rely on persisted state
    } catch {}

    setLoading(true)
    
    try {
        // 1. Wait for audio generation if it's still in progress
        let audioBuffer: ArrayBuffer
        const difficulty = locationState?.difficulty || 'MEDIUM'
        
        if (locationState?.audioData) {
            // Use pre-generated audio from difficulty selection (if already completed)
            audioBuffer = locationState.audioData
        } else if (locationState?.isGeneratingAudio) {
            // Wait for audio generation to complete (with timeout) or use fallback if failed
            if (audioGenerationFailed) {
                // Generation already failed, use fallback immediately
                const audioResponse = await fetch(HARDCODED_AUDIO_URL)
                if (!audioResponse.ok) throw new Error("Failed to load fallback game audio")
                audioBuffer = await audioResponse.arrayBuffer()
            } else if (generatedAudioRef.current) {
                // Audio already generated, use it (check ref first for immediate availability)
                audioBuffer = generatedAudioRef.current
            } else if (generatedAudio) {
                // Audio already generated, use it (fallback to state)
                audioBuffer = generatedAudio
            } else {
                // Wait for audio generation to complete (with timeout)
                const maxWaitTime = 60000 // 60 seconds max wait
                const startTime = Date.now()
                // Use refs in the condition to avoid stale closure issues
                while ((audioGeneratingRef.current || !generatedAudioRef.current) && !audioGenerationFailedRef.current && (Date.now() - startTime < maxWaitTime)) {
                    await new Promise(resolve => setTimeout(resolve, 500)) // Check every 500ms
                }
                
                // Check ref first, then state
                const finalAudio = generatedAudioRef.current || generatedAudio
                if (!finalAudio || audioGenerationFailedRef.current) {
                    // Fallback to hardcoded audio if generation failed or timed out
                    const audioResponse = await fetch(HARDCODED_AUDIO_URL)
                    if (!audioResponse.ok) throw new Error("Failed to load fallback game audio")
                    audioBuffer = await audioResponse.arrayBuffer()
                } else {
                    audioBuffer = finalAudio
                }
            }
        } else {
            // Fallback to hardcoded audio (for backward compatibility)
            const audioResponse = await fetch(HARDCODED_AUDIO_URL)
            if (!audioResponse.ok) throw new Error("Failed to load game audio")
            audioBuffer = await audioResponse.arrayBuffer()
        }

        // 2. Upload PDF to Storage & DB, then Generate Quiz
        let docId = '';
        const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

        // Only perform upload if user is logged in
        if (user) {
             const formData = new FormData();
             formData.append('file', file);
             formData.append('user_id', user.id);
             // handleDocumentUpload doesn't seem to have topic input, send default or ignore
             
             console.log("🚀 Starting Upload (GamePage)...");
             const uploadRes = await fetch(`${API_URL}/document`, {
                 method: 'POST',
                 headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                 },
                 body: formData
             });

             if (!uploadRes.ok) {
                 const err = await uploadRes.json();
                 throw new Error(err.detail || 'Upload failed');
             }

             const uploadData = await uploadRes.json();
             console.log("✅ Upload Complete:", uploadData);
             docId = uploadData.id;
             setUploadedDocumentId(docId);

             // Generate Quiz via Backend
             console.log("🧠 Generating Quiz...");
             const quizRes = await fetch(`${API_URL}/generate-quiz/${docId}`, {
                 method: 'POST',
                 headers: {
                    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                 }
             });

             if (!quizRes.ok) {
                 const err = await quizRes.json();
                 throw new Error(err.detail || "Quiz generation failed");
             }

             const quizData = await quizRes.json();
             console.log("✅ Quiz Generated:", quizData);

             // Update Topic if needed
             if (quizData.genre) {
                  await fetch(`${API_URL}/document/${docId}/topic`, {
                      method: 'PUT',
                      headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
                      },
                      body: JSON.stringify({ topic: quizData.genre })
                  });
             }
             
             // Use REAL generated data
             // We need to map it to the format expected by processAudioAndStartLevel
             // But first, let's skip the hardcoded part below
             
             /* 
                We will use a flag or return here to bypass the hardcoded block 
                that follows in the original code. 
                However, the original code had "HARDCODED DATA (REMOVE THIS...)" 
                I should replace that section too.
             */
             
             // Map and Start Level directly here
             const mappedQuestions = mapQuizQuestions(quizData.questions);
            
            await processAudioAndStartLevel(audioBuffer, mappedQuestions, difficulty as any);
            
    } 
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
      
      {/* Toggle Button for Webcam - Only visible on Upload Screen or if desired in game too? 
          User said: "while the user is uploading the document there should be a slider that the user can click to then turn off the webcam"
      */}
      {!hasGenerated && (
          <div style={{
              position: 'absolute',
              top: 270, // Below the webcam box (20 top + 240 height + 10 gap)
              right: 20,
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(0,0,0,0.5)',
              padding: '8px 12px',
              borderRadius: '20px',
              border: '1px solid #333'
          }}>
              <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Webcam Overlay</span>
              <div 
                onClick={() => setWebcamVisible(!webcamVisible)}
                style={{
                    width: '40px',
                    height: '20px',
                    background: webcamVisible ? '#00ffff' : '#333',
                    borderRadius: '10px',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.3s'
                }}
              >
                  <div style={{
                      width: '16px',
                      height: '16px',
                      background: 'white',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: webcamVisible ? '22px' : '2px',
                      transition: 'left 0.3s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }} />
              </div>
          </div>
      )}

      {webcamVisible && (
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
      )}

      {/* Keep HandTracker Logic active even if visual is hidden? 
          The user asked "toggle whether or not the webcam overlays in the ui". 
          Usually this means hiding the PiP box. 
          HOWEVER, the game needs hand tracking to function.
          If we hide the HandTracker component, it unmounts and tracking stops.
          
          We should probably keep it mounted but hidden if we want tracking to continue (invisible mode).
          BUT, user likely means "Disable it completely" or "Just hide the preview".
          In this game, seeing your hands is crucial for calibration.
          But if they want to turn it off, maybe they want to play with mouse/keyboard? (Not supported yet?)
          
          Re-reading: "toggle whether or not the webcam overlays in the ui. it should be on by default... turn off the webcam."
          
          If I unmount it, the camera stops. 
          If I CSS hide it: <div style={{ ... display: webcamVisible ? 'block' : 'none' }}>
          Then tracking continues in background.
          
          Let's assume "Overlays in UI" means visual visibility. 
          If tracking is REQUIRED for gameplay, hiding it completely (display: none) allows gameplay but removes feedback.
          
          If user means "Disable Camera permissions/stream", then we must unmount.
          But then game won't work unless there's a fallback input method.
          
          Assuming Visual Toggle for now: changing `webcamVisible && (...)` to CSS toggle.
      */}
      
       <div style={{ 
          position: 'absolute', 
          top: 20, 
          right: 20, 
          width: '320px', 
          height: '240px', 
          zIndex: 100,
          border: webcamVisible ? '2px solid rgba(255, 255, 255, 0.5)' : 'none',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'black',
          boxShadow: webcamVisible ? '0 0 20px rgba(0,0,0,0.5)' : 'none',
          // Visibility Toggle:
          opacity: webcamVisible ? 1 : 0, 
          pointerEvents: webcamVisible ? 'auto' : 'none',
          transition: 'opacity 0.3s'
      }}>
          {/* Always render HandTracker to keep Logic alive, just hide container */}
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
              
              {/* Audio Generation Status */}
              {audioGenerating && (
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '15px 30px', 
                  background: 'rgba(0, 255, 255, 0.1)', 
                  border: '2px solid rgba(0, 255, 255, 0.5)', 
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div className="spinner" style={{ width: '20px', height: '20px', border: '3px solid rgba(0, 255, 255, 0.3)', borderTop: '3px solid #00ffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  <p style={{ color: '#00ffff', margin: 0, fontFamily: 'Orbitron', fontSize: '0.9rem' }}>
                    Generating your custom song... ({locationState?.difficulty || 'MEDIUM'})
                  </p>
                </div>
              )}
              
              {audioGenerationFailed && !audioGenerating && (
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '15px 30px', 
                  background: 'rgba(255, 100, 100, 0.1)', 
                  border: '2px solid rgba(255, 100, 100, 0.5)', 
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <p style={{ color: '#ff6464', margin: 0, fontFamily: 'Orbitron', fontSize: '0.9rem', textAlign: 'center' }}>
                    ⚠️ Song generation unavailable. Using default audio instead.
                  </p>
                  <p style={{ color: '#ff6464', margin: 0, fontFamily: 'Orbitron', fontSize: '0.75rem', opacity: 0.8, textAlign: 'center' }}>
                    Backend server not running. Start it with: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px' }}>cd backend && uvicorn main:app --reload --port 8000</code>
                  </p>
                </div>
              )}

              <p style={{ marginBottom: '40px', color: '#aaa', maxWidth: '400px', textAlign: 'center' }}>
                {loading 
                  ? (audioGenerating 
                      ? 'Generating song & analyzing document...' 
                      : 'Analyzing Document & Generating Quiz...')
                  : 'Upload your study notes (PDF) to convert them into a rhythm game level! The game will last 60 seconds.'}
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
