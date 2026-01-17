import { useEffect, useState } from 'react'
import { useGameStore } from './GameManager'

interface CalibrationOverlayProps {
    onComplete: () => void
}

export const CalibrationOverlay = ({ onComplete }: CalibrationOverlayProps) => {
    const { leftHandPos, rightHandPos } = useGameStore()
    const [leftReady, setLeftReady] = useState(false)
    const [rightReady, setRightReady] = useState(false)

    // Calibration Zones (0-1 coordinates)
    // Left Hand Target: Bottom Left (or Top Left? Let's say Bottom Left for "Ready" stance, or Corners)
    // Let's use Top Corners for "Reach" validation.
    // Video is mirrored:
    // Screen Left (x=0) is "Right" in Camera? No, HandTracker sends raw.
    // CSS mirror flips it.
    // If I reach Top Left of Screen:
    // - My Left Hand physically.
    // - Camera sees hand on Right side of image? (If I face camera, my Left is Camera Right).
    // - MediaPipe "Left" hand. x coordinate > 0.5?
    
    // Let's rely on OBSERVATION from previous steps (HandTracker uses raw coords).
    // If we assume HandTracker outputs normalized [0,1].
    // If x=0 is one edge, x=1 is other.
    // If I reach "Left" on screen (visual).
    // Ideally we just check extreme values.
    
    // Target: < 0.2 and > 0.8
    const TARGET_EDGE = 0.15 
    
    useEffect(() => {
        // Check Left Hand (Pink) -> Should be on Left side (x < TARGET_EDGE)
        if (leftHandPos) {
            if (leftHandPos.x < TARGET_EDGE || leftHandPos.x > (1 - TARGET_EDGE)) {
                // Determine WHICH side it is on?
                // Usually Left Hand is on Left Side (x < 0.5 if mirrored correctly).
                // Let's just check if it's "Far" enough.
                if (leftHandPos.x < 0.2) setLeftReady(true) // Assuming x=0 is left
            } else {
                 setLeftReady(false)
            }
        }

        // Check Right Hand (Cyan) -> Right Side (x > 0.8)
        if (rightHandPos) {
            if (rightHandPos.x > 0.8) setRightReady(true)
            else setRightReady(false)
        }
    }, [leftHandPos, rightHandPos])

    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', padding: '20px', boxSizing: 'border-box',
            zIndex: 20, pointerEvents: 'none',
            background: 'rgba(0,0,0,0.4)'
        }}>
            {/* Header */}
            <div style={{ textAlign: 'center', color: '#fff', textShadow: '0 0 10px black', marginTop: '50px' }}>
                <h1 style={{ fontFamily: 'Orbitron' }}>CALIBRATION</h1>
                <p>Step back until you can reach the target boxes with your hands.</p>
                <p>Ensure your environment is well lit.</p>
            </div>

            {/* Targets Container */}
            <div style={{ position: 'absolute', top: '50%', left: 0, width: '100%', height: '50%', transform: 'translateY(-50%)' }}>
                {/* Left Target (Pink) */}
                <div style={{
                    position: 'absolute', 
                    left: '5%', top: '30%',
                    width: '150px', height: '150px',
                    border: `4px solid ${leftReady ? '#00ff00' : '#ff00ff'}`,
                    borderRadius: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: leftReady ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,255,0.1)',
                    transition: 'all 0.3s'
                }}>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>LEFT HAND</span>
                </div>

                {/* Right Target (Cyan) */}
                <div style={{
                    position: 'absolute', 
                    right: '5%', top: '30%',
                    width: '150px', height: '150px',
                    border: `4px solid ${rightReady ? '#00ff00' : '#00ffff'}`,
                    borderRadius: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: rightReady ? 'rgba(0,255,0,0.2)' : 'rgba(0,255,255,0.1)',
                    transition: 'all 0.3s'
                }}>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>RIGHT HAND</span>
                </div>
            </div>

            {/* Confirmation */}
            <div style={{ textAlign: 'center', marginBottom: '50px', pointerEvents: 'auto' }}>
                <button 
                    disabled={!leftReady && !rightReady} // Allow loose calibration (at least one hand or manually skip)
                    onClick={onComplete}
                    style={{
                        padding: '15px 40px',
                        fontSize: '1.5em',
                        background: (leftReady && rightReady) ? '#00ff00' : '#333',
                        color: (leftReady && rightReady) ? '#000' : '#888',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontFamily: 'Orbitron'
                    }}
                >
                    {leftReady && rightReady ? "START GAME" : "CALIBRATE..."}
                </button>
                {/* SKIP option */}
                <div style={{ marginTop: '10px' }}>
                    <button onClick={onComplete} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', textDecoration: 'underline' }}>
                        Skip Calibration
                    </button>
                </div>
            </div>
        </div>
    )
}
