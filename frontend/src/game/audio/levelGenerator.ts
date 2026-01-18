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
    correctAnswerRaw?: string; // Fallback for display
  };
  // Legacy blocks structure
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
    beats?: number[]; // Added for Runtime Director
    questionsQueue?: QuestionData[]; // Added for Runtime Director
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

// IMPORT CENTRALIZED CONFIG
import { 
  STREAM_SPAWN_OFFSET, 
  MCQ_QUESTION_BUFFER
} from '../GameConfig'

export function generateLevel(audioData: AudioAnalysisData, passedQuestions: QuestionData[] = [], difficulty: Difficulty = 'EASY'): GameLevelData {
  
  // 1. Prepare Questions
  let questions = passedQuestions.length > 0 ? passedQuestions : PLACEHOLDER_QUESTIONS;
  
  // Randomize Questions
  // We double the list to ensure we have enough for a long song
  questions = [...questions, ...questions, ...questions]
      .sort(() => Math.random() - 0.5)
      .map(q => {
          // FORCE T/F PAIR (User Request: Revert to Floating Pair)
          if (q.type === 'TRUE_FALSE') {
              return { ...q, type: 'TRUE_FALSE_PAIR' }
          }
          return q
      });

  const levelData: GameLevelData = {
    metadata: {
      ...audioData.metadata || {},
      difficulty
    },
    timeline: [], // Kept for legacy compatibility, but will be empty
    beats: audioData.beats, // Pass beats for runtime director
    questionsQueue: questions // Pass full queue
  };

  return levelData;
}
