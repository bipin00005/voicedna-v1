import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Dna, 
  Upload, 
  FileText, 
  Sparkles, 
  History, 
  Trash2, 
  ChevronRight, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRightLeft,
  Menu,
  X,
  Clock,
  MessageSquare,
  Mail,
  Send,
  Bot,
  ShieldCheck,
  ExternalLink,
  ShieldAlert,
  Search,
  Check
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import ReactDiffViewer from 'react-diff-viewer-continued';
import mammoth from 'mammoth';
import { analyzeStyle, humanizeText } from './lib/gemini';
import { StyleProfile, ChatMessage } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [isAppStarted, setIsAppStarted] = useState(() => {
    return localStorage.getItem('voice_dna_profile') !== null;
  });
  const [activeTab, setActiveTab] = useState<'calibration' | 'humanize' | 'history' | 'profile' | 'support' | 'chat' | 'verification'>('calibration');
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [samples, setSamples] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [outputLines, setOutputLines] = useState<{original: string, humanized: string}[]>([]);
  const [isHumanizing, setIsHumanizing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [history, setHistory] = useState<{id: string, original: string, humanized: string, timestamp: number}[]>([]);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [hasResendKey, setHasResendKey] = useState(true);

  useEffect(() => {
    // Ping the server to check for the API key status
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setHasResendKey(!!data.config?.hasResendKey);
        if (!data.config?.hasApiKey) {
          setErrorStatus(
            "The Gemini API key is missing on the server. Please ensure you have added a secret named 'GEMINI_KEY' in the Secrets panel."
          );
        }
      })
      .catch((err) => {
        console.warn("Could not reach health check endpoint:", err);
      });
  }, []);

  useEffect(() => {
    const savedProfile = localStorage.getItem('voice_dna_profile');
    const savedHistory = localStorage.getItem('voice_dna_history');
    const savedDraft = localStorage.getItem('voice_dna_draft');
    const savedSamples = localStorage.getItem('voice_dna_samples');

    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
      setActiveTab('humanize');
    }
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedDraft) setInputText(savedDraft);
    if (savedSamples) setSamples(JSON.parse(savedSamples));
  }, []);

  useEffect(() => {
    localStorage.setItem('voice_dna_draft', inputText);
  }, [inputText]);

  useEffect(() => {
    localStorage.setItem('voice_dna_samples', JSON.stringify(samples));
  }, [samples]);

  const saveProfile = (newProfile: StyleProfile) => {
    setProfile(newProfile);
    localStorage.setItem('voice_dna_profile', JSON.stringify(newProfile));
  };

  const saveToHistory = (original: string, humanized: string) => {
    const newItem = {
      id: crypto.randomUUID(),
      original,
      humanized,
      timestamp: Date.now()
    };
    const newHistory = [newItem, ...history].slice(0, 50);
    setHistory(newHistory);
    localStorage.setItem('voice_dna_history', JSON.stringify(newHistory));
  };

  const [viewMode, setViewMode] = React.useState<'diff' | 'final'>('diff');

  const handleAnalyze = async () => {
    if (samples.length === 0) return;
    setIsAnalyzing(true);
    try {
      const newProfile = await analyzeStyle(samples);
      saveProfile(newProfile);
      setActiveTab('humanize');
      setErrorStatus(null);
    } catch (error) {
      console.error(error);
      setErrorStatus(error instanceof Error ? error.message : 'Failed to analyze style.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleHumanize = async () => {
    if (!profile || !inputText) return;
    setIsHumanizing(true);
    try {
      const result = await humanizeText(inputText, profile);
      setOutputLines([{ original: inputText, humanized: result }]);
      saveToHistory(inputText, result);
      
      // Feature: Automatically copy to clipboard
      try {
        await navigator.clipboard.writeText(result);
      } catch (copyErr) {
        console.warn("Auto-copy failed:", copyErr);
      }
      
      setErrorStatus(null);
    } catch (error) {
      console.error(error);
      setErrorStatus(error instanceof Error ? error.message : 'Failed to humanize text.');
    } finally {
      setIsHumanizing(false);
    }
  };

  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      
      if (file.name.endsWith('.docx')) {
        reader.onload = async (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          try {
            const result = await mammoth.extractRawText({ arrayBuffer });
            setSamples(prev => [...prev, result.value]);
          } catch (err) {
            console.error('Error parsing Word file:', err);
            alert(`Failed to parse ${file.name}`);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = () => {
          const text = reader.result as string;
          setSamples(prev => [...prev, text]);
        };
        reader.readAsText(file);
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 
      'text/plain': ['.txt'], 
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    multiple: true
  } as any);

  const getWordCount = (text: string) => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  };

  if (!isAppStarted) {
    return <LandingPage onLaunch={() => setIsAppStarted(true)} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-text-main font-sans relative">
      {/* Mobile Header */}
      <div className="lg:hidden absolute top-0 left-0 right-0 h-16 bg-sidebar border-b border-border flex items-center justify-between px-6 z-50">
        <button 
          onClick={() => setIsAppStarted(false)} 
          className="flex items-center gap-2.5 font-bold text-lg text-accent hover:opacity-80 transition-opacity"
        >
          <Dna size={24} strokeWidth={2.5} />
          VoiceDNA
        </button>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('support')}
              className={cn("p-2 transition-colors", activeTab === 'support' ? "text-accent" : "text-text-dim hover:text-accent")}
              title="Support & Feedback"
            >
              <MessageSquare size={20} />
            </button>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-text-main">
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
      </div>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-border flex flex-col p-6 transition-transform duration-300 lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <button 
          onClick={() => setIsAppStarted(false)} 
          className="hidden lg:flex items-center gap-2.5 font-bold text-lg mb-10 text-accent hover:opacity-80 transition-opacity"
        >
          <Dna size={24} strokeWidth={2.5} />
          VoiceDNA
        </button>
        
        <nav className="space-y-8 mt-16 lg:mt-0">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-dim mb-3 font-semibold">Interface</div>
            <div className="space-y-1">
              <NavItem 
                active={activeTab === 'calibration'} 
                onClick={() => { setActiveTab('calibration'); setIsSidebarOpen(false); }}
                icon={<Upload size={18} />}
                label="Calibration"
              />
              <NavItem 
                active={activeTab === 'humanize'} 
                onClick={() => { setActiveTab('humanize'); setIsSidebarOpen(false); }}
                icon={<Sparkles size={18} />}
                label="Humanizer"
                disabled={!profile}
              />
              <NavItem 
                active={activeTab === 'profile'} 
                onClick={() => { setActiveTab('profile'); setIsSidebarOpen(false); }}
                icon={<Dna size={18} />}
                label="Voice DNA"
                disabled={!profile}
              />
              <NavItem 
                active={activeTab === 'chat'} 
                onClick={() => { setActiveTab('chat'); setIsSidebarOpen(false); }}
                icon={<Bot size={18} />}
                label="App Guide"
                disabled={!profile}
              />
              <NavItem 
                active={activeTab === 'history'} 
                onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }}
                icon={<History size={18} />}
                label="History"
              />
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-dim mb-3 font-semibold">Support</div>
            <div className="space-y-1">
              <NavItem 
                active={activeTab === 'support'}
                onClick={() => { setActiveTab('support'); setIsSidebarOpen(false); }}
                icon={<MessageSquare size={18} />}
                label="Help & Feedback"
              />
            </div>
          </div>
        </nav>

        <div className="mt-auto pt-6 text-[11px] text-text-dim text-center border-t border-border/50">
          v1.2.6 Active Engine: Gemini-3-F
        </div>
      </aside>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 gap-6 overflow-hidden pt-20 lg:pt-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold m-0">
              {activeTab === 'calibration' ? 'Voice Calibration' : 
               activeTab === 'humanize' ? 'Humanize Draft' : 
               activeTab === 'profile' ? 'Voice DNA Profile' : 
               activeTab === 'chat' ? 'App Guide & Help' :
               activeTab === 'support' ? 'Support & Feedback' : 'History'}
            </h1>
            <p className="text-xs md:text-sm text-text-dim mt-1">
              {activeTab === 'calibration' ? 'Upload samples to build your Voice DNA' : 
               activeTab === 'humanize' ? `Applying "${profile?.name}" Voice Profile` : 
               activeTab === 'profile' ? 'Deep analysis of your unique writing style' : 
               activeTab === 'chat' ? 'Ask questions about privacy, features, or how to use the app' :
               activeTab === 'support' ? 'Report issues or suggest improvements' : 'Review your past humanized texts'}
            </p>
          </div>
          
          <div className="bg-card border border-border px-4 py-2 rounded-full flex items-center gap-3 text-xs md:text-sm">
            <div className={cn("status-pulse", profile ? "bg-success" : "bg-amber-500")} style={{ boxShadow: `0 0 8px ${profile ? 'var(--color-success)' : '#f59e0b'}` }}></div>
            <span className="text-text-dim whitespace-nowrap">Voice DNA: <strong className="text-text-main">{profile ? 'Active' : 'Not Calibrated'}</strong></span>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {errorStatus && (
            <motion.div 
              initial={{ opacity: 0, h: 0 }}
              animate={{ opacity: 1, h: 'auto' }}
              className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center justify-between mb-2 shrink-0"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-3">
                  <AlertCircle size={18} />
                  <span className="text-sm font-medium">{errorStatus}</span>
                </div>
                {errorStatus.includes('GEMINI_API_KEY') && (
                  <button 
                    onClick={() => window.location.reload()}
                    className="text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1 rounded-md transition-colors font-semibold"
                  >
                    Refresh App
                  </button>
                )}
              </div>
              <button onClick={() => setErrorStatus(null)} className="p-1 hover:bg-white/10 rounded ml-4">
                <X size={14} />
              </button>
            </motion.div>
          )}

          {activeTab === 'calibration' && (
            <motion.div 
              key="calibration"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col gap-6 overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
                <div className="md:col-span-2 flex flex-col gap-4 min-h-0">
                  <div 
                    {...getRootProps()} 
                    className={cn(
                      "flex-1 border-2 border-dashed rounded-2xl transition-all flex flex-col items-center justify-center text-center cursor-pointer",
                      isDragActive ? "border-accent bg-accent/5" : "border-border hover:border-accent/50 hover:bg-card/50"
                    )}
                  >
                    <input {...getInputProps()} />
                    <div className="w-12 h-12 bg-card border border-border rounded-full flex items-center justify-center mb-4">
                      <Upload className="text-text-dim" />
                    </div>
                    <p className="font-medium">Drop your writing samples here</p>
                    <p className="text-sm text-text-dim mt-1">Supports .txt, .md, and .docx files</p>
                  </div>

                  {samples.length > 0 && (
                    <div className="bg-card border border-border rounded-2xl p-4 space-y-3 overflow-hidden flex flex-col max-h-60">
                      <div className="flex items-center justify-between shrink-0">
                        <h3 className="text-[11px] font-bold uppercase tracking-widest text-text-dim">Uploaded Samples ({samples.length})</h3>
                        <button 
                          onClick={() => setSamples([])}
                          className="text-[11px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Clear all
                        </button>
                      </div>
                      <div className="overflow-y-auto space-y-2 pr-1">
                        {samples.map((sample, i) => (
                          <div key={i} className="p-3 bg-bg/50 border border-border rounded-xl flex items-center justify-between group">
                            <div className="flex items-center gap-3 truncate">
                              <FileText className="text-text-dim shrink-0" size={18} />
                              <span className="text-sm truncate text-text-main">{sample.slice(0, 60)}...</span>
                            </div>
                            <button 
                              onClick={() => setSamples(prev => prev.filter((_, idx) => idx !== i))}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 text-red-400 rounded transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-accent rounded-2xl text-white shadow-lg shadow-accent/20">
                    <h3 className="font-bold text-lg mb-2">Ready to Analyze?</h3>
                    <p className="text-white/80 text-sm mb-6">
                      Once you've uploaded your samples, we'll generate your unique writing profile.
                    </p>
                    <button 
                      disabled={samples.length < 1 || isAnalyzing}
                      onClick={handleAnalyze}
                      className="w-full py-3 bg-white text-accent rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="animate-spin" size={18} />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          Generate Voice DNA
                          <ChevronRight size={18} />
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-6 border border-border rounded-2xl bg-card">
                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                      <AlertCircle size={16} className="text-amber-500" />
                      Tips for best results
                    </h4>
                    <ul className="text-xs text-text-dim space-y-2.5">
                      <li className="flex gap-2"><span>•</span> Use samples that represent your natural voice</li>
                      <li className="flex gap-2"><span>•</span> Avoid highly technical or academic papers</li>
                      <li className="flex gap-2"><span>•</span> Mix short and long paragraphs</li>
                      <li className="flex gap-2"><span>•</span> 3-5 samples is the sweet spot</li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'humanize' && profile && (
            <motion.div 
              key="humanize"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col gap-6 overflow-hidden"
            >
              {/* Editor Container */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-0">
                <div className="bg-card border border-border rounded-2xl flex flex-col overflow-hidden relative">
                  <div className="px-4 py-3 bg-black/10 border-b border-border flex justify-between items-center text-[11px] font-bold text-text-dim uppercase tracking-widest">
                    <span>Original AI Output</span>
                    <span className="text-accent">Low Variance Detected</span>
                  </div>
                  <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste AI text here..."
                    className="flex-1 p-5 bg-transparent outline-none resize-none font-sans leading-relaxed text-text-main placeholder:text-text-dim/30"
                  />
                  <div className="absolute bottom-4 right-4 text-[10px] font-bold text-text-dim/50 uppercase tracking-widest bg-black/20 px-2 py-1 rounded">
                    {getWordCount(inputText)} words
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
                  <div className="px-4 py-3 bg-black/10 border-b border-border flex justify-between items-center text-[11px] font-bold text-text-dim uppercase tracking-widest">
                    <span>Humanized Output</span>
                    <div className="flex items-center gap-2 bg-black/20 p-0.5 rounded-lg">
                      <button 
                        onClick={() => setViewMode('diff')}
                        className={cn("px-2 py-1 rounded-md transition-all", viewMode === 'diff' ? "bg-accent text-white" : "hover:text-text-main")}
                      >
                        Diff
                      </button>
                      <button 
                        onClick={() => setViewMode('final')}
                        className={cn("px-2 py-1 rounded-md transition-all", viewMode === 'final' ? "bg-accent text-white" : "hover:text-text-main")}
                      >
                        Final
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-5">
                    {outputLines.length > 0 ? (
                      <div className="prose prose-invert max-w-none">
                        {viewMode === 'diff' ? (
                          <ReactDiffViewer 
                            oldValue={outputLines[0].original} 
                            newValue={outputLines[0].humanized} 
                            splitView={false}
                            hideLineNumbers={true}
                            useDarkTheme={true}
                            styles={{
                              variables: {
                                dark: {
                                  diffViewerBackground: 'transparent',
                                  addedBackground: 'rgba(16, 185, 129, 0.1)',
                                  addedColor: '#10B981',
                                  removedBackground: 'transparent',
                                  removedColor: 'inherit',
                                  wordAddedBackground: 'rgba(16, 185, 129, 0.2)',
                                  wordRemovedBackground: 'transparent',
                                }
                              }
                            }}
                          />
                        ) : (
                          <div className="whitespace-pre-wrap text-text-main leading-relaxed">
                            {outputLines[0].humanized}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center text-text-dim/40">
                        <Sparkles size={40} className="mb-4 opacity-20" />
                        <p className="text-sm">Your humanized text will appear here</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex gap-3 justify-center shrink-0">
                <button 
                  onClick={() => setInputText('')}
                  className="px-6 py-3 bg-sidebar border border-border text-text-main rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-card transition-colors"
                >
                  <Trash2 size={16} />
                  Clear
                </button>
                <button 
                  disabled={!inputText || isHumanizing}
                  onClick={handleHumanize}
                  className="px-8 py-3 bg-accent text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-accent/90 transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
                >
                  {isHumanizing ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Re-Humanizing...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Apply Voice DNA
                    </>
                  )}
                </button>
                <button 
                  disabled={outputLines.length === 0}
                  onClick={() => navigator.clipboard.writeText(outputLines[0].humanized)}
                  className="px-6 py-3 bg-sidebar border border-border text-text-main rounded-xl font-semibold text-sm flex items-center gap-2 hover:bg-card transition-colors disabled:opacity-30"
                >
                  <FileText size={16} />
                  Copy Final
                </button>
                <button 
                  disabled={outputLines.length === 0}
                  onClick={() => setActiveTab('verification')}
                  className="px-6 py-3 bg-success/10 border border-success/30 text-success rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-success/20 transition-all shadow-lg shadow-success/5 disabled:opacity-30"
                >
                  <ShieldCheck size={18} />
                  Verify AI Detection
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && profile && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Perplexity" value={`${Math.round(profile.perplexity * 100)}%`} fill={profile.perplexity * 100} />
                <MetricCard label="Burstiness" value={`${Math.round(profile.burstiness * 100)}%`} fill={profile.burstiness * 100} />
                <MetricCard label="Voice Match" value="94.1%" fill={94} />
                  <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim mb-1">Engine</div>
                    <a 
                      href="https://myauthdev.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-lg font-mono font-bold text-accent hover:underline decoration-accent/30 underline-offset-4"
                    >
                      MyAuthGrp
                    </a>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
                    <Sparkles size={16} />
                    Tone & Personality
                  </h3>
                  <p className="text-text-main leading-relaxed">
                    {profile.tone}
                  </p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
                    <ArrowRightLeft size={16} />
                    Sentence Structure
                  </h3>
                  <p className="text-text-main leading-relaxed">
                    {profile.sentenceStructure}
                  </p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
                    <FileText size={16} />
                    Vocabulary Level
                  </h3>
                  <p className="text-text-main leading-relaxed">
                    {profile.vocabularyLevel}
                  </p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-accent mb-4 flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    Signature Quirks
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.quirks.map((quirk, i) => (
                      <span key={i} className="px-3 py-1 bg-bg border border-border rounded-full text-xs text-text-dim">
                        {quirk}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-accent mb-4">Signature Transitions</h3>
                <div className="flex flex-wrap gap-3">
                  {profile.transitionWords.map((word, i) => (
                    <span key={i} className="text-sm font-mono text-text-main bg-accent/5 px-3 py-1.5 rounded-lg border border-accent/20">
                      "{word}"
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {history.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 overflow-y-auto pr-2">
                  {history.map((item) => (
                    <div key={item.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-text-dim text-xs">
                          <Clock size={14} />
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                        <button 
                          onClick={() => {
                            const newHistory = history.filter(h => h.id !== item.id);
                            setHistory(newHistory);
                            localStorage.setItem('voice_dna_history', JSON.stringify(newHistory));
                          }}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold uppercase text-text-dim">Original</div>
                          <div className="text-sm text-text-dim line-clamp-3 bg-bg/50 p-3 rounded-xl border border-border/50">
                            {item.original}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-[10px] font-bold uppercase text-success">Humanized</div>
                          <div className="text-sm text-text-main line-clamp-3 bg-bg/50 p-3 rounded-xl border border-border/50">
                            {item.humanized}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => {
                            setInputText(item.original);
                            setOutputLines([{ original: item.original, humanized: item.humanized }]);
                            setActiveTab('humanize');
                          }}
                          className="text-xs font-bold text-accent hover:underline"
                        >
                          Restore to Editor
                        </button>
                        <button 
                          onClick={() => navigator.clipboard.writeText(item.humanized)}
                          className="text-xs font-bold text-text-dim hover:text-text-main"
                        >
                          Copy Result
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-card border border-border rounded-full flex items-center justify-center mb-6">
                    <History className="text-text-dim/30" size={40} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">No History Yet</h2>
                  <p className="text-text-dim max-w-md text-sm">
                    Your humanized texts will be saved here automatically once you start using the tool.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col gap-6 overflow-hidden"
            >
              <ChatView profile={profile!} />
            </motion.div>
          )}

          {activeTab === 'verification' && outputLines.length > 0 && (
            <motion.div 
              key="verification"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2"
            >
              <VerificationView text={outputLines[0].humanized} />
            </motion.div>
          )}

          {activeTab === 'support' && (
            <motion.div 
              key="support"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col gap-6 overflow-hidden"
            >
              <SupportView hasResendKey={hasResendKey} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function SupportView({ hasResendKey }: { hasResendKey: boolean }) {
  const [formData, setFormData] = useState({
    type: 'Feedback',
    subject: '',
    message: '',
    email: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (resp.ok) {
        setSuccess(true);
        setFormData({ type: 'Feedback', subject: '', message: '', email: '' });
      } else {
        const errData = await resp.json();
        alert(errData.error || "Failed to send message.");
      }
    } catch (err) {
      console.error(err);
      alert("A network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-card border border-border rounded-3xl"
      >
        <div className="w-24 h-24 bg-success/10 text-success rounded-full flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
          <CheckCircle2 size={48} />
        </div>
        <h2 className="text-3xl font-bold mb-4 italic">Message Sent!</h2>
        <p className="text-text-main text-lg max-w-lg mb-8 leading-relaxed">
          Your feedback has been successfully delivered to <span className="text-accent font-bold">myauthgrp@gmail.com</span>. 
        </p>
        <div className="text-xs text-text-dim/60 mb-8 max-w-md mx-auto">
          Sent via Resend (Sandbox Mode). To enable delivery to multiple recipients, consider verifying your domain at resend.com.
        </div>
        <button 
          onClick={() => setSuccess(false)}
          className="px-10 py-4 bg-accent text-white rounded-xl font-bold text-lg hover:bg-accent/90 transition-all shadow-xl shadow-accent/20"
        >
          Send Another Message
        </button>
      </motion.div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
        <div className="bg-card border border-border rounded-3xl p-6 md:p-8 flex flex-col gap-6 overflow-hidden">
           <div className="shrink-0">
             <h2 className="text-xl md:text-2xl font-bold mb-2">How can we help?</h2>
             <p className="text-sm text-text-dim">Report bugs, suggest features, or just say hello.</p>
           </div>

           {!hasResendKey && (
             <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-start gap-4">
               <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
               <div className="text-sm text-amber-200/80 leading-relaxed">
                 <strong className="text-amber-500 block mb-0.5">Contact Method Disabled</strong>
                 To send emails, please add a secret named <code className="text-amber-400 bg-black/20 px-1 rounded">RESEND_API_KEY</code> in the platform settings.
               </div>
             </div>
           )}

           <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim ml-1">Inquiry Type</label>
                  <select 
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent transition-all appearance-none"
                  >
                    <option>Feedback</option>
                    <option>Support</option>
                    <option>Contact</option>
                    <option>Bug Report</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim ml-1">Your Email (Optional)</label>
                  <input 
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent transition-all"
                  />
                </div>
             </div>

             <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim ml-1">Subject</label>
               <input 
                 required
                 placeholder="What is this about?"
                 value={formData.subject}
                 onChange={e => setFormData({...formData, subject: e.target.value})}
                 className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-accent transition-all"
               />
             </div>

             <div className="space-y-2 flex-1 min-h-[120px]">
               <label className="text-[10px] font-bold uppercase tracking-widest text-text-dim ml-1">Message</label>
               <textarea 
                 required
                 placeholder="Tell us more..."
                 value={formData.message}
                 onChange={e => setFormData({...formData, message: e.target.value})}
                 className="w-full h-full min-h-[120px] bg-bg border border-border rounded-xl p-4 text-sm focus:ring-1 focus:ring-accent transition-all resize-none"
               />
             </div>

             <button 
               disabled={isSubmitting}
               className="mt-2 w-full py-4 bg-accent text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-accent/20 shrink-0"
             >
               {isSubmitting ? (
                 <Loader2 className="animate-spin" size={20} />
               ) : (
                 <>
                   <Mail size={18} />
                   Send Message
                 </>
               )}
             </button>
           </form>
        </div>

        <div className="hidden lg:flex flex-col gap-6">
           <div className="bg-accent/5 border border-accent/20 rounded-3xl p-8">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-accent">
                <MessageSquare size={20} />
                Knowledge Base
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-card/50 rounded-2xl border border-border/50">
                  <h4 className="text-sm font-bold mb-1 font-sans">What is Voice DNA?</h4>
                  <p className="text-xs text-text-dim leading-relaxed">Our engine analyzes rhythm, vocabulary, and punctuation to replicate your unique writing personality.</p>
                </div>
                <div className="p-4 bg-card/50 rounded-2xl border border-border/50">
                  <h4 className="text-sm font-bold mb-1 font-sans">Privacy Guarantee</h4>
                  <p className="text-xs text-text-dim leading-relaxed">All writing samples and DNA profiles are stored locally in your browser and never shared with 3rd parties.</p>
                </div>
              </div>
           </div>

           <div className="bg-sidebar border border-border rounded-3xl p-8 flex-1 flex flex-col justify-center items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mb-6">
                <Mail size={32} />
              </div>
              <h3 className="font-bold mb-1 text-lg">Direct Support</h3>
              <p className="text-xs text-text-dim mb-6 max-w-[200px]">For urgent inquiries, you can reach us directly at:</p>
              <div className="group relative">
                <code className="text-xs bg-bg px-4 py-2 rounded-xl border border-border text-accent font-mono select-all flex items-center gap-2 transition-all hover:border-accent/50 hover:bg-accent/5">
                  myauthgrp@gmail.com
                </code>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, disabled = false }: { active?: boolean, onClick?: () => void, icon: React.ReactNode, label: string, disabled?: boolean }) {
  return (
    <button 
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group",
        active ? "bg-card text-text-main shadow-sm" : "text-text-dim hover:text-text-main hover:bg-card/50",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      <div className={cn("w-1.5 h-1.5 rounded-full shrink-0 transition-all", active ? "bg-accent scale-100" : "bg-transparent scale-0 group-hover:scale-50 group-hover:bg-text-dim")} />
      <span className="shrink-0">{icon}</span>
      <span className="font-medium truncate">{label}</span>
    </button>
  );
}

function MetricCard({ label, value, fill }: { label: string, value: string, fill: number }) {
  return (
    <div className="bg-card border border-border p-4 rounded-xl relative overflow-hidden group">
      <div className="text-[10px] font-bold uppercase tracking-widest text-text-dim mb-1">{label}</div>
      <div className="text-xl font-mono font-bold text-text-main">{value}</div>
      <div className="absolute top-4 right-4 w-10 h-1 bg-border rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full" style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

function LandingPage({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="min-h-screen bg-landing-bg text-text-main selection:bg-accent/30 selection:text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-landing-bg/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
            className="flex items-center gap-2.5 font-bold text-xl text-accent hover:opacity-80 transition-opacity"
          >
            <Dna size={28} strokeWidth={2.5} />
            VoiceDNA
          </button>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-text-dim">
            <a href="#features" className="hover:text-text-main transition-colors">Features</a>
            <a href="#science" className="hover:text-text-main transition-colors">The Science</a>
            <a href="#pricing" className="hover:text-text-main transition-colors">Pricing</a>
          </div>
          <button 
            onClick={onLaunch}
            className="px-5 py-2 bg-accent text-white rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent/20"
          >
            Launch App
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 hero-gradient">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-[11px] font-bold uppercase tracking-widest mb-6">
              AI Style Mimicry v2.0
            </span>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[0.9] tracking-tight text-white italic">
              WRITE LIKE <span className="text-accent not-italic">YOU</span>,<br /> 
              EVEN WITH AI.
            </h1>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-text-dim mb-10 leading-relaxed text-balance">
              Every human has a unique writing fingerprint. Our engine analyzes yours to transform robotic AI output into text that sounds exactly like you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={onLaunch}
                className="w-full sm:w-auto px-10 py-4 bg-accent text-white rounded-xl font-bold text-lg hover:bg-accent/90 transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent/25"
              >
                Humanize Now
                <ArrowRightLeft size={20} />
              </button>
              <button className="w-full sm:w-auto px-10 py-4 glass-card text-text-main rounded-xl font-bold text-lg hover:bg-white/10 transition-all">
                View Samples
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-12 border-y border-white/5 bg-sidebar/30">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatBox label="Detectors Bypassed" value="99.8%" />
          <StatBox label="Active Users" value="12k+" />
          <StatBox label="Styles Analyzed" value="45k" />
          <StatBox label="API Latency" value="< 1.2s" />
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 md:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 md:mb-24">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight italic">Why Voice DNA?</h2>
            <div className="h-1.5 w-24 bg-accent rounded-full mb-6"></div>
            <p className="text-text-dim max-w-xl">We don't just add filler words. We replicate your internal rhythm, vocabulary level, and punctuation quirks.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Dna className="text-accent" />}
              title="Style Calibration"
              desc="Upload your writing samples and our forensic engine extracts your unique 'Voice DNA' profile."
            />
            <FeatureCard 
              icon={<Sparkles className="text-accent" />}
              title="Anti-GPT Signature"
              desc="Removes standard AI patterns like markdown bolding, lists, and robotic sentence structures."
            />
            <FeatureCard 
              icon={<History className="text-accent" />}
              title="Local History"
              desc="Your data stays yours. Profiles and history are stored locally in your browser for privacy."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-white/5 bg-sidebar/50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between gap-12 mb-12">
            <div>
              <button 
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }} 
                className="flex items-center gap-2.5 font-bold text-xl text-accent mb-4 hover:opacity-80 transition-opacity"
              >
                <Dna size={28} strokeWidth={2.5} />
                VoiceDNA
              </button>
              <p className="text-sm text-text-dim max-w-xs leading-relaxed">
                The world's most advanced behavioral mimicry engine for digital text.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
              <FooterCol title="Product" links={['Humanizer', 'API', 'Security', 'Models']} />
              <FooterCol title="Company" links={['About', 'Privacy', 'Twitter', 'GitHub']} />
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] text-text-dim uppercase tracking-widest font-medium">© 2026 <a href="https://myauthdev.com" target="_blank" rel="noopener noreferrer" className="hover:text-accent underline decoration-white/10 underline-offset-4">MyAuthGrp</a> Labs. All rights reserved.</p>
              <p className="text-[10px] text-text-dim/60">
                Developed by <a href="https://bipinkhatiwada.com.np" target="_blank" rel="noopener noreferrer" className="text-accent/60 hover:text-accent transition-colors underline decoration-accent/20 underline-offset-2">Bipin Khatiwada</a>
              </p>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-[10px] px-2 py-0.5 rounded bg-success/10 text-success border border-success/20 font-bold uppercase flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                SYSTEM: OPERATIONAL • MYAUTHGRP
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatBox({ label, value }: { label: string, value: string }) {
  return (
    <div className="text-center group">
      <div className="text-2xl md:text-3xl font-mono font-bold text-white mb-1 group-hover:text-accent transition-colors">{value}</div>
      <div className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-text-dim">{label}</div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-8 rounded-3xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group">
      <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-text-dim text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function FooterCol({ title, links }: { title: string, links: string[] }) {
  return (
    <div className="space-y-4">
      <h4 className="text-[11px] font-bold uppercase tracking-widest text-white">{title}</h4>
      <div className="flex flex-col gap-2">
        {links.map(link => (
          <a key={link} href="#" className="text-sm text-text-dim hover:text-accent transition-colors">{link}</a>
        ))}
      </div>
    </div>
  );
}

function VerificationView({ text }: { text: string }) {
  const [scanResult, setScanResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const runScan = async () => {
      setIsScanning(true);
      try {
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        if (response.ok) {
          const data = await response.json();
          setScanResult(data);
        }
      } catch (err) {
        console.error("Scan failed:", err);
      } finally {
        setIsScanning(false);
      }
    };
    runScan();
  }, [text]);

  const externalTools = [
    { name: 'ZeroGPT', url: 'https://www.zerogpt.com/', color: 'text-blue-400', desc: 'High accuracy with deep sentence-level analysis' },
    { name: 'GPTZero', url: 'https://gptzero.me/', color: 'text-emerald-400', desc: 'The gold standard for educators and academic integrity' },
    { name: 'QuillBot', url: 'https://quillbot.com/ai-detector', color: 'text-orange-400', desc: 'Specialized in detecting paraphrased and reworded AI content' },
    { name: 'CopyLeaks', url: 'https://copyleaks.com/ai-content-detector', color: 'text-purple-400', desc: 'Enterprise-grade military-level detection across 30+ languages' },
    { name: 'Content at Scale', url: 'https://contentatscale.ai/ai-content-detector/', color: 'text-lime-400', desc: 'Best for detecting SEO-focused AI long-form articles' },
    { name: 'Winston AI', url: 'https://gowinston.ai/', color: 'text-yellow-400', desc: 'Highly rated for GPT-4, Claude, and Gemini detection' },
    { name: 'Originality.ai', url: 'https://originality.ai/', color: 'text-red-400', desc: 'Aggressive detection tailored for professional web publishers' },
    { name: 'Hive Moderation', url: 'https://hivemoderation.com/ai-generated-content-detection', color: 'text-amber-500', desc: 'Powerful multi-modal detection trusted by major platforms' },
    { name: 'Crossplag', url: 'https://crossplag.com/ai-content-detector/', color: 'text-blue-500', desc: 'Linguistic-based analysis with integrated plagiarism checks' },
    { name: 'Sapling', url: 'https://sapling.ai/ai-content-detector', color: 'text-cyan-400', desc: 'Lightweight and fast, perfect for quick email and chat scans' },
    { name: 'Scribbr', url: 'https://www.scribbr.com/ai-detector/', color: 'text-indigo-400', desc: 'Reliable academic-focused checker powered by Turnitin logic' },
    { name: 'Stealth Writer', url: 'https://stealthwriter.ai/', color: 'text-pink-400', desc: 'The ultimate benchmark to test text against invisible AI' }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Internal Diagnostic Card */}
        <div className="lg:col-span-2 bg-card border border-border rounded-3xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-success to-accent" />
          <div className="p-8">
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-3">
                 <div className="p-3 rounded-2xl bg-success/10 text-success">
                   <ShieldCheck size={24} />
                 </div>
                 <div>
                   <h3 className="text-xl font-bold">Internal Scan Results</h3>
                   <p className="text-xs text-text-dim uppercase tracking-widest font-bold">
                     Engine: <a href="https://myauthdev.com" target="_blank" rel="noopener noreferrer" className="hover:text-accent underline decoration-white/10 decoration-dotted underline-offset-4">MyAuthGrp</a> Diagnostic
                   </p>
                 </div>
               </div>
               {isScanning && <Loader2 className="animate-spin text-accent" size={24} />}
            </div>

            {scanResult ? (
              <div className="space-y-8">
                <div className="flex items-end gap-6">
                  <div className="text-7xl font-mono font-bold text-white leading-none">
                    {100 - scanResult.score}<span className="text-2xl text-text-dim font-sans ml-2">%</span>
                  </div>
                  <div className="pb-1">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-success mb-1">Human Probability</div>
                    <div className="flex gap-1">
                      {[...Array(10)].map((_, i) => (
                        <div key={i} className={cn(
                          "w-3 h-1.5 rounded-full transition-colors",
                          i < (10 - scanResult.score/10) ? "bg-success" : "bg-white/5"
                        )} />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/5">
                  <div className="space-y-1">
                    <div className="text-[10px] text-text-dim uppercase font-bold">Perplexity</div>
                    <div className="text-sm font-mono text-white">{scanResult.breakdown.perplexity}%</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-text-dim uppercase font-bold">Burstiness</div>
                    <div className="text-sm font-mono text-white">{scanResult.breakdown.burstiness}%</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] text-text-dim uppercase font-bold">Pattern Match</div>
                    <div className="text-sm font-mono text-white">{scanResult.breakdown.patternMatch}%</div>
                  </div>
                </div>

                <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 flex gap-4 items-start">
                  <div className="p-2 rounded-lg bg-accent/10 text-accent">
                    <Search size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white mb-1 uppercase tracking-tight">Technical Analysis</div>
                    <p className="text-xs text-text-dim leading-relaxed italic">"{scanResult.analysis}"</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center opacity-30">
                <Search size={48} className="mb-4" />
                <p className="text-sm max-w-xs">Initializing deep behavioral scan of your humanized text...</p>
              </div>
            )}
          </div>
        </div>

        {/* Global Verification Card */}
        <div className="bg-sidebar border border-border rounded-3xl p-8 flex flex-col">
          <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
            <ExternalLink size={18} className="text-text-dim" />
            External Verification
          </h3>
          <p className="text-[11px] text-text-dim mb-8 font-medium leading-relaxed">
            Major platforms (Quillbot, Turnitin) protect their scan engines via login. Use the tools below for true multi-platform validation.
          </p>

          <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {externalTools.map(tool => (
              <button 
                key={tool.name}
                onClick={async () => {
                  try { await navigator.clipboard.writeText(text); } catch(e) {}
                  window.open(tool.url, '_blank');
                }}
                className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all flex items-center justify-between group"
              >
                <div className="text-left">
                  <div className={cn("text-sm font-bold mb-0.5 group-hover:text-white transition-colors", tool.color)}>{tool.name}</div>
                  <div className="text-[10px] text-text-dim">{tool.desc}</div>
                </div>
                <div className="p-2 rounded-lg bg-white/5 text-text-dim group-hover:bg-white/10 group-hover:text-white transition-all">
                  <Check size={14} />
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 p-4 rounded-2xl bg-accent/5 border border-accent/10 flex items-center gap-4">
             <div className="p-2 rounded-xl bg-accent/20 text-accent">
               <ShieldAlert size={16} />
             </div>
             <p className="text-[10px] text-accent/80 leading-relaxed font-bold uppercase tracking-tight">
               Text is already copied to your clipboard. Just paste (Ctrl+V) when the tool opens.
             </p>
          </div>
        </div>
      </div>

      <div className="p-6 bg-card border border-border rounded-3xl flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/5 rounded-2xl text-text-dim">
            <FileText size={20} />
          </div>
          <div>
            <div className="text-sm font-bold">Scanning Document</div>
            <p className="text-xs text-text-dim">{text.slice(0, 60)}...</p>
          </div>
        </div>
        <button 
          onClick={async () => {
             try {
                await navigator.clipboard.writeText(text);
                alert("Copied to clipboard!");
             } catch(e) {}
          }}
          className="px-6 py-2.5 bg-sidebar border border-border rounded-xl text-sm font-bold hover:bg-white/5 transition-colors"
        >
          Recopy Text
        </button>
      </div>
    </div>
  );
}

function ChatView({ profile }: { profile: StyleProfile }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [useLowLatency, setUseLowLatency] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const chatHistory = [...messages, userMessage].map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: chatHistory, 
          profile,
          useThinking,
          useLowLatency
        })
      });

      if (!response.ok) throw new Error("Failed to get response");
      const data = await response.json();

      const aiMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        content: data.result,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
      alert("Error sending message.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-hidden">
      <div className="bg-card border border-border rounded-3xl flex-1 flex flex-col overflow-hidden relative">
        {/* Chat Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
               <Bot size={20} />
             </div>
             <div>
               <div className="text-sm font-bold">Assistant Guide</div>
               <div className="text-[10px] text-success flex items-center gap-1 font-bold uppercase">
                 <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                 Active Support
               </div>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { setUseThinking(!useThinking); if (!useThinking) setUseLowLatency(false); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                useThinking ? "bg-accent text-white" : "bg-bg text-text-dim border border-border"
              )}
            >
              <Sparkles size={14} />
              High Thinking
            </button>
            <button 
              onClick={() => { setUseLowLatency(!useLowLatency); if (!useLowLatency) setUseThinking(false); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                useLowLatency ? "bg-success text-white" : "bg-bg text-text-dim border border-border"
              )}
            >
              <Clock size={14} />
              Low Latency
            </button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <Bot size={32} />
              </div>
              <p className="text-sm max-w-xs">Ask me how to use the app, where to click, or about your privacy.</p>
            </div>
          ) : (
            messages.map((m) => (
              <motion.div 
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-4",
                  m.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1",
                  m.role === 'user' ? "bg-accent/20 text-accent" : "bg-white/10 text-text-main"
                )}>
                  {m.role === 'user' ? <Upload size={14} /> : <Bot size={14} />}
                </div>
                <div className={cn(
                  "max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed",
                  m.role === 'user' ? "bg-accent text-white" : "bg-bg border border-border"
                )}>
                  {m.content}
                </div>
              </motion.div>
            ))
          )}
          {isSending && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Bot size={14} />
              </div>
              <div className="bg-bg border border-border p-4 rounded-2xl">
                <Loader2 size={16} className="animate-spin text-accent" />
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <form onSubmit={handleSend} className="p-4 bg-white/[0.02] border-t border-border">
          <div className="relative">
            <input 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={isSending ? "Syncing..." : "Type your message..."}
              disabled={isSending}
              className="w-full bg-bg border border-border rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-1 focus:ring-accent transition-all"
            />
            <button 
              disabled={!input.trim() || isSending}
              className="absolute right-2 top-1.5 p-2 bg-accent text-white rounded-lg disabled:opacity-50 transition-all hover:bg-accent/90"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
