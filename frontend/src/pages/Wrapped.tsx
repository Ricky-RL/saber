import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/Auth';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { Zap, Trophy, Activity, ArrowRight, X, Music } from 'lucide-react';

import { HelloCube } from '../components/HelloCube';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

interface WrappedStats {
  has_data: boolean;
  year: number;
  total_games: number;
  total_score: number;
  avg_accuracy: number;
  best_accuracy: number;
  best_streak: number;
  top_score: number;
  most_active_day: string;
  global_avg_accuracy: number;
  accuracy_percentile: number;
  activity_percentile: number;
  total_spent?: number; // Optional, as it might not be in the backend yet
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const WrappedPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<WrappedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [slide, setSlide] = useState(0);
  const { width, height } = useWindowSize();

  const handlePrevSlide = () => setSlide((s: number) => Math.max(0, s - 1));
  const handleNextSlide = () => setSlide((s: number) => Math.min(slides.length - 1, s + 1));

  // Background pattern component
  const BackgroundPattern = () => (
    <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" style={{
      backgroundImage: `radial-gradient(circle, #808080 1px, transparent 1px)`,
      backgroundSize: '20px 20px'
    }}></div>
  );

  // Common wrapper for slides
  const SlideWrapper = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <div className={`flex flex-col items-center justify-center h-full px-12 relative z-10 w-full max-w-4xl mx-auto ${className}`}>
        {children}
    </div>
  );

  useEffect(() => {
    async function fetchWrapped() {
      if (!user) return;
      try {
        const res = await fetch(`${API_URL}/wrapped/${user.id}`);
        if (!res.ok) throw new Error("Failed to fetch wrapped");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchWrapped();
  }, [user]);

  if (loading) return <div className="min-h-screen bg-[#0E0E0E] flex items-center justify-center text-white font-mono">LOADING_DATA...</div>;

  if (!stats || !stats.has_data) {
    return (
      <div className="min-h-screen bg-[#0E0E0E] flex flex-col items-center justify-center text-white p-8 text-center font-mono">
        <h2 className="text-3xl font-bold mb-4">NO DATA FOUND</h2>
        <p className="text-gray-400 mb-8">INITIATE GAMEPLAY TO GENERATE METRICS</p>
        <button onClick={() => navigate('/profile')} className="border border-white/20 px-6 py-2 hover:bg-white/10 transition-colors uppercase">Return</button>
      </div>
    );
  }

  const slides = [
    // Intro
    <SlideWrapper className="bg-[#0e0e0e] text-center">
       <BackgroundPattern />
       
       <div className="w-full flex justify-between items-center mb-12 absolute top-12 left-0 px-12">
           <div className="flex items-center gap-2">
               <div className="w-6 h-6 bg-[#5865F2] rounded-full"></div>
               <span className="font-bold tracking-wider">SABER WRAPPED</span>
           </div>
           <X 
             className="cursor-pointer opacity-50 hover:opacity-100" 
             onClick={() => navigate('/profile')} 
           />
       </div>

       <div className="flex flex-row items-center justify-center gap-4 h-full w-full max-w-6xl"> 
            {/* Cube on Left */}
            <motion.div 
                initial={{ scale: 0.8, x: -100, opacity: 0 }} 
                animate={{ scale: 1, x: 0, opacity: 1 }} 
                transition={{ type: "spring", stiffness: 100 }}
                className="w-[60%] h-[800px] relative preserve-3d flex items-center justify-center"
            >
                <div className="absolute inset-0">
                    <Canvas camera={{ position: [0, 0, 7], fov: 45 }} gl={{ alpha: true }}>
                        <HelloCube 
                            playerName={user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || "Traveller"} 
                            primaryColor="#ff00ff" 
                            secondaryColor="#00f0ff"
                        />
                        <OrbitControls enableZoom={false} />
                    </Canvas>
                </div>
            </motion.div>

            {/* Text on Right */}
            <motion.div 
                initial={{ x: 50, opacity: 0 }} 
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-left z-10 w-[40%]"
            >
                <div className="flex items-center gap-2 mb-4 text-neon-pink text-glow-pink uppercase text-sm tracking-widest font-bold">
                    <Zap size={16} className="text-neon-pink drop-shadow-[0_0_10px_rgba(255,0,255,0.8)]" /> Total Games Played
                </div>
                <h1 className="text-9xl font-black mb-6 font-mono text-neon-pink text-glow-pink">{stats.total_games}</h1>
                <p className="text-2xl text-gray-300 font-medium max-w-md">Ready to review your performance?</p>
            </motion.div>
       </div>
    </SlideWrapper>,
    
    // Activity
    <SlideWrapper className="bg-[#111111]">
        <BackgroundPattern />
        <div className="absolute top-12 left-12 font-bold tracking-wider flex items-center gap-2 text-xl">
           <Music size={24} /> ACTIVITY
        </div>
        
        <div className="w-full flex items-center justify-center gap-20">
            <motion.div 
               initial={{ scale: 0 }} 
               animate={{ scale: 1 }} 
               className="w-96 h-96 rounded-full border border-dashed border-yellow-500/30 relative flex items-center justify-center flex-shrink-0"
            >
                <div className="w-3/4 h-3/4 rounded-full border border-dashed border-yellow-500/60 animate-[spin_10s_linear_infinite]" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                        <Activity className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
                        <div className="text-sm text-yellow-500 uppercase tracking-widest">Most Active</div>
                    </div>
                </div>
            </motion.div>

            <div className="text-left">
                <motion.h2 
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="text-8xl font-black text-neon-yellow text-glow-yellow mb-4 font-mono leading-none"
                >
                    {stats.most_active_day.toUpperCase().split(' ')[0]}
                </motion.h2>
                <p className="text-4xl font-bold mb-8 leading-tight">
                    Was your grind day. <br />
                    <span className="text-gray-400 text-xl font-normal block mt-4">You logged in more on {stats.most_active_day} than any other day.</span>
                </p>

                <div className="flex items-center gap-8 text-base text-gray-500 font-mono border-t border-gray-800 pt-8">
                    <span>🌐 GLOBAL</span>
                    <span>🏁 {stats.year}</span>
                    <span>⚡ ACTION</span>
                </div>
            </div>
        </div>
    </SlideWrapper>,

    // Performance / Comparison
    <SlideWrapper className="bg-[#000000]">
        <BackgroundPattern />
        <div className="absolute top-12 left-12 font-bold tracking-wider flex items-center gap-2 text-xl">
           <Trophy size={24} /> PERFORMANCE
        </div>

        <div className="w-full grid grid-cols-2 gap-20 items-center">
            <div className="relative">
                <div className="inline-block p-4 border border-green-500/30 rounded bg-green-500/10 text-green-400 font-mono text-sm mb-8">
                    TOP {100 - stats.accuracy_percentile}% PLAYER
                </div>

                <h2 className="text-7xl font-black mb-8 uppercase leading-tight">
                    Your<br/>
                    <span className="text-neon-green text-glow-green">Accuracy</span>
                </h2>
                
                <p className="text-2xl font-bold text-gray-300">
                    You're sharper than <span className="text-green-500">{stats.accuracy_percentile}%</span> of other players.
                </p>
            </div>

            <div className="space-y-8 w-full">
                <div className="bg-[#1a1a1a] p-8 rounded-2xl border border-white/10">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden">
                                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`} alt="profile" />
                            </div>
                            <span className="font-bold text-xl">YOU</span>
                        </div>
                        <span className="font-mono text-3xl text-green-400">{Math.round(stats.avg_accuracy * 100)}%</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.avg_accuracy * 100}%` }}
                            transition={{ duration: 1, delay: 0.5 }}
                            className="h-full bg-green-500"
                        />
                    </div>
                </div>

                <div className="bg-[#1a1a1a] p-8 rounded-2xl border border-white/10 opacity-60">
                     <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-2xl">
                                🌎
                            </div>
                            <span className="font-bold text-xl">EVERYONE ELSE</span>
                        </div>
                        <span className="font-mono text-3xl">{Math.round(stats.global_avg_accuracy * 100)}%</span>
                    </div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.global_avg_accuracy * 100}%` }}
                            transition={{ duration: 1, delay: 0.7 }}
                            className="h-full bg-indigo-500"
                        />
                    </div>
                </div>
            </div>
        </div>
    </SlideWrapper>,
    
    // Summary Card
    <SlideWrapper className="bg-[#1a1a1a] items-center justify-center">
        <Confetti width={width} height={height} recycle={false} numberOfPieces={500} colors={['#5865F2', '#EB459E', '#FEE75C', '#57F287']} />
        
        <div className="flex gap-16 items-center">
             <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="w-[500px] bg-black border-2 border-[#5865F2] rounded-3xl p-10 relative overflow-hidden shadow-[0_0_100px_rgba(88,101,242,0.2)] max-h-[85vh] overflow-y-auto custom-scrollbar"
            >
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#5865F2] via-[#EB459E] to-[#FEE75C]" />
                
                <div className="flex justify-between items-start mb-12">
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-2">Your Favorite</h3>
                        <h2 className="text-5xl font-black uppercase">Stats {stats.year}</h2>
                    </div>
                    <div className="w-20 h-20 bg-[#5865F2] rounded-full flex items-center justify-center text-4xl font-bold">S</div>
                </div>

                <div className="space-y-6">
                    <div className="flex justify-between items-center p-6 bg-[#111] rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                        <div className="flex items-center gap-4">
                            <Trophy size={24} className="text-[#FEE75C]" />
                            <span className="font-bold text-xl">Top Score</span>
                        </div>
                        <span className="font-mono text-2xl text-[#FEE75C]">#{stats.top_score}</span>
                    </div>

                    <div className="flex justify-between items-center p-6 bg-[#111] rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                        <div className="flex items-center gap-4">
                            <Activity size={24} className="text-[#EB459E]" />
                            <span className="font-bold text-xl">Total Accuracy</span>
                        </div>
                        <span className="font-mono text-2xl text-[#EB459E]">{Math.round(stats.avg_accuracy * 100)}%</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-6 bg-[#111] rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                        <div className="flex items-center gap-4">
                            <Zap size={24} className="text-[#57F287]" />
                            <span className="font-bold text-xl">Strike</span>
                        </div>
                        <span className="font-mono text-2xl text-[#57F287]">x{stats.best_streak}</span>
                    </div>

                    <div className="flex justify-between items-center p-6 bg-[#111] rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                        <div className="flex items-center gap-4">
                            <Trophy size={24} className="text-[#FEE75C]" />
                             <span className="font-bold text-xl">Total Score</span>
                        </div>
                        <span className="font-mono text-2xl text-[#FEE75C]">{stats.total_score}</span>
                    </div>

                     <div className="flex justify-between items-center p-6 bg-[#111] rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                        <div className="flex items-center gap-4">
                             <div className="w-6 h-6 rounded-full bg-red-500" />
                             <div className="w-6 h-6 rounded-full bg-blue-500" />
                             <span className="font-bold text-xl">Fav Colors</span>
                        </div>
                        <span className="font-mono text-lg text-white">Default</span>
                    </div>
                     
                    <div className="flex justify-between items-center p-6 bg-[#111] rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                        <div className="flex items-center gap-4">
                             <span className="font-bold text-xl text-yellow-400">$</span>
                             <span className="font-bold text-xl">Total Spent</span>
                        </div>
                        <span className="font-mono text-2xl text-yellow-400">${stats.total_spent || 0}</span>
                    </div>

                </div>

                <div className="mt-12 pt-8 border-t border-white/10 flex justify-between items-end">
                    <div className="flex gap-4 text-3xl">
                        <span>🌐</span>
                        <span>🏁</span>
                        <span>🖤</span>
                    </div>
                    <div className="text-right">
                        <p className="text-gray-500 text-sm">GENERATED ON</p>
                        <p className="font-mono">{new Date().toLocaleDateString()}</p>
                    </div>
                </div>
            </motion.div>

            <div className="flex flex-col gap-6">
                 <h3 className="text-4xl font-bold max-w-xs">Thanks for playing with us this year.</h3>
                 <button 
                    onClick={() => navigate('/profile')}
                    className="group flex items-center gap-4 text-xl text-gray-400 hover:text-white transition-colors text-left"
                >
                    <span>RETURN TO PROFILE</span>
                    <div className="p-3 border border-current rounded-full group-hover:bg-white group-hover:text-black transition-all">
                        <ArrowRight size={24} />
                    </div>
                </button>
            </div>
        </div>
    </SlideWrapper>
  ];

  return (
    <div className="fixed inset-0 bg-black text-white z-50 overflow-hidden font-sans select-none flex items-center justify-center">
        
        <div className="w-full h-full relative bg-[#050505]">
             {/* Top Progress Bar */}
             <div className="absolute top-0 left-0 right-0 z-50 p-6 flex gap-4 max-w-screen-xl mx-auto">
                 {slides.map((_, i) => (
                     <div key={i} className="h-2 flex-1 bg-white/10 rounded-full overflow-hidden">
                         <div 
                            className={`h-full bg-white transition-all duration-300 ${i <= slide ? 'w-full' : 'w-0'}`}
                         />
                     </div>
                 ))}
             </div>

             <AnimatePresence mode='wait'>
                <motion.div
                    key={slide}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="h-full w-full"
                >
                    {slides[slide]}
                </motion.div>
             </AnimatePresence>
             
             {/* Tap Areas - Desktop Arrows */}
             <button 
                className="absolute left-8 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all z-40"
                onClick={handlePrevSlide}
                disabled={slide === 0}
             >
                 <ArrowRight className="rotate-180" size={32} />
             </button>

             <button 
                className="absolute right-8 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all z-40"
                onClick={handleNextSlide}
                disabled={slide === slides.length - 1}
             >
                 <ArrowRight size={32} />
             </button>
        </div>
        
        {/* Desktop Background Blur */}
        <div 
            className="absolute inset-0 -z-10 bg-center bg-cover blur-3xl opacity-10"
            style={{ backgroundImage: `url('https://cdn.discordapp.com/attachments/1077755355027509292/1206680459521360002/gradient.png')` }}
        />
    </div>
  );
};

export default WrappedPage;
