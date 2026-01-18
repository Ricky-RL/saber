// --- GAME VISUAL & TIMING CONFIGURATION ---

// 1. GAME SPEED
// Controls how fast blocks move towards the player.
// Higher = Faster blocks, but they spawn further away to keep timing consistent.
// 20 is "Moderate/Fast". 
export const GAME_SPEED = 35;

// 2. SPAWN PREVIEW
// How many seconds *before* the beat a block spawns.
// Affects visual spawn distance. Distance = SPEED * TIME.
export const SPAWN_PREVIEW_TIME = 2.0;

// 3. HIT WINDOW (Z-Axis)
// The depth range where a hit is counted.
export const HIT_WINDOW_Z_MIN = -0.5; // Closest to player
export const HIT_WINDOW_Z_MAX = -2.5; // Furthest from player
export const DEFAULT_HIT_THRESHOLD = 0.8; // Tolerance size

// 4. MCQ STREAM TIMING
// Time delay between consecutive blocks in a stream.
// 1.6s = Approx 3 beats at 110BPM. (Reduced from 2.0s per request)
export const STREAM_SPAWN_OFFSET = 1.6;

// 5. MCQ BUFFERS (levelGenerator.ts)
// How long to wait AFTER the last block before declaring the question "done".
export const MCQ_QUESTION_BUFFER = 1.0; 

// 6. INTERVAL SPACER (Dynamic Director)
// Minimum time to wait AFTER a question finishes before looking for the next beat.
export const DYNAMIC_SPAWN_SPACER = 2.0; // Increased to 2.0s (User Request: "Too fast")

// 7. COLUMNS
// X-positions for the 4 tracks.
// Extra Wide spread: [-3.5, -1.5, 1.5, 3.5]
export const COLUMN_POSITIONS = [-3.5, -1.5, 1.5, 3.5];
