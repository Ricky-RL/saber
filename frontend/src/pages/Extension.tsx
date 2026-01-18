import { useState, useEffect } from 'react';
// import { Link } from 'wouter'; // Replaced with anchor tags for extension
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Timer,
  BookOpen,
  Play,
  Pause,
  RotateCcw,
  Upload,
  Gamepad2,
  MessageCircle,
  Mic,
  MicOff,
  X,
} from 'lucide-react';

export default function Extension() {
  const [activeTab, setActiveTab] = useState<'pomodoro' | 'recall'>('pomodoro');
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [isBreak, setIsBreak] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  /* State for file upload checking */
  const [hasFile, setHasFile] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsBreak(!isBreak);
      setTimeLeft(isBreak ? workDuration * 60 : breakDuration * 60);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, isBreak, workDuration, breakDuration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(workDuration * 60);
    setIsBreak(false);
  };

  const toggleRecording = () => {
    if (!isRecording) {
      setIsRecording(true);
      setTimeout(() => {
        setCurrentTranscript("What is the main function of mitochondria in a cell?");
        setTimeout(() => {
          setIsRecording(false);
          setChatMessages(prev => [
            ...prev,
            { role: 'user', text: "What is the main function of mitochondria in a cell?" },
            { role: 'assistant', text: "The mitochondria is often called the 'powerhouse of the cell.' Its main function is to produce ATP (adenosine triphosphate) through cellular respiration. ATP is the primary energy currency that powers most cellular processes." }
          ]);
          setCurrentTranscript('');
        }, 2000);
      }, 1500);
    } else {
      setIsRecording(false);
      setCurrentTranscript('');
    }
  };

  const progress = isBreak 
    ? ((breakDuration * 60 - timeLeft) / (breakDuration * 60)) * 100
    : ((workDuration * 60 - timeLeft) / (workDuration * 60)) * 100;

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col items-center bg-background">
      <div className="absolute inset-0 grid-lines opacity-30" />
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-neon-purple/20 rounded-full blur-[100px]" />

      <div className="relative z-10 w-full max-w-[380px] flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 mt-2">
            <a 
              href={import.meta.env.VITE_FRONTEND_URL || "http://localhost:8000"} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-magenta flex items-center justify-center">
                <Zap className="w-5 h-5 text-background" />
              </div>
              <span className="font-display text-lg font-bold">
                <span className="text-neon-cyan">STUDY</span>
                <span className="text-neon-magenta">SABER</span>
              </span>
            </a>
            <motion.button
              data-testid="button-chatbot"
              onClick={() => setShowChatbot(true)}
              className="p-2 rounded-lg bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30 transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <MessageCircle className="w-5 h-5" />
            </motion.button>
        </div>

        <motion.div
          className="flex-1 flex flex-col w-full"
        >

          <div className="flex border-b border-border">
            <button
              data-testid="tab-pomodoro"
              onClick={() => setActiveTab('pomodoro')}
              className={`flex-1 py-3 px-4 font-ui font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                activeTab === 'pomodoro'
                  ? 'bg-neon-cyan/10 text-neon-cyan border-b-2 border-neon-cyan'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Timer className="w-4 h-4" />
              Pomodoro
            </button>
            <button
              data-testid="tab-recall"
              onClick={() => setActiveTab('recall')}
              className={`flex-1 py-3 px-4 font-ui font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                activeTab === 'recall'
                  ? 'bg-neon-magenta/10 text-neon-magenta border-b-2 border-neon-magenta'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Active Recall
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'pomodoro' && (
              <motion.div
                key="pomodoro"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-6"
              >
                <div className="text-center mb-6">
                  <p className={`font-display text-sm mb-2 ${isBreak ? 'text-green-400' : 'text-neon-cyan'}`}>
                    {isBreak ? 'BREAK TIME' : 'FOCUS TIME'}
                  </p>
                  <div className="relative w-48 h-48 mx-auto mb-4">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-muted/30"
                      />
                      <motion.circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="url(#gradient)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 45}`}
                        strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                        className="drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="hsl(var(--neon-cyan))" />
                          <stop offset="100%" stopColor="hsl(var(--neon-magenta))" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-display text-4xl font-bold text-foreground">
                        {formatTime(timeLeft)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center gap-3 mb-6">
                  <motion.button
                    data-testid="button-toggle-timer"
                    onClick={() => setIsRunning(!isRunning)}
                    className={`p-4 rounded-full ${
                      isRunning 
                        ? 'bg-neon-pink/20 text-neon-pink hover:bg-neon-pink/30' 
                        : 'bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30'
                    } transition-colors`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </motion.button>
                  <motion.button
                    data-testid="button-reset-timer"
                    onClick={resetTimer}
                    className="p-4 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <RotateCcw className="w-6 h-6" />
                  </motion.button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-2">Work (min)</label>
                    <input
                      data-testid="input-work-duration"
                      type="number"
                      value={workDuration}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 25;
                        setWorkDuration(val);
                        if (!isBreak && !isRunning) setTimeLeft(val * 60);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-input border border-border focus:border-neon-cyan outline-none font-ui text-center"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-2">Break (min)</label>
                    <input
                      data-testid="input-break-duration"
                      type="number"
                      value={breakDuration}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 5;
                        setBreakDuration(val);
                        if (isBreak && !isRunning) setTimeLeft(val * 60);
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-input border border-border focus:border-neon-cyan outline-none font-ui text-center"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'recall' && (
              <motion.div
                key="recall"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-6"
              >
                <div 
                  className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 transition-colors cursor-pointer ${
                    hasFile 
                      ? 'border-neon-cyan bg-neon-cyan/5' 
                      : 'border-border hover:border-neon-magenta/50'
                  }`}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <input 
                    type="file" 
                    id="file-upload" 
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setHasFile(true);
                        console.log(e.target.files);
                      }
                    }} 
                  />
                  <Upload className={`w-10 h-10 mx-auto mb-3 ${hasFile ? 'text-neon-cyan' : 'text-muted-foreground'}`} />
                  <p className={`font-ui text-sm ${hasFile ? 'text-neon-cyan font-bold' : 'text-muted-foreground'}`}>
                    {hasFile ? 'File Uploaded!' : 'Drop your notes here or click to upload'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    PDF, DOCX, TXT supported
                  </p>
                </div>

                {/* ... existing card code ... */}

                <div className="space-y-3 mb-6">
                  {/* ... */}
                </div>

                <a 
                  href={hasFile ? `${import.meta.env.VITE_FRONTEND_URL || "http://localhost:8000"}/game` : undefined}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={!hasFile ? "pointer-events-none cursor-not-allowed" : ""}
                >
                  <motion.button
                    data-testid="button-start-game"
                    disabled={!hasFile}
                    className={`w-full py-4 rounded-xl font-display font-bold flex items-center justify-center gap-3 transition-all ${
                      hasFile 
                        ? 'bg-gradient-to-r from-neon-magenta to-neon-pink text-background' 
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                    whileHover={hasFile ? { scale: 1.02 } : {}}
                    whileTap={hasFile ? { scale: 0.98 } : {}}
                  >
                    <Gamepad2 className="w-5 h-5" />
                    LAUNCH STUDYSABER
                  </motion.button>
                </a>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence>
        {showChatbot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end justify-center pb-4"
          >
            <div 
              className="absolute inset-0 bg-background/60 backdrop-blur-sm"
              onClick={() => setShowChatbot(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="relative w-full max-w-[350px] px-2"
            >
              <div className="glass-card rounded-3xl p-6 border border-neon-purple/50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-purple to-neon-pink flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-background" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-neon-purple">STUDY ASSISTANT</h3>
                      <p className="text-xs text-muted-foreground">Voice-enabled AI helper</p>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => setShowChatbot(false)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </motion.button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-3 mb-4">
                  {chatMessages.map((msg, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-xl ${
                        msg.role === 'user'
                          ? 'bg-neon-cyan/10 ml-8 border border-neon-cyan/30'
                          : 'bg-neon-purple/10 mr-8 border border-neon-purple/30'
                      }`}
                    >
                      <p className="text-sm font-ui">{msg.text}</p>
                    </motion.div>
                  ))}
                  
                  {currentTranscript && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-3 rounded-xl bg-neon-cyan/10 ml-8 border border-neon-cyan/30"
                    >
                      <p className="text-sm font-ui text-neon-cyan">{currentTranscript}</p>
                      <span className="inline-block w-2 h-4 bg-neon-cyan animate-pulse ml-1" />
                    </motion.div>
                  )}
                </div>

                <div className="flex items-center justify-center">
                  <motion.button
                    data-testid="button-voice-input"
                    onClick={toggleRecording}
                    className={`p-6 rounded-full transition-all ${
                      isRecording
                        ? 'bg-neon-pink text-background animate-pulse box-glow-pink'
                        : 'bg-neon-purple/20 text-neon-purple hover:bg-neon-purple/30'
                    }`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {isRecording ? (
                      <MicOff className="w-8 h-8" />
                    ) : (
                      <Mic className="w-8 h-8" />
                    )}
                  </motion.button>
                </div>
                
                <p className="text-center text-xs text-muted-foreground mt-3">
                  {isRecording ? 'Listening... tap to stop' : 'Tap to start voice input'}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
