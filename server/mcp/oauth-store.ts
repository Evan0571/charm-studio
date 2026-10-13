import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type MaybePromise<T> = T | Promise<T>;
export interface OAuthPersistence {
  get<T>(kind: string, id: string): MaybePromise<T | undefined>;
  put(kind: string, id: string, value: unknown, ttl?: number): MaybePromise<void>;
  remove(kind: string, id: string): MaybePromise<void>;
  /** Return and delete a live record in one database operation. */
  consume<T>(kind: string, id: string): MaybePromise<T | undefined>;
  checkHealth(): MaybePromise<void>;
  close(): void;
}

/** Local development/desktop storage; cloud deployments use SupabaseOAuthStore. */
export class OAuthStore implements OAuthPersistence {
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
    if (count.n >= 5000 && !this.get(kind, id)) throw new Error('OAuth store capacity reached');
    this.db.prepare('INSERT OR REPLACE INTO oauth_records VALUES (?,?,?,?)').run(kind, id, JSON.stringify(value), ttl === undefined ? null : this.now() + ttl);
  }
  remove(kind: string, id: string) { this.db.prepare('DELETE FROM oauth_records WHERE kind=? AND id=?').run(kind, id); }
  consume<T>(kind: string, id: string): T | undefined {
    const row = this.db.prepare('DELETE FROM oauth_records WHERE kind=? AND id=? AND (expires IS NULL OR expires > ?) RETURNING value').get(kind, id, this.now()) as { value: string } | undefined;
    return row ? JSON.parse(row.value) as T : undefined;
  }
  checkHealth() { this.db.prepare('SELECT id FROM oauth_records LIMIT 0').all(); }
  close() { this.db.close(); }
}

/** Shared, server-only records. Each canonical endpoint has its own namespace. */
export class SupabaseOAuthStore implements OAuthPersistence {
  private client: SupabaseClient;
  constructor(url: string, key: string, private namespace: string, private now = Date.now) {
    this.client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  async get<T>(kind: string, id: string): Promise<T | undefined> {
    const { data, error } = await this.client.from('charm_oauth_records').select('value,expires_at').eq('namespace', this.namespace).eq('kind', kind).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data || (data.expires_at !== null && Date.parse(data.expires_at) <= this.now())) return undefined;
    return data.value as T;
  }
  async put(kind: string, id: string, value: unknown, ttl?: number): Promise<void> {
    const { error } = await this.client.rpc('loop_oauth_put', {
      p_namespace: this.namespace, p_kind: kind, p_id: id, p_value: value,
      p_expires_at: ttl === undefined ? null : new Date(this.now() + ttl).toISOString(),
    });
    if (error) throw error;
  }
  async remove(kind: string, id: string): Promise<void> {
    const { error } = await this.client.from('charm_oauth_records').delete().eq('namespace', this.namespace).eq('kind', kind).eq('id', id);
    if (error) throw error;
  }
  async consume<T>(kind: string, id: string): Promise<T | undefined> {
    // Postgres DELETE ... RETURNING is atomic across every Vercel instance.
    const { data, error } = await this.client.rpc('loop_oauth_consume', { p_namespace: this.namespace, p_kind: kind, p_id: id });
    if (error) throw error;
    return data === null ? undefined : data as T;
  }
  async checkHealth(): Promise<void> {
    const { error } = await this.client.from('charm_oauth_records').select('id').limit(0);
    if (error) throw error;
  }
  close() { /* The HTTP database client holds no local file or session. */ }
}
