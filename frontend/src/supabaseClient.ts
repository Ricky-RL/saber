import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if running in a Chrome extension environment
declare const chrome: any;
const isExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

const chromeStorageAdapter = {
  getItem: (key: string): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!isExtension) return resolve(null);
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] || null);
      });
    });
  },
  setItem: (key: string, value: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!isExtension) return resolve();
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  },
  removeItem: (key: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!isExtension) return resolve();
      chrome.storage.local.remove([key], () => {
        resolve();
      });
    });
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isExtension ? chromeStorageAdapter : localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: !isExtension, // URL detection doesn't work well in popup
  },
});
