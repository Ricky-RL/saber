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
  Phone,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/Auth';
import LoginModal from '../components/LoginModal';

interface Document {
  id: string;
  name: string;
  questions: number;
  created_at?: string;
}

export default function Extension() {
  const [activeTab, setActiveTab] = useState<'pomodoro' | 'recall'>('pomodoro');
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);

  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [isBreak, setIsBreak] = useState(false);
  
  const { user } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const handleCallClick = async (doc: Document) => {
    const frontendUrl = import.meta.env.VITE_FRONTEND_URL || "http://localhost:5173";
    window.open(`${frontendUrl}?callDocId=${doc.id}`, '_blank');
  };

  useEffect(() => {
    if (activeTab === 'recall' && user) {
      fetchDocuments();
    }
  }, [activeTab, user]);

  const fetchDocuments = async () => {
    try {
      setLoadingDocs(true);
      
      if (user) {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10); // Limit nicely for extension

        if (error) throw error;
        
        if (data) {
          setDocuments(data.map(doc => ({
            id: doc.id,
            name: doc.name,
            questions: doc.questions || 0,
            created_at: doc.created_at
          })));
        }
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
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
              href={import.meta.env.VITE_FRONTEND_URL || "http://localhost:5173"} 
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
              Study
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
                {!user ? (
                   <div className="flex flex-col items-center justify-center h-[300px] text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-pink/20 flex items-center justify-center mb-4">
                        <BookOpen className="w-8 h-8 text-neon-pink" />
                      </div>
                      <h3 className="font-display font-bold text-lg mb-2">Login Required</h3>
                      <p className="text-sm text-muted-foreground mb-6 max-w-[200px]">
                        Sign in to access your documents and start studying.
                      </p>
                      <button
                        onClick={() => setIsLoginModalOpen(true)}
                        className="px-6 py-2 rounded-lg bg-white text-black font-ui font-medium hover:bg-gray-200 transition-colors"
                      >
                        Sign In
                      </button>
                   </div>
                ) : (
                  <div className="flex flex-col h-[420px]">
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 mb-4">
                      {loadingDocs ? (
                        <div className="text-center py-10 text-muted-foreground">
                          <p className="animate-pulse">Loading documents...</p>
                        </div>
                      ) : documents.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            <p>No documents found.</p>
                            <p className="text-xs mt-2">Upload documents in the main app to see them here.</p>
                        </div>
                      ) : (
                        documents.map((doc, index) => {
                          return (
                            <motion.div
                              key={doc.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className="glass-card rounded-xl p-4 border border-white/10 hover:border-neon-magenta/50 transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-ui font-semibold text-sm truncate text-foreground">
                                    {doc.name}
                                  </h3>
                                </div>

                                <motion.button
                                  onClick={() => handleCallClick(doc)}
                                  className="p-2 rounded-lg text-muted-foreground hover:text-green-400 hover:bg-green-400/10 transition-colors"
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  title="Call Avatar"
                                >
                                  <Phone className="w-4 h-4" />
                                </motion.button>

                                <a 
                                  href={`${import.meta.env.VITE_FRONTEND_URL || "http://localhost:5173"}/game?documentId=${doc.id}&mode=auto`}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                >
                                  <motion.button
                                    className="p-2 rounded-lg bg-neon-magenta/10 text-neon-magenta hover:bg-neon-magenta/20 transition-colors"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    title="Play Single"
                                  >
                                    <Play className="w-4 h-4" />
                                  </motion.button>
                                </a>
                              </div>
                            </motion.div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>


      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />
    </div>
  );
}
