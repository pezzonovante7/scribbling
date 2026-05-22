import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Plus,
  Briefcase,
  Lock,
  Moon,
  Sun,
  Download,
  Upload,
  Pin,
  LockKeyhole,
} from 'lucide-react';
import type { DecryptedNote, Workspace } from './db';

interface Props {
  workspace: Workspace;
  setWorkspace: (w: Workspace) => void;
  notes: DecryptedNote[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onLockVault?: () => void;
  isDark: boolean;
  toggleDark: () => void;
  searchRef: React.RefObject<HTMLInputElement>;
}

export function Sidebar({
  workspace,
  setWorkspace,
  notes,
  selectedId,
  onSelect,
  onCreate,
  onExport,
  onImport,
  onLockVault,
  isDark,
  toggleDark,
  searchRef,
}: Props) {
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const sorted = useMemo(() => {
    const arr = [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    if (!search.trim()) return arr;
    const q = search.toLowerCase();
    return arr.filter((n) => {
      const hay = `${n.title} ${n.content} ${n.tags.join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notes, search]);

  useEffect(() => {
    setSearch('');
  }, [workspace]);

  const isPersonal = workspace === 'personal';

  return (
    <aside className="w-80 shrink-0 border-r border-line bg-blush flex flex-col">
      {/* Brand + theme */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-cocoa">
          Scribbling
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-coral ml-1.5 align-middle" />
        </h1>
        <button
          onClick={toggleDark}
          className="p-2 rounded-xl hover:bg-peach-soft text-cocoa-soft hover:text-coral transition"
          aria-label="Toggle dark mode"
          title="Toggle theme"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Workspace toggle */}
      <div className="px-5 pb-3">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-cream border border-line">
          <button
            onClick={() => setWorkspace('professional')}
            className={`flex items-center justify-center gap-1.5 py-2 text-sm rounded-xl transition ${
              workspace === 'professional'
                ? 'bg-coral text-white shadow-sm font-semibold'
                : 'text-cocoa hover:bg-peach-soft'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Professional
          </button>
          <button
            onClick={() => setWorkspace('personal')}
            className={`flex items-center justify-center gap-1.5 py-2 text-sm rounded-xl transition ${
              workspace === 'personal'
                ? 'bg-coral text-white shadow-sm font-semibold'
                : 'text-cocoa hover:bg-peach-soft'
            }`}
          >
            <Lock className="w-4 h-4" />
            Personal
          </button>
        </div>
      </div>

      {/* New note */}
      <div className="px-5 pb-3">
        <button
          onClick={onCreate}
          className="w-full bg-coral hover:bg-coral-deep text-white py-3 rounded-2xl flex items-center justify-center gap-2 font-semibold shadow-glow transition"
        >
          <Plus className="w-5 h-5" />
          New note
        </button>
      </div>

      {/* Search */}
      <div className="px-5 pb-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-cocoa-soft pointer-events-none" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setSearch('')}
            placeholder="Search notes…"
            className="w-full pl-10 pr-3 py-2.5 bg-cream border border-line rounded-2xl text-sm text-cocoa placeholder:text-cocoa-soft focus:outline-none focus:border-coral transition"
          />
          <kbd className="hidden md:inline-block absolute right-3 top-2.5 text-[10px] text-cocoa-soft border border-line rounded px-1.5 py-0.5">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        {sorted.length === 0 ? (
          <div className="px-4 py-12 text-center text-cocoa-soft text-sm">
            {search ? (
              <>
                Nothing matches <span className="text-cocoa">"{search}"</span>
              </>
            ) : (
              <>
                <p className="mb-1">No notes yet.</p>
                <p className="text-xs opacity-75">
                  Press <kbd className="border border-line rounded px-1 py-0.5">⌘N</kbd>{' '}
                  to start.
                </p>
              </>
            )}
          </div>
        ) : (
          sorted.map((n) => {
            const active = n.id === selectedId;
            const preview = n.content
              .replace(/[#*_>`\-]/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 80);
            return (
              <button
                key={n.id}
                onClick={() => onSelect(n.id)}
                className={`w-full text-left px-3.5 py-3 rounded-2xl mb-1 transition ${
                  active ? 'bg-peach-soft' : 'hover:bg-peach-soft/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-cocoa text-sm line-clamp-1 flex-1">
                    {n.title || 'Untitled'}
                  </div>
                  {n.pinned && (
                    <Pin className="w-3.5 h-3.5 text-coral shrink-0 mt-0.5 fill-current" />
                  )}
                </div>
                {preview && (
                  <div className="text-xs text-cocoa-soft mt-1 line-clamp-2 leading-snug">
                    {preview}
                  </div>
                )}
                <div className="flex items-center justify-between mt-1.5">
                  <div className="text-[10px] text-cocoa-soft uppercase tracking-wide">
                    {formatDate(n.updatedAt)}
                  </div>
                  {n.tags.length > 0 && (
                    <div className="flex gap-1">
                      {n.tags.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-cream text-cocoa-soft border border-line"
                        >
                          {t}
                        </span>
                      ))}
                      {n.tags.length > 2 && (
                        <span className="text-[10px] text-cocoa-soft">
                          +{n.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer actions */}
      <div className="px-3 py-3 border-t border-line flex items-center gap-1 text-xs">
        <button
          onClick={onExport}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl hover:bg-peach-soft text-cocoa-soft hover:text-coral transition"
          title="Export workspace as JSON"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl hover:bg-peach-soft text-cocoa-soft hover:text-coral transition"
          title="Import JSON"
        >
          <Upload className="w-3.5 h-3.5" />
          Import
        </button>
        {isPersonal && onLockVault && (
          <button
            onClick={onLockVault}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl hover:bg-peach-soft text-cocoa-soft hover:text-coral transition"
            title="Lock vault"
          >
            <LockKeyhole className="w-3.5 h-3.5" />
            Lock
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = '';
          }}
        />
      </div>
    </aside>
  );
}

function formatDate(d: Date): string {
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
