import React, { useRef, useState } from 'react';
import { ProcessedData } from '../types';
import VideoPlayer, { VideoPlayerRef } from './VideoPlayer';
import NotesPanel from './NotesPanel';
import FlashcardsPanel from './FlashcardsPanel';
import { ArrowLeft, Volume2, Loader2, Download, FileText, FileVideo } from 'lucide-react';

interface DashboardProps {
  file: File;
  data: ProcessedData;
  onBack: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ file, data, onBack }) => {
  const videoRef = useRef<VideoPlayerRef>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'flashcards'>('notes');
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const videoUrl = URL.createObjectURL(file);

  const handleNoteClick = (timestampStr: string) => {
    // Parse timestamp HH:MM:SS to seconds
    const parts = timestampStr.split(':').map(Number);
    let seconds = 0;
    if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
    
    videoRef.current?.seekTo(seconds);
  };

  const handleTranscriptClick = async (text: string, id: string, lang: string) => {
    setLoadingAudioId(id);
    try {
        // Use local TTS via video player ref
        videoRef.current?.playAudioManual(text, lang);
    } catch (e) {
        console.error(e);
    } finally {
        // Since local TTS is fire-and-forget (mostly), we clear loading immediately
        // or we could track speaking state in VideoPlayer but simple is better here.
        setLoadingAudioId(null);
    }
  };

  const handleDownloadSource = () => {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowExportMenu(false);
  };

  const exportSRT = (type: 'bilingual' | 'original' | 'vietnamese') => {
    let content = '';
    data.subtitles.forEach((sub, index) => {
        // SRT format:
        // 1
        // 00:00:01,000 --> 00:00:04,000
        // Text line 1
        // Text line 2
        
        // Ensure millisecond format (Simple approximation)
        const start = sub.startTime.includes(',') ? sub.startTime : `${sub.startTime},000`;
        const end = sub.endTime.includes(',') ? sub.endTime : `${sub.endTime},000`;

        content += `${index + 1}\n`;
        content += `${start} --> ${end}\n`;
        
        if (type === 'bilingual') {
            content += `${sub.textOriginal}\n`;
            content += `${sub.textVietnamese}\n\n`;
        } else if (type === 'original') {
            content += `${sub.textOriginal}\n\n`;
        } else {
            content += `${sub.textVietnamese}\n\n`;
        }
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.split('.')[0]}_${type}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowExportMenu(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800 leading-tight max-w-md truncate" title={file.name}>{file.name}</h1>
            <p className="text-xs text-gray-500">Bilingual Study Mode (Local TTS)</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            {/* Export Dropdown */}
            <div className="relative">
                <button 
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export</span>
                </button>
                
                {showExportMenu && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 z-20 overflow-hidden">
                            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                                Subtitles
                            </div>
                            <button onClick={() => exportSRT('bilingual')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600">
                                Bilingual (.srt)
                            </button>
                            <button onClick={() => exportSRT('vietnamese')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600">
                                Vietnamese Only (.srt)
                            </button>
                            <button onClick={() => exportSRT('original')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600">
                                Original Only (.srt)
                            </button>

                            <div className="border-t border-gray-100 my-1"></div>
                            
                            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                                Media
                            </div>
                            <button onClick={handleDownloadSource} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2">
                                <FileVideo className="w-4 h-4" />
                                Download Source Video
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block"></div>

            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button 
                    onClick={() => setActiveTab('notes')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'notes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Notes
                </button>
                <button 
                    onClick={() => setActiveTab('flashcards')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'flashcards' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Flashcards
                </button>
            </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Video Player */}
        <div className="lg:col-span-2 space-y-4">
          <VideoPlayer 
            ref={videoRef} 
            src={videoUrl} 
            subtitles={data.subtitles} 
          />
          
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
             <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    Transcript Preview
                </h3>
             </div>
             <div className="h-64 overflow-y-auto custom-scrollbar text-sm space-y-1 pr-2">
                {data.subtitles.map(sub => (
                    <div key={sub.id} className="grid grid-cols-12 gap-3 hover:bg-indigo-50/50 p-3 rounded-lg transition-colors group border border-transparent hover:border-indigo-100">
                        <span 
                            className="col-span-2 text-gray-400 font-mono text-xs cursor-pointer hover:text-indigo-600 hover:underline pt-1"
                            onClick={() => handleNoteClick(sub.startTime)}
                        >
                            {sub.startTime}
                        </span>
                        <div className="col-span-10 flex flex-col gap-1">
                            <div className="flex items-start justify-between">
                                <p className="text-gray-900 font-medium leading-relaxed">{sub.textOriginal}</p>
                                <button 
                                    onClick={() => handleTranscriptClick(sub.textOriginal, `${sub.id}-orig`, 'en-US')}
                                    disabled={loadingAudioId !== null}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-white transition-all shadow-sm"
                                    title="Play Original (Local)"
                                >
                                    {loadingAudioId === `${sub.id}-orig` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                            <div className="flex items-start justify-between">
                                <p className="text-indigo-600 text-sm italic leading-relaxed">{sub.textVietnamese}</p>
                                <button 
                                    onClick={() => handleTranscriptClick(sub.textVietnamese, `${sub.id}-vn`, 'vi-VN')}
                                    disabled={loadingAudioId !== null}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-white transition-all shadow-sm"
                                    title="Đọc tiếng Việt (Local)"
                                >
                                    {loadingAudioId === `${sub.id}-vn` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
             </div>
          </div>
        </div>

        {/* Right Column: Tools */}
        <div className="lg:col-span-1 h-[600px] lg:h-auto lg:min-h-[calc(100vh-8rem)] sticky top-24">
            {activeTab === 'notes' ? (
                <NotesPanel notes={data.notes} onNoteClick={handleNoteClick} />
            ) : (
                <FlashcardsPanel cards={data.flashcards} />
            )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;