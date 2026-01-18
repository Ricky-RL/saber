import { useEffect, useState, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stars, OrbitControls, PerspectiveCamera, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Block } from './Block'

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
  

  const { scene } = useThree() 
  
  // Audio Playback Management
  const [currentAudioTime, setCurrentAudioTime] = useState(0)
  
  // Ref to track questions answered in THIS session to prevent race conditions
  const handledQuestionsRef = useRef<Set<string>>(new Set())
  const endGameStartTime = useRef<number | null>(null) // Track when to end game
  
  // Avatar ref
  const avatarRef = useRef<AvatarRef>(null)

  // Reset ref on start
  useEffect(() => {
     if (isPlaying) {
         handledQuestionsRef.current.clear()
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
      else if (time > 45) { // Hard limit fallback extended
          endGame()
      }


      // --- SPAWNER ---
      if (levelData) {
          const PREVIEW_TIME = 2.0 // User Request: Spawn later (closer to beat) for faster feel
          
          levelData.timeline.forEach((event) => {
              // If event is coming up within preview time AND hasn't been spawned yet
              if (event.timestamp <= time + PREVIEW_TIME && !event.spawned) {
                  event.spawned = true 
                  spawnQuestionBlocks(event.data, event.timestamp)
              }
          })
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

              // HIT WINDOW: Z between -2.5 and -0.5
              if (blockPos.z > -2.5 && blockPos.z < -0.5) {
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

                          const hitThresholdX = obj.userData.size ? (obj.userData.size[0] / 2) + 0.4 : 0.8
                          const hitThresholdY = obj.userData.size ? (obj.userData.size[1] / 2) + 0.4 : 0.8

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
  })

  // Spawn Logic Helper
  // --- SPAWNER HELPER ---
  const spawnQuestionBlocks = (question: QuestionData, targetTime: number) => {
      const newBlocks: any[] = []
      
      const SPAWN_Y = 0.0 
      // [CONFIG] BLOCK SPEED
      // This determines how fast the blocks travel.
      // Since Arrival Time is fixed (PREVIEW_TIME = 2.0s), increasing Speed increases Spawn Distance.
      // Distance = Speed * Time. 
      // Speed 50 * 2.0s = 100 meters spawn distance.
      // Speed 12 * 2.0s = 24 meters spawn distance.
      const SPEED = 12
      
      // 1. SPAWN Flying Header
      setHeaders(prev => [...prev, {
          id: `header_${question.id}`,
          text: question.content.questionText,
          targetTime: targetTime,
          speed: SPEED // Pass Speed
      }])

      // Variation Logic
      if (question.type === 'TRUE_FALSE_PAIR') {
         // --- PAIR VARIATION (Separate Left/Right) ---
         // Randomize Order (Left/Right)
         const isReversed = Math.random() > 0.5 
         
         // Left Block (Pink)
         newBlocks.push({
             id: `${question.id}_left_pair`,
             questionId: question.id, // Explicit ID
             position: [-1.2, SPAWN_Y, -30], 
             color: '#ff00ff', // Pink/Magenta for Left
             text: isReversed ? question.content.answers?.[1].text : question.content.answers?.[0].text, 
             type: 'true_false_pair',
             targetTime: targetTime,
             speed: SPEED, // Pass Speed
             isCorrect: isReversed ? question.content.answers?.[1].isCorrect : question.content.answers?.[0].isCorrect,
         })
         
         // Right Block (Cyan)
         newBlocks.push({
             id: `${question.id}_right_pair`,
             questionId: question.id, // Explicit ID
             position: [1.2, SPAWN_Y, -30],
             color: '#00ffff', // Cyan/Blue for Right
             text: isReversed ? question.content.answers?.[0].text : question.content.answers?.[1].text,
             type: 'true_false_pair',
             targetTime: targetTime,
             speed: SPEED, // Pass Speed
             isCorrect: isReversed ? question.content.answers?.[0].isCorrect : question.content.answers?.[1].isCorrect,
         })

      } else if (question.type === 'TRUE_FALSE_SPLIT') {
         // --- SPLIT VARIATION (Visual Center + Invisible Hitboxes) ---
         // Randomize Axis (Horizontal/Vertical) and Order
         // const splitAxis = Math.random() > 0.5 ? 'vertical' : 'horizontal' // Disabled Vertical for now
         const splitAxis: 'horizontal' | 'vertical' = Math.random() > 1 ? 'vertical' : 'horizontal'
         const isReversed = Math.random() > 0.5
         
         // Determine Labels and Answers
         // Normal: A=Left/Top=True(0), B=Right/Bot=False(1)
         // Reversed: A=Left/Top=False(1), B=Right/Bot=True(0)
         const labelA = isReversed ? "F" : "T" // Or actual text? User said "T" and "F" visual logic in Block.tsx uses these props
         const labelB = isReversed ? "T" : "F"
         
         const answerA = isReversed ? question.content.answers?.[1] : question.content.answers?.[0]
         const answerB = isReversed ? question.content.answers?.[0] : question.content.answers?.[1]

         // 1. VISUAL ONLY Block (Center)
         newBlocks.push({
             id: `${question.id}_visual`,
             questionId: question.id, // Explicit ID
             position: [0, SPAWN_Y, -30], 
             color: '#ffffff', 
             type: 'true_false_split', 
             targetTime: targetTime,
             speed: SPEED, // Pass Speed
             isCorrect: false,
             splitAxis: splitAxis, // Pass random axis
             labelA: labelA,
             labelB: labelB,
             answers: question.content.answers 
         })

         // 2. Hitbox A (Left or Top)
         // STRETCHED HITBOXES (User Request)
         // Vertical: Wide and Flat. Horizontal: Tall and Narrow.
         const posA: [number, number, number] = splitAxis === 'vertical' 
             ? [0, SPAWN_Y + 1.0, -30] // Top (Closer to center)
             : [-1.0, SPAWN_Y, -30]    // Left (Closer to center)

         const sizeA: [number, number, number] = splitAxis === 'vertical'
             ? [8, 2.2, 1.3] // Wide 
             : [2.2, 5, 1.3] // Tall

         newBlocks.push({
             id: `${question.id}_hitbox_a`,
             questionId: question.id, 
             position: posA, 
             size: sizeA, 
             color: '#00ffff',
             type: 'mcq', 
             targetTime: targetTime,
             speed: SPEED, // Pass Speed
             isCorrect: answerA?.isCorrect,
             invisible: true // Visible for debugging
         })

         // 3. Hitbox B (Right or Bottom)
         const posB: [number, number, number] = splitAxis === 'vertical'
             ? [0, SPAWN_Y - 1.0, -30] // Bottom
             : [1.0, SPAWN_Y, -30]     // Right

             
         const sizeB: [number, number, number] = splitAxis === 'vertical'
             ? [8, 2.2, 1.3] // Wide
             : [2.2, 5, 1.3] // Tall

         newBlocks.push({
             id: `${question.id}_hitbox_b`,
             questionId: question.id,
             position: posB, 
             size: sizeB, // Custom Size
             color: '#ff00ff',
             type: 'mcq',
             targetTime: targetTime,
             speed: SPEED, // Pass Speed
             isCorrect: answerB?.isCorrect,
             invisible: true // Visible for debugging
         })

      } else {
          // MCQ - WIDER SPREAD & BIGGER BLOCKS
          const count = question.content.answers?.length || 0
          const spacing = 3.5 // Increased from 2
          const startX = -((count - 1) * spacing) / 2
          
          
          const TRON_COLORS = ['#00ffff', '#ff00ff', '#ff0000', '#39ff14'] // Cyan, Magenta, Red, Neon Green
          const colorOffset = Math.floor(Math.random() * TRON_COLORS.length) // Randomize start color

          question.content.answers?.forEach((ans, idx) => {
              const x = startX + (idx * spacing)
              const colorIdx = (idx + colorOffset) % TRON_COLORS.length // Cycle with offset
              
              newBlocks.push({
                  id: `${question.id}_${idx}`,
                  questionId: question.id, // Explicit ID
                  position: [x, SPAWN_Y, -30],
                  color: TRON_COLORS[colorIdx], // Cycle through Tron colors
                  text: ans.text,
                  type: 'mcq',
                  size: [1.8, 1.8, 1.8], // BIGGER BLOCKS (User Request)
                  targetTime: targetTime,
                  speed: SPEED, // Pass Speed
                  isCorrect: ans.isCorrect,
                  questionText: question.content.questionText
              })
          })
      }
      
      setBlocks(prev => [...prev, ...newBlocks])
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
      // (Split logic removed - now handled by invisible hitboxes with intrinsic isCorrect values)


      // Mark as answered if Valid HIT (even if wrong, we consume the question)
      handledQuestionsRef.current.add(questionId)

      // Set Last Answer for UI Feedback
      if (block.text) {
          useGameStore.getState().setLastAnswer(block.text)
          // Auto-clear after 2 seconds? Or let UI handle it?
          setTimeout(() => useGameStore.getState().setLastAnswer(null), 2000)
      }

      // Explosion
      // Use block color for visual feedback of WHAT was hit.
      // If invisible hitbox, use the color defined in spawner.
      setExplosions(prev => [...prev, { 
          id: Date.now() + Math.random(), 
          position: [hitPos.x, hitPos.y, hitPos.z], 
          color: block.color || (isCorrect ? '#00ff00' : '#ff0000') 
      }])
      
      // Remove ALL blocks belonging to this question (using explicit ID)
      setBlocks(prev => prev.filter(b => b.questionId !== questionId))
      
      // Remove the Flying Header for this question
      setHeaders(prev => prev.filter(h => h.id !== `header_${questionId}`))

      if (isCorrect) {
          setScore(s => s + 100)
          setCombo(c => c + 1)
          incrementCorrectCount()
          avatarRef.current?.sayMessage("Correct!")
      } else {
          setCombo(() => 0)
          avatarRef.current?.sayMessage("Wrong!")
      }
  }

  const handleMiss = (id: string) => {
      setBlocks(prev => prev.filter(b => b.id !== id))
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
