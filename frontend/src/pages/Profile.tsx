import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/Auth';
import { supabase } from '../supabaseClient';
import UploadModal from '../components/UploadModal';
import PreviewModal from '../components/PreviewModal';
import { 
  Zap, 
  FileText, 
  Trash2, 
  Edit3, 
  Play, 
  ChevronLeft,
  Search,
  Trophy,
  Target,
  Check,
  X,
  Upload,
  Clock,
  LogOut,
  Eye
} from 'lucide-react';

// Helper for relative time
function timeAgo(dateString: string) {
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
}

interface Document {
  id: string;
  name: string;
  questions: number;
  created_at: string;
  accuracy: number;
  file_path: string; // Add file_path to interface
  file_type: string; // Add file_type to interface
}

interface HistoryEntry {
  id: string;
  document_id: string;
  score: number;
  accuracy: number;
  best_streak: number;
  created_at: string;
  documents: {
    name: string;
  }
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'documents' | 'history'>('documents');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  useEffect(() => {
    if (user) {
      fetchDocuments();
      fetchHistory();
    }
  }, [user]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Map data to match the interface, assuming some defaults for now for missing fields
        const mappedDocs: Document[] = data.map(doc => ({
          id: doc.id,
          name: doc.name,
          questions: doc.questions || 0,
          created_at: new Date(doc.created_at).toLocaleDateString(),
          accuracy: 0, // Placeholder as it's not in the DB yet
          file_path: doc.file_path,
          file_type: doc.file_type
        }));
        setDocuments(mappedDocs);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      console.log('Fetching history for user:', user?.id);
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/game/history/${user?.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }
      
      const data = await response.json();
      console.log('Fetched history data:', data);

      if (data) {
        setHistory(data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const saveEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Calculate stats from history
  const bestScore = history.reduce((max, curr) => Math.max(max, curr.score), 0);
  const avgAccuracy = history.length > 0
    ? Math.round(history.reduce((acc, curr) => acc + (curr.accuracy * 100), 0) / history.length)
    : 0;
  const totalSessions = history.length;

  const filteredDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen relative overflow-hidden text-foreground">
      <UploadModal 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={fetchDocuments}
      />
      <PreviewModal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
      />
      <div className="absolute inset-0 grid-lines opacity-30" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-neon-purple/10 rounded-full blur-[100px]" />

      <nav className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-6">
          <Link to="/">
            <motion.button
              data-testid="button-back"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              whileHover={{ x: -3 }}
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </motion.button>
          </Link>
          
          <Link to="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-magenta flex items-center justify-center">
                <Zap className="w-5 h-5 text-background" />
              </div>
              <h1 className="font-display text-xl font-bold tracking-wider">
                <span className="text-neon-cyan">STUDY</span>
                <span className="text-neon-magenta">SABER</span>
              </h1>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right mr-4 hidden sm:block">
             <p className="text-xs text-muted-foreground font-ui mb-0.5 uppercase tracking-wider">Player</p>
             <div className="text-lg font-bold bg-gradient-to-r from-neon-cyan to-neon-magenta bg-clip-text text-transparent font-display tracking-wide">
               {user?.user_metadata?.full_name || user?.email}
             </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-8 py-4">
        <div className="flex items-center gap-4 mb-8">
          <motion.button
            data-testid="tab-documents"
            onClick={() => setActiveTab('documents')}
            className={`font-display text-lg font-bold px-6 py-3 rounded-lg transition-all ${
              activeTab === 'documents' 
                ? 'bg-neon-cyan/20 text-neon-cyan border-glow-cyan' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            MY DOCUMENTS
          </motion.button>
          
          <motion.button
            data-testid="tab-history"
            onClick={() => setActiveTab('history')}
            className={`font-display text-lg font-bold px-6 py-3 rounded-lg transition-all ${
              activeTab === 'history' 
                ? 'bg-neon-magenta/20 text-neon-magenta border-glow-magenta' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            QUIZ HISTORY
          </motion.button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'documents' && (
            <motion.div
              key="documents"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    data-testid="input-search"
                    type="text"
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-card border border-border focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan outline-none font-ui transition-all"
                  />
                </div>
                
                <motion.button
                  onClick={() => setIsUploadModalOpen(true)}
                  data-testid="button-upload"
                  className="neon-button px-5 py-3 rounded-xl font-ui font-medium flex items-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Upload className="w-4 h-4" />
                  Upload New
                </motion.button>
              </div>

              <div className="space-y-3">
                {filteredDocs.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <p>No documents found. Upload one to get started!</p>
                  </div>
                )}
                {filteredDocs.map((doc, index) => (
                  <motion.div
                    key={doc.id}
                    data-testid={`doc-row-${doc.id}`}
                    className="glass-card rounded-xl p-5 hover:border-neon-purple/50 transition-all group"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-purple/30 to-neon-pink/30 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-neon-purple" />
                        </div>
                        
                        <div className="flex-1">
                          {editingId === doc.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                data-testid={`input-edit-${doc.id}`}
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="px-3 py-1 rounded-lg bg-input border border-neon-cyan focus:ring-1 focus:ring-neon-cyan outline-none font-ui"
                                autoFocus
                              />
                              <motion.button
                                onClick={saveEdit}
                                className="p-1.5 rounded-lg bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30"
                                whileTap={{ scale: 0.9 }}
                              >
                                <Check className="w-4 h-4" />
                              </motion.button>
                              <motion.button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30"
                                whileTap={{ scale: 0.9 }}
                              >
                                <X className="w-4 h-4" />
                              </motion.button>
                            </div>
                          ) : (
                            <>
                              <h3 className="font-ui font-semibold text-foreground group-hover:text-neon-purple transition-colors">
                                {doc.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {doc.questions} questions • {doc.created_at}
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm text-muted-foreground">Accuracy</p>
                          <p className="font-display text-neon-cyan">{doc.accuracy}%</p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <motion.button
                            onClick={() => setPreviewDoc(doc)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            title="Preview Document"
                          >
                            <Eye className="w-4 h-4" />
                          </motion.button>

                          <motion.button
                            data-testid={`button-edit-${doc.id}`}
                            onClick={() => startEdit(doc.id, doc.name)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Edit3 className="w-4 h-4" />
                          </motion.button>
                          
                          <motion.button
                            onClick={() => handleDelete(doc.id)}
                            data-testid={`button-delete-${doc.id}`}
                            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                          
                          <Link to="/game" state={{ mode: 'auto' }}>
                            <motion.button
                              data-testid={`button-play-${doc.id}`}
                              className="p-2 rounded-lg bg-neon-magenta/10 text-neon-magenta hover:bg-neon-magenta/20 transition-colors"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              <Play className="w-4 h-4" />
                            </motion.button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="glass-card rounded-xl p-5 text-center">
                  <Trophy className="w-8 h-8 text-neon-cyan mx-auto mb-2" />
                  <p className="font-display text-2xl font-bold text-neon-cyan">{bestScore.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Best Score</p>
                </div>
                <div className="glass-card rounded-xl p-5 text-center">
                  <Target className="w-8 h-8 text-neon-pink mx-auto mb-2" />
                  <p className="font-display text-2xl font-bold text-neon-pink">{avgAccuracy}%</p>
                  <p className="text-sm text-muted-foreground">Avg Accuracy</p>
                </div>
                <div className="glass-card rounded-xl p-5 text-center">
                  <Clock className="w-8 h-8 text-neon-purple mx-auto mb-2" />
                  <p className="font-display text-2xl font-bold text-neon-purple">{totalSessions}</p>
                  <p className="text-sm text-muted-foreground">Total Sessions</p>
                </div>
              </div>

              <div className="space-y-3">
                {history.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <p>No game history found. Play a game to see your stats!</p>
                  </div>
                )}
                {history.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    data-testid={`history-row-${entry.id}`}
                    className="glass-card rounded-xl p-5"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-neon-magenta/30 to-neon-pink/30">
                          <Zap className="w-6 h-6 text-neon-magenta" />
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-display px-2 py-0.5 rounded bg-neon-magenta/20 text-neon-magenta">
                              STUDYSABER
                            </span>
                          </div>
                          <h3 className="font-ui font-semibold text-foreground mt-1">
                            {entry.documents?.name || 'Unknown Document'}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {timeAgo(entry.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Score</p>
                          <p className="font-display text-xl text-neon-pink">
                            {entry.score.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Accuracy</p>
                          <p className="font-display text-xl text-neon-cyan">{Math.round(entry.accuracy * 100)}%</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Best Streak</p>
                            <p className="font-display text-xl text-neon-purple">🔥 {entry.best_streak}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
