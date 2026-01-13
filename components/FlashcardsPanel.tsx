import React, { useState } from 'react';
import { Flashcard } from '../types';
import { BrainCircuit, Download, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';

interface FlashcardsPanelProps {
  cards: Flashcard[];
}

const FlashcardsPanel: React.FC<FlashcardsPanelProps> = ({ cards }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const exportAnki = () => {
    // Simple CSV format for Anki: Front,Back
    const csvContent = cards.map(c => {
      // Escape quotes for CSV
      const front = `"${c.term}"`;
      const back = `"${c.definition}<br><br><em>Context: ${c.context}</em>"`;
      return `${front},${back}`;
    }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flashcards_anki.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  if (!cards || cards.length === 0) {
    return (
      <div className="h-full bg-white rounded-xl shadow border border-gray-200 p-8 flex flex-col items-center justify-center text-gray-400">
        <BrainCircuit className="w-12 h-12 mb-4 opacity-50" />
        <p>No flashcards generated.</p>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-indigo-600" />
          Flashcards ({currentIndex + 1}/{cards.length})
        </h3>
        <button 
          onClick={exportAnki}
          className="text-sm px-3 py-1.5 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
        >
          <Download className="w-3 h-3" /> Anki CSV
        </button>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center justify-center bg-gray-50/50">
        <div 
          className="relative w-full max-w-md h-64 perspective-1000 cursor-pointer group"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className={`relative w-full h-full duration-500 preserve-3d transition-transform ${isFlipped ? 'rotate-y-180' : ''}`} style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
            
            {/* Front */}
            <div className="absolute w-full h-full backface-hidden bg-white rounded-2xl shadow-xl border border-gray-200 flex flex-col items-center justify-center p-8 text-center hover:border-indigo-300 transition-colors">
              <span className="text-xs font-bold text-indigo-500 tracking-wider mb-2">TERM</span>
              <h2 className="text-3xl font-bold text-gray-800">{currentCard.term}</h2>
              <div className="absolute bottom-4 right-4 text-gray-300">
                <RotateCw className="w-5 h-5" />
              </div>
            </div>

            {/* Back */}
            <div className="absolute w-full h-full backface-hidden bg-indigo-600 rounded-2xl shadow-xl flex flex-col items-center justify-center p-8 text-center text-white rotate-y-180" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}>
              <span className="text-xs font-bold text-indigo-200 tracking-wider mb-2">DEFINITION</span>
              <h2 className="text-xl font-semibold mb-4">{currentCard.definition}</h2>
              <div className="w-full h-px bg-indigo-400 mb-4 opacity-50"></div>
              <p className="text-sm text-indigo-100 italic">"{currentCard.context}"</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-8 mt-8">
          <button onClick={handlePrev} className="p-3 rounded-full bg-white shadow-md border border-gray-200 hover:bg-gray-50 text-gray-600">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button onClick={() => setIsFlipped(!isFlipped)} className="text-sm text-gray-500 hover:text-indigo-600 font-medium">
            {isFlipped ? 'Show Term' : 'Show Meaning'}
          </button>
          <button onClick={handleNext} className="p-3 rounded-full bg-white shadow-md border border-gray-200 hover:bg-gray-50 text-gray-600">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlashcardsPanel;
