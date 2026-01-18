import { guess } from 'web-audio-beat-detector';

export interface AudioAnalysisData {
  metadata: {
    duration: number;
    bpm: number;
    totalBeats: number;
  };
  beats: number[]; // Array of absolute timestamps (in seconds)
}

export async function analyzeAudio(arrayBuffer: ArrayBuffer, fallbackBpm?: number): Promise<AudioAnalysisData> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  let audioBuffer: AudioBuffer;
  
  try {
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error("Error decoding audio:", error);
    throw new Error("Failed to decode audio file. Please ensure it's a valid audio format.");
  }

  // Check if audio has valid data
  if (!audioBuffer || audioBuffer.length === 0 || audioBuffer.duration === 0) {
    console.warn("Audio buffer is empty or invalid");
    throw new Error("Audio file appears to be empty or invalid");
  }

  try {
    const { bpm, offset } = await guess(audioBuffer);
    
    // Sanity check BPM or normalize if needed
    const validBpm = bpm && bpm > 0 ? bpm : (fallbackBpm || 120);
    const validOffset = offset && offset >= 0 ? offset : 0;

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
    // Fallback: Use fallback BPM or default to 120
    const fallbackBpmValue = fallbackBpm || 120;
    console.warn("Beat detection failed, using fallback BPM:", fallbackBpmValue, error);
    
    const beatDuration = 60 / fallbackBpmValue;
    const beats: number[] = [];
    
    // Generate beats at regular intervals
    let currentTime = 0;
    while (currentTime < audioBuffer.duration) {
      beats.push(currentTime);
      currentTime += beatDuration;
    }

    return {
      metadata: {
        duration: audioBuffer.duration,
        bpm: fallbackBpmValue,
        totalBeats: beats.length,
      },
      beats,
    };
  }
}
