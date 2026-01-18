import { useEffect, useState, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, OrbitControls, PerspectiveCamera, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Block } from './Block'

// IMPORT CENTRALIZED CONFIG
import { 
    GAME_SPEED, 
    SPAWN_PREVIEW_TIME, 
    HIT_WINDOW_Z_MIN, 
    HIT_WINDOW_Z_MAX, 
    DEFAULT_HIT_THRESHOLD, 
    STREAM_SPAWN_OFFSET,
    COLUMN_POSITIONS,
    DYNAMIC_SPAWN_SPACER
} from './GameConfig'

// TOGGLE THIS TO SEE HITBOXES
const DEBUG_SHOW_HITBOXES = false

import { SaberController } from './SaberController'
import { useGameStore } from './GameManager'
import { Explosion } from './Explosion'
import { QuestionHeader } from './QuestionHeader'
import type { QuestionData } from './audio/levelGenerator'
import Avatar, { type AvatarRef } from '../components/Avatar'


function GameLoop() {
  // ... (Store destructuring)
  const { 
    isPlaying,
    isPaused,
    levelData,
    audioBuffer,
    audioContext,
    audioStartTime,
    audioSource,
    togglePause,
    endGame,
    setScore,
    setCombo, 
    setAudioContext,
    incrementCorrectCount,
    equippedItems // Need equipped items to update lane colors
  } = useGameStore()

  const [blocks, setBlocks] = useState<any[]>([])
  const [headers, setHeaders] = useState<any[]>([]) // State for flying text headers
  const [explosions, setExplosions] = useState<{id: number, position: [number, number, number], color: string}[]>([])
  const [currentQuestionText, setCurrentQuestionText] = useState<string | null>(null) // Static HUD Text
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null) // TRACK ID to prevent overwriting

  

  const { scene } = useThree() 
  
  // Audio Playback Management
  const [currentAudioTime, setCurrentAudioTime] = useState(0)
  
  // Ref to track questions answered in THIS session to prevent race conditions
  const handledQuestionsRef = useRef<Set<string>>(new Set())
  const endGameStartTime = useRef<number | null>(null) // Track when to end game
  
  // DYNAMIC DIRECTOR REFS
  const nextSpawnTimeRef = useRef<number>(0)
  const questionQueueRef = useRef<QuestionData[]>([])
  const currentQuestionTargetTimeRef = useRef<number>(0) // Track when current Q ends

  // Avatar ref
  const avatarRef = useRef<AvatarRef>(null)

  // Reset ref on start
  useEffect(() => {
     if (isPlaying) {
         handledQuestionsRef.current.clear()
         nextSpawnTimeRef.current = 0
         questionQueueRef.current = [] // Will be repopulated by director
     }
  }, [isPlaying])

  // --- AUDIO LOGIC ---
  useEffect(() => {
    if (isPlaying && !isPaused && levelData && audioBuffer) {
        // Start or Resume Audio
        let ctx = audioContext
        if (!ctx) {
            ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        }
        
        if (ctx.state === 'suspended') {
            ctx.resume()
        }

        // Create Source
        const source = ctx.createBufferSource()
        source.buffer = audioBuffer
        
        // Create Gain Node (Volume Control)
        const gainNode = ctx.createGain()
        gainNode.gain.value = 0.25 // Reduced to 25% per user request
        
        // Connect: Source -> Gain -> Destination
        source.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        // Calculate offset (if resuming)
        const offset = currentAudioTime 
        source.start(0, offset)
        
        // Store context info
        const startTime = ctx.currentTime - offset
        setAudioContext(ctx, source, startTime)

        source.onended = () => {
             // If we reached the end naturally
             if (ctx?.currentTime && (ctx.currentTime - startTime >= audioBuffer.duration - 0.5)) {
                 endGame() // Fallback end
             }
        }
        
        return () => {
            try { source.stop() } catch(e) {}
        }
    } else if (isPaused && audioSource) {
        try { audioSource.stop() } catch(e) {}
        setAudioContext(audioContext, null, audioStartTime) // Clear source
    } else if (!isPlaying) {
        if (audioSource) try { audioSource.stop() } catch(e) {}
        if (audioContext) try { audioContext.close() } catch(e) {}
        setAudioContext(null, null, 0)
        setBlocks([])
        setCurrentAudioTime(0)
        handledQuestionsRef.current.clear()
        setCurrentQuestionText(null)
    }
  }, [isPlaying, isPaused, levelData, audioBuffer])

  // --- GAME LOOP & SPAWNER ---
  useFrame(() => {
      if (!isPlaying || isPaused || !audioContext) return

      // Update Time
      const time = audioContext.currentTime - audioStartTime
      setCurrentAudioTime(time)

      // Game ends when logic:
      let allSpawned = false
      if (levelData && levelData.timeline.length > 0) {
          allSpawned = levelData.timeline.every(e => e.spawned)
      }

      // If all spawned and screen is clear, end game (with 3s buffer)
      // Check if we passed the last block time or if blocks are empty
      if (allSpawned && blocks.length === 0 && (levelData?.timeline?.length || 0) > 0) {
          if (endGameStartTime.current === null) {
              endGameStartTime.current = time
          } else if (time - endGameStartTime.current > 3.0) {
              endGame()
          }
      } 
      // Also end if we are approaching end of song (Buffer duration - 3s)
      else if (audioBuffer && time > audioBuffer.duration - 3.0) {
           endGame()
      }
      else if (time > 90) { // Hard limit fallback extended
          endGame()
      }


      // --- DYNAMIC DIRECTOR (User Request) ---
      // Replaces static timeline loop.
      // Logic: If we are idle (no active question), check if it's time to spawn the next one.
      
      const directorTime = time + SPAWN_PREVIEW_TIME
      
      // Initialize Director on first run
      if (nextSpawnTimeRef.current === 0 && levelData?.beats && levelData.beats.length > 0) {
           // Start slightly after audio begins
           nextSpawnTimeRef.current = 4.0 
      }

      // CHECK IF WE SHOULD SPAWN
      if (levelData && !currentQuestionId) {
          // If we are past the scheduled spawn time considering preview...
          // Actually, we want to hit the beat at `nextSpawnTime`.
          // So we spawn at `nextSpawnTime - SPAWN_PREVIEW_TIME`.
          
          if (time >= nextSpawnTimeRef.current - SPAWN_PREVIEW_TIME) {
              
               // 1. Get Next Question
               if (!questionQueueRef.current || questionQueueRef.current.length === 0) {
                   if (levelData.questionsQueue) {
                       questionQueueRef.current = [...levelData.questionsQueue]
                   }
               }
               
               if (questionQueueRef.current && questionQueueRef.current.length > 0) {
                   const question = questionQueueRef.current.shift()
                   if (question) {
                       // 2. Exact Alignment
                       // We aimed for `nextSpawnTimeRef`. Let's find the closest beat to that target 
                       // to ensure we are still on rhythm.
                       let targetHitTime = nextSpawnTimeRef.current
                       
                       // Find beat >= targetHitTime
                       if (levelData.beats) {
                           const beat = levelData.beats.find(b => b >= targetHitTime)
                           if (beat) targetHitTime = beat
                       }
                       
                       // 3. Spawn
                       spawnQuestionBlocks(question, targetHitTime)
                       
                       // 4. Mark Active
                       // (spawnQuestionBlocks sets currentQuestionId)
                   }
               }
          }
      }

      // --- COLLISION ---
      const sabers: THREE.Object3D[] = []
      scene.traverse((obj) => {
          if (obj.userData?.velocity) { 
              sabers.push(obj)
          }
      })

      const hitsToProcess: { id: string, vel: number, pos: THREE.Vector3 }[] = []

      scene.traverse((obj) => {
          // Check if it's a block Group
          if (obj.userData?.isBlock && !obj.userData.hit) {
              const blockId = obj.userData.id
              
              // Ignore Visual-Only blocks
              if (blockId.endsWith('_visual')) return 

              const blockMesh = obj
              const blockPos = new THREE.Vector3()
              blockMesh.getWorldPosition(blockPos)

              // HIT WINDOW: Used Constants
              if (blockPos.z > HIT_WINDOW_Z_MAX && blockPos.z < HIT_WINDOW_Z_MIN) {
                  sabers.forEach(saber => {
                      const hitPoints = [
                          new THREE.Vector3(0, 0.5, 0),  // Lower Point
                          new THREE.Vector3(0, 1.0, 0),  // Lower Mid
                          new THREE.Vector3(0, 1.5, 0),  // Mid
                          new THREE.Vector3(0, 2.25, 0), // Upper Mid
                          new THREE.Vector3(0, 3.0, 0)   // Tip
                      ]
                      const saberVel = saber.userData.velocity as THREE.Vector3
                      
                      // Filter low velocity (must swing) - DISABLED per user request for "Static Hit"
                      // if (saberVel.length() < 0.5) return 

                      let isHit = false
                      for (const pt of hitPoints) {
                          const worldPt = pt.clone().applyMatrix4(saber.matrixWorld)
                          const dx = Math.abs(worldPt.x - blockPos.x)
                          const dy = Math.abs(worldPt.y - blockPos.y)

                          const hitThresholdX = obj.userData.size ? (obj.userData.size[0] / 2) + 0.4 : DEFAULT_HIT_THRESHOLD
                          const hitThresholdY = obj.userData.size ? (obj.userData.size[1] / 2) + 0.4 : DEFAULT_HIT_THRESHOLD

                          if (dx < hitThresholdX && dy < hitThresholdY) {
                              isHit = true
                              break
                          }
                      }
                      
                      if (isHit) {
                          obj.userData.hit = true // Tag as hit so we don't double hit
                          hitsToProcess.push({ id: blockId, vel: saberVel.x, pos: blockPos })
                      }
                  })
              }
          }
      })
      
      hitsToProcess.forEach(hit => handleCollision(hit.id, hit.vel, hit.pos))

      // --- IMMEDIATE MISS DETECTION (Time Based) ---
      // "Why cant we just know when the question has ended??"
      // We know targetTime. If audioTime > targetTime + 0.5 (buffer), it's missed.
      if (currentQuestionId && !handledQuestionsRef.current.has(currentQuestionId) && currentQuestionTargetTimeRef.current > 0) {
          const missThresholdTime = currentQuestionTargetTimeRef.current + 0.5
          
          if (time > missThresholdTime) {
             // 1. Mark Handled
             handledQuestionsRef.current.add(currentQuestionId)
             
             // 2. Feedback (Purple Missed)
             useGameStore.getState().setFeedback({
                  type: 'MISSED',
                  text: "MISSED!",
             })
             // Reset Combo to 1
             setCombo(() => 1) 
             avatarRef.current?.sayMessage("Missed!")
             setTimeout(() => useGameStore.getState().setFeedback(null), 2000)
             
             // 3. Clear HUD & ASSETS
             setCurrentQuestionText(null)
             setCurrentQuestionId(null)
             currentQuestionTargetTimeRef.current = 0 // Reset
             
             setBlocks(prev => prev.filter(b => b.questionId !== currentQuestionId))
             setHeaders(prev => prev.filter(h => h.id !== `header_${currentQuestionId}`))
             
             // 4. NEXT QUESTION
             const now = audioContext.currentTime - audioStartTime
             scheduleNextQuestion(now + DYNAMIC_SPAWN_SPACER)
          }
      }
  })

  // Spawn Logic Helper
  // --- SPAWNER HELPER ---
  // SPAWNER HELPER
  const spawnQuestionBlocks = (question: QuestionData, targetTime: number) => {
      const newBlocks: any[] = []
      
      const SPAWN_Y = 0.0 
      const SPEED = GAME_SPEED
      
      // --- ROBUST TARGET TIME SETTING (Consolidated) ---
      // Ensure we track the "End Time" of the question for Immediate Miss Logic.
      // This applies to ALL types (T/F, MCQ) to fix the "T/F needs same logic" bug.
      let extraDuration = 0
      if (question.type === 'TRUE_FALSE_PAIR' || question.type === 'TRUE_FALSE_SPLIT') {
          extraDuration = 0 // Single timestamp arrival
      } else {
          // MCQ Stream
          const count = question.content.answers?.length || 0
          extraDuration = Math.max(0, (count - 1) * STREAM_SPAWN_OFFSET)
      }
      currentQuestionTargetTimeRef.current = targetTime + extraDuration
      // --------------------------------------------------

      // UNIQUE ID GENERATION (Fixes "Ghost Hits" & "Stall" on loop)
      const instanceId = `${question.id}_${Date.now()}`
      
      // TIMEOUT HANDLER (User Request: "Miss all blocks = Wrong + Show Correct")
      const handleQuestionTimeout = () => {
          // If we haven't answered this question yet...
          if (!handledQuestionsRef.current.has(instanceId)) {
              // console.log(`Question ${instanceId} timed out (Missed All)`)
              handledQuestionsRef.current.add(instanceId)
              
              const correctAns = question.content.answers?.find(a => a.isCorrect)
              const correctText = correctAns?.text || "Unknown"

              // Start Feedback
              useGameStore.getState().setFeedback({
                  type: 'WRONG',
                  text: "NOTHING", // "I chose nothing"
                  correctText: correctText
              })
              
              // Reset Combo
              setCombo(() => 1)
              avatarRef.current?.sayMessage("Missed!")
              
              // Auto-clear feedback
              setTimeout(() => useGameStore.getState().setFeedback(null), 2000)

              // Clear Static HUD immediately if active
              setCurrentQuestionId(prevId => {
                 if (prevId === instanceId) {
                     setCurrentQuestionText(null)
                     return null
                 }
                 return prevId
              })
          }
      }

      // Variation Logic
      if (question.type === 'TRUE_FALSE_PAIR') {
         // 1. SPAWN Flying Header
          setHeaders(prev => [...prev, {
              id: `header_${instanceId}`,
              text: question.content.questionText,
              targetTime: targetTime,
              speed: SPEED 
          }])
          setCurrentQuestionId(instanceId)
          // currentQuestionTargetTimeRef set at top
          
          const DURATION = 4.0
          scheduleNextQuestion(targetTime + DURATION) 
          
          // Set Timeout for Miss (Duration + Buffer)
          setTimeout(handleQuestionTimeout, (DURATION + 1.0) * 1000)

         // --- PAIR VARIATION (Separate Left/Right with Random Positions) ---
         // 1. Randomize Content Order (Left/Right text swap)
         const isReversed = Math.random() > 0.5 

         // 2. Randomize Column Positions (Pick 2 distinct columns)
         // Use COLUMN_POSITIONS = [-3.5, -1.5, 1.5, 3.5]
         const availableCols = [...COLUMN_POSITIONS]
         const col1Index = Math.floor(Math.random() * availableCols.length)
         const col1 = availableCols.splice(col1Index, 1)[0]
         const col2Index = Math.floor(Math.random() * availableCols.length)
         const col2 = availableCols[col2Index] // Only 3 left, pick one
         
         // FIRST BLOCK (Random Column 1)
         // Ensure Color Consistency: T = Cyan, F = Pink
         const textLeft = isReversed ? question.content.answers?.[1].text : question.content.answers?.[0].text
         const isTrueLeft = textLeft === 'T' || textLeft === 'True'
         const colorLeft = isTrueLeft ? '#00ffff' : '#ff00ff'

         newBlocks.push({
             id: `${instanceId}_left_pair`,
             questionId: instanceId, 
             position: [col1, SPAWN_Y, -30], 
             color: colorLeft, 
             text: textLeft, 
             type: 'true_false_pair',
             targetTime: targetTime,
             startTime: currentAudioTime, // Restored for Animation
             speed: SPEED, 
             isCorrect: isReversed ? question.content.answers?.[1].isCorrect : question.content.answers?.[0].isCorrect,
         })
         
         // SECOND BLOCK (Random Column 2)
         const textRight = isReversed ? question.content.answers?.[0].text : question.content.answers?.[1].text
         const isTrueRight = textRight === 'T' || textRight === 'True'
         const colorRight = isTrueRight ? '#00ffff' : '#ff00ff'

         newBlocks.push({
             id: `${instanceId}_right_pair`,
             questionId: instanceId, 
             position: [col2, SPAWN_Y, -30],
             color: colorRight,
             text: textRight,
             type: 'true_false_pair',
             targetTime: targetTime,
             startTime: currentAudioTime, // Restored for Animation
             speed: SPEED, 
             isCorrect: isReversed ? question.content.answers?.[0].isCorrect : question.content.answers?.[1].isCorrect,
         })

      } else if (question.type === 'TRUE_FALSE_SPLIT') {
         // ... (Split Logic not currently used)
      } else {
          // --- MCQ STREAM MODE (New) ---
          setCurrentQuestionText(question.content.questionText)
          setCurrentQuestionId(instanceId) // TRACK THIS ID
          
          const count = question.content.answers?.length || 0
          // Wait for LAST block in stream
          const totalDuration = (count - 1) * STREAM_SPAWN_OFFSET 
          // currentQuestionTargetTimeRef set at top
          
          const hudDuration = totalDuration + SPAWN_PREVIEW_TIME + 2.0 
          
          // SCHEDULE FALLBACK (Max Duration)
          scheduleNextQuestion(targetTime + totalDuration + 2.0)

          // USE TIMEOUT HANDLER
          setTimeout(handleQuestionTimeout, (hudDuration + 0.5) * 1000)

          const TRON_COLORS = ['#00ffff', '#ff00ff', '#ff0000', '#39ff14'] 
          const colorOffset = Math.floor(Math.random() * TRON_COLORS.length) 

          let columns = [...COLUMN_POSITIONS] 
          columns = columns.sort(() => Math.random() - 0.5)

          question.content.answers?.forEach((ans, idx) => {
              const blockTargetTime = targetTime + (idx * STREAM_SPAWN_OFFSET)
              
              const x = columns[idx % columns.length] 
              const colorIdx = (idx + colorOffset) % TRON_COLORS.length 
              
              newBlocks.push({
                  id: `${instanceId}_${idx}`,
                  questionId: instanceId, 
                  position: [x, SPAWN_Y, -30],
                  color: TRON_COLORS[colorIdx], 
                  text: ans.text,
                  type: 'mcq',
                  size: [1.8, 1.8, 1.8], 
                  targetTime: blockTargetTime, 
                  startTime: currentAudioTime, // Restored for Animation
                  speed: SPEED,
                  isCorrect: ans.isCorrect,
                  questionText: question.content.questionText
              })
          })
      }
      
      setBlocks(prev => [...prev, ...newBlocks])
  }




  // HELPER: Schedule Next Question
  const scheduleNextQuestion = (minTime: number) => {
      nextSpawnTimeRef.current = minTime
  }

  const handleCollision = (blockId: string, _velX: number, hitPos: THREE.Vector3) => {
      const block = blocks.find(b => b.id === blockId)
      if (!block) return
      
      // Ignore header text collision
      if (block.type === 'text_header') return 

      // ROBUST QUESTION ID (Fixes "Partial Clear" Bug)
      const questionId = block.questionId || blockId.split('_')[0] 
      
      // If we already handled this question ID this session, IGNORE subsequent hits
      if (handledQuestionsRef.current.has(questionId)) {
          return; 
      }

      // Logic for Split Block
      let isCorrect = block.isCorrect
  
      // Mark as answered if Valid HIT (even if wrong, we consume the question)
      handledQuestionsRef.current.add(questionId)

      // --- FEEDBACK LOGIC (User Request: Green for Correct, Red+Correct for Wrong) ---
      if (block.text) {
          if (isCorrect) {
               useGameStore.getState().setFeedback({ 
                   type: 'CORRECT', 
                   text: block.text 
               })
          } else {
               // Find the CORRECT answer for this question
               // We look through all current blocks (or we could look at questionQueue/History if we tracked it)
               // Since blocks are still in state until this frame ends, we can find the sibling block with isCorrect=true
               const correctBlock = blocks.find(b => b.questionId === questionId && b.isCorrect)
               const correctText = correctBlock?.text || "Unknown"

               useGameStore.getState().setFeedback({ 
                   type: 'WRONG', 
                   text: block.text,
                   correctText: correctText
               })
          }
          
          // Auto-clear
          setTimeout(() => useGameStore.getState().setFeedback(null), 2000)
      }

      // Explosion
      setExplosions(prev => [...prev, { 
          id: Date.now() + Math.random(), 
          position: [hitPos.x, hitPos.y, hitPos.z], 
          color: block.color || (isCorrect ? '#00ff00' : '#ff0000') 
      }])
      
      // Remove ALL blocks belonging to this question (using explicit ID)
      setBlocks(prev => prev.filter(b => b.questionId !== questionId))
      
      // Remove the Flying Header for this question (if any)
      setHeaders(prev => prev.filter(h => h.id !== `header_${questionId}`))

      // HIDE STATIC HUD if this question is answered
      // Check ID match to be safe
      if (currentQuestionId === questionId) {
          setCurrentQuestionText(null)
          setCurrentQuestionId(null)
          currentQuestionTargetTimeRef.current = 0 // Reset invalidates time-based miss
      } 
      
      // --- DYNAMIC DIRECTOR TRIGGER (User Request) ---
      // "Release the rest of the time interval as soon as block is hit"
      // Schedule next question immediately (after spacer)
      if (audioContext) {
           const now = audioContext.currentTime - audioStartTime
           scheduleNextQuestion(now + DYNAMIC_SPAWN_SPACER)
      }

      if (isCorrect) {
          const currentCombo = useGameStore.getState().combo
          setScore(s => s + (100 * (currentCombo > 0 ? currentCombo : 1)))
          setCombo(c => c + 1)
          incrementCorrectCount()
          avatarRef.current?.sayMessage("Correct!")
      } else {
          setCombo(() => 1)
          avatarRef.current?.sayMessage("Wrong!")
      }
  }

  const handleMiss = (id: string) => {
      // If we miss a block, removed it
      setBlocks(prev => prev.filter(b => b.id !== id))
      
      // Note: We do NOT trigger "Schedule Next" on a single block miss 
      // because there might be other blocks coming (e.g. MCQ stream).
      // The "Max Duration Fallback" in spawnQuestionBlocks handles the timeout if they miss everything.
  }

  const handleHeaderComplete = (id: string) => {
      setHeaders(prev => prev.filter(h => h.id !== id))
  }

  // Keyboard Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') togglePause()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePause])


  return (
    <>
      <OrbitControls makeDefault={false} enabled={false} /> 

      {/* STATIC QUESTION HUD */}
      {currentQuestionText && (
          <Html position={[0, 0, 0]} fullscreen style={{ pointerEvents: 'none' }}>
              <div style={{
                  position: 'absolute',
                  top: '10%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '80%',
                  textAlign: 'center',
                  fontFamily: '"Orbitron", sans-serif',
                  // UPDATED STYLING: Black/White, Simple (User Request)
                  background: 'rgba(0, 0, 0, 0.9)', // High opacity black
                  border: '2px solid white',         // Simple white border
                  textShadow: 'none',                // Remove neon glow
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  padding: '20px',
                  borderRadius: '10px',              // Slightly sharper corners
                  zIndex: 1000
              }}>
                  {currentQuestionText}
              </div>
          </Html>
      )}
      
      {/* PAUSE MENU */}
      {isPaused && (
          <Html center>
              <div style={{
                  background: 'rgba(0,0,0,0.8)', padding: '40px', borderRadius: '20px', border: '2px solid white',
                  display: 'flex', flexDirection: 'column', gap: '20px', color: 'white', fontFamily: 'Orbitron, sans-serif',
                  textAlign: 'center', minWidth: '300px', zIndex: 100
              }}>
                  <h1 style={{ margin: 0, textShadow: '0 0 10px white' }}>PAUSED</h1>
                  <button onClick={() => togglePause()} style={{ background: 'transparent', border: '1px solid white', color: 'white', padding: '10px 20px', fontSize: '1rem', cursor: 'pointer', marginBottom: '10px' }}>
                    RESUME
                  </button>
                  <button onClick={() => window.location.reload()} style={{ background: 'transparent', border: '1px solid #ff0055', color: '#ff0055', padding: '10px 20px', fontSize: '1rem', cursor: 'pointer' }}>
                    EXIT
                  </button>
              </div>
          </Html>
      )} 
      
      {/* Lightsabers */}
      <SaberController side="left" color="#ff00ff" isPaused={isPaused} />
      <SaberController side="right" color="#00ffff" isPaused={isPaused} />

      {/* HIT LINE INDICATOR */}
      <mesh position={[0, -1.8, -1.5]}> 
        <boxGeometry args={[8, 0.05, 0.05]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} toneMapped={false} />
      </mesh>

      {/* Flying Question Headers */}
      {headers.map(header => (
        <QuestionHeader
            key={header.id}
            id={header.id}
            text={header.text}
            targetTime={header.targetTime}
            audioTime={currentAudioTime}
            speed={header.speed} // Use dynamic speed
            onComplete={handleHeaderComplete}
        />
      ))}

      {/* Blocks */}
      {blocks.map(block => (
        <Block 
            key={block.id}
            {...block}
            audioTime={currentAudioTime} 
            // speed={12} <- REMOVED HARDCODED OVERRIDE
            onMiss={handleMiss}
            showHitbox={DEBUG_SHOW_HITBOXES}
        />
      ))}

      {/* Explosions */}
      {explosions.map(exp => (
          <Explosion 
            key={exp.id} 
            position={exp.position} 
            color={exp.color} 
            onComplete={() => setExplosions(prev => prev.filter(e => e.id !== exp.id))}
          />
      ))}
      <gridHelper args={[20, 20, 0x333333, 0x111111]} position={[0, -2, 0]} />

      <LaneColors equippedItems={equippedItems} />

      {/* Moving Floor - Matte */}
      <mesh position={[0, -2.1, -20]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[20, 300]} /> {/* Increased length */}
          <meshStandardMaterial color="#050505" roughness={1} metalness={0} /> 
      </mesh>

      {/* Avatar in bottom left corner */}
      <Html
        position={[-3, 0.5, 3]}
        transform
        occlude={false}
        style={{
          width: '200px',
          height: '200px',
          pointerEvents: 'none'
        }}
      >
        <Avatar ref={avatarRef} />
      </Html>
    </>
  )
}

function LaneColors({ equippedItems }: { equippedItems: any }) {
    // Determine colors
    const equippedPair = equippedItems?.saber_pair?.value // e.g., "#FF00FF,#00FFFF"
  
    let leftColor = "#ff00ff";
    let rightColor = "#00ffff";

    if (equippedPair && typeof equippedPair === 'string') {
        const colors = equippedPair.split(',');
        leftColor = colors[0];
        rightColor = colors.length > 1 ? colors[1] : colors[0];
    }

    return (
        <>
            <PulsatingLine position={[-8, -2, -20]} color={leftColor} />
            <PulsatingLine position={[8, -2, -20]} color={rightColor} />
        </>
    )
}

function PulsatingLine({ position, color }: { position: [number, number, number], color: string }) {
    const matRef = useRef<THREE.MeshStandardMaterial>(null!)
    const offset = position[0] 
    useFrame((state) => {
        if (matRef.current) {
            matRef.current.emissiveIntensity = 2.5 + Math.sin(state.clock.elapsedTime * 3 + offset) * 1.5
        }
    })
    return (
      <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
         <boxGeometry args={[0.5, 300, 0.5]} /> {/* Increased length */}
         <meshStandardMaterial ref={matRef} color={color} emissive={color} toneMapped={false} />
      </mesh>
    )
}

export default function Scene() {
  return (
    <Canvas gl={{ alpha: false }}> {/* Alpha false for performance since we have opaque background now */}
      <PerspectiveCamera makeDefault position={[0, 1.5, 6]} fov={60} />
      <color attach="background" args={['#000000']} />  {/* Restored Black Background */}
      <fog attach="fog" args={['#000000', 30, 200]} /> {/* Increased fog distance */}
      
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <GameLoop />
      
      <EffectComposer>
        <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} intensity={2} />
      </EffectComposer>
    </Canvas>
  )
}
