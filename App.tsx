import React, { useState, useRef } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import LandingPage from './components/LandingPage';
import { AppState, ProcessedData, ProcessingOptions } from './types';
import { processMediaWithGemini } from './services/geminiService';
import { saveToCache } from './services/cacheService';
import { Sparkles } from 'lucide-react';

const App: React.FC = () => {
  // New State: Show Landing Page initially
  const [showLanding, setShowLanding] = useState(true);

  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  // Ref to hold the abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStartProcessing = async (file: File, options: ProcessingOptions, cachedData?: ProcessedData) => {
    setCurrentFile(file);
    setAppState(AppState.PROCESSING);
    setErrorMsg(null);
    setStatusMessage("Initializing...");
    setProgress(5);

    // If cached data is provided, skip the API call
    if (cachedData) {
        setStatusMessage("Loading from cache...");
        setProgress(100);
        setTimeout(() => {
            setProcessedData(cachedData);
            setAppState(AppState.DASHBOARD);
        }, 800); // Small fake delay for UX smoothness
        return;
    }

    // Create a new controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const data = await processMediaWithGemini(
        file, 
        options, 
        (status, pct) => {
            setStatusMessage(status);
            if (pct !== undefined) setProgress(pct);
        },
        controller.signal // Pass signal to service
      );
      
      // Save result to cache for future use
      await saveToCache(file, data);

      setProgress(100);
      setProcessedData(data);
      setAppState(AppState.DASHBOARD);
    } catch (err: any) {
      if (err.message === "Processing cancelled by user.") {
          resetApp();
          return;
      }
      
      console.error(err);
      setErrorMsg(err.message || "An unexpected error occurred during processing.");
      setAppState(AppState.ERROR);
      setProgress(0);
    } finally {
        setStatusMessage(null);
        abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          setStatusMessage("Cancelling...");
      }
  };

  const resetApp = () => {
    setAppState(AppState.UPLOAD);
    setCurrentFile(null);
    setProcessedData(null);
    setErrorMsg(null);
    setStatusMessage(null);
    setProgress(0);
  };

  const goHome = () => {
      resetApp();
      setShowLanding(true);
  };

  // 1. Landing Page View
  if (showLanding) {
      return <LandingPage onGetStarted={() => setShowLanding(false)} />;
  }

  // 2. Dashboard View (When file is processed)
  if (appState === AppState.DASHBOARD && currentFile && processedData) {
      return <Dashboard file={currentFile} data={processedData} onBack={resetApp} />;
  }

  // 3. Main App View (Upload / Processing / Error)
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-white selection:text-black">
        {/* Simple App Header */}
        <header className="absolute top-0 w-full p-8 flex justify-between items-center z-20">
            <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={goHome}>
                 <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg shadow-white/20">
                    <div className="w-2 h-2 bg-black rounded-full"></div>
                 </div>
                 <span className="font-bold text-lg text-white tracking-tight">BilingualFlow</span>
            </div>
            {appState === AppState.UPLOAD && (
                <button onClick={goHome} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                    Back to Home
                </button>
            )}
        </header>

        <main className="container mx-auto px-4 h-screen flex flex-col justify-center items-center relative z-10">
            
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>

            {/* Error Message Display */}
            {appState === AppState.ERROR && (
                <div className="w-full max-w-xl mb-8 animate-fade-in-up relative z-20">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center shadow-2xl backdrop-blur-md">
                        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3 text-red-400">
                            <span className="text-2xl">⚠</span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">Processing Failed</h3>
                        <p className="text-red-300 text-sm mb-4">{errorMsg}</p>
                        <button 
                            onClick={resetApp} 
                            className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors shadow-sm"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}
            
            <div className="relative z-20 w-full">
                <FileUpload 
                onStart={handleStartProcessing} 
                onCancel={handleCancel}
                isLoading={appState === AppState.PROCESSING}
                statusMessage={statusMessage}
                progress={progress}
                />
            </div>
        </main>

        <footer className="absolute bottom-6 w-full text-center text-gray-600 text-xs font-mono">
            <p>&copy; {new Date().getFullYear()} BilingualFlow • Gemini 1.5 Architecture</p>
        </footer>
    </div>
  );
};

export default App;