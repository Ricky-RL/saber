import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X, LogIn, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

declare const chrome: any;

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [loading, setLoading] = useState(false);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!isOpen) return null;

  const handleExtensionLogin = async () => {
    try {
      setLoading(true);
      
      // Open login page in new tab
      const loginUrl = `${import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173'}/login`;
      
      // We need to use runtime messaging or direct scripting if available
      // Since we are in the popup, we can use chrome.tabs.create
      chrome.tabs.create({ url: loginUrl, active: true }, (tab: any) => {
        // Start polling for the token
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        
        checkIntervalRef.current = setInterval(() => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // This runs in the context of the opened page
              const key = `sb-${import.meta.env.VITE_SUPABASE_ID || 'cjpkxxujsk'}-auth-token`; // We need to know the storage key
              // Actually, simpler approach: dump all localStorage
              return JSON.stringify(localStorage);
            }
          }, (results: any) => {
            if (results && results[0] && results[0].result) {
              try {
                const storage = JSON.parse(results[0].result);
                // Find supabase token
                const tokenKey = Object.keys(storage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
                
                if (tokenKey && storage[tokenKey]) {
                  const sessionData = JSON.parse(storage[tokenKey]);
                   if (sessionData && sessionData.access_token) {
                     // Found it! Sync to extension storage
                     chrome.storage.local.set({ [tokenKey]: storage[tokenKey] }, async () => {
                       // Also set in current supabase client memory
                       await supabase.auth.setSession({
                         access_token: sessionData.access_token,
                         refresh_token: sessionData.refresh_token,
                       });
                       
                       // Cleanup
                       if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
                       chrome.tabs.remove(tab.id);
                       setLoading(false);
                       onClose();
                     });
                   }
                }
              } catch (e) {
                console.error("Error parsing storage", e);
              }
            }
          });
        }, 1000);
      });

    } catch (error) {
      console.error('Error logging in from extension:', error);
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Check if in extension
    const isExtension = typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting;
    
    if (isExtension) {
      handleExtensionLogin();
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${import.meta.env.VITE_FRONTEND_URL || 'http://localhost:5173'}/profile`, // Redirect to profile
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
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-white text-black font-ui font-bold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
             <>
               <Loader2 className="w-5 h-5 animate-spin" />
               Connecting to StudySaber...
             </>
          ) : (
            <>
               <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
               Continue with Google
            </>
          )}
        </button>
      </motion.div>
    </div>
  );
}
