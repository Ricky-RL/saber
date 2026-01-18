import type { AudioAnalysisData } from './beatDetector';

// UPDATED TYPES (User Request: Variations + Bomb)
export interface QuestionData {
  id: string;
  type: 'TRUE_FALSE' | 'MCQ' | 'BOMB' | 'TRUE_FALSE_PAIR' | 'TRUE_FALSE_SPLIT';
  content: {
    questionText: string;
    answers?: {
        text: string;
        isCorrect: boolean;
    }[];
  };
  // Legacy blocks structure (optional/unused by new generator but kept for compat if needed)
  blocks?: any[]; 
}

export interface LevelEvent {
    timestamp: number;
    data: QuestionData; 
    spawned?: boolean; 
}

export interface GameLevelData {
    metadata: any;
    timeline: LevelEvent[];
}

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

// BIOLOGY QUESTIONS (User Request)
// True = Right, False = Left (as per User Request)
export const PLACEHOLDER_QUESTIONS: QuestionData[] = [
  {
      id: "bio_1",
      type: 'TRUE_FALSE',
      content: {
          questionText: "Mitochondria is the powerhouse of the cell",
          answers: [
              { text: "F", isCorrect: false }, // Left
              { text: "T", isCorrect: true }    // Right (Correct)
          ]
      }
  },
  {
      id: "bio_2",
      type: 'MCQ',
      content: {
          questionText: "What carries genetic info?",
          answers: [
              { text: "RNA", isCorrect: false },
              { text: "DNA", isCorrect: true },
              { text: "ATP", isCorrect: false },
              { text: "Lipid", isCorrect: false }
          ]
      }
  },
  {
      id: "bio_3",
      type: 'TRUE_FALSE',
      content: {
          questionText: "Ribosomes are found in the nucleus",
          answers: [
              { text: "F", isCorrect: true }, // Left (Correct)
              { text: "T", isCorrect: false }  // Right
          ]
      }
  },
  {
      id: "bio_4",
      type: 'MCQ',
      content: {
          questionText: "Cell division separator?",
          answers: [
              { text: "Prophase", isCorrect: false },
              { text: "Meta", isCorrect: false },
              { text: "Anaphase", isCorrect: true },
              { text: "Telo", isCorrect: false }
          ]
      }
  },
  {
      id: "bio_5",
      type: 'TRUE_FALSE',
      content: {
          questionText: "DNA is a double helix structure",
          answers: [
              { text: "F", isCorrect: false },
              { text: "T", isCorrect: true } // Right (Correct)
          ]
      }
  }
];

export function generateLevel(audioData: AudioAnalysisData, passedQuestions: QuestionData[] = [], difficulty: Difficulty = 'EASY'): GameLevelData {
  const levelData: GameLevelData = {
    metadata: {
      ...audioData.metadata || {},
      difficulty
    },
    timeline: []
  };

  // Use passed questions if available, otherwise fallback to placeholders (or empty)
  let questions = passedQuestions.length > 0 ? passedQuestions : PLACEHOLDER_QUESTIONS;
  
  // Randomize Questions (Shuffle)
  questions = [...questions].sort(() => Math.random() - 0.5);

  let questionIndex = 0;
  
  // Determine beat interval based on difficulty
  let beatInterval = 8;
  if (difficulty === 'MEDIUM') beatInterval = 4; // User Request: Higher density (Every 4th beat)
  if (difficulty === 'HARD') beatInterval = 2;

  // LIMIT TO 60 SECONDS (User Request)
  const MAX_DURATION = 60; 

  // Count valid beats to avoid infinite loop
  // const _validBeats = audioData.beats.filter(b => b >= 8.0 && b <= MAX_DURATION);

  for (let i = 0; i < audioData.beats.length; i += beatInterval) {
    const beatTime = audioData.beats[i];
    
    // Filter out beats < 2s (User Request: "2 seconds as the line")
    if (beatTime < 2.0) continue;

    // Strict cut-off
    if (beatTime > MAX_DURATION) break; 
    
    // Get question (Looping logic)
    // If we run out, reshuffle and start over? Or just simple modulo loop.
    // Simple modulo loop for now to ensure all Questions are used before repeating.
    const qIdx = questionIndex % questions.length;
    const question = questions[qIdx];
    
    // Determine Type Variation for True/False
    // Randomly choose between PAIR (Separate blocks) and SPLIT (Single block)
    let finalType = question.type;
    if (finalType === 'TRUE_FALSE') {
        finalType = 'TRUE_FALSE_PAIR'; // User Request: Only Pair variation
    }

    // Clone data to avoid mutating original
    const eventData = { ...question, type: finalType };

    levelData.timeline.push({
      timestamp: beatTime,
      data: eventData as QuestionData, 
      spawned: false
    });

    questionIndex++;
  }

  return levelData;
}
