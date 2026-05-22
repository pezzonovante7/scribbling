import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Editor } from './Editor';
import { LockScreen } from './Lock';
import {
  dbPro,
  dbVault,
  type DecryptedNote,
  type ProNote,
  type VaultNote,
  type Workspace,
} from './db';
import { encryptString, decryptString } from './crypto';

const LS_THEME = 'scribbling.theme';
const LS_WORKSPACE = 'scribbling.workspace';
const LS_SELECTED_PRO = 'scribbling.selected.pro';
const LS_SELECTED_PERSONAL = 'scribbling.selected.personal';

function readStoredWorkspace(): Workspace {
  const v = localStorage.getItem(LS_WORKSPACE);
  return v === 'personal' ? 'personal' : 'professional';
}

function readStoredDark(): boolean {
  const v = localStorage.getItem(LS_THEME);
  if (v === 'dark') return true;
  if (v === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function App() {
  const [workspace, setWorkspaceState] = useState<Workspace>(readStoredWorkspace);
  const [isDark, setIsDark] = useState<boolean>(readStoredDark);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [selectedPro, setSelectedPro] = useState<number | null>(() => {
    const v = localStorage.getItem(LS_SELECTED_PRO);
    return v ? Number(v) : null;
  });
  const [selectedPersonal, setSelectedPersonal] = useState<number | null>(() => {
    const v = localStorage.getItem(LS_SELECTED_PERSONAL);
    return v ? Number(v) : null;
  });
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Persist theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.dataset.colorMode = isDark ? 'dark' : 'light';
    localStorage.setItem(LS_THEME, isDark ? 'dark' : 'light');
  }, [isDark]);

  // Persist workspace selection
  const setWorkspace = useCallback((w: Workspace) => {
    setWorkspaceState(w);
    localStorage.setItem(LS_WORKSPACE, w);
  }, []);

  // Bumped after every mutation to force list refresh
  const [proTick, setProTick] = useState(0);
  const [vaultTick, setVaultTick] = useState(0);
  const refreshPro = useCallback(() => setProTick((t) => t + 1), []);
  const refreshVault = useCallback(() => setVaultTick((t) => t + 1), []);

  const [proRows, setProRows] = useState<ProNote[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await dbPro.open();
        const rows = await dbPro.notes.toArray();
        if (!cancelled) setProRows(rows);
      } catch {
        if (!cancelled) setProRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proTick]);

  const [vaultRows, setVaultRows] = useState<VaultNote[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await dbVault.open();
        const rows = await dbVault.notes.toArray();
        if (!cancelled) setVaultRows(rows);
      } catch {
        if (!cancelled) setVaultRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultTick]);

  // Decrypted personal notes (cached by id+updatedAt)
  const [personalNotes, setPersonalNotes] = useState<DecryptedNote[]>([]);
  const decryptCacheRef = useRef<Map<number, { stamp: number; note: DecryptedNote }>>(
    new Map()
  );

  useEffect(() => {
    if (workspace !== 'personal' || !vaultKey) return;
    let cancelled = false;
    (async () => {
      const cache = decryptCacheRef.current;
      const out: DecryptedNote[] = [];
      for (const row of vaultRows) {
        if (row.id === undefined) continue;
        if (!row.data) continue; // legacy un-encrypted (shouldn't happen after first unlock)
        const stamp = row.updatedAt.getTime();
        const cached = cache.get(row.id);
        if (cached && cached.stamp === stamp) {
          out.push(cached.note);
          continue;
        }
        try {
          const json = await decryptString(vaultKey, row.data);
          const parsed = JSON.parse(json) as {
            title: string;
            content: string;
            tags: string[];
          };
          const note: DecryptedNote = {
            id: row.id,
            title: parsed.title ?? '',
            content: parsed.content ?? '',
            tags: Array.isArray(parsed.tags) ? parsed.tags : [],
            pinned: row.pinned ?? false,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          };
          cache.set(row.id, { stamp, note });
          out.push(note);
        } catch {
          // skip undecryptable rows
        }
      }
      if (!cancelled) setPersonalNotes(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultRows, vaultKey, workspace]);

  // When vault locks, drop cache and clear selection
  const lockVault = useCallback(() => {
    setVaultKey(null);
    decryptCacheRef.current.clear();
    setPersonalNotes([]);
    setSelectedPersonal(null);
  }, []);

  // Pro notes as DecryptedNote-shape (no decryption needed)
  const proNotes: DecryptedNote[] = useMemo(
    () =>
      proRows
        .filter((n): n is ProNote & { id: number } => n.id !== undefined)
        .map((n) => ({
          id: n.id,
          title: n.title ?? '',
          content: n.content ?? '',
          tags: Array.isArray(n.tags) ? n.tags : [],
          pinned: n.pinned ?? false,
          createdAt: n.createdAt ?? n.updatedAt ?? new Date(),
          updatedAt: n.updatedAt ?? new Date(),
        })),
    [proRows]
  );

  const notes = workspace === 'professional' ? proNotes : personalNotes;
  const selectedId =
    workspace === 'professional' ? selectedPro : selectedPersonal;
  const setSelectedId = (id: number | null) => {
    if (workspace === 'professional') {
      setSelectedPro(id);
      if (id !== null) localStorage.setItem(LS_SELECTED_PRO, String(id));
      else localStorage.removeItem(LS_SELECTED_PRO);
    } else {
      setSelectedPersonal(id);
      if (id !== null) localStorage.setItem(LS_SELECTED_PERSONAL, String(id));
      else localStorage.removeItem(LS_SELECTED_PERSONAL);
    }
  };

  const selectedNote = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId]
  );

  // ----- Actions -----

  const createNote = useCallback(async () => {
    const now = new Date();
    if (workspace === 'professional') {
      const id = await dbPro.notes.add({
        title: '',
        content: '',
        tags: [],
        pinned: false,
        createdAt: now,
        updatedAt: now,
      });
      setSelectedPro(id as number);
      localStorage.setItem(LS_SELECTED_PRO, String(id));
      refreshPro();
    } else {
      if (!vaultKey) return;
      const data = await encryptString(
        vaultKey,
        JSON.stringify({ title: '', content: '', tags: [] })
      );
      const id = await dbVault.notes.add({
        data,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      });
      setSelectedPersonal(id as number);
      localStorage.setItem(LS_SELECTED_PERSONAL, String(id));
      refreshVault();
    }
  }, [workspace, vaultKey, refreshPro, refreshVault]);

  const updateNote = useCallback(
    async (id: number, patch: Partial<DecryptedNote>) => {
      const now = new Date();
      if (workspace === 'professional') {
        const existing = await dbPro.notes.get(id);
        if (!existing) return;
        await dbPro.notes.update(id, {
          ...('title' in patch ? { title: patch.title } : {}),
          ...('content' in patch ? { content: patch.content } : {}),
          ...('tags' in patch ? { tags: patch.tags } : {}),
          ...('pinned' in patch ? { pinned: patch.pinned } : {}),
          updatedAt: now,
        });
        refreshPro();
      } else {
        if (!vaultKey) return;
        const current = personalNotes.find((n) => n.id === id);
        if (!current) return;
        const next = {
          title: patch.title ?? current.title,
          content: patch.content ?? current.content,
          tags: patch.tags ?? current.tags,
        };
        const data = await encryptString(vaultKey, JSON.stringify(next));
        await dbVault.notes.update(id, {
          data,
          ...('pinned' in patch ? { pinned: patch.pinned } : {}),
          updatedAt: now,
        });
        refreshVault();
      }
    },
    [workspace, vaultKey, personalNotes, refreshPro, refreshVault]
  );

  const deleteNote = useCallback(
    async (id: number) => {
      if (workspace === 'professional') {
        await dbPro.notes.delete(id);
        if (selectedPro === id) {
          setSelectedPro(null);
          localStorage.removeItem(LS_SELECTED_PRO);
        }
        refreshPro();
      } else {
        await dbVault.notes.delete(id);
        decryptCacheRef.current.delete(id);
        if (selectedPersonal === id) {
          setSelectedPersonal(null);
          localStorage.removeItem(LS_SELECTED_PERSONAL);
        }
        refreshVault();
      }
    },
    [workspace, selectedPro, selectedPersonal, refreshPro, refreshVault]
  );

  const exportWorkspace = useCallback(() => {
    const payload = {
      workspace,
      exportedAt: new Date().toISOString(),
      notes: notes.map(({ id, ...rest }) => ({ id, ...rest })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scribbling-${workspace}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [workspace, notes]);

  const importWorkspace = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as {
          notes?: Array<{
            title?: string;
            content?: string;
            tags?: string[];
            pinned?: boolean;
            createdAt?: string;
            updatedAt?: string;
          }>;
        };
        if (!Array.isArray(parsed.notes)) return;
        const now = new Date();
        for (const raw of parsed.notes) {
          const item = {
            title: raw.title ?? '',
            content: raw.content ?? '',
            tags: Array.isArray(raw.tags) ? raw.tags : [],
            pinned: raw.pinned ?? false,
            createdAt: raw.createdAt ? new Date(raw.createdAt) : now,
            updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : now,
          };
          if (workspace === 'professional') {
            await dbPro.notes.add(item);
          } else {
            if (!vaultKey) return;
            const data = await encryptString(
              vaultKey,
              JSON.stringify({
                title: item.title,
                content: item.content,
                tags: item.tags,
              })
            );
            await dbVault.notes.add({
              data,
              pinned: item.pinned,
              createdAt: item.createdAt,
              updatedAt: item.updatedAt,
            });
          }
        }
        if (workspace === 'professional') refreshPro();
        else refreshVault();
      } catch {
        // ignore parse failures
      }
    },
    [workspace, vaultKey, refreshPro, refreshVault]
  );

  // ----- Keyboard shortcuts -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (meta && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        if (workspace === 'personal' && !vaultKey) return;
        createNote();
      } else if (e.key === 'Escape') {
        const el = searchRef.current;
        if (el && document.activeElement === el) el.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createNote, vaultKey, workspace]);

  // ----- Render -----

  const showLockScreen = workspace === 'personal' && !vaultKey;

  return (
    <div className="flex h-screen bg-cream text-cocoa">
      <Sidebar
        workspace={workspace}
        setWorkspace={setWorkspace}
        notes={notes}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={createNote}
        onExport={exportWorkspace}
        onImport={importWorkspace}
        onLockVault={workspace === 'personal' && vaultKey ? lockVault : undefined}
        isDark={isDark}
        toggleDark={() => setIsDark((d) => !d)}
        searchRef={searchRef}
      />
      <main className="flex-1 flex flex-col min-w-0">
        {showLockScreen ? (
          <LockScreen onUnlock={(k) => setVaultKey(k)} />
        ) : selectedNote ? (
          <Editor
            note={selectedNote}
            isDark={isDark}
            onChange={(patch) => updateNote(selectedNote.id, patch)}
            onDelete={() => deleteNote(selectedNote.id)}
          />
        ) : (
          <EmptyState onCreate={createNote} />
        )}
      </main>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-peach-soft mb-6">
          <Sparkles className="w-10 h-10 text-coral" />
        </div>
        <h2 className="text-3xl font-bold text-cocoa mb-2">A quiet place to think</h2>
        <p className="text-cocoa-soft mb-6 leading-relaxed">
          Pick a note from the sidebar, or start something new. Press{' '}
          <kbd className="border border-line rounded px-1.5 py-0.5 text-xs">⌘N</kbd> to
          begin and{' '}
          <kbd className="border border-line rounded px-1.5 py-0.5 text-xs">⌘K</kbd> to
          search.
        </p>
        <button
          onClick={onCreate}
          className="px-6 py-3 rounded-2xl bg-coral hover:bg-coral-deep text-white font-semibold shadow-glow transition"
        >
          Start a new note
        </button>
      </div>
    </div>
  );
}
