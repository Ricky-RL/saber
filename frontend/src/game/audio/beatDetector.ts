import { guess } from 'web-audio-beat-detector';

export interface AudioAnalysisData {
  metadata: {
    duration: number;
    bpm: number;
    totalBeats: number;
  };
  beats: number[]; // Array of absolute timestamps (in seconds)
}

export async function analyzeAudio(arrayBuffer: ArrayBuffer): Promise<AudioAnalysisData> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  try {
    const { bpm, offset } = await guess(audioBuffer);
    
    // Sanity check BPM or normalize if needed
    // The library usually does a good job, but we can clamp or double/halve if needed.
    // For now, let's trust the library but ensure it's not zero.
    const validBpm = bpm || 120;
    const validOffset = offset || 0;

    const beatDuration = 60 / validBpm;
    const beats: number[] = [];
    
    // Reconstruct beat timestamps starting from offset
    let currentTime = validOffset;
    while (currentTime < audioBuffer.duration) {
      beats.push(currentTime);
      currentTime += beatDuration;
    }

    return {
      metadata: {
        duration: audioBuffer.duration,
        bpm: Math.round(validBpm),
        totalBeats: beats.length,
      },
      beats,
    };
  } catch (error) {
    console.error("Error detecting beats:", error);
    // Fallback: Return empty or basic structure
    return {
      metadata: {
        duration: audioBuffer.duration,
        bpm: 0,
        totalBeats: 0,
      },
      beats: [],
    };
  }
}
