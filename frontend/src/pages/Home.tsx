import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/Auth';
import { supabase } from '../supabaseClient'; // Added import for supabase
import LoginModal from '../components/LoginModal';
import { 
  Zap, 
  FileText, 
  Target,
  ChevronRight,
  Gamepad2,
  Play,
  Clock,
  User
} from 'lucide-react';

/*
const recentDocsDummy = [
  { id: 1, name: 'Math Revision', questions: 10, lastStudied: '2 days ago' },
  { id: 2, name: 'Science Quiz', questions: 8, lastStudied: '1 week ago' },
  { id: 3, name: 'History Facts', questions: 5, lastStudied: '2 weeks ago' },
  { id: 4, name: 'Chemistry Review', questions: 15, lastStudied: '3 days ago' },
];
*/

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  
  return Math.floor(seconds) + " seconds ago";
};

const studyCalendar = (() => {
  // Generate 6 months of data
  const months = [];
  for (let m = 0; m < 6; m++) {
    const days = [];
    // 4 weeks * 7 days = 28 days per block for clean grid
    for (let i = 0; i < 28; i++) {
      const hasStudy = Math.random() > 0.4;
      const intensity = hasStudy ? Math.floor(Math.random() * 4) + 1 : 0;
      const gamesPlayed = hasStudy ? Math.floor(Math.random() * 10) + 1 : 0;
      days.push({ intensity, gamesPlayed });
    }
    months.push(days);
  }
  return months;
})();

const getIntensityColor = (intensity: number) => {
  switch (intensity) {
    case 0: return 'bg-muted/30';
    case 1: return 'bg-neon-purple/30';
    case 2: return 'bg-neon-purple/50';
    case 3: return 'bg-neon-pink/60';
    case 4: return 'bg-neon-pink/90 box-glow-pink';
    default: return 'bg-muted/30';
  }
};

interface Document {
  id: string; // Changed from number to string to match UUID
  name: string;
  questions: number;
  lastStudied?: string;
  created_at?: string;
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [recentDocs, setRecentDocs] = useState<Document[]>([]);

  useEffect(() => {
    const fetchRecentDocs = async () => {
      if (user) {
        try {
          const session = await supabase.auth.getSession();
          const token = session.data.session?.access_token;
          
          if (token) {
            const response = await fetch('http://127.0.0.1:8000/recent-documents', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              // Transform data to match UI, calculating 'lastStudied' if possible, or using created_at
             const transformedDocs = data.map((doc: any) => {
                const timeAgo = doc.last_interaction ? formatTimeAgo(doc.last_interaction) : 'Unknown';
                const action = doc.interaction_type === 'played' ? 'Played' : 'Uploaded';
                return {
                  id: doc.id,
                  name: doc.name,
                  questions: doc.questions || 0,
                  lastStudied: `${action} ${timeAgo}`
                };
              });
              setRecentDocs(transformedDocs);
            }
          }
        } catch (error) {
          console.error("Error fetching recent documents:", error);
        }
      }
    };

    fetchRecentDocs();
  }, [user]);

  const handleProfileClick = async () => {
    // Fire-and-forget call to backend logging
    if (user) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          fetch('http://127.0.0.1:8000/api/log-profile-visit', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          }).catch(err => console.error('Failed to log profile visit:', err));
        }
      });
      
      navigate('/profile');
    } else {
      setIsLoginModalOpen(true);
    }
  };
  const [hoveredDay, setHoveredDay] = useState<{ index: number; monthIndex: number; gamesPlayed: number; x: number; y: number } | null>(null);

  const handleMouseEnter = (monthIndex: number, dayIndex: number, gamesPlayed: number, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredDay({ 
      index: dayIndex, 
      monthIndex,
      gamesPlayed, 
      x: rect.left + rect.width / 2, 
      y: rect.top - 10 
    });
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  return (
    <div className="min-h-screen relative overflow-hidden text-foreground">
      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
      />
      <div className="absolute inset-0 grid-lines opacity-50" />
      
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-cyan/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-magenta/10 rounded-full blur-[100px]" />

      {/* Hover Tooltip */}
      <AnimatePresence>
        {hoveredDay && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ 
              position: 'fixed', 
              left: hoveredDay.x, 
              top: hoveredDay.y,
              transform: 'translate(-50%, -100%)',
              zIndex: 50
            }}
            className="pointer-events-none mb-2"
          >
            <div className="glass-card px-4 py-2 rounded-lg border-neon-cyan/50 box-glow-cyan bg-black/80 backdrop-blur-xl">
              <p className="font-display text-xs text-neon-cyan whitespace-nowrap">
                GAMES PLAYED: <span className="text-white font-bold text-sm ml-1">{hoveredDay.gamesPlayed}</span>
              </p>
            </div>
            {/* Arrow */}
            <div className="w-2 h-2 bg-neon-cyan/50 rotate-45 absolute left-1/2 -bottom-1 -translate-x-1/2" />
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <Link to="/">
          <motion.div 
            className="flex items-center gap-3 cursor-pointer"
            whileHover={{ scale: 1.02 }}
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-magenta flex items-center justify-center">
              <Zap className="w-6 h-6 text-background" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-wider">
              <span className="text-neon-cyan text-glow-cyan">STUDY</span>
              <span className="text-neon-magenta text-glow-magenta">SABER</span>
            </h1>
          </motion.div>
        </Link>

        <div className="flex items-center gap-4">
          <motion.button
            onClick={handleProfileClick}
            data-testid="button-profile"
            className="neon-button px-5 py-2.5 rounded-lg font-ui font-medium flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <User className="w-4 h-4" />
            {user ? (
              <span className="font-bold text-neon-cyan">
                {user.user_metadata?.full_name || user.email}
              </span>
            ) : 'Sign In'}
          </motion.button>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-8 py-8">
        <motion.section 
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="glass-card rounded-2xl p-8 border-glow-cyan">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-3xl font-bold text-neon-cyan text-glow-cyan mb-2">
                  DAILY CHALLENGE
                </h2>
                <p className="text-muted-foreground font-ui">
                  15 questions from your recent notes await
                </p>
              </div>
              <div className="flex items-center gap-3 text-neon-pink">
                <Target className="w-6 h-6" />
                <span className="font-display text-2xl">🔥 7 Day Streak</span>
              </div>
            </div>

            <div className="flex gap-4">
              {/* <Link to="/quiz" className="flex-1">
                <motion.button
                  data-testid="button-daily-quiz"
                  className="w-full bg-gradient-to-r from-neon-cyan/20 to-neon-blue/20 border-2 border-neon-cyan rounded-xl p-6 text-left hover:border-neon-cyan hover:box-glow-cyan transition-all"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-neon-cyan/20 flex items-center justify-center">
                      <FileText className="w-7 h-7 text-neon-cyan" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-bold text-neon-cyan mb-1">CLASSIC QUIZ</h3>
                      <p className="text-muted-foreground text-sm">Traditional MCQ format</p>
                    </div>
                  </div>
                </motion.button>
              </Link> */}

              <Link to="/game" className="flex-1">
                <motion.button
                  data-testid="button-daily-game"
                  className="w-full bg-gradient-to-r from-neon-magenta/20 to-neon-pink/20 border-2 border-neon-magenta rounded-xl p-6 text-left hover:border-neon-magenta hover:box-glow-magenta transition-all"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-neon-magenta/20 flex items-center justify-center">
                      <Gamepad2 className="w-7 h-7 text-neon-magenta" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl font-bold text-neon-magenta mb-1">STUDYSABER</h3>
                      <p className="text-muted-foreground text-sm">Slash through questions</p>
                    </div>
                  </div>
                </motion.button>
              </Link>
            </div>
          </div>
        </motion.section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.section 
            className="lg:col-span-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-foreground">
                RECENT DOCUMENTS
              </h2>
              <Link to="/profile">
                <span className="text-neon-cyan text-sm font-ui flex items-center gap-1 hover:text-glow-cyan cursor-pointer">
                  View All <ChevronRight className="w-4 h-4" />
                </span>
              </Link>
            </div>

            <div className="space-y-3">
              {recentDocs.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  data-testid={`card-document-${doc.id}`}
                  className="glass-card rounded-xl p-5 hover:border-neon-cyan/50 transition-all cursor-pointer group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  whileHover={{ x: 5 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-purple/30 to-neon-pink/30 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-neon-pink" />
                      </div>
                      <div>
                        <h3 className="font-ui font-semibold text-foreground group-hover:text-neon-cyan transition-colors">
                          {doc.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {doc.questions} questions • {doc.lastStudied}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* <Link to="/quiz">
                        <motion.button
                          data-testid={`button-review-${doc.id}`}
                          className="px-4 py-2 rounded-lg bg-neon-cyan/10 text-neon-cyan text-sm font-ui hover:bg-neon-cyan/20 transition-colors"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Review
                        </motion.button>
                      </Link> */}
                      <Link to="/game" state={{ mode: 'auto', documentId: doc.id }}>
                        <motion.button
                          data-testid={`button-play-${doc.id}`}
                          className="p-2 rounded-lg bg-neon-magenta/10 text-neon-magenta hover:bg-neon-magenta/20 transition-colors"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Play className="w-4 h-4" />
                        </motion.button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h2 className="font-display text-xl font-bold text-foreground mb-6">
              STUDY ACTIVITY
            </h2>
            
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground font-ui">Last 3 months</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Less</span>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className={`w-2.5 h-2.5 rounded-[2px] ${getIntensityColor(i)}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">More</span>
                </div>
              </div>
              
              {/* 
                CALENDAR STYLING GUIDE:
                - Layout: Flex container for separate month blocks.
                - Blocks: Each month is a grid (7 rows x N cols).
                - Cell Style: 'w-2.5 h-2.5' (size) 'rounded-[2px]' (shape).
                - Spacing: 'gap-4' between months, 'gap-[2px]' between cells.
              */}
              <div className="flex gap-4">
                {studyCalendar.map((month, mIndex) => (
                  <div key={mIndex} className="grid grid-rows-7 grid-flow-col gap-[2px]">
                    {month.map((day, dIndex) => (
                      <motion.div
                        key={`${mIndex}-${dIndex}`}
                        data-testid={`calendar-day-${mIndex}-${dIndex}`}
                        className={`w-2.5 h-2.5 rounded-[2px] ${getIntensityColor(day.intensity)} transition-all cursor-crosshair`}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: (mIndex * 30 + dIndex) * 0.005 }}
                        whileHover={{ scale: 1.4, zIndex: 10, borderColor: 'white', borderWidth: 1 }}
                        onMouseEnter={(e) => handleMouseEnter(mIndex, dIndex, day.gamesPlayed, e)}
                        onMouseLeave={handleMouseLeave}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="font-display text-xl font-bold text-neon-cyan">156</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Questions</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-xl font-bold text-neon-pink">87%</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Accuracy</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-xl font-bold text-neon-purple">x42</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Best Combo</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-5 mt-4">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-neon-cyan" />
                <h3 className="font-ui font-semibold">Quick Stats</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Study Time Today</span>
                  <span className="font-display text-neon-cyan">45 min</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Best Streak</span>
                  <span className="font-display text-neon-pink">🔥 14 days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Documents</span>
                  <span className="font-display text-neon-purple">12</span>
                </div>
                {/* Added Best Combo to Quick Stats as requested */}
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Best Combo</span>
                  <span className="font-display text-neon-cyan">x42</span>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
