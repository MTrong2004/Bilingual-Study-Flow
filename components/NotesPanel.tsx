import React from 'react';
import { Note } from '../types';
import { PlayCircle, FileText } from 'lucide-react';

interface NotesPanelProps {
  notes: Note[];
  onNoteClick: (timestamp: string) => void;
}

const NotesPanel: React.FC<NotesPanelProps> = ({ notes, onNoteClick }) => {
  const exportNotes = () => {
    // Generate simple HTML for the "Doc"
    const content = `
      <html>
      <head>
        <style>
          body { font-family: sans-serif; padding: 40px; }
          h1 { color: #333; }
          .note { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
          .time { color: #666; font-weight: bold; font-size: 0.9em; }
          .title { font-size: 1.2em; color: #2563eb; margin: 5px 0; }
          .text { line-height: 1.6; }
        </style>
      </head>
      <body>
        <h1>Study Notes</h1>
        ${notes.map(n => `
          <div class="note">
            <div class="time">[${n.timestamp}]</div>
            <h3 class="title">${n.title}</h3>
            <div class="text">${n.content}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;
    const blob = new Blob([content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'study_notes.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          Timestamp Notes
        </h3>
        <button 
          onClick={exportNotes}
          className="text-sm px-3 py-1.5 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
          Export Doc
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
        {notes.length === 0 ? (
          <div className="text-center text-gray-400 py-10">
            No notes generated. Try checking "Smart Notes" next time.
          </div>
        ) : (
          notes.map((note, idx) => (
            <div 
              key={idx} 
              className="group p-4 rounded-lg border border-transparent hover:border-indigo-100 hover:bg-indigo-50/50 transition-all cursor-pointer"
              onClick={() => onNoteClick(note.timestamp)}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-gray-100 text-gray-600 group-hover:bg-indigo-100 group-hover:text-indigo-700">
                  {note.timestamp}
                </span>
                <PlayCircle className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h4 className="font-semibold text-gray-800 mb-1">{note.title}</h4>
              <p className="text-gray-600 text-sm leading-relaxed">{note.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotesPanel;
