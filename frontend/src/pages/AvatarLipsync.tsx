import { useState, useEffect, useRef } from 'react';

// TalkingHead is loaded from CDN via importmap in index.html
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TalkingHeadType = any;

// Use Ready Player Me URL with required morph targets for lip sync
// The morphTargets parameter is REQUIRED for lip sync to work
const AVATAR_URL = 'https://models.readyplayer.me/696c0b59b01cd8746d2eb787.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png';

// Helper to convert base64 to ArrayBuffer (fallback if TalkingHead method unavailable)
function b64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

const POSES = [
  { name: 'Idle', url: '/avatar_idle.fbx' },
  { name: 'Dance', url: '/avatar_dance.fbx' },
];

const MOODS = ['neutral', 'happy', 'angry', 'sad', 'fear', 'disgust', 'love', 'sleep'];

const ELEVEN_VOICES = [
  { id: 'G3zrXA9moYrFCgwBAvxJ', name: 'Vanessa (Default)' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh' },
];

export default function AvatarLipsync() {
  const containerRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<TalkingHeadType | null>(null);
  const elevenSocketRef = useRef<WebSocket | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedPose, setSelectedPose] = useState<string>('Idle');
  const [selectedMood, setSelectedMood] = useState<string>('neutral');
  const [selectedVoice, setSelectedVoice] = useState<string>(ELEVEN_VOICES[0].id);
  const [textInput, setTextInput] = useState<string>('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const initTalkingHead = async () => {
      if (!containerRef.current || headRef.current) return;

      try {
        // Dynamically import TalkingHead from CDN
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - CDN URL import resolved at runtime
        const module = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/gh/met4citizen/TalkingHead@1.7/modules/talkinghead.mjs');
        const TalkingHead = module.TalkingHead;
        
        const head = new TalkingHead(containerRef.current, {
          cameraView: 'upper',
          cameraZoomEnable: true,
          cameraPanEnable: true,
          avatarMood: 'neutral',
          lipsyncModules: ['en'],
          lipsyncLang: 'en',
          pcmSampleRate: 22050,
          mixerGainSpeech: 1.5,
        });

        await head.showAvatar({
          url: AVATAR_URL,
          body: 'F',
          avatarMood: 'neutral',
          lipsyncLang: 'en',
        });
        
        console.log('TalkingHead initialized successfully');
        console.log('TalkingHead methods available:', {
          streamStart: typeof head.streamStart,
          streamAudio: typeof head.streamAudio,
          streamNotifyEnd: typeof head.streamNotifyEnd,
          streamStop: typeof head.streamStop,
          speakAudio: typeof head.speakAudio,
        });
        console.log('Audio context state:', head.audioCtx?.state);
        
        // Check if avatar has morph targets for lip sync
        if (head.mtAvatar) {
          const hasVisemes = Object.keys(head.mtAvatar).some(key => 
            key.includes('viseme') || key.includes('Viseme') || 
            key.includes('mouth') || key.includes('jaw')
          );
          console.log('Avatar morph targets check:', {
            hasMorphTargets: !!head.mtAvatar,
            hasVisemes: hasVisemes,
            sampleKeys: Object.keys(head.mtAvatar || {}).slice(0, 10),
          });
        }

        headRef.current = head;
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing TalkingHead:', error);
        setIsLoading(false);
      }
    };

    initTalkingHead();

    return () => {
      if (elevenSocketRef.current) {
        elevenSocketRef.current.close();
      }
      if (headRef.current) {
        headRef.current.streamStop?.();
        headRef.current.dispose();
        headRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (headRef.current) {
      headRef.current.setMood(selectedMood);
    }
  }, [selectedMood]);

  const handlePoseSelect = async (pose: typeof POSES[0]) => {
    if (!headRef.current) return;
    setSelectedPose(pose.name);

    if (pose.url && headRef.current.playPose) {
      headRef.current.playPose(pose.url, null, 60);
    } else if (headRef.current.stopPose) {
      headRef.current.stopPose();
    }
  };

  const speakWithElevenLabs = async (text: string) => {
    if (!text.trim() || !headRef.current) return;

    setIsSpeaking(true);

    // Resume audio context if suspended (browser autoplay policy)
    if (headRef.current.audioCtx) {
      console.log('Audio context state before resume:', headRef.current.audioCtx.state);
      if (headRef.current.audioCtx.state === 'suspended') {
        await headRef.current.audioCtx.resume();
        console.log('Audio context state after resume:', headRef.current.audioCtx.state);
      }
    }

    // Clean up any existing connections
    if (elevenSocketRef.current) {
      elevenSocketRef.current.close();
      elevenSocketRef.current = null;
    }

    // Stop any existing stream before starting a new one
    try {
      headRef.current.streamStop();
    } catch {
      // Ignore errors if no stream was active
    }

    // Accumulate all words and timings across the stream
    const allWords: string[] = [];
    const allWtimes: number[] = [];
    const allWdurations: number[] = [];
    let timeOffset = 0;

    try {
      // Start streaming mode on TalkingHead
      console.log('Starting stream, audioCtx state:', headRef.current.audioCtx?.state);
      headRef.current.streamStart(
        { sampleRate: 22050, lipsyncLang: 'en', lipsyncType: 'words' },
        () => console.log('Audio started'),
        () => {
          console.log('Audio ended');
          setIsSpeaking(false);
        }
      );
      console.log('Stream started successfully');

      const jwtResponse = await fetch('/app/jwt/get', { cache: 'no-store' });
      if (!jwtResponse.ok) throw new Error('Failed to get JWT');
      const { jwt } = await jwtResponse.json();

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/elevenlabs/${jwt}/v1/text-to-speech/${selectedVoice}/stream-input?model_id=eleven_multilingual_v2&output_format=pcm_22050`;

      const socket = new WebSocket(wsUrl);
      elevenSocketRef.current = socket;

      socket.onopen = () => {
        // Send BOS (beginning of stream) message
        socket.send(JSON.stringify({
          text: ' ',
          voice_settings: { stability: 0.8, similarity_boost: true },
          generation_config: { chunk_length_schedule: [500, 500, 500, 500] },
        }));

        // Send the actual text
        socket.send(JSON.stringify({
          text: text,
          try_trigger_generation: false,
          flush: true,
        }));

        // Send empty text to signal end of input
        socket.send(JSON.stringify({ text: '' }));
      };

      socket.onmessage = (event) => {
        const r = JSON.parse(event.data);
        console.log('ElevenLabs message:', r);

        // Skip if head is no longer available
        if (!headRef.current) return;

        // Process alignment data when received - extract words and timings
        // Use normalizedAlignment if available (more accurate), otherwise use alignment
        const alignment = r.normalizedAlignment || r.alignment;
        
        if (alignment) {
          let word = '';
          let time = 0;
          let duration = 0;

          for (let i = 0; i < alignment.chars.length; i++) {
            if (word.length === 0) time = alignment.charStartTimesMs[i] + timeOffset;

            if (word.length && alignment.chars[i] === ' ') {
              allWords.push(word);
              allWtimes.push(time);
              allWdurations.push(duration);
              word = '';
              duration = 0;
            } else {
              duration += alignment.charDurationsMs[i];
              word += alignment.chars[i];
            }
          }

          if (word.length) {
            allWords.push(word);
            allWtimes.push(time);
            allWdurations.push(duration);
          }

          // Update time offset for next alignment chunk
          if (alignment.chars.length > 0) {
            const lastCharIndex = alignment.chars.length - 1;
            timeOffset = alignment.charStartTimesMs[lastCharIndex] + alignment.charDurationsMs[lastCharIndex];
          }
        }

        // Convert and stream audio chunk
        if (r.audio) {
          const arrayBuffer = headRef.current.b64ToArrayBuffer 
            ? headRef.current.b64ToArrayBuffer(r.audio) 
            : b64ToArrayBuffer(r.audio);
          
          const streamData: {
            audio: ArrayBuffer;
            words?: string[];
            wtimes?: number[];
            wdurations?: number[];
          } = {
            audio: arrayBuffer,
          };

          // Include accumulated words with audio chunks
          // Send words with first audio chunk that has alignment, or with all chunks if we have words
          if (allWords.length > 0) {
            streamData.words = [...allWords];
            streamData.wtimes = [...allWtimes];
            streamData.wdurations = [...allWdurations];
          }

          console.log('Streaming to TalkingHead:', {
            audioSize: streamData.audio.byteLength,
            wordsCount: streamData.words?.length || 0,
            hasWords: !!streamData.words,
          });
          
          try {
            headRef.current.streamAudio(streamData);
          } catch (err) {
            console.error('Error streaming audio:', err);
          }
        }

        // When we receive isFinal, signal end of stream
        if (r.isFinal) {
          console.log('Stream complete, notifying end. Total words:', allWords.length);
          try {
            headRef.current.streamNotifyEnd();
          } catch (err) {
            console.error('Error notifying stream end:', err);
            setIsSpeaking(false);
          }
          socket.close();
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        try {
          headRef.current?.streamStop();
        } catch {
          // Ignore
        }
        setIsSpeaking(false);
      };

      socket.onclose = () => {
        // Speaking state will be set to false by onAudioEnd callback
        // Add a fallback timeout in case the callback doesn't fire
        setTimeout(() => {
          setIsSpeaking((current) => {
            if (current) {
              console.log('Fallback: resetting speaking state');
            }
            return false;
          });
        }, 10000);
      };
    } catch (error) {
      console.error('Error with ElevenLabs:', error);
      headRef.current?.streamStop();
      setIsSpeaking(false);
    }
  };

  const handleSpeak = () => {
    speakWithElevenLabs(textInput);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          Avatar Lipsync
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Avatar Container */}
          <div className="lg:col-span-2">
            <div
              ref={containerRef}
              className="w-full aspect-video bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] rounded-2xl overflow-hidden border border-cyan-500/30 shadow-[0_0_30px_rgba(0,255,255,0.1)]"
              style={{ minHeight: '500px' }}
            >
              {isLoading && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-cyan-400 animate-pulse">Loading avatar...</div>
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-6">
            {/* Mood Selection */}
            <div className="bg-[#1a1a2e] p-5 rounded-xl border border-purple-500/20">
              <h3 className="text-lg font-semibold mb-4 text-purple-400">Mood</h3>
              <div className="grid grid-cols-2 gap-2">
                {MOODS.map((mood) => (
                  <button
                    key={mood}
                    onClick={() => setSelectedMood(mood)}
                    className={`px-3 py-2 rounded-lg capitalize transition-all ${
                      selectedMood === mood
                        ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.5)]'
                        : 'bg-[#252542] hover:bg-[#2f2f52] text-gray-300'
                    }`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>

            {/* Pose Selection */}
            <div className="bg-[#1a1a2e] p-5 rounded-xl border border-cyan-500/20">
              <h3 className="text-lg font-semibold mb-4 text-cyan-400">Pose</h3>
              <div className="grid grid-cols-2 gap-2">
                {POSES.map((pose) => (
                  <button
                    key={pose.name}
                    onClick={() => handlePoseSelect(pose)}
                    className={`px-3 py-2 rounded-lg transition-all ${
                      selectedPose === pose.name
                        ? 'bg-cyan-600 text-white shadow-[0_0_15px_rgba(0,255,255,0.5)]'
                        : 'bg-[#252542] hover:bg-[#2f2f52] text-gray-300'
                    }`}
                  >
                    {pose.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Selection */}
            <div className="bg-[#1a1a2e] p-5 rounded-xl border border-pink-500/20">
              <h3 className="text-lg font-semibold mb-4 text-pink-400">Voice</h3>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="w-full bg-[#252542] text-gray-200 px-4 py-3 rounded-lg border border-pink-500/30 focus:outline-none focus:border-pink-500"
              >
                {ELEVEN_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Text Input */}
        <div className="mt-8 bg-[#1a1a2e] p-6 rounded-xl border border-cyan-500/20">
          <h3 className="text-lg font-semibold mb-4 text-cyan-400">Text to Speak</h3>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Enter text to speak with lip sync..."
            className="w-full bg-[#252542] text-gray-200 px-4 py-3 rounded-lg border border-cyan-500/30 focus:outline-none focus:border-cyan-500 h-28 resize-none"
          />
          <div className="flex gap-4 mt-4">
            <button
              onClick={handleSpeak}
              disabled={isSpeaking || !textInput.trim()}
              className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                isSpeaking || !textInput.trim()
                  ? 'bg-gray-700 cursor-not-allowed text-gray-500'
                  : 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white shadow-[0_0_20px_rgba(0,255,255,0.3)]'
              }`}
            >
              {isSpeaking ? 'Speaking...' : 'Speak'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
