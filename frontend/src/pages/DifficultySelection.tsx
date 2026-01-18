import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { Link } from 'react-router-dom';

type Difficulty = 'easy' | 'medium' | 'hard';

export default function DifficultySelection() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<Difficulty | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useCustomSong, setUseCustomSong] = useState(false); // Toggle for custom song generation (default: OFF - use default song)

  const handleDifficultySelect = async (difficulty: Difficulty) => {
    setLoading(difficulty);
    setError(null);

    // Navigate immediately to game page - audio will be generated in the background if toggle is on
    navigate('/game', {
      state: {
        difficulty: difficulty.toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD',
        isGeneratingAudio: useCustomSong, // Only generate if toggle is enabled
      },
    });
  };

  const getDifficultyColor = (difficulty: Difficulty) => {
    switch (difficulty) {
      case 'easy':
        return {
          bg: 'from-neon-cyan/20 to-neon-blue/20',
          border: 'border-neon-cyan',
          hoverBorder: 'hover:border-neon-cyan',
          glow: 'hover:box-glow-cyan',
          text: 'text-neon-cyan',
          iconBg: 'bg-neon-cyan/20',
        };
      case 'medium':
        return {
          bg: 'from-neon-magenta/20 to-neon-pink/20',
          border: 'border-neon-magenta',
          hoverBorder: 'hover:border-neon-magenta',
          glow: 'hover:box-glow-magenta',
          text: 'text-neon-magenta',
          iconBg: 'bg-neon-magenta/20',
        };
      case 'hard':
        return {
          bg: 'from-neon-pink/20 to-neon-red/20',
          border: 'border-neon-pink',
          hoverBorder: 'hover:border-neon-pink',
          glow: 'hover:box-glow-pink',
          text: 'text-neon-pink',
          iconBg: 'bg-neon-pink/20',
        };
    }
  };

  const difficulties: { value: Difficulty; label: string; description: string; bpm: number }[] = [
    { value: 'easy', label: 'EASY', description: '110 BPM - Perfect for beginners', bpm: 110 },
    { value: 'medium', label: 'MEDIUM', description: '130 BPM - Balanced challenge', bpm: 130 },
    { value: 'hard', label: 'HARD', description: '150 BPM - Maximum intensity', bpm: 150 },
  ];

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
      </nav>

      <main className="relative z-10 max-w-4xl mx-auto px-8 py-12">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-4xl font-bold mb-4">
            <span className="text-neon-cyan text-glow-cyan">SELECT</span>
            <span className="text-neon-magenta text-glow-magenta ml-2">DIFFICULTY</span>
          </h2>
          <p className="text-muted-foreground font-ui text-lg">
            Choose your challenge level. Toggle custom song generation below.
          </p>
        </motion.section>

        {/* Toggle for custom song generation */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center mb-8"
        >
          <div className="glass-card rounded-xl p-4 border-2 border-neon-cyan/50 bg-gradient-to-r from-neon-cyan/10 to-neon-magenta/10">
            <label className="flex items-center gap-4 cursor-pointer">
              <span className="text-foreground font-ui text-sm font-medium">
                Use custom AI-generated song
              </span>
              <div
                onClick={() => setUseCustomSong(!useCustomSong)}
                className={`
                  relative w-14 h-7 rounded-full transition-all duration-300
                  ${useCustomSong 
                    ? 'bg-gradient-to-r from-neon-cyan to-neon-magenta' 
                    : 'bg-gray-600'
                  }
                `}
              >
                <div
                  className={`
                    absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-all duration-300
                    ${useCustomSong ? 'translate-x-7' : 'translate-x-0'}
                    shadow-lg
                  `}
                />
              </div>
              <span className="text-muted-foreground font-ui text-xs">
                {useCustomSong ? 'ON' : 'OFF'}
              </span>
            </label>
            {!useCustomSong && (
              <p className="text-muted-foreground text-xs mt-2 text-center">
                Using default song from audio files
              </p>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {difficulties.map((diff, index) => {
            const colors = getDifficultyColor(diff.value);
            const isLoading = loading === diff.value;
            const isDisabled = loading !== null && !isLoading;

            return (
              <motion.button
                key={diff.value}
                onClick={() => handleDifficultySelect(diff.value)}
                disabled={isDisabled || isLoading}
                className={`
                  glass-card rounded-2xl p-8 text-left transition-all
                  bg-gradient-to-r ${colors.bg}
                  border-2 ${colors.border} ${colors.hoverBorder}
                  ${colors.glow}
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                whileHover={!isDisabled && !isLoading ? { scale: 1.02, y: -2 } : {}}
                whileTap={!isDisabled && !isLoading ? { scale: 0.98 } : {}}
              >
                <div className="flex flex-col items-center text-center">
                  <div className={`w-16 h-16 rounded-xl ${colors.iconBg} flex items-center justify-center mb-4`}>
                    {isLoading ? (
                      <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className={`font-display text-2xl font-bold ${colors.text}`}>
                        {diff.label.charAt(0)}
                      </span>
                    )}
                  </div>
                  
                  <h3 className={`font-display text-2xl font-bold mb-2 ${colors.text}`}>
                    {diff.label}
                  </h3>
                  
                  <p className="text-muted-foreground text-sm mb-2">
                    {diff.description}
                  </p>
                  
                  <div className={`text-xs font-ui ${colors.text} opacity-80`}>
                    {diff.bpm} BPM
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-4 border-2 border-red-500 bg-red-500/10"
          >
            <p className="text-red-400 text-center font-ui">{error}</p>
          </motion.div>
        )}

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mt-6"
          >
            <p className="text-neon-cyan font-ui">
              Generating your custom song...
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
