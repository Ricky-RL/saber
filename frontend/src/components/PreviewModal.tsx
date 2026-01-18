import { motion } from 'framer-motion';
import { X, FileText } from 'lucide-react';
import {  useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/Auth';

interface Document {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
}

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
}

export default function PreviewModal({ isOpen, onClose, document }: PreviewModalProps) {
  const { user } = useAuth();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && document && user) {
      fetchFileUrl();
    } else {
      setFileUrl(null);
      setError(null);
    }
  }, [isOpen, document, user]);

  const fetchFileUrl = async () => {
    if (!document) return;
    setLoading(true);
    setError(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    try {
      // Fetch document from backend to get signed URL (bypassing RLS)
      const res = await fetch(`${API_URL}/document/${document.id}`, {
          headers: {
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          }
      });

      if (!res.ok) {
          throw new Error("Failed to load document");
      }

      const docData = await res.json();
      
      if (docData.file_url) {
        setFileUrl(docData.file_url);
      } else {
        throw new Error("No preview URL available");
      }

    } catch (err: any) {
      console.error('Error getting file URL:', err);
      setError('Could not load document preview.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl h-[80vh] flex flex-col bg-card rounded-2xl border border-neon-cyan/20 box-glow-cyan overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-neon-purple/20 text-neon-purple">
               <FileText className="w-5 h-5" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground truncate max-w-md">
              {document.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 bg-black/50 overflow-hidden relative flex items-center justify-center">
          {loading ? (
             <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground">Loading preview...</p>
             </div>
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : fileUrl ? (
             <iframe 
               src={fileUrl} 
               className="w-full h-full border-0"
               title="Document Preview"
             />
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
