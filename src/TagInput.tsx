import { useState, KeyboardEvent } from 'react';
import { X, Hash } from 'lucide-react';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
}

export function TagInput({ tags, onChange }: Props) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 32);
    if (!t || tags.includes(t)) {
      setDraft('');
      return;
    }
    onChange([...tags, t]);
    setDraft('');
  };

  const remove = (t: string) => onChange(tags.filter((x) => x !== t));

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      remove(tags[tags.length - 1]);
    }
  };

  return (
    <div className="flex items-center flex-wrap gap-1.5">
      <Hash className="w-3.5 h-3.5 text-cocoa-soft" />
      {tags.map((t) => (
        <button
          key={t}
          onClick={() => remove(t)}
          className="group inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-peach-soft hover:bg-peach text-cocoa text-xs font-medium transition"
        >
          {t}
          <X className="w-3 h-3 opacity-50 group-hover:opacity-100" />
        </button>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => draft && add(draft)}
        placeholder={tags.length ? '' : 'Add tag…'}
        className="flex-1 min-w-[100px] bg-transparent text-xs text-cocoa placeholder:text-cocoa-soft focus:outline-none py-0.5"
      />
    </div>
  );
}
