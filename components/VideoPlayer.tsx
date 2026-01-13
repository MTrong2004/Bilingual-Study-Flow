import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Subtitle } from '../types';
import { getTTSAudio } from '../services/geminiService';
import { 
  Captions, 
  Loader2, 
  Settings, 
  Maximize, 
  Minimize, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Headphones, 
  Check,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  subtitles: Subtitle[];
  onTimeUpdate?: (time: number) => void;
}

export interface VideoPlayerRef {
  seekTo: (seconds: number) => void;
  playAudioManual: (text: string, lang?: string) => void;
}

const parseTime = (timeStr: string): number => {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
};

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Available Gemini Voices
const GEMINI_VOICES = [
  { name: 'Kore (Female - Warm)', id: 'Kore' },
  { name: 'Puck (Male - Natural)', id: 'Puck' },
  { name: 'Charon (Male - Deep)', id: 'Charon' },
  { name: 'Fenrir (Male - Strong)', id: 'Fenrir' },
  { name: 'Zephyr (Female - Soft)', id: 'Zephyr' },
];

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(({ src, subtitles, onTimeUpdate }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Audio Context & Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const onlineAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());

  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Settings & Dubbing State
  const [voiceMode, setVoiceMode] = useState<'LOCAL' | 'FREE_HQ' | 'GEMINI'>('FREE_HQ');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedLocalVoiceURI, setSelectedLocalVoiceURI] = useState<string>('');
  const [selectedGeminiVoice, setSelectedGeminiVoice] = useState<string>('Kore');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsMenu, setSettingsMenu] = useState<'MAIN' | 'VOICE_MODE' | 'VOICE_SELECT'>('MAIN');

  const [currentSub, setCurrentSub] = useState<Subtitle | null>(null);
  const [showSubs, setShowSubs] = useState(true);
  const [isAutoDub, setIsAutoDub] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  
  const lastPlayedSubId = useRef<number | null>(null);
  // CHANGED: Use number instead of NodeJS.Timeout for browser compatibility
  const controlsTimeoutRef = useRef<number | null>(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioContextRef.current = new AudioContext();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    return () => { audioContextRef.current?.close(); };
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      const availVoices = window.speechSynthesis.getVoices();
      if (availVoices.length > 0) {
        const sorted = availVoices.sort((a, b) => {
            const scoreA = (a.name.includes('Neural') || a.name.includes('Natural') ? 20 : 0) + (a.lang.includes('vi') ? 10 : 0);
            const scoreB = (b.name.includes('Neural') || b.name.includes('Natural') ? 20 : 0) + (b.lang.includes('vi') ? 10 : 0);
            return scoreB - scoreA;
        });
        setVoices(sorted);
        const bestVn = sorted.find(v => v.lang.includes('vi'));
        setSelectedLocalVoiceURI(bestVn ? bestVn.voiceURI : sorted[0]?.voiceURI || '');
      }
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // --- AUDIO LOGIC ---
  const setDucking = (active: boolean) => {
      if (videoRef.current) videoRef.current.volume = active ? (isMuted ? 0 : 0.1) : (isMuted ? 0 : volume);
  };

  const stopAllAudio = () => {
    if (audioSourceRef.current) { try { audioSourceRef.current.stop(); } catch(e) {} audioSourceRef.current = null; }
    if (onlineAudioRef.current) { onlineAudioRef.current.pause(); onlineAudioRef.current = null; }
    window.speechSynthesis.cancel();
    setSpeakingText(null);
    setLoadingAudio(false);
    setDucking(false);
  };

  const playGeminiAudio = async (text: string, onEnd: () => void) => {
      if (!audioContextRef.current || !gainNodeRef.current) return;
      const cacheKey = `${text}-${selectedGeminiVoice}`;
      try {
        let buffer: AudioBuffer;
        if (audioCache.current.has(cacheKey)) {
            buffer = audioCache.current.get(cacheKey)!;
        } else {
            setLoadingAudio(true);
            buffer = await getTTSAudio(text, selectedGeminiVoice, audioContextRef.current);
            audioCache.current.set(cacheKey, buffer);
            setLoadingAudio(false);
        }
        if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNodeRef.current);
        source.onended = onEnd;
        audioSourceRef.current = source;
        source.start();
      } catch (error) {
          setLoadingAudio(false);
          playFreeHQAudio(text, 'vi-VN', onEnd);
      }
  };

  const playFreeHQAudio = (text: string, langHint: string, onEnd: () => void) => {
        const langCode = langHint.split('-')[0]; 
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${langCode}&client=tw-ob`;
        const audio = new Audio(url);
        onlineAudioRef.current = audio;
        audio.playbackRate = 1.15; 
        audio.onended = onEnd;
        audio.onerror = () => playLocalAudio(text, langHint, onEnd); 
        audio.play().catch(() => playLocalAudio(text, langHint, onEnd));
  };

  const playLocalAudio = (text: string, langHint: string, onEnd: () => void) => {
    const utterance = new SpeechSynthesisUtterance(text);
    if (langHint !== 'vi-VN') {
        const specificVoice = voices.find(v => v.lang.startsWith(langHint.split('-')[0]));
        if (specificVoice) utterance.voice = specificVoice;
    } else {
        const userVoice = voices.find(v => v.voiceURI === selectedLocalVoiceURI);
        if (userVoice) utterance.voice = userVoice;
    }
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  };

  const speakText = (text: string, isManual: boolean, langHint: string = 'vi-VN') => {
    stopAllAudio();
    if (speakingText === text && isManual) return;
    setSpeakingText(text);
    setDucking(true);
    const onEnd = () => { setSpeakingText(null); setDucking(false); };

    if (langHint !== 'vi-VN') { playFreeHQAudio(text, langHint, onEnd); return; }

    switch (voiceMode) {
        case 'GEMINI': playGeminiAudio(text, onEnd); break;
        case 'FREE_HQ': playFreeHQAudio(text, langHint, onEnd); break;
        case 'LOCAL': default: playLocalAudio(text, langHint, onEnd); break;
    }
  };

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = seconds;
        videoRef.current.play();
        stopAllAudio();
      }
    },
    playAudioManual: (text: string, lang: string = 'vi-VN') => speakText(text, true, lang)
  }));

  // --- PLAYER CONTROLS LOGIC ---
  const togglePlay = () => {
      if (videoRef.current) {
          if (videoRef.current.paused) videoRef.current.play();
          else videoRef.current.pause();
      }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      if (onTimeUpdate) onTimeUpdate(time);

      const activeSubIndex = subtitles.findIndex(sub => {
        const start = parseTime(sub.startTime);
        const end = parseTime(sub.endTime);
        return time >= start && time <= end;
      });
      const activeSub = activeSubIndex !== -1 ? subtitles[activeSubIndex] : null;

      if (activeSub && isAutoDub && activeSub.id !== lastPlayedSubId.current) {
         lastPlayedSubId.current = activeSub.id;
         speakText(activeSub.textVietnamese, false, 'vi-VN');
      }
      setCurrentSub(activeSub || null);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = Number(e.target.value);
      if (videoRef.current) {
          videoRef.current.currentTime = time;
          setCurrentTime(time);
          stopAllAudio();
      }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
      const vol = Number(e.target.value);
      setVolume(vol);
      if (videoRef.current) {
          videoRef.current.volume = vol;
          setIsMuted(vol === 0);
      }
  };

  const toggleMute = () => {
      if (videoRef.current) {
          const newMuted = !isMuted;
          setIsMuted(newMuted);
          videoRef.current.volume = newMuted ? 0 : volume;
      }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen().catch(err => console.error(err));
    else document.exitFullscreen();
  };

  const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = window.setTimeout(() => {
          if (!videoRef.current?.paused && !isSettingsOpen) setShowControls(false);
      }, 2500);
  };

  // --- RENDERERS ---

  const renderSettingsMenu = () => {
    if (!isSettingsOpen) return null;

    return (
        <div className="absolute bottom-16 right-4 w-64 bg-[#0f0f0f]/95 backdrop-blur-md rounded-xl overflow-hidden shadow-2xl z-50 animate-fade-in-up border border-white/10">
            {settingsMenu === 'MAIN' && (
                <div className="py-2">
                    <button 
                        onClick={() => setSettingsMenu('VOICE_MODE')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors text-sm text-white"
                    >
                        <div className="flex items-center gap-3">
                            <Settings className="w-4 h-4 text-gray-400" />
                            <span>Voice Engine</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-400">
                            <span className="text-xs">{voiceMode === 'GEMINI' ? 'Gemini AI' : voiceMode === 'FREE_HQ' ? 'Google HQ' : 'Local'}</span>
                            <ChevronRight className="w-4 h-4" />
                        </div>
                    </button>
                    {(voiceMode === 'LOCAL' || voiceMode === 'GEMINI') && (
                        <button 
                            onClick={() => setSettingsMenu('VOICE_SELECT')}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors text-sm text-white"
                        >
                             <div className="flex items-center gap-3">
                                <Headphones className="w-4 h-4 text-gray-400" />
                                <span>Select Voice</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                    )}
                </div>
            )}

            {settingsMenu === 'VOICE_MODE' && (
                <div className="py-2">
                    <div className="px-4 py-2 flex items-center gap-2 border-b border-white/10 mb-1 cursor-pointer" onClick={() => setSettingsMenu('MAIN')}>
                        <ChevronLeft className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-bold text-white">Voice Engine</span>
                    </div>
                    {[
                        { id: 'FREE_HQ', label: 'Google Translate (Free HQ)', desc: 'Natural & Fast (Online)' },
                        { id: 'LOCAL', label: 'System Voice (Offline)', desc: 'No internet needed' },
                        { id: 'GEMINI', label: 'Gemini AI (Premium)', desc: 'Most human-like (API)' }
                    ].map((mode) => (
                        <button 
                            key={mode.id}
                            onClick={() => { setVoiceMode(mode.id as any); setSettingsMenu('MAIN'); }}
                            className="w-full px-4 py-2.5 flex items-start gap-3 hover:bg-white/10 transition-colors text-left"
                        >
                            {voiceMode === mode.id && <Check className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />}
                            <div className={`${voiceMode !== mode.id ? 'pl-7' : ''}`}>
                                <div className="text-sm text-white font-medium">{mode.label}</div>
                                <div className="text-xs text-gray-500">{mode.desc}</div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {settingsMenu === 'VOICE_SELECT' && (
                <div className="py-2 max-h-60 overflow-y-auto custom-scrollbar">
                     <div className="px-4 py-2 flex items-center gap-2 border-b border-white/10 mb-1 cursor-pointer sticky top-0 bg-[#0f0f0f] z-10" onClick={() => setSettingsMenu('MAIN')}>
                        <ChevronLeft className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-bold text-white">Select Voice</span>
                    </div>
                    {voiceMode === 'GEMINI' ? (
                        GEMINI_VOICES.map(v => (
                             <button 
                                key={v.id}
                                onClick={() => { setSelectedGeminiVoice(v.id); setSettingsMenu('MAIN'); }}
                                className="w-full px-4 py-2 flex items-center gap-3 hover:bg-white/10 transition-colors text-left text-sm text-white"
                            >
                                {selectedGeminiVoice === v.id && <Check className="w-4 h-4 text-indigo-400" />}
                                <span className={selectedGeminiVoice !== v.id ? 'pl-7' : ''}>{v.name}</span>
                            </button>
                        ))
                    ) : (
                        voices.map(v => (
                             <button 
                                key={v.voiceURI}
                                onClick={() => { setSelectedLocalVoiceURI(v.voiceURI); setSettingsMenu('MAIN'); }}
                                className="w-full px-4 py-2 flex items-center gap-3 hover:bg-white/10 transition-colors text-left text-sm text-white"
                            >
                                {selectedLocalVoiceURI === v.voiceURI && <Check className="w-4 h-4 text-indigo-400" />}
                                <span className={`truncate ${selectedLocalVoiceURI !== v.voiceURI ? 'pl-7' : ''}`}>{v.name}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
  };

  return (
    <div 
        ref={containerRef} 
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { if (!videoRef.current?.paused && !isSettingsOpen) setShowControls(false); }}
        className="relative group bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800 flex flex-col justify-center items-center select-none"
        style={{ maxHeight: isFullscreen ? '100vh' : 'auto' }}
    >
      <video
        ref={videoRef}
        src={src}
        className={`w-full ${isFullscreen ? 'h-screen object-contain' : 'aspect-video'}`}
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Subtitles Overlay */}
      {showSubs && currentSub && (
        <div className={`absolute bottom-20 left-0 right-0 flex flex-col items-center justify-end px-4 pb-2 z-20 pointer-events-none transition-all duration-300 ${showControls ? '-translate-y-4' : 'translate-y-0'}`}>
             <div className="flex flex-col items-center gap-1.5 transition-all">
                <button
                    onClick={(e) => { e.stopPropagation(); speakText(currentSub.textOriginal, true, 'en-US'); }}
                    className="pointer-events-auto bg-black/60 hover:bg-black/80 backdrop-blur-[2px] px-2 py-0.5 rounded text-white/90 text-sm md:text-base font-medium transition-colors text-center max-w-[90%] md:max-w-[70%]"
                >
                    {currentSub.textOriginal}
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); speakText(currentSub.textVietnamese, true, 'vi-VN'); }}
                    className="pointer-events-auto bg-black/75 hover:bg-black/90 backdrop-blur-[2px] px-3 py-1 rounded-md text-yellow-300 text-lg md:text-2xl font-semibold shadow-sm transition-colors text-center max-w-[95%] md:max-w-[80%] leading-relaxed"
                >
                    {loadingAudio && speakingText === currentSub.textVietnamese ? (
                        <span className="flex items-center gap-2 justify-center"><Loader2 className="w-5 h-5 animate-spin" />{currentSub.textVietnamese}</span>
                    ) : currentSub.textVietnamese}
                </button>
             </div>
        </div>
      )}

      {/* Settings Popup */}
      {renderSettingsMenu()}

      {/* CUSTOM CONTROLS OVERLAY (YouTube Style) */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-12 pb-3 px-3 transition-opacity duration-300 flex flex-col gap-1 z-30 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Progress Bar */}
        <div className="w-full relative group/progress h-4 flex items-center cursor-pointer">
            <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onChange={handleSeek}
                className="absolute w-full h-1 bg-white/30 rounded-full appearance-none cursor-pointer z-20 hover:h-1.5 transition-all [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-600 [&::-webkit-slider-thumb]:opacity-0 group-hover/progress:[&::-webkit-slider-thumb]:opacity-100"
            />
            {/* Progress Visuals (since range input styling is limited) */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-red-600 rounded-full z-10 pointer-events-none group-hover/progress:h-1.5 transition-all" style={{ width: `${(currentTime / duration) * 100}%` }}></div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between mt-[-5px]">
            {/* Left: Play, Volume, Time */}
            <div className="flex items-center gap-4">
                <button onClick={togglePlay} className="text-white hover:text-gray-200 transition-colors">
                    {isPlaying ? <Pause className="fill-white w-6 h-6" /> : <Play className="fill-white w-6 h-6" />}
                </button>

                <div className="flex items-center gap-2 group/volume">
                    <button onClick={toggleMute} className="text-white">
                        {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    </button>
                    <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300">
                        <input 
                            type="range" min="0" max="1" step="0.1" 
                            value={isMuted ? 0 : volume} 
                            onChange={handleVolume}
                            className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                        />
                    </div>
                </div>

                <div className="text-xs text-gray-300 font-medium font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </div>
            </div>

            {/* Right: Tools, Settings, Fullscreen */}
            <div className="flex items-center gap-3">
                
                {/* Auto Dub Toggle */}
                <button 
                    onClick={() => { const newState = !isAutoDub; setIsAutoDub(newState); if(!newState) stopAllAudio(); }}
                    className={`relative p-2 rounded-lg transition-all ${isAutoDub ? 'text-indigo-400' : 'text-white hover:bg-white/10'}`}
                    title="Auto-Dub (AI Voiceover)"
                >
                    <Headphones className={`w-5 h-5 ${isAutoDub ? 'fill-indigo-400/20' : ''}`} />
                    {isAutoDub && <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span></span>}
                </button>

                {/* Subtitles Toggle */}
                <button 
                    onClick={() => setShowSubs(!showSubs)}
                    className={`relative p-2 rounded-lg transition-all ${showSubs ? 'text-white' : 'text-gray-500 hover:text-white hover:bg-white/10'}`}
                    title="Toggle Subtitles"
                >
                    <Captions className={`w-6 h-6 ${showSubs ? 'fill-red-600 border-b-2 border-red-600 pb-0.5' : ''}`} />
                </button>

                {/* Settings Toggle */}
                <button 
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className={`p-2 rounded-lg transition-all ${isSettingsOpen ? 'rotate-90 text-white' : 'text-white hover:bg-white/10'}`}
                >
                    <Settings className="w-5 h-5" />
                </button>

                {/* Fullscreen */}
                <button onClick={toggleFullscreen} className="p-2 text-white hover:bg-white/10 rounded-lg">
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
});

export default VideoPlayer;