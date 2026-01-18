import { motion } from 'framer-motion';
import { X, Upload, FileText, AlertCircle } from 'lucide-react';
import { useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/Auth';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

export default function UploadModal({ isOpen, onClose, onUploadComplete }: UploadModalProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTopic, setDocTopic] = useState('');

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);
    setError(null);
    
    // Auto-fill the name with filename (without extension) if needed
    const nameWithoutExt = selectedFile.name.split('.').slice(0, -1).join('.');
    const docName = nameWithoutExt;

    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

    try {
      // 1. Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // 2. Insert record into documents table
      const { data: docData, error: dbError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          name: docName.trim(),
          topic: docTopic.trim() || null, // Add topic
          file_path: filePath,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          processed: false,
          questions: 0
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // 3. Create agent for the document
      if (docData?.id) {
        try {
          console.log(`Creating agent for document ${docData.id}...`);
          const session = await supabase.auth.getSession();
          const agentFormData = new FormData();
          agentFormData.append('user_id', user.id);
          
          const agentResponse = await fetch(`${API_URL}/create-agent/${docData.id}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.data.session?.access_token || ''}`
            },
            body: agentFormData
          });

          if (!agentResponse.ok) {
            const errorText = await agentResponse.text();
            let errorDetail = "Agent creation failed";
            try {
              const err = JSON.parse(errorText);
              errorDetail = err.detail || err.message || errorText;
            } catch {
              errorDetail = errorText || `HTTP ${agentResponse.status}: ${agentResponse.statusText}`;
            }
            console.error("Agent creation failed:", errorDetail);
            console.error("Response status:", agentResponse.status);
          } else {
            const agentData = await agentResponse.json();
            console.log("Agent created successfully:", agentData);
          }
        } catch (agentError: any) {
          console.error("Error creating agent:", agentError);
          console.error("Error message:", agentError.message);
          console.error("Error stack:", agentError.stack);
        }
      }

      onUploadComplete();
      onClose();
      setSelectedFile(null);
      setDocTopic('');
      
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
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
          <div className="mx-auto w-12 h-12 mb-4 rounded-xl bg-neon-cyan/20 flex items-center justify-center">
             <Upload className="w-6 h-6 text-neon-cyan" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Upload Document
          </h2>
          <p className="text-muted-foreground mt-2">
            Select a PDF file to generate a quiz from
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Topic (Optional)
            </label>
            <input
              type="text"
              value={docTopic}
              onChange={(e) => setDocTopic(e.target.value)}
              placeholder="e.g., Science, History, Math"
              className="w-full px-4 py-2 bg-black/40 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 text-white placeholder-gray-500"
            />
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              selectedFile ? 'border-neon-cyan bg-neon-cyan/5' : 'border-border hover:border-muted-foreground'
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              accept=".pdf,.txt,.md,.docx"
              onChange={handleFileSelect}
            />
            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-8 h-8 text-neon-cyan" />
                <p className="font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="w-8 h-8" />
                <p>Click to select a file</p>
                <p className="text-xs">PDF, TXT, MD, DOCX up to 10MB</p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className={`w-full py-3 rounded-xl font-ui font-bold transition-all ${
              !selectedFile || isUploading
                ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                : 'bg-neon-cyan text-black hover:bg-neon-cyan/90'
            }`}
          >
            {isUploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
