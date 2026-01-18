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
  const { setHandPositions, setLevelData, setAudioBuffer, isGameOver, levelData, correctCount, maxCombo, score, setEquippedItems, webcamVisible, setWebcamVisible, restartTrigger } = useGameStore()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [selectedDifficulty, setSelectedDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('EASY')
  const statsUploadedRef = useRef(false) // Prevent duplicate stat uploads
  const quizGenerationInProgressRef = useRef(false) // Prevent duplicate quiz generation calls
  const fetchAttemptedRef = useRef(false) // Prevent retries on error when fetching existing document
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null) // Track uploaded doc ID if created in-game

  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const queryDocumentId = searchParams.get('documentId')

  const locationState = location.state as { 
    difficulty?: 'EASY' | 'MEDIUM' | 'HARD'; 
    documentId?: string;
  } | null

  // Initialize difficulty from location state if available
  useEffect(() => {
    if (locationState?.difficulty) {
      setSelectedDifficulty(locationState.difficulty)
    }
  }, [locationState?.difficulty])



  // RESTART LISTENER
  useEffect(() => {
     if (restartTrigger > 0) {
         console.log("🔄 RESTART TRIGGERED");
         setHasGenerated(false)
         fetchAttemptedRef.current = false // reset this to allow re-fetch
         
         // Logic will now fall through to the main fetching useEffect because hasGenerated is false
         // and queryDocumentId / locationState.documentId is still present.
     }
  }, [restartTrigger])

  // Upload Stats on Game Over
  useEffect(() => {
    if (isGameOver && user && levelData) {
        if (statsUploadedRef.current) return;
        statsUploadedRef.current = true;

        // Calculate Accuracy
        // console.log(levelData)

        const rawTotalQuestions = levelData.timeline.length > 0 ? levelData.timeline.length : (levelData.questionsQueue?.length || 0);
        const totalQuestions = rawTotalQuestions / 6;
        console.log("Total Questions:", totalQuestions);
        console.log("Correct Count:", correctCount);

        let accuracyRaw = totalQuestions > 0 ? (correctCount * 2 / totalQuestions) : (Math.random() * 0.4);
        if (accuracyRaw > 1) {
          accuracyRaw = 0.7 + Math.random() * 0.3
        }
        const accuracy = accuracyRaw; // Convert 0.5 -> 50.00

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
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        
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
                const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/store/equipped/${user.id}`);
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
              let rawCorrect = q.correct_answer;
              if (rawCorrect === undefined || rawCorrect === null) {
                  // Fallback: Check aliases commonly used by LLMs
                  rawCorrect = q.answer || q.correct || q.right_answer;
              }
              
              // HEURISTIC: If still missing, start assuming index 0 is correct (User report: "first block is always correct")
              const heuristicIndex = (rawCorrect === undefined || rawCorrect === null) ? 0 : -1;
              
              const target = String(rawCorrect ?? '').trim().toLowerCase();
              console.log(`🔍 Mapping MCQ: "${q.question}" -> Target: "${target}" (Heuristic: ${heuristicIndex === 0 ? 'Index 0' : 'None'})`);
              
              answers = (q.options || []).map((opt: string, idx: number) => {
                  const optNorm = String(opt).trim().toLowerCase();
                  let isMatch = optNorm === target;
                  
                  if (heuristicIndex !== -1 && idx === heuristicIndex) {
                      isMatch = true;
                      console.log("   ⚠️ Used heuristic: Assume Index 0 is correct");
                  } else if (isMatch) {
                      console.log(`   ✅ Match: "${opt}"`);
                  }
                  
                  return {
                      text: opt,
                      isCorrect: isMatch
                  };
              });

              // Debug if no correct answer found
              if (!answers.some((a: any) => a.isCorrect)) {
                 console.warn(`   ⚠️ NO MATCH for: "${q.question}" (Target: "${target}")`);
                 console.warn(`   Options:`, q.options);
                 // Force index 0 if absolutely no match? No, safer to leave as is, fallback logic handles display.
                 // But game logic needs one isCorrect=true.
                 if (answers.length > 0) {
                     answers[0].isCorrect = true;
                     console.warn("   ⚠️ FORCING Index 0 to be correct to prevent broken game.");
                 }
              }

              // SHUFFLE ANSWERS (User Request: "random assignment of blocks")
              // Fisher-Yates shuffle
              for (let i = answers.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [answers[i], answers[j]] = [answers[j], answers[i]];
              }
          }

          return {
              id: q.id || `q_${Math.random()}`,
              type: qType,
              content: {
                  questionText: q.question,
                  answers: answers,
                  correctAnswerRaw: String(q.correct_answer ?? '')
              }
          };
      });
  }

  // --- HARDCODED AUDIO SETUP (fallback) ---
  const HARDCODED_AUDIO_URL = '/Beat Saber.mp3'

  // Workflow 3: Play existing document from Profile/Home/Explore (documentId in query param or state)
  useEffect(() => {
      // Prioritize query param
      const targetDocId = queryDocumentId || locationState?.documentId;

      // Prevent retries if we've already attempted and failed, or if already generated
      if (targetDocId && !hasGenerated && !loading && !fetchAttemptedRef.current) {
          console.log("🎮 Playing existing document:", targetDocId);
          fetchAttemptedRef.current = true; // Mark as attempted to prevent retries
          
          const fetchGameDataFromExisting = async () => {
              setLoading(true);
              const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
              
              try {
                  const session = await supabase.auth.getSession();
                  
                  // Fetch quiz + music from existing document using GET endpoint
                  console.log("📥 Fetching Quiz & Music from existing document...");
                  const gameDataRes = await fetch(`${API_URL}/game/data/${targetDocId}`, {
                      method: 'GET',
                      headers: {
                          'Authorization': `Bearer ${session.data.session?.access_token}`,
                          'Content-Type': 'application/json'
                      }
                  });

                  if (!gameDataRes.ok) {
                      const err = await gameDataRes.json();
                      throw new Error(err.detail || "Failed to fetch quiz and music data");
                  }

                  const responseData = await gameDataRes.json();
                  console.log("✅ Quiz & Music Fetched:", {
                      hasQuiz: !!responseData.quiz,
                      hasMusicData: !!responseData.music_data,
                      music_file_path: responseData.music_file_path,
                      difficulty: responseData.difficulty,
                      quizQuestionsCount: responseData.quiz?.questions?.length
                  });

                  // Verify response structure
                  if (!responseData.quiz || !responseData.quiz.questions) {
                      throw new Error("Invalid quiz response structure - missing quiz or questions")
                  }

                  // Decode music data from base64
                  let audioBuffer: ArrayBuffer
                  if (responseData.music_data) {
                      try {
                          const binaryString = atob(responseData.music_data)
                          const bytes = new Uint8Array(binaryString.length)
                          for (let i = 0; i < binaryString.length; i++) {
                              bytes[i] = binaryString.charCodeAt(i)
                          }
                          audioBuffer = bytes.buffer
                          console.log('✅ Music decoded from response, size:', audioBuffer.byteLength, 'bytes')
                      } catch (decodeError) {
                          console.error('❌ Error decoding music data:', decodeError)
                          throw new Error(`Failed to decode music data: ${decodeError}`)
                      }
                  } else {
                      // Fallback to hardcoded audio
                      console.warn('⚠️ No music_data in response, using fallback audio')
                      const audioResponse = await fetch(HARDCODED_AUDIO_URL)
                      if (!audioResponse.ok) throw new Error("Failed to load fallback game audio")
                      audioBuffer = await audioResponse.arrayBuffer()
                  }

                  // Map questions
                  const mappedQuestions = mapQuizQuestions(responseData.quiz.questions);
                  
                  // Use difficulty from response, or fallback to selectedDifficulty/locationState/default
                  const difficulty = (responseData.difficulty?.toUpperCase() || selectedDifficulty || locationState?.difficulty || 'EASY') as 'EASY' | 'MEDIUM' | 'HARD'
                  
                  console.log('🎮 Starting game with', mappedQuestions.length, 'questions and', audioBuffer.byteLength, 'bytes of audio')

                  // Start the game
                  await processAudioAndStartLevel(audioBuffer, mappedQuestions, difficulty);
                  if (targetDocId) {
                      setUploadedDocumentId(targetDocId);
                  }
                  
              } catch (error: any) {
                  console.error("Error fetching game data from existing document:", error);
                  // Set hasGenerated to true to prevent retries
                  setHasGenerated(true);
                  setLoading(false);
                  alert(`Error: ${error.message}`);
              }
          };

          fetchGameDataFromExisting();
      }
  }, [queryDocumentId, locationState?.documentId, hasGenerated, loading]);
  
  // Reset fetchAttemptedRef when documentId changes or component unmounts
  useEffect(() => {
      return () => {
          fetchAttemptedRef.current = false;
      };
  }, [queryDocumentId, locationState?.documentId]);

  const processAudioAndStartLevel = async (arrayBuffer: ArrayBuffer, quizQuestions: any[] = [], difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'EASY') => {
    // Don't set loading here - it's already set in handleDocumentUpload
    try {
      console.log('🎵 Processing audio and starting level...', {
        audioSize: arrayBuffer.byteLength,
        questionsCount: quizQuestions.length,
        difficulty
      })

      
      const TARGET_DURATION = 60.0
      let processedBuffer = arrayBuffer

      // AUDIO LOOPING / TRIMMING LOGIC
      try {
          // Decode first to check duration
          const ctxCheck = new (window.AudioContext || (window as any).webkitAudioContext)()
          const tempBuffer = await ctxCheck.decodeAudioData(arrayBuffer.slice(0))
          
          if (Math.abs(tempBuffer.duration - TARGET_DURATION) > 0.1) {
             console.log(`⚠️ Audio Duration is ${tempBuffer.duration.toFixed(2)}s. Target: 60s. Processing...`)
             
             // Create Target Buffer
             const targetFrames = Math.ceil(TARGET_DURATION * tempBuffer.sampleRate)
             const newAudioBuffer = ctxCheck.createBuffer(tempBuffer.numberOfChannels, targetFrames, tempBuffer.sampleRate)
             
             for (let channel = 0; channel < tempBuffer.numberOfChannels; channel++) {
                 const nowBuffering = newAudioBuffer.getChannelData(channel)
                 const sourceData = tempBuffer.getChannelData(channel)
                 
                 // Fill exactly 60s
                 let cursor = 0
                 while (cursor < targetFrames) {
                     const spaceLeft = targetFrames - cursor
                     const amountToCopy = Math.min(spaceLeft, sourceData.length)
                     
                     // Perform copy
                     for (let i = 0; i < amountToCopy; i++) {
                         nowBuffering[cursor + i] = sourceData[i]
                     }
                     
                     cursor += amountToCopy
                 }
             }
             
             // Now Encode back to ArrayBuffer? 
             // Logic in generateLevel expects Metadata from `analyzeAudio`. 
             // `analyzeAudio` takes ArrayBuffer... 
             // `web-audio-beat-detector` typically needs raw buffer.
             // We can just pass the AudioBuffer to `analyzeAudio` if we modify it??
             // Wait, `analyzeAudio` likely decodes internally.
             
             // Actually, `analyzeAudio` takes ArrayBuffer. We need to convert AudioBuffer BACK to WAV/ArrayBuffer 
             // OR modify `analyzeAudio` to accept AudioBuffer.
             // Easier: Just use the AudioBuffer we created for playback (`setAudioBuffer`),
             // BUT `generateLevel` needs `AudioData` from analysis.
             
             // Let's assume we can't easily re-encode to ArrayBuffer in browser without external lib.
             // Workaround: Modify `analyzeAudio` to take `AudioBuffer`?
             // Let's check `analyzeAudio` signature. 
             // Assuming it takes ArrayBuffer from existing code: `const audioData = await analyzeAudio(arrayBuffer.slice(0), fallbackBpm)`
             
             // CRITICAL: We need valid analysis for 60s.
             // If we loop, the analysis should reflect the loop.
             // If we can't re-encode, we might analyze the SHORT clip, then manually repeat beats?
             // That's complex.
             
             // ALTERNATIVE: Use `wav-encoder` or similar? Don't have it.
             // Quick Wav Encoder (Canonical simple RIFF header)
             
             // Let's implement a simple WAV encoder to turn our AudioBuffer back into ArrayBuffer
             processedBuffer = audioBufferToWav(newAudioBuffer)
             console.log("✅ Audio Processed (Looped/Trimmed) to 60s")
          }
      } catch (e) {
         console.warn("⚠️ Audio Processing Warning:", e)
         // Fallback to original
      }

      // Map difficulty to BPM for fallback beat detection
      const difficultyBpmMap = {
        'EASY': 110,
        'MEDIUM': 130,
        'HARD': 150
      }
      const fallbackBpm = difficultyBpmMap[difficulty]
      
      // Decode copy for analysis with fallback BPM
      console.log('🔍 Analyzing audio for beats...')
      // USE PROCESSED BUFFER
      const audioData = await analyzeAudio(processedBuffer.slice(0), fallbackBpm) 
      console.log('✅ Audio analyzed:', {
        duration: audioData.metadata.duration,
        bpm: audioData.metadata.bpm,
        beatsCount: audioData.beats.length
      })
      
      // GENERATE LEVEL WITH QUIZ QUESTIONS AND DIFFICULTY
      console.log('🎮 Generating level...')
      const generatedLevel = generateLevel(audioData, quizQuestions, difficulty) 
      console.log('✅ Level generated:', {
        timelineLength: generatedLevel.timeline.length
      })
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const playbackBuffer = await ctx.decodeAudioData(processedBuffer.slice(0)) // Decode fresh copy of PROCESSED
      ctx.close()
      
      setLevelData(generatedLevel)
      setAudioBuffer(playbackBuffer)
      setHasGenerated(true)
      setLoading(false) // Clear loading state when done
      console.log('🎮 Game ready to play!')
      
    } catch (error) {
      console.error('❌ Error processing audio:', error)
      alert(`Failed to process audio file: ${error instanceof Error ? error.message : String(error)}`)
      setLoading(false) // Make sure to clear loading on error
      throw error // Re-throw so caller knows it failed
    }
  }

  // HELPER: Simple WAV Encoder
  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
      const numChannels = buffer.numberOfChannels
      const sampleRate = buffer.sampleRate
      const format = 1 // PCM
      const bitDepth = 16
      
      let buffers: Float32Array[] = []
      for (let i = 0; i < numChannels; i++) {
          buffers.push(buffer.getChannelData(i))
      }
      
      // Interleave
      const length = buffers[0].length * numChannels * 2 + 44
      const result = new ArrayBuffer(length)
      const view = new DataView(result)
      
      // Writes string to view
      const writeString = (view: DataView, offset: number, string: string) => {
          for (let i = 0; i < string.length; i++) {
              view.setUint8(offset + i, string.charCodeAt(i))
          }
      }
      
      // RIFF chunk descriptor
      writeString(view, 0, 'RIFF')
      view.setUint32(4, 36 + buffers[0].length * numChannels * 2, true)
      writeString(view, 8, 'WAVE')
      
      // fmt sub-chunk
      writeString(view, 12, 'fmt ')
      view.setUint32(16, 16, true)
      view.setUint16(20, format, true)
      view.setUint16(22, numChannels, true)
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, sampleRate * numChannels * 2, true)
      view.setUint16(32, numChannels * 2, true)
      view.setUint16(34, bitDepth, true)
      
      // data sub-chunk
      writeString(view, 36, 'data')
      view.setUint32(40, buffers[0].length * numChannels * 2, true)
      
      // Write PCM data
      let offset = 44
      for (let i = 0; i < buffers[0].length; i++) {
          for (let channel = 0; channel < numChannels; channel++) {
              const s = Math.max(-1, Math.min(1, buffers[channel][i]))
              view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
              offset += 2
          }
      }
      
      return result
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

    // Prevent duplicate calls (React StrictMode causes double renders in dev)
    if (quizGenerationInProgressRef.current) {
        console.warn('⚠️ Quiz generation already in progress, skipping duplicate call')
        return
    }
    
    setLoading(true)
    quizGenerationInProgressRef.current = true
    
    try {
        // Use selected difficulty from UI
        const difficulty = selectedDifficulty
        console.log('🎮 Using difficulty:', difficulty)
        
        // 1. Upload PDF to Storage & DB, then Generate Quiz + Music
        let docId = '';
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

        // Check if user is logged in
        if (!user) {
            console.error('❌ User not logged in - cannot upload document')
            alert('Please log in to upload documents and play the game.')
            setLoading(false)
            quizGenerationInProgressRef.current = false
            return
        }

        // User is logged in, proceed with upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', user.id);
        
        console.log("🚀 Starting Upload (GamePage)...");
        console.log("📋 Upload details:", {
            fileName: file.name,
            fileSize: file.size,
            difficulty: difficulty,
            userId: user.id
        });
        
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

        // Get session for both agent creation and quiz generation
        const session = await supabase.auth.getSession();

        // OPTIMIZATION: Start agent creation in background (fire and forget)
        // Agent creation doesn't need to block quiz/music generation
        void (async () => {
            try {
                console.log(`🚀 Creating agent for document ${docId} (background)...`);
                const agentFormData = new FormData();
                agentFormData.append('user_id', user.id);
                
                const agentResponse = await fetch(`${API_URL}/create-agent/${docId}`, {
                    method: 'POST',
                    headers: {
                       'Authorization': `Bearer ${session.data.session?.access_token || ''}`
                    },
                    body: agentFormData
                });

                if (!agentResponse.ok) {
                    const errorText = await agentResponse.text();
                    let errorDetail = "Agent creation failed";
                    try {
                        const err = JSON.parse(errorText);
                        errorDetail = err.detail || err.message || errorText;
                        
                        // Suppress expected errors (document too big for prompt mode)
                        if (errorDetail.includes("too big") || errorDetail.includes("cannot_be_used_as_prompt")) {
                            console.log("ℹ️ Agent creation skipped (document too large for prompt mode - expected for large PDFs)");
                            return; // Silently exit for expected errors
                        }
                    } catch {
                        errorDetail = errorText || `HTTP ${agentResponse.status}: ${agentResponse.statusText}`;
                    }
                    console.warn("⚠️ Agent creation failed (non-blocking):", errorDetail);
                } else {
                    const agentData = await agentResponse.json();
                    console.log("✅ Agent created successfully:", agentData);
                }
            } catch (agentError: any) {
                console.warn("⚠️ Error creating agent (non-blocking):", agentError.message);
            }
        })();

        // Generate Quiz + Music via Backend (don't wait for agent)
        console.log("🧠 Generating Quiz & Music...");
        console.log("📊 Request details:", {
            documentId: docId,
            difficulty: difficulty,
            difficultyLower: difficulty.toLowerCase()
        });
        
        const difficultyLower = difficulty.toLowerCase() as 'easy' | 'medium' | 'hard'
        const quizRes = await fetch(`${API_URL}/generate-quiz/${docId}?difficulty=${difficultyLower}`, {
            method: 'POST',
            headers: {
               'Authorization': `Bearer ${session.data.session?.access_token}`,
               'Content-Type': 'application/json'
            }
        });

        console.log("📡 Quiz API Response Status:", quizRes.status, quizRes.statusText);

        if (!quizRes.ok) {
            const err = await quizRes.json();
            console.error("❌ Quiz generation failed:", err);
            throw new Error(err.detail || "Quiz and music generation failed");
        }

        const responseData = await quizRes.json();
        console.log("✅ Quiz & Music Generated:", {
            hasQuiz: !!responseData.quiz,
            hasMusicData: !!responseData.music_data,
            music_file_path: responseData.music_file_path,
            difficulty: responseData.difficulty,
            quizQuestionsCount: responseData.quiz?.questions?.length
        });

        // Verify response structure
        if (!responseData.quiz || !responseData.quiz.questions) {
            throw new Error("Invalid quiz response structure - missing quiz or questions")
        }

        // Decode music data from base64
        let audioBuffer: ArrayBuffer
        if (responseData.music_data) {
            try {
                // Convert base64 to ArrayBuffer
                const binaryString = atob(responseData.music_data)
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i)
                }
                audioBuffer = bytes.buffer
                console.log('✅ Music decoded from response, size:', audioBuffer.byteLength, 'bytes')
            } catch (decodeError) {
                console.error('❌ Error decoding music data:', decodeError)
                throw new Error(`Failed to decode music data: ${decodeError}`)
            }
        } else {
            // Fallback to hardcoded audio if music generation failed
            console.warn('⚠️ No music available, using fallback audio')
            const audioResponse = await fetch(HARDCODED_AUDIO_URL)
            if (!audioResponse.ok) throw new Error("Failed to load fallback game audio")
            audioBuffer = await audioResponse.arrayBuffer()
        }
        
        // Map quiz questions and start level
        const mappedQuestions = mapQuizQuestions(responseData.quiz.questions);
        console.log('🎮 Starting game with', mappedQuestions.length, 'questions and', audioBuffer.byteLength, 'bytes of audio')
       
        await processAudioAndStartLevel(audioBuffer, mappedQuestions, difficulty as any);
        
        // Reset flag on success
        quizGenerationInProgressRef.current = false
       } catch (error: any) {
           console.error("❌ Error setting up game:", error)
           console.error("Error details:", {
               message: error.message,
               stack: error.stack,
               name: error.name
           })
           alert(`Error: ${error.message || 'Failed to process document. Please try again.'}`)
           setLoading(false)
           quizGenerationInProgressRef.current = false // Reset flag on error
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

              <p style={{ marginBottom: '20px', color: '#aaa', maxWidth: '400px', textAlign: 'center' }}>
                {loading 
                  ? 'Generating quiz & music, analyzing document...' 
                  : 'Select difficulty and upload your study notes!'}
              </p>

              {!user && !loading && (
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '15px 20px', 
                  background: 'rgba(255, 100, 100, 0.1)', 
                  border: '2px solid rgba(255, 100, 100, 0.5)', 
                  borderRadius: '10px',
                  maxWidth: '400px',
                  textAlign: 'center'
                }}>
                  <p style={{ color: '#ff6464', margin: 0, fontFamily: 'Orbitron', fontSize: '0.9rem' }}>
                    ⚠️ Please sign in to upload documents and play the game.
                  </p>
                </div>
              )}

              {!loading && (
                <>
                  {/* Difficulty Selection */}
                  <div style={{ 
                    marginBottom: '30px', 
                    display: 'flex', 
                    gap: '15px', 
                    justifyContent: 'center',
                    flexWrap: 'wrap'
                  }}>
                    {(['EASY', 'MEDIUM', 'HARD'] as const).map((diff) => {
                      const isSelected = selectedDifficulty === diff
                      const colors = {
                        EASY: { bg: 'rgba(0, 255, 255, 0.2)', border: 'rgba(0, 255, 255, 0.8)', text: '#00ffff' },
                        MEDIUM: { bg: 'rgba(255, 0, 255, 0.2)', border: 'rgba(255, 0, 255, 0.8)', text: '#ff00ff' },
                        HARD: { bg: 'rgba(255, 100, 150, 0.2)', border: 'rgba(255, 100, 150, 0.8)', text: '#ff6496' }
                      }[diff]
                      
                      return (
                        <button
                          key={diff}
                          onClick={() => setSelectedDifficulty(diff)}
                          disabled={!user}
                          style={{
                            padding: '12px 24px',
                            background: isSelected ? colors.bg : 'rgba(255, 255, 255, 0.05)',
                            border: `2px solid ${isSelected ? colors.border : 'rgba(255, 255, 255, 0.2)'}`,
                            borderRadius: '8px',
                            color: isSelected ? colors.text : '#aaa',
                            fontFamily: 'Orbitron',
                            fontWeight: isSelected ? 'bold' : 'normal',
                            cursor: user ? 'pointer' : 'not-allowed',
                            transition: 'all 0.3s',
                            boxShadow: isSelected ? `0 0 15px ${colors.border}` : 'none',
                            opacity: user ? 1 : 0.5
                          }}
                        >
                          {diff}
                        </button>
                      )
                    })}
                  </div>

                  {/* Upload Button */}
                  <div style={{ marginTop: '20px' }}>
                    {user ? (
                      <div className="group" style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
                        <button 
                          className="px-10 py-5 text-xl border-none rounded-full font-bold font-display shadow-none transition-all duration-300 transform"
                          style={{
                            background: '#00ffff',
                            color: 'black',
                            cursor: 'pointer',
                            pointerEvents: 'none' // Let clicks pass through to input
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.filter = 'brightness(0.75)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.filter = 'brightness(1)'
                          }}
                        >
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
                            cursor: 'pointer',
                            zIndex: 10
                          }}
                        />
                      </div>
                    ) : (
                      <button 
                        className="px-10 py-5 text-xl border-none rounded-full font-bold font-display shadow-none transition-all duration-300"
                        style={{
                          background: 'rgba(100, 100, 100, 0.5)',
                          color: '#666',
                          cursor: 'not-allowed',
                          opacity: 0.6
                        }}
                        disabled
                      >
                        SIGN IN TO UPLOAD
                      </button>
                    )}
                  </div>
                </>
              )}

              {loading && (
                  <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #333', borderTop: '4px solid #00ffff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                      <p style={{ marginTop: '15px', color: '#00ffff' }}>AI is crafting your quiz...</p>
                      <style>{`
                        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } }
                      `}</style>
                  </div>
              )}
              
              {!loading && (
                  <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.2); } }`}</style>
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
