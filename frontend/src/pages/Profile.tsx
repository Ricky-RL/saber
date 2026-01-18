import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/Auth';
import { supabase } from '../supabaseClient';
import UploadModal from '../components/UploadModal';
import PreviewModal from '../components/PreviewModal';
import AvatarLipsyncView from '../components/AvatarLipsyncView';
import { 
  Plus, 
  Trash2, 
  Play, 
  Settings, 
  LogOut, 
  ChevronLeft,
  Upload,
  Check,
  X,
  FileText,
  Clock,
  Eye,
  Gift,
  Phone,
  Search,
  Trophy,
  Target,
  Zap
} from 'lucide-react';
import { base } from 'framer-motion/client';

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
  topic?: string;
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
  const [activeTab, setActiveTab] = useState<'documents' | 'history' | 'store'>('documents');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  // State for store items
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  const [purchasedItems, setPurchasedItems] = useState<string[]>([]);
  const [equippedItems, setEquippedItems] = useState<any>({});
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [callingDoc, setCallingDoc] = useState<Document | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);

  const avatarContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (user) {
      fetchDocuments();
      fetchHistory();
      fetchStoreData();
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
          file_type: doc.file_type,
          topic: doc.topic
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

  const fetchStoreData = async () => {
    try {
      if(!user?.id) return;

      // Fetch Items
      const itemsRes = await fetch(`${import.meta.env.VITE_API_URL}/store/items`);
      if (itemsRes.ok) {
        setStoreItems(await itemsRes.json());
      }

      // Fetch Balance
      const balanceRes = await fetch(`${import.meta.env.VITE_API_URL}/store/balance/${user.id}`);
      if (balanceRes.ok) {
        const data = await balanceRes.json();
        setUserBalance(data.balance);
      }

      // Fetch Purchases
      const purchasesRes = await fetch(`${import.meta.env.VITE_API_URL}/store/purchases/${user.id}`);
      if (purchasesRes.ok) {
        setPurchasedItems(await purchasesRes.json());
      }

      // Fetch Equipped
      const equippedRes = await fetch(`${import.meta.env.VITE_API_URL}/store/equipped/${user.id}`);
      if (equippedRes.ok) {
        setEquippedItems(await equippedRes.json());
      }

    } catch (e) {
      console.error("Error fetching store data", e);
    }
  };

  const handlePurchase = async (itemId: string) => {
    try {
        if(!user?.id) return;
        const res = await fetch(`${import.meta.env.VITE_API_URL}/store/purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, item_id: itemId })
        });
        
        if (res.ok) {
            const data = await res.json();
            setUserBalance(data.new_balance);
            setPurchasedItems([...purchasedItems, itemId]);
            // alert("Purchase successful!"); // Removed alert
        } else {
            const err = await res.json();
            alert(`Purchase failed: ${err.detail}`);
        }
    } catch (e) {
        console.error("Error purchasing item", e);
    }
  };

  const handleEquip = async (itemId: string, itemType: string) => {
    try {
        if(!user?.id) return;
        const res = await fetch(`${import.meta.env.VITE_API_URL}/store/equip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, item_id: itemId, item_type: itemType })
        });

        if(res.ok) {
            // Optimistic update
            const item = storeItems.find(i => i.id === itemId);
            setEquippedItems({
                ...equippedItems,
                [itemType]: {
                    item_id: itemId,
                    value: item.value,
                    name: item.name
                }
            });
        }
    } catch(e) {
        console.error("Error equipping item", e);
    }
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

  const handleCallClick = async (doc: Document) => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/get-agent/${user.id}/${doc.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch agent ID');
      }
      const data = await response.json();
      setAgentId(data.agent_id);
      setCallingDoc(doc);
    } catch (error) {
      console.error('Error fetching agent ID:', error);
      alert('Failed to load agent. Please try again.');
    }
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

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <UploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadComplete={fetchDocuments}
        />
        
        {previewDoc && (
          <PreviewModal
            isOpen={!!previewDoc}
            onClose={() => setPreviewDoc(null)}
            document={previewDoc}
          />
        )}

        {callingDoc && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md backdrop-saturate-150"
            onClick={() => {
              setCallingDoc(null);
              setAgentId(null);
            }}
          >
            <div
              className="relative w-[min(1100px,92vw)] h-[min(80vh,760px)] rounded-3xl border border-white/15 bg-gradient-to-br from-neutral-900/90 via-black/90 to-neutral-950/95 shadow-[0_40px_120px_rgba(0,0,0,0.65)] ring-1 ring-white/10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.08),transparent_55%)]" />
              <button
                onClick={() => {
                  setCallingDoc(null);
                  setAgentId(null);
                }}
                className="absolute top-4 right-4 z-10 p-2 rounded-full border border-white/10 bg-black/40 hover:bg-white/10 transition-colors text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="relative h-full w-full p-5 md:p-7 flex flex-col gap-4">
                <div className="relative flex-1 rounded-2xl border border-white/10 bg-transparent overflow-hidden min-h-[320px]">
                  <div
                    ref={avatarContainerRef}
                    className="absolute inset-0 bg-transparent"
                  />
                  <AvatarLipsyncView key={callingDoc.id} containerRef={avatarContainerRef} />
                  <div className="absolute bottom-4 left-4 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs uppercase tracking-widest text-white/70">
                    Live Avatar
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  {agentId && (
                    <elevenlabs-convai 
                      agent-id={agentId}
                      variant="tiny"
                      avatar-orb-color-1="#6366f1" // Orb gradient color 1: indigo-500
                      avatar-orb-color-2="#a21caf" // Orb gradient color 2: purple-800
                      style-base-color="#6366f1"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
              Profile
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             <Link
               to="/wrapped"
               className="flex items-center gap-2 font-display font-bold px-5 py-2.5 rounded-lg bg-neon-green/20 text-neon-green border-glow-green hover:bg-neon-green/30 transition-all"
             >
                <Gift size={18} />
                <span>Your {currentYear} Wrapped</span>
             </Link>

            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 font-display font-bold text-neon-cyan text-glow-cyan px-4 py-2 rounded-full hover:bg-neon-cyan/10 transition-all"
            >
              <Upload className="w-4 h-4" />
              Upload New
            </button>

            <button
              onClick={handleSignOut}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

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

          <motion.button
            data-testid="tab-store"
            onClick={() => setActiveTab('store')}
            className={`font-display text-lg font-bold px-6 py-3 rounded-lg transition-all ${
              activeTab === 'store' 
                ? 'bg-neon-yellow/20 text-neon-yellow border-glow-yellow' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            STORE
          </motion.button>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {activeTab === 'documents' && (
            <motion.div
              key="documents"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="glass-card rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 via-transparent to-transparent p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                      data-testid="input-search"
                      type="text"
                      placeholder="Search documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan outline-none font-ui transition-all"
                    />
                  </div>
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
                      className="glass-card rounded-xl p-5 border border-white/10 hover:border-neon-purple/50 hover:shadow-[0_12px_40px_rgba(168,85,247,0.15)] transition-all group"
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
                              <h3 className="font-ui font-semibold text-foreground group-hover:text-neon-purple transition-colors flex items-center gap-2">
                                {doc.name}
                                {doc.topic && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 uppercase tracking-wider">
                                    {doc.topic}
                                  </span>
                                )}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {doc.created_at}
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-6">

                        
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
                            onClick={() => handleCallClick(doc)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-green-400 hover:bg-green-400/10 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            title="Call Avatar"
                          >
                            <Phone className="w-4 h-4" />
                          </motion.button>

                          {/* 
                          <motion.button
                            data-testid={`button-edit-${doc.id}`}
                            onClick={() => startEdit(doc.id, doc.name)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            title="Rename"
                          >
                            <Edit3 className="w-4 h-4" />
                          </motion.button>
                          */}

                          <motion.button
                            data-testid={`button-delete-${doc.id}`}
                            onClick={() => handleDelete(doc.id)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                          
                          <Link to="/game" state={{ mode: 'auto', documentId: doc.id }}>
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
                  <p className="text-sm text-muted-foreground">Quiz Score</p>
                </div>
                <div className="bg-game-dark/50 p-4 rounded-lg border border-neon-blue/20 text-center">
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
                          <p className="text-sm text-muted-foreground">Quiz Score</p>
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
          
          {activeTab === 'store' && (
            <motion.div
              key="store"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Balance Display */}
              <div className="flex justify-end mb-6">
                <div className="glass-card px-6 py-3 rounded-xl flex items-center gap-3 border border-neon-yellow/30 bg-neon-yellow/5">
                  <span className="text-neon-yellow font-display font-bold text-xl">{userBalance}</span>
                  <div className="w-5 h-5 rounded-full bg-neon-yellow/20 flex items-center justify-center border border-neon-yellow">
                    <span className="text-[10px] font-bold text-neon-yellow">©</span>
                  </div>
                  <span className="text-sm text-muted-foreground uppercase tracking-wider font-ui">Credits</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {storeItems.map((item) => {
                    const isPurchased = purchasedItems.includes(item.id) || item.cost === 0;
                    
                    // If equipped specific item OR if default item and nothing equipped in that slot
                    const isDefault = item.name === 'Classic Duo';
                    const nothingEquipped = !equippedItems[item.type];
                    
                    const isEquipped = (equippedItems[item.type]?.item_id === item.id) || (isDefault && nothingEquipped);
                    
                    // Parse colors for preview
                    const colors = item.value.split(',');
                    const leftColor = colors[0];
                    const rightColor = colors.length > 1 ? colors[1] : colors[0];

                    return (
                        <div key={item.id} className="glass-card rounded-xl p-6 flex flex-col items-center hover:bg-white/5 transition-colors">
                            <div className="flex space-x-3 mb-4">
                                <div className="w-12 h-12 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] border-2 border-white/10" style={{ backgroundColor: leftColor, boxShadow: `0 0 20px ${leftColor}66` }}></div>
                                <div className="w-12 h-12 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)] border-2 border-white/10" style={{ backgroundColor: rightColor, boxShadow: `0 0 20px ${rightColor}66` }}></div>
                            </div>
                            <h3 className="text-xl font-display font-bold text-white mb-1">{item.name}</h3>
                            <p className="text-sm text-gray-400 mb-6 text-center font-ui">{item.description}</p>
                            
                            <div className="mt-auto w-full">
                                {!isPurchased ? (
                                    <button
                                        onClick={() => handlePurchase(item.id)}
                                        className="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent text-sm font-bold font-display rounded-lg shadow-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-[1.02]"
                                    >
                                        Buy for {item.cost} pts
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleEquip(item.id, item.type)}
                                        disabled={isEquipped}
                                        className={`w-full inline-flex justify-center items-center px-4 py-3 border text-sm font-bold font-display rounded-lg shadow-lg focus:outline-none transition-all
                                            ${isEquipped 
                                                ? 'border-white/10 text-gray-400 bg-white/5 cursor-default' 
                                                : 'border-transparent text-white bg-green-600 hover:bg-green-500 hover:shadow-green-500/25'}`}
                                    >
                                        {isEquipped ? 'EQUIPPED' : 'EQUIP'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
