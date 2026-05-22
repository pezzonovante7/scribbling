import { useEffect, useRef, useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { Trash2, Pin, PinOff, Check } from 'lucide-react';
import { TagInput } from './TagInput';
import type { DecryptedNote } from './db';

interface Props {
  note: DecryptedNote;
  isDark: boolean;
  onChange: (patch: Partial<DecryptedNote>) => void;
  onDelete: () => void;
}

export function Editor({ note, isDark, onChange, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(true);
  const savedTimer = useRef<number | null>(null);

  // local mirror for instant input feedback
  const [titleDraft, setTitleDraft] = useState(note.title);
  const [contentDraft, setContentDraft] = useState(note.content);
  const lastIdRef = useRef(note.id);

  useEffect(() => {
    if (lastIdRef.current !== note.id) {
      setTitleDraft(note.title);
      setContentDraft(note.content);
      setConfirming(false);
      lastIdRef.current = note.id;
    }
  }, [note.id, note.title, note.content]);

  const markDirty = () => {
    setSaved(false);
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(true), 350);
  };

  const words = contentDraft.trim() ? contentDraft.trim().split(/\s+/).length : 0;
  const chars = contentDraft.length;

  return (
    <section className="flex-1 flex flex-col bg-cream min-w-0">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-line">
        <div className="flex items-start gap-3">
          <input
            value={titleDraft}
            onChange={(e) => {
              setTitleDraft(e.target.value);
              onChange({ title: e.target.value });
              markDirty();
            }}
            placeholder="Untitled note"
            className="flex-1 text-2xl font-bold bg-transparent text-cocoa placeholder:text-cocoa-soft focus:outline-none"
          />
          <button
            onClick={() => onChange({ pinned: !note.pinned })}
            className={`p-2 rounded-xl transition ${
              note.pinned
                ? 'bg-peach-soft text-coral'
                : 'text-cocoa-soft hover:text-coral hover:bg-peach-soft'
            }`}
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            {note.pinned ? (
              <Pin className="w-4 h-4 fill-current" />
            ) : (
              <PinOff className="w-4 h-4" />
            )}
          </button>
          {confirming ? (
            <button
              onClick={onDelete}
              onBlur={() => setConfirming(false)}
              autoFocus
              className="px-3 py-2 rounded-xl bg-ember text-white text-sm font-semibold hover:opacity-90 transition flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" /> Confirm
            </button>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="p-2 rounded-xl text-cocoa-soft hover:text-ember hover:bg-peach-soft transition"
              title="Delete note"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="mt-2.5">
          <TagInput tags={note.tags} onChange={(tags) => onChange({ tags })} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden p-5">
        <div data-color-mode={isDark ? 'dark' : 'light'} className="h-full">
          <MDEditor
            value={contentDraft}
            onChange={(v) => {
              const next = v ?? '';
              setContentDraft(next);
              onChange({ content: next });
              markDirty();
            }}
            height="100%"
            preview="live"
            visibleDragbar={false}
            previewOptions={{ skipHtml: false }}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="px-6 py-2 border-t border-line flex items-center justify-between text-[11px] text-cocoa-soft">
        <div className="flex items-center gap-3">
          <span>{words} words</span>
          <span>{chars} chars</span>
        </div>
        <div className="flex items-center gap-1.5">
          {saved ? (
            <>
              <Check className="w-3 h-3 text-coral" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-coral animate-pulse" />
              <span>Saving…</span>
            </>
          )}
          <span className="opacity-60">·</span>
          <span>{note.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </section>
  );
}
