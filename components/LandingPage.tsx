import React, { Suspense } from 'react';
import { Sparkles, BrainCircuit, FileText, Languages, ArrowRight, Play, Globe } from 'lucide-react';
import Hero3D from './Hero3D';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-white selection:text-black overflow-x-hidden relative">
      
      {/* Navbar - Glassmorphism Effect (Blur content underneath) */}
      <nav className="fixed w-full z-50 top-0 left-0 bg-black/30 backdrop-blur-xl border-b border-white/5 transition-all duration-300 supports-[backdrop-filter]:bg-black/20">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                 <div className="w-2 h-2 bg-black rounded-full"></div>
              </div>
              <span className="font-bold text-xl tracking-tight text-white group-hover:opacity-80 transition-opacity">BilingualFlow</span>
            </div>
            
            <div className="flex items-center gap-8">
                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
                    <a href="#" className="hover:text-white transition-colors">Manifesto</a>
                    <a href="#" className="hover:text-white transition-colors">Solutions</a>
                    <a href="#" className="hover:text-white transition-colors">Pricing</a>
                </div>

                <button 
                    onClick={onGetStarted}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-full text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                    Get Started <ArrowRight className="w-4 h-4" />
                </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 min-h-screen flex flex-col justify-center px-6 lg:px-12 pt-24">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Text Content */}
            <div className="space-y-8 z-20 order-2 lg:order-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 border border-white/20 rounded-full text-xs font-medium text-gray-300 backdrop-blur-sm bg-white/5">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    Gemini 1.5 Architecture
                </div>
                
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.1] text-white">
                    Master Languages <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Through Context</span>
                </h1>
                
                <p className="text-lg text-gray-400 max-w-lg leading-relaxed font-light">
                    Don't just watch content—absorb it. Our AI transforms your favorite media into bilingual subtitles, timestamped notes, and instant flashcards.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button 
                        onClick={onGetStarted}
                        className="px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    >
                        <Play className="w-5 h-5 fill-black group-hover:scale-110 transition-transform" /> Start Learning
                    </button>
                    <button 
                        className="px-8 py-4 border border-white/20 text-white rounded-full font-medium text-lg hover:bg-white/5 backdrop-blur-sm transition-colors flex items-center justify-center gap-2"
                    >
                        <Globe className="w-5 h-5" /> View Demo
                    </button>
                </div>

                {/* Statistics */}
                <div className="pt-8 flex gap-12 border-t border-white/10 mt-8">
                    <div>
                        <h3 className="text-3xl font-bold text-white">50+</h3>
                        <p className="text-sm text-gray-500 uppercase tracking-widest mt-1">Languages</p>
                    </div>
                    <div>
                        <h3 className="text-3xl font-bold text-white">AI</h3>
                        <p className="text-sm text-gray-500 uppercase tracking-widest mt-1">Generated Notes</p>
                    </div>
                </div>
            </div>

            {/* 3D Column - Meteorite Space */}
            <div className="h-[500px] lg:h-[700px] w-full relative z-10 order-1 lg:order-2 flex items-center justify-center pointer-events-none">
                <Suspense fallback={<div className="w-full h-full flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-500 rounded-full animate-spin"></div></div>}>
                    <Hero3D />
                </Suspense>
            </div>
        </div>
      </div>

      {/* Feature Section - Dark Agency Style */}
      <div className="relative z-10 bg-[#050505] py-32 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          <div className="mb-24 flex flex-col md:flex-row md:items-end justify-between gap-6">
             <h2 className="text-4xl md:text-5xl font-bold tracking-tight max-w-xl">
                 Engineered for <br/>
                 <span className="text-gray-500">Deep Comprehension.</span>
             </h2>
             <p className="text-gray-400 max-w-xs text-sm leading-6">
                 Our proprietary AI pipeline decomposes audio waves into semantic structures, creating a seamless bridge between languages.
             </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-500 cursor-default backdrop-blur-sm">
              <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                <Languages className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Dual-Stream Subs</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Synchronized bilingual text streams allow for instant pattern recognition and vocabulary acquisition without pausing context.
              </p>
            </div>

            {/* Card 2 */}
            <div className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-500 cursor-default backdrop-blur-sm">
              <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                <FileText className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Semantic Notes</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                AI creates structured, timestamped summaries, extracting the core "Knowledge Graph" of the content automatically.
              </p>
            </div>

            {/* Card 3 */}
            <div className="group p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-500 cursor-default backdrop-blur-sm">
              <div className="w-12 h-12 bg-pink-500/10 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                <BrainCircuit className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Active Recall</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                One-click Anki export. We transform passive video consumption into active memory retention artifacts.
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-[#050505] border-t border-white/10 py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
            <p>Powered by Google Gemini 1.5 Flash</p>
            <div className="flex gap-6 mt-4 md:mt-0">
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-white transition-colors">Terms</a>
                <a href="#" className="hover:text-white transition-colors">Twitter</a>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;