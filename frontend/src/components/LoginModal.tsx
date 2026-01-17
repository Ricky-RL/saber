import { motion } from 'framer-motion';
import { X, LogIn } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/profile`, // Redirect back to profile or home
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error logging in with Google:', error);
      alert('Error logging in with Google');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md p-8 overflow-hidden bg-card rounded-2xl border border-neon-cyan/20 box-glow-cyan"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 mb-4 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-magenta flex items-center justify-center">
             <LogIn className="w-6 h-6 text-white" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Sign In
          </h2>
          <p className="mt-2 text-muted-foreground font-ui">
            Access your study profile and progress
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-white text-black font-ui font-bold hover:bg-gray-100 transition-colors"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>
      </motion.div>
    </div>
  );
}
