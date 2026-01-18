import { useGameStore } from './GameManager'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import './UI.css'

export function UI() {
  const { score, combo, isPlaying, isGameOver, startGame } = useGameStore()
  const feedback = useGameStore((state) => state.feedback) // CALL HOOK HERE

  return (
    <div className="saber-ui">
      
      {/* HUD - Top */}
      {/* HUD - Top */}
      <div className="hud-top">
        <div className="stats-container">
            <div className="score-box">
                <h2 className="stat-value">{score.toLocaleString()}</h2>
                <p className="stat-label">SCORE</p>
            </div>
            
            <div className="combo-box">
                <h2 className="stat-value">x{combo}</h2>
                <p className="stat-label">COMBO</p>
            </div>

            {/* LAST ANSWER FEEDBACK - Stacked Below Combo */}
            <AnimatePresence>
                {feedback && !isGameOver && ( 
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="answer-feedback"
                        style={{ 
                            marginTop: '0.5rem',
                            textAlign: 'left',
                            fontFamily: "'Orbitron', sans-serif",
                            zIndex: 200,
                            pointerEvents: 'none'
                        }}
                    >
                        {feedback.type === 'CORRECT' ? (
                           // CORRECT: Green Text
                           <div style={{ color: '#00ff00', fontSize: '2rem', textShadow: '0 0 10px #00ff00' }}>
                               CORRECT: {feedback.text}
                           </div>
                        ) : feedback.type === 'MISSED' ? (
                           // MISSED: Purple Text (User Request)
                           <div style={{ color: '#D000FF', fontSize: '2rem', textShadow: '0 0 10px #D000FF' }}>
                               {feedback.text}
                           </div>
                        ) : (
                           // WRONG: Red Selection + Green Correction
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                               <div style={{ color: '#ff0000', fontSize: '1.8rem', textShadow: '0 0 10px #ff0000' }}>
                                   YOU CHOSE: {feedback.text}
                               </div>
                               <div style={{ color: '#00ff00', fontSize: '1.5rem', textShadow: '0 0 8px #00ff00' }}>
                                   ANSWER: {feedback.correctText}
                               </div>
                           </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </div>

      {/* Main Menu */}
      {!isPlaying && !isGameOver && (
        <div className="main-menu">
            <h1 className="title-main">
                <span className="text-cyan">STUDY</span>
                <span className="text-magenta">SABER</span>
            </h1>
            
            <button 
                onClick={startGame}
                className="start-btn"
            >
                <div className="btn-text">START GAME</div>
            </button>
        </div>
      )}

      {/* Game Over */}
      {isGameOver && (
        <div className="game-over">
            <h2 className="stat-value" style={{ marginBottom: '1rem' }}>COMPLETE</h2>
            <div className="text-cyan stat-value" style={{ fontSize: '4rem', marginBottom: '3rem' }}>
                {score.toLocaleString()}
            </div>
            
            <div className="action-buttons">
                <button 
                    onClick={() => useGameStore.getState().triggerRestart()}
                    className="btn-primary"
                >
                    PLAY AGAIN
                </button>
                <Link to="/" className="btn-secondary" style={{ pointerEvents: 'auto' }}>
                    EXIT
                </Link>
            </div>
        </div>
      )}
      
      {/* Game Timer (Bottom Left) */}
      <GameTimer />
    </div>
  )
}

import { useEffect, useState } from 'react'
function GameTimer() {
    const { isPlaying, isPaused, audioContext, audioStartTime } = useGameStore()
    const [timeStr, setTimeStr] = useState("0:00")
    
    useEffect(() => {
        let frameId: number
        
        const update = () => {
            if (isPlaying && !isPaused && audioContext) {
                const now = audioContext.currentTime - audioStartTime
                // Ensure non-negative
                const safeTime = Math.max(0, now)
                
                const mins = Math.floor(safeTime / 60)
                const secs = Math.floor(safeTime % 60)
                
                setTimeStr(`${mins}:${secs.toString().padStart(2, '0')}`)
                frameId = requestAnimationFrame(update)
            } else {
                 // If paused/stopped, don't update loop but keep current display?
                 // Or loop slowly to catch resume?
                 // Better: Dependency on isPaused handles re-trigger.
            }
        }
        
        if (isPlaying && !isPaused) {
            update()
        }
        
        return () => cancelAnimationFrame(frameId)
    }, [isPlaying, isPaused, audioContext, audioStartTime])
    
    if (!isPlaying) return null

    return (
        <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '1.5rem',
            color: '#00ffff',
            textShadow: '0 0 10px #00ffff',
            background: 'rgba(0,0,0,0.5)',
            padding: '10px 20px',
            borderRadius: '10px',
            border: '1px solid #00ffff',
            zIndex: 100
        }}>
            {timeStr}
        </div>
    )
}
