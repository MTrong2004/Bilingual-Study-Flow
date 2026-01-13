import React, { useState, ChangeEvent, useEffect } from 'react';
import { Upload, FileVideo, FileAudio, CheckCircle2, AlertCircle, Sparkles, XCircle, Mic2, BookOpen, Layers, ArrowRight, History, Zap } from 'lucide-react';
import { ProcessingOptions, ProcessedData } from '../types';
import { getFromCache } from '../services/cacheService';

interface FileUploadProps {
  onStart: (file: File, options: ProcessingOptions, cachedData?: ProcessedData) => void;
  onCancel?: () => void;
  isLoading: boolean;
  statusMessage?: string | null;
  progress?: number;
}

const FileUpload: React.FC<FileUploadProps> = ({ onStart, onCancel, isLoading, statusMessage, progress = 0 }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cachedData, setCachedData] = useState<ProcessedData | null>(null);
  const [checkingCache, setCheckingCache] = useState(false);
  const [options, setOptions] = useState<ProcessingOptions>({
    generateNotes: true,
    generateFlashcards: true,
    originalLanguage: 'Auto Detect'
  });

  // Check cache whenever file changes
  useEffect(() => {
    const checkFileCache = async () => {
        if (file) {
            setCheckingCache(true);
            const cached = await getFromCache(file);
            if (cached) {
                setCachedData(cached);
            } else {
                setCachedData(null);
            }
            setCheckingCache(false);
        } else {
            setCachedData(null);
        }
    };
    checkFileCache();
  }, [file]);

  const validateAndSetFile = (selectedFile: File) => {
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB
    if (selectedFile.size > maxSize) {
      setError("File exceeds 2GB limit.");
      setFile(null);
    } else {
      setError(null);
      setFile(selectedFile);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) validateAndSetFile(e.target.files[0]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleSubmit = () => {
    if (file) {
        // Pass cachedData (if it exists) to the start function
        onStart(file, options, cachedData || undefined);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="bg-white/5 backdrop-blur-2xl rounded-[2rem] border border-white/10 p-8 md:p-12 relative overflow-hidden shadow-2xl">
        
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white mb-2">Initialize Session</h2>
            <p className="text-gray-400 mb-8">Upload media to begin extraction.</p>

            {/* Drop Zone */}
            <div 
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className={`group relative border border-dashed rounded-2xl p-10 transition-all duration-300 ease-in-out cursor-pointer text-center mb-8
                ${error ? 'border-red-500/50 bg-red-500/5' : 
                  cachedData ? 'border-amber-500/50 bg-amber-500/5' :
                  file ? 'border-green-500/50 bg-green-500/5' : 
                  'border-white/20 hover:border-white/40 hover:bg-white/5'}`}
            >
                <input 
                type="file" 
                accept="video/*,audio/*" 
                className="hidden" 
                id="fileInput"
                onChange={handleFileChange}
                disabled={isLoading}
                />
                <label htmlFor="fileInput" className={`flex flex-col items-center w-full ${isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                {file ? (
                    <div className="flex items-center gap-6 w-full">
                        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white border border-white/10 shrink-0">
                            {file.type.startsWith('video') ? <FileVideo className="w-8 h-8" /> : <FileAudio className="w-8 h-8" />}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                            <h3 className="text-white font-bold text-lg truncate">{file.name}</h3>
                            <div className="flex items-center gap-3 mt-1">
                                <p className="text-green-400 font-medium text-sm flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Ready
                                </p>
                                {checkingCache ? (
                                    <span className="flex items-center gap-1 text-gray-400 text-xs font-mono animate-pulse">
                                        Checking cache...
                                    </span>
                                ) : cachedData ? (
                                    <span className="flex items-center gap-1 text-amber-400 text-xs font-bold uppercase tracking-wider bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                                        <History className="w-3 h-3" /> Previous Translation Found
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <button 
                            onClick={(e) => { e.preventDefault(); setFile(null); setCachedData(null); }}
                            className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                        >
                            <XCircle className="w-6 h-6" />
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-white/5 group-hover:bg-white/10 rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-white mb-4 transition-colors border border-white/5">
                            {error ? <AlertCircle className="w-8 h-8 text-red-400" /> : <Upload className="w-8 h-8" />}
                        </div>
                        <h3 className="text-lg font-bold text-gray-200 group-hover:text-white transition-colors">
                            {error ? <span className="text-red-400">{error}</span> : "Drop files or click to browse"}
                        </h3>
                        <p className="text-gray-500 text-sm mt-2 font-mono">MP4, MOV, MP3 (Max 2GB)</p>
                    </>
                )}
                </label>
            </div>

            {/* Options Grid */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
                
                {/* Language Select */}
                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-1">Input Source</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Mic2 className="h-4 w-4 text-gray-400" />
                        </div>
                        <select 
                            value={options.originalLanguage}
                            onChange={(e) => setOptions({...options, originalLanguage: e.target.value})}
                            className="block w-full pl-10 pr-10 py-4 text-sm border border-white/10 focus:outline-none focus:border-white/30 rounded-xl bg-black/40 text-white cursor-pointer appearance-none font-medium transition-colors hover:bg-black/60"
                        >
                            <option value="Auto Detect">Auto Detect Language</option>
                            <option value="English">English</option>
                            <option value="Japanese">Japanese</option>
                            <option value="Korean">Korean</option>
                            <option value="Chinese">Chinese</option>
                            <option value="French">French</option>
                            <option value="Vietnamese">Vietnamese</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                             <Sparkles className="h-3 w-3 text-gray-500" />
                        </div>
                    </div>
                </div>

                {/* Option Card: Notes */}
                <div 
                    onClick={() => !isLoading && setOptions({...options, generateNotes: !options.generateNotes})}
                    className={`cursor-pointer flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${options.generateNotes ? 'border-white/30 bg-white/10' : 'border-white/5 bg-transparent hover:bg-white/5'}`}
                >
                    <div className={`p-2 rounded-lg ${options.generateNotes ? 'text-white' : 'text-gray-600'}`}>
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <h4 className={`font-bold text-sm ${options.generateNotes ? 'text-white' : 'text-gray-500'}`}>Smart Notes</h4>
                    </div>
                    {options.generateNotes && <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>}
                </div>

                {/* Option Card: Flashcards */}
                <div 
                    onClick={() => !isLoading && setOptions({...options, generateFlashcards: !options.generateFlashcards})}
                    className={`cursor-pointer flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${options.generateFlashcards ? 'border-white/30 bg-white/10' : 'border-white/5 bg-transparent hover:bg-white/5'}`}
                >
                    <div className={`p-2 rounded-lg ${options.generateFlashcards ? 'text-white' : 'text-gray-600'}`}>
                        <Layers className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <h4 className={`font-bold text-sm ${options.generateFlashcards ? 'text-white' : 'text-gray-500'}`}>Flashcards</h4>
                    </div>
                    {options.generateFlashcards && <div className="w-2 h-2 rounded-full bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.5)]"></div>}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
                 {isLoading && onCancel && (
                    <button 
                        onClick={onCancel}
                        className="px-6 py-4 rounded-xl font-bold text-gray-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={!file || isLoading || !!error || checkingCache}
                    className={`flex-1 py-4 px-6 rounded-full font-bold text-sm tracking-wide text-black transition-all transform active:scale-95 flex items-center justify-center gap-2 relative overflow-hidden ${
                    !file || isLoading || !!error || checkingCache
                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                        : cachedData 
                            ? 'bg-amber-400 hover:bg-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.5)]'
                            : 'bg-white hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                    }`}
                >
                    {isLoading ? (
                         <>
                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                            <span>PROCESSING {progress}%</span>
                         </>
                    ) : cachedData ? (
                        <>
                            <Zap className="w-4 h-4" />
                            <span>INSTANT LOAD (CACHE)</span>
                        </>
                    ) : (
                        <>
                            <span>GENERATE KIT</span>
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>

            {/* Progress Message */}
            {isLoading && (
                <div className="mt-8 text-center">
                    <p className="text-xs font-mono text-gray-400 animate-pulse uppercase tracking-widest">{statusMessage}</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;