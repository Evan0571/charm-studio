import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

/** Small persistent store for this single-process demo's OAuth clients and grants. */
export class OAuthStore {
  private db: DatabaseSync;
  constructor(path = ':memory:', private now = Date.now) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.db.exec('CREATE TABLE IF NOT EXISTS oauth_records (kind TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, expires INTEGER, PRIMARY KEY(kind,id))');
  }
  get<T>(kind: string, id: string): T | undefined {
    const row = this.db.prepare('SELECT value, expires FROM oauth_records WHERE kind=? AND id=?').get(kind, id) as { value: string; expires: number | null } | undefined;
    if (!row || (row.expires !== null && row.expires <= this.now())) return undefined;
    return JSON.parse(row.value) as T;
  }
  put(kind: string, id: string, value: unknown, ttl?: number) {
    this.db.prepare('DELETE FROM oauth_records WHERE expires IS NOT NULL AND expires <= ?').run(this.now());
    const count = this.db.prepare('SELECT COUNT(*) AS n FROM oauth_records').get() as { n: number };
    if (count.n >= 5000) throw new Error('OAuth store capacity reached');
    this.db.prepare('INSERT OR REPLACE INTO oauth_records VALUES (?,?,?,?)').run(kind, id, JSON.stringify(value), ttl === undefined ? null : this.now() + ttl);
  }
  remove(kind: string, id: string) { this.db.prepare('DELETE FROM oauth_records WHERE kind=? AND id=?').run(kind, id); }
  close() { this.db.close(); }
}
