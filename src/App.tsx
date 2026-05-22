import { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { Search, Download, Lock, Trash2, Moon, Sun } from 'lucide-react';
import Dexie from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import Fuse from 'fuse.js';

const dbProfessional = new Dexie('ScribblingProfessional');
dbProfessional.version(1).stores({ notes: '++id,title,content,tags,updatedAt' });

const dbPersonal = new Dexie('ScribblingPersonal');
dbPersonal.version(1).stores({ notes: '++id,title,content,tags,updatedAt' });

function App() {
  const [workspace, setWorkspace] = useState<'professional' | 'personal'>('professional');
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDark, setIsDark] = useState(false);
  const db = workspace === 'professional' ? dbProfessional : dbPersonal;

  const liveNotes = useLiveQuery(() => db.table('notes').orderBy('updatedAt').reverse().toArray(), [db]);

  const fuse = new Fuse(liveNotes || [], {
    keys: ['title', 'content'],
    threshold: 0.3,
  });
  const filteredNotes = searchTerm ? fuse.search(searchTerm).map(r => r.item) : (liveNotes || []);

  const createNote = async () => {
    const id = await db.table('notes').add({
      title: 'Untitled Note',
      content: '',
      tags: [],
      updatedAt: new Date()
    });
    const newNote = await db.table('notes').get(id);
    setSelectedNote(newNote);
  };

  const updateNote = async (field: string, value: any) => {
    if (!selectedNote) return;
    await db.table('notes').update(selectedNote.id, {
      [field]: value,
      updatedAt: new Date()
    });
    setSelectedNote({ ...selectedNote, [field]: value, updatedAt: new Date() });
  };

  const deleteNote = async (id: number) => {
    if (confirm('Delete this note permanently?')) {
      await db.table('notes').delete(id);
      setSelectedNote(null);
    }
  };

  const exportProfessional = async () => {
    if (workspace !== 'professional') return;
    const allNotes = await db.table('notes').toArray();
    const blob = new Blob([JSON.stringify(allNotes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scribbling-professional-export.json';
    a.click();
  };

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Scribbling</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setWorkspace('professional')} className={`px-4 py-1 text-sm rounded-xl ${workspace === 'professional' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Professional</button>
            <button onClick={() => setWorkspace('personal')} className={`px-4 py-1 text-sm rounded-xl flex items-center gap-1 ${workspace === 'personal' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}><Lock className="w-4 h-4" /> Personal</button>
            <button onClick={() => setIsDark(!isDark)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl">{isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
          </div>
        </div>

        <div className="p-4">
          <button onClick={createNote} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-2xl flex items-center justify-center gap-2 font-medium">+ New Note</button>
        </div>

        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search notes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 py-3 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-2xl focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="flex-1 overflow-auto px-2">
          {filteredNotes.map((note: any) => (
            <div key={note.id} onClick={() => setSelectedNote(note)} className={`mx-2 px-4 py-3 rounded-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 mb-1 ${selectedNote?.id === note.id ? 'bg-blue-50 dark:bg-blue-950' : ''}`}>
              <div className="font-medium line-clamp-1">{note.title}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{new Date(note.updatedAt).toLocaleDateString()}</div>
            </div>
          ))}
        </div>

        {workspace === 'professional' && (
          <div className="p-4 border-t">
            <button onClick={exportProfessional} className="w-full flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 py-2 text-sm font-medium"><Download className="w-4 h-4" /> Export Professional Notes</button>
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        {selectedNote ? (
          <>
            <div className="px-6 py-4 border-b flex items-center gap-4">
              <input type="text" value={selectedNote.title} onChange={(e) => updateNote('title', e.target.value)} className="flex-1 text-2xl font-semibold bg-transparent focus:outline-none" placeholder="Note title..." />
              <button onClick={() => deleteNote(selectedNote.id)} className="flex items-center gap-2 text-red-500 hover:text-red-600 px-4 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950"><Trash2 className="w-5 h-5" /> Delete</button>
            </div>
            <div className="flex-1 p-6 overflow-auto">
              <MDEditor value={selectedNote.content} onChange={(val) => updateNote('content', val || '')} height="100%" preview="live" />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500 text-lg">Select a note or click “+ New Note” to begin writing</div>
        )}
      </div>
    </div>
  );
}

export default App;