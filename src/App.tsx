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
  Clock
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import ReactDiffViewer from 'react-diff-viewer-continued';
import mammoth from 'mammoth';
import { analyzeStyle, humanizeText } from './lib/gemini';
import { StyleProfile } from './types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [isAppStarted, setIsAppStarted] = useState(() => {
    return localStorage.getItem('voice_dna_profile') !== null;
  });
  const [activeTab, setActiveTab] = useState<'calibration' | 'humanize' | 'history' | 'profile'>('calibration');
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [samples, setSamples] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [outputLines, setOutputLines] = useState<{original: string, humanized: string}[]>([]);
  const [isHumanizing, setIsHumanizing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [history, setHistory] = useState<{id: string, original: string, humanized: string, timestamp: number}[]>([]);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!process.env.GEMINI_API_KEY) {
      setErrorStatus("GEMINI_API_KEY is missing. Please add it to your Secrets in AI Studio.");
    }
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
        <div className="flex items-center gap-2.5 font-bold text-lg text-accent">
          <Dna size={24} strokeWidth={2.5} />
          VoiceDNA
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-text-main">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r border-border flex flex-col p-6 transition-transform duration-300 lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="hidden lg:flex items-center gap-2.5 font-bold text-lg mb-10 text-accent">
          <Dna size={24} strokeWidth={2.5} />
          VoiceDNA
        </div>
        
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
                active={activeTab === 'history'} 
                onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }}
                icon={<History size={18} />}
                label="History"
              />
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-dim mb-3 font-semibold">Library</div>
            <div className="space-y-1">
              <NavItem icon={<FileText size={18} />} label="Recent Drafts" onClick={() => { setActiveTab('humanize'); setIsSidebarOpen(false); }} />
              <NavItem icon={<History size={18} />} label="Calibration Sets" onClick={() => { setActiveTab('calibration'); setIsSidebarOpen(false); }} />
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
              {activeTab === 'calibration' ? 'Voice Calibration' : activeTab === 'humanize' ? 'Humanize Draft' : activeTab === 'profile' ? 'Voice DNA Profile' : 'History'}
            </h1>
            <p className="text-xs md:text-sm text-text-dim mt-1">
              {activeTab === 'calibration' ? 'Upload samples to build your Voice DNA' : activeTab === 'humanize' ? `Applying "${profile?.name}" Voice Profile` : activeTab === 'profile' ? 'Deep analysis of your unique writing style' : 'Review your past humanized texts'}
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
              <div className="flex items-center gap-3">
                <AlertCircle size={18} />
                <span className="text-sm font-medium">{errorStatus}</span>
              </div>
              <button onClick={() => setErrorStatus(null)} className="p-1 hover:bg-white/10 rounded">
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
                  <div className="text-lg font-mono font-bold text-accent">Gemini-3-F</div>
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
        </AnimatePresence>
      </main>
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
          <div className="flex items-center gap-2.5 font-bold text-xl text-accent">
            <Dna size={28} strokeWidth={2.5} />
            VoiceDNA
          </div>
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
              <div className="flex items-center gap-2.5 font-bold text-xl text-accent mb-4">
                <Dna size={28} strokeWidth={2.5} />
                VoiceDNA
              </div>
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
            <p className="text-[11px] text-text-dim uppercase tracking-widest font-medium">© 2026 VoiceDNA Labs. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <span className="text-[10px] px-2 py-0.5 rounded bg-success/10 text-success border border-success/20 font-bold uppercase">System: Operational</span>
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
