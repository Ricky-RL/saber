import { useRef, useState } from 'react';
import AvatarComponent from '../components/Avatar';
import type { AvatarRef } from '../components/Avatar';

export default function Avatar() {
  const avatarRef = useRef<AvatarRef>(null);
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = async () => {
    if (!text.trim() || isSpeaking || !avatarRef.current) return;
    
    setIsSpeaking(true);
    try {
      await avatarRef.current.sayMessage(text);
    } finally {
      setIsSpeaking(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden text-foreground">
      <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-900">
        <div className="w-full max-w-2xl h-96 mb-4">
          <AvatarComponent ref={avatarRef} />
        </div>

        <div className="w-full max-w-2xl flex gap-4">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSpeak();
              }
            }}
            placeholder="Enter text to speak..."
            className="flex-1 px-4 py-2 bg-gray-800 text-white border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500"
            disabled={isSpeaking}
          />
          <button
            onClick={handleSpeak}
            disabled={isSpeaking || !text.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isSpeaking ? 'Speaking...' : 'Speak'}
          </button>
        </div>
      </div>
    </div>
  );
}
