import { useGameStore } from './GameManager'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import './UI.css'

export function UI() {
  const { score, combo, isPlaying, isGameOver, currentQuestionText, startGame } = useGameStore()
  const lastAnswer = useGameStore((state) => state.lastAnswer) // CALL HOOK HERE

  return (
    <div className="saber-ui">
      
      {/* HUD - Top */}
      <div className="hud-top">
        <div className="score-box">
            <h2 className="stat-value">{score.toLocaleString()}</h2>
            <p className="stat-label">SCORE</p>
        </div>

        {/* LAST ANSWER FEEDBACK */}
        <AnimatePresence>
            {lastAnswer && ( // USE VARIABLE HERE
                <motion.div 
                    initial={{ opacity: 0, scale: 0.5, x: -50 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 1.5 }}
                    className="answer-feedback"
                    style={{ 
                        position: 'absolute', 
                        top: '20px', 
                        left: '140px', // Right of Score
                        color: '#00ffff',
                        fontFamily: "'Orbitron', sans-serif", // Assume same font as checks
                        fontSize: '2rem',
                        textShadow: '0 0 10px cyan'
                    }}
                >
                    {lastAnswer}
                </motion.div>
            )}
        </AnimatePresence>

        <div className="combo-box">
            <h2 className="stat-value">x{combo}</h2>
            <p className="stat-label">COMBO</p>
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
                    onClick={startGame}
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
    </div>
  )
}
