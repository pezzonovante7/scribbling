import Dexie, { type Table } from 'dexie';

export type Workspace = 'professional' | 'personal';

export interface ProNote {
  id?: number;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultNote {
  id?: number;
  data: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  _legacyTitle?: string;
  _legacyContent?: string;
  _legacyTags?: string[];
}

export interface VaultMeta {
  id: 1;
  saltB64: string;
  verifierB64: string;
  iterations: number;
  createdAt: Date;
}

export interface DecryptedNote {
  id: number;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

class ProDB extends Dexie {
  notes!: Table<ProNote, number>;
  constructor() {
    super('ScribblingProfessional');
    this.version(1).stores({ notes: '++id,title,content,tags,updatedAt' });
    this.version(2)
      .stores({ notes: '++id,title,updatedAt,pinned' })
      .upgrade((tx) =>
        tx
          .table('notes')
          .toCollection()
          .modify((n: any) => {
            if (n.pinned === undefined) n.pinned = false;
            if (n.createdAt === undefined) n.createdAt = n.updatedAt ?? new Date();
            if (!Array.isArray(n.tags)) n.tags = [];
          })
      );
  }
}

class VaultDB extends Dexie {
  notes!: Table<VaultNote, number>;
  vault!: Table<VaultMeta, number>;
  constructor() {
    super('ScribblingPersonal');
    this.version(1).stores({ notes: '++id,title,content,tags,updatedAt' });
    this.version(2)
      .stores({ notes: '++id,updatedAt,pinned', vault: 'id' })
      .upgrade((tx) =>
        tx
          .table('notes')
          .toCollection()
          .modify((n: any) => {
            if (n.title !== undefined || n.content !== undefined) {
              n._legacyTitle = n.title ?? '';
              n._legacyContent = n.content ?? '';
              n._legacyTags = Array.isArray(n.tags) ? n.tags : [];
            }
            if (n.pinned === undefined) n.pinned = false;
            if (n.createdAt === undefined) n.createdAt = n.updatedAt ?? new Date();
            delete n.title;
            delete n.content;
            delete n.tags;
          })
      );
  }
}

export const dbPro = new ProDB();
export const dbVault = new VaultDB();
