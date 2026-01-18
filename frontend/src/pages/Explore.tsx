import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { 
  FileText, 
  Play, 
  ChevronLeft,
  Search,
  Star
} from 'lucide-react';

interface Document {
  id: string;
  name: string;
  questions: number;
  created_at: string;
  topic?: string;
  rating?: number;
  user_id: string;
}

export default function Explore() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, [searchQuery]); // Re-fetch when search query changes (debounce ideally, but simple for now)

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (token) {
        let url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/documents/explore`;
        if (searchQuery) {
          url += `?query=${encodeURIComponent(searchQuery)}`;
        }

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setDocuments(data);
        }
      }
    } catch (error) {
      console.error('Error fetching explore documents:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="absolute inset-0 grid-lines opacity-20 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-neon-cyan/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-neon-blue/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-4">
            <Link 
              to="/" 
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <h1 className="font-display text-3xl font-bold text-neon-cyan text-glow-cyan">
              EXPLORE
            </h1>
          </div>
        </header>

        {/* Search */}
        <div className="glass-card rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 via-transparent to-transparent p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  data-testid="input-search"
                  type="text"
                  placeholder="Search by name or topic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan outline-none font-ui transition-all"
                />
              </div>
            </div>
        </div>

        {/* Documents Grid */}
        <div className="space-y-3">
            {loading && (
                 <div className="text-center py-10 text-muted-foreground">
                    <p>Loading...</p>
                 </div>
            )}
            {!loading && documents.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <p>No documents found.</p>
                </div>
            )}
            {!loading && documents.map((doc, index) => (
            <motion.div
                key={doc.id}
                data-testid={`explore-doc-${doc.id}`}
                className="glass-card rounded-xl p-5 border border-white/10 hover:border-neon-cyan/50 hover:shadow-[0_12px_40px_rgba(34,211,238,0.15)] transition-all group"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * index }}
            >
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-blue/30 to-neon-cyan/30 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-neon-cyan" />
                    </div>
                    
                    <div className="flex-1">
                        <h3 className="font-ui font-semibold text-foreground group-hover:text-neon-cyan transition-colors flex items-center gap-2">
                            {doc.name}
                            {doc.topic && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 uppercase tracking-wider">
                                {doc.topic}
                                </span>
                            )}
                        </h3>
                         <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1 text-yellow-400">
                                {doc.rating ? doc.rating : '-'} <Star className="w-3 h-3 fill-yellow-400" />
                            </span>
                            <span>•</span>
                            <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link to="/game" state={{ mode: 'auto', documentId: doc.id }}>
                    <motion.button
                        data-testid={`button-play-${doc.id}`}
                        className="p-2 rounded-lg bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="Play"
                    >
                        <Play className="w-4 h-4" />
                    </motion.button>
                    </Link>
                </div>
                </div>
            </motion.div>
            ))}
        </div>
      </div>
    </div>
  );
}
