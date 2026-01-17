import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Zap, 
  FileText, 
  Target,
  ChevronRight,
  Folder,
  Gamepad2,
  Play,
  Clock
} from 'lucide-react';

const recentDocs = [
  { id: 1, name: 'Biology Chapter 5', questions: 24, lastStudied: '2 hours ago' },
  { id: 2, name: 'Physics Formulas', questions: 18, lastStudied: '1 day ago' },
  { id: 3, name: 'History Notes', questions: 32, lastStudied: '2 days ago' },
  { id: 4, name: 'Chemistry Review', questions: 15, lastStudied: '3 days ago' },
];

const studyCalendar = (() => {
  const days = [];
  for (let i = 0; i < 91; i++) {
    const hasStudy = Math.random() > 0.4;
    const intensity = hasStudy ? Math.floor(Math.random() * 4) + 1 : 0;
    days.push(intensity);
  }
  return days;
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

export default function Home() {
  const [dailyQuizMode, setDailyQuizMode] = useState<'quiz' | 'game' | null>(null);

  return (
    <div className="min-h-screen relative overflow-hidden text-foreground">
      <div className="absolute inset-0 grid-lines opacity-50" />
      
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-neon-cyan/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-neon-magenta/10 rounded-full blur-[100px]" />

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
          <Link to="/profile">
            <motion.button
              data-testid="button-documents"
              className="neon-button px-5 py-2.5 rounded-lg font-ui font-medium flex items-center gap-2"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <Folder className="w-4 h-4" />
              Documents & History
            </motion.button>
          </Link>
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
              <Link to="/quiz" className="flex-1">
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
              </Link>

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
                      <Link to="/quiz">
                        <motion.button
                          data-testid={`button-review-${doc.id}`}
                          className="px-4 py-2 rounded-lg bg-neon-cyan/10 text-neon-cyan text-sm font-ui hover:bg-neon-cyan/20 transition-colors"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Review
                        </motion.button>
                      </Link>
                      <Link to="/game">
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
                      <div key={i} className={`w-3 h-3 rounded-sm ${getIntensityColor(i)}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">More</span>
                </div>
              </div>
              
              <div className="grid grid-cols-13 gap-1">
                {studyCalendar.map((intensity, index) => (
                  <motion.div
                    key={index}
                    data-testid={`calendar-day-${index}`}
                    className={`w-3 h-3 rounded-sm ${getIntensityColor(intensity)} transition-all hover:scale-150`}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.005 }}
                  />
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="font-display text-2xl font-bold text-neon-cyan">156</p>
                    <p className="text-xs text-muted-foreground">Questions Answered</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-2xl font-bold text-neon-pink">87%</p>
                    <p className="text-xs text-muted-foreground">Accuracy</p>
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
              </div>
            </div>
          </motion.section>
        </div>
      </main>
    </div>
  );
}
