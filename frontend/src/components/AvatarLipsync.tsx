import React, { useState, useEffect, useRef } from 'react';
import { TalkingHead } from '@met4citizen/talkinghead';

const TalkingHeadApp = () => {
  const [selectedPose, setSelectedPose] = useState(null);
  const [selectedMood, setSelectedMood] = useState('neutral');
  const [elevenVoice, setElevenVoice] = useState('21m00Tcm4TlvDq8ikWAM');
  const [textInput, setTextInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const headRef = useRef(null);
  const containerRef = useRef(null);
  const elevenSocketRef = useRef(null);

  const poses = [
    { name: 'Idle', url: null },
    { name: 'Talking', url: 'talking' },
    { name: 'Thinking', url: 'thinking' },
    { name: 'Presenting', url: 'presenting' }
  ];

  const moods = ['neutral', 'happy', 'sad', 'angry', 'surprised'];

  const elevenVoices = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh' }
  ];

  useEffect(() => {
    const initTalkingHead = async () => {
      if (!containerRef.current || headRef.current) return;

      try {
        const head = new TalkingHead(containerRef.current, {
          ttsEndpoint: "https://texttospeech.googleapis.com/v1/text:synthesize",
          cameraView: 'upper',
          avatarMood: 'neutral',
          lipsyncModules: ["en"]
        });

        await head.showAvatar({
          url: 'https://models.readyplayer.me/696c0b59b01cd8746d2eb787.glb',
          body: 'F',
          avatarMood: 'neutral',
          ttsLang: "en-GB",
          ttsVoice: "en-GB-Standard-A",
          lipsyncLang: 'en'
        });

        headRef.current = head;
      } catch (error) {
        console.error('Error initializing TalkingHead:', error);
      }
    };

    initTalkingHead();

    return () => {
      if (elevenSocketRef.current) {
        elevenSocketRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (headRef.current) {
      headRef.current.setMood(selectedMood);
    }
  }, [selectedMood]);

  const handlePoseSelect = async (pose) => {
    if (!headRef.current) return;
    
    setSelectedPose(pose.name);
    
    if (pose.url) {
      console.log('Pose selected:', pose.name);
    }
  };

  const speakWithElevenLabs = async (text) => {
    if (!text.trim() || !apiKey) {
      alert('Please enter text and API key');
      return;
    }

    setIsSpeaking(true);

    try {
      const url = `wss://api.elevenlabs.io/v1/text-to-speech/${elevenVoice}/stream-input?model_id=eleven_turbo_v2_5&output_format=pcm_22050`;
      
      const socket = new WebSocket(url);
      elevenSocketRef.current = socket;

      let audioQueue = [];
      let wordQueue = [];
      let timeQueue = [];
      let durationQueue = [];

      socket.onopen = () => {
        socket.send(JSON.stringify({
          text: " ",
          voice_settings: {
            stability: 0.8,
            similarity_boost: true
          },
          generation_config: {
            chunk_length_schedule: [500, 500, 500, 500]
          },
          xi_api_key: apiKey
        }));

        socket.send(JSON.stringify({
          text: text,
          try_trigger_generation: false,
          flush: true
        }));

        socket.send(JSON.stringify({
          text: ""
        }));
      };

      socket.onmessage = async (event) => {
        const response = JSON.parse(event.data);

        if (response.audio) {
          const binaryString = atob(response.audio);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          audioQueue.push(bytes.buffer);
        }

        if (response.alignment) {
          let word = '';
          let time = 0;
          let duration = 0;

          for (let i = 0; i < response.alignment.chars.length; i++) {
            if (word.length === 0) {
              time = response.alignment.charStartTimesMs[i];
            }
            
            if (word.length && response.alignment.chars[i] === ' ') {
              wordQueue.push(word);
              timeQueue.push(time);
              durationQueue.push(duration);
              word = '';
              duration = 0;
            } else {
              duration += response.alignment.charDurationsMs[i];
              word += response.alignment.chars[i];
            }
          }

          if (word.length) {
            wordQueue.push(word);
            timeQueue.push(time);
            durationQueue.push(duration);
          }
        }

        if (response.isFinal || response.normalizedAlignment) {
          if (headRef.current && audioQueue.length > 0) {
            await headRef.current.speakAudio({
              audio: audioQueue,
              words: wordQueue,
              wtimes: timeQueue,
              wdurations: durationQueue
            }, {
              lipsyncLang: 'en'
            });
          }
          socket.close();
          setIsSpeaking(false);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsSpeaking(false);
      };

      socket.onclose = () => {
        setIsSpeaking(false);
      };

    } catch (error) {
      console.error('Error with ElevenLabs:', error);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (headRef.current) {
      headRef.current.stopSpeaking();
    }
    if (elevenSocketRef.current) {
      elevenSocketRef.current.close();
    }
    setIsSpeaking(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Talking Head Demo</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div 
              ref={containerRef}
              className="w-full aspect-video bg-gray-800 rounded-lg overflow-hidden border-2 border-blue-500"
              style={{ minHeight: '500px' }}
            />
          </div>

          <div className="space-y-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">Mood</h3>
              <div className="grid grid-cols-2 gap-2">
                {moods.map(mood => (
                  <button
                    key={mood}
                    onClick={() => setSelectedMood(mood)}
                    className={`px-3 py-2 rounded capitalize ${
                      selectedMood === mood
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {mood}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">Pose</h3>
              <div className="grid grid-cols-2 gap-2">
                {poses.map(pose => (
                  <button
                    key={pose.name}
                    onClick={() => handlePoseSelect(pose)}
                    className={`px-3 py-2 rounded ${
                      selectedPose === pose.name
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {pose.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">ElevenLabs Voice</h3>
              <select
                value={elevenVoice}
                onChange={(e) => setElevenVoice(e.target.value)}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded"
              >
                {elevenVoices.map(voice => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">ElevenLabs API Key</h3>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Text to Speak</h3>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Enter text to speak..."
            className="w-full bg-gray-700 text-white px-3 py-2 rounded mb-3 h-24"
          />
          <div className="flex gap-3">
            <button
              onClick={() => speakWithElevenLabs(textInput)}
              disabled={isSpeaking || !apiKey}
              className={`px-6 py-2 rounded font-semibold ${
                isSpeaking || !apiKey
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSpeaking ? 'Speaking...' : 'Speak'}
            </button>
            <button
              onClick={stopSpeaking}
              disabled={!isSpeaking}
              className={`px-6 py-2 rounded font-semibold ${
                !isSpeaking
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Stop
            </button>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-gray-400">
          <p>Note: You need an ElevenLabs API key to use text-to-speech.</p>
          <p>Get one at: <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">elevenlabs.io</a></p>
        </div>
      </div>
    </div>
  );
};

export default TalkingHeadApp;
